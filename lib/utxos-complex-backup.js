/*
  This library manages UTXO data for XEC wallets using Chronik client.
  Enhanced with advanced UTXO classification, health monitoring, and privacy analysis.
*/

const UtxoClassifier = require('./utxo-analytics/UtxoClassifier')
const UtxoHealthMonitor = require('./utxo-analytics/UtxoHealthMonitor')
const PrivacyScorer = require('./utxo-analytics/PrivacyScorer')

class Utxos {
  constructor (localConfig = {}) {
    this.chronik = localConfig.chronik
    this.ar = localConfig.ar

    if (!this.ar) {
      throw new Error('AdapterRouter instance required for UTXO management')
    }

    // UTXO store to hold cached data (XEC-only for Phase 1)
    this.utxoStore = {
      xecUtxos: [],
      lastUpdated: null,
      classifications: new Map(), // UTXO ID -> Classification
      healthAssessments: new Map(), // UTXO ID -> Health Assessment
      privacyScores: new Map() // UTXO ID -> Privacy Score
    }

    // Advanced UTXO analytics components
    this.classifier = new UtxoClassifier(localConfig.classifierConfig)
    this.healthMonitor = new UtxoHealthMonitor(localConfig.healthConfig)
    this.privacyScorer = new PrivacyScorer(localConfig.privacyConfig)

    // Performance tracking
    this.performanceMetrics = {
      cacheHitRate: 0,
      totalRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastRefreshTime: null,
      analyticsTime: 0 // Time spent on classification/health/privacy analysis
    }

    // Configuration
    this.maxRetries = localConfig.maxRetries || 3
    this.retryDelay = localConfig.retryDelay || 1000
    this.cacheTimeout = localConfig.cacheTimeout || 30000 // 30 seconds
    this.dustLimit = localConfig.dustLimit || 546 // XEC dust limit
    this.enableAnalytics = localConfig.enableAnalytics !== false // Default enabled
    this.currentBlockHeight = localConfig.currentBlockHeight || 0
  }

  // Helper method to extract value from UTXO (handles both sats and value properties)
  _getUtxoValue (utxo) {
    // Handle both string and BigInt sats values from Chronik API
    const satoshis = utxo.sats || utxo.value || 0
    if (typeof satoshis === 'bigint') {
      return Number(satoshis)
    } else if (typeof satoshis === 'string') {
      return parseInt(satoshis) || 0
    } else {
      return parseInt(satoshis) || 0
    }
  }

  async initUtxoStore (addr, forceRefresh = false) {
    try {
      this.performanceMetrics.totalRequests++
      const startTime = Date.now()

      // Check if cache is still valid
      if (!forceRefresh && this._isCacheValid(addr)) {
        this.performanceMetrics.cacheHits++
        return true
      }

      // Fetch fresh UTXO data
      const utxosResult = await this._fetchUtxosWithRetry(addr)

      // Process and store UTXOs
      await this._processUtxos(utxosResult, addr)

      // Update performance metrics
      const responseTime = Date.now() - startTime
      this._updatePerformanceMetrics(responseTime)

      this.utxoStore.lastUpdated = Date.now()

      return true
    } catch (err) {
      throw new Error(`UTXO store initialization failed: ${err.message}`)
    }
  }

  async _fetchUtxosWithRetry (addr, maxRetries = this.maxRetries) {
    let lastError
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        attempt++

        // Use exponential backoff for retries
        if (attempt > 1) {
          const delay = this.retryDelay * Math.pow(2, attempt - 2)
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        const result = await this.ar.getUtxos(addr)

        if (!result || !result.utxos) {
          throw new Error('Invalid UTXO response format')
        }

        return result
      } catch (err) {
        lastError = err

        if (attempt >= maxRetries) {
          break
        }

        // Log retry attempt (in production, use proper logging)
        // Suppress console output during test execution
        if (process.env.NODE_ENV !== 'test' && process.env.TEST !== 'unit') {
          console.warn(`UTXO fetch attempt ${attempt} failed: ${err.message}. Retrying...`)
        }
      }
    }

    throw new Error(`UTXO fetch failed after ${maxRetries} attempts: ${lastError.message}`)
  }

  async _processUtxos (utxosResult, addr) {
    try {
      const analyticsStartTime = Date.now()

      // Reset XEC UTXO store
      this.utxoStore.xecUtxos = []
      this.utxoStore.classifications.clear()
      this.utxoStore.healthAssessments.clear()
      this.utxoStore.privacyScores.clear()

      const validUtxos = []

      // Process each UTXO
      for (const utxo of utxosResult.utxos) {
        // Validate UTXO structure
        if (!this._isValidUtxo(utxo)) {
          continue
        }

        // Filter out dust UTXOs if configured
        if (this._getUtxoValue(utxo) < this.dustLimit) {
          continue
        }

        // Phase 1: XEC-only UTXO processing (tokens deferred to future phases)
        this.utxoStore.xecUtxos.push(utxo)
        validUtxos.push(utxo)
      }

      // Sort UTXOs by value (descending for optimal coin selection)
      this.utxoStore.xecUtxos.sort((a, b) => this._getUtxoValue(b) - this._getUtxoValue(a))

      // Perform advanced analytics if enabled
      if (this.enableAnalytics && validUtxos.length > 0) {
        await this._performUtxoAnalytics(validUtxos, addr)
      }

      // Update analytics performance metrics
      const analyticsTime = Date.now() - analyticsStartTime
      this.performanceMetrics.analyticsTime = analyticsTime
    } catch (err) {
      throw new Error(`UTXO processing failed: ${err.message}`)
    }
  }

  _isValidUtxo (utxo) {
    return (
      utxo &&
      utxo.outpoint &&
      typeof utxo.outpoint.txid === 'string' &&
      typeof utxo.outpoint.outIdx === 'number' &&
      typeof this._getUtxoValue(utxo) === 'number' &&
      this._getUtxoValue(utxo) > 0
    )
  }

  // Token operations deferred to future phases - XEC-only for Phase 1
  getSpendableETokenUtxos () {
    // Phase 1: XEC-only implementation - eToken support deferred to future phases
    return []
  }

  getSpendableXecUtxos (options = {}) {
    const {
      includeUnconfirmed = false,
      minHealthScore = 0,
      minPrivacyScore = 0,
      excludeSuspicious = false
    } = options

    // Return XEC UTXOs that can be spent with optional filtering
    return this.utxoStore.xecUtxos.filter(utxo => {
      // Basic spendability checks
      if (this._getUtxoValue(utxo) < this.dustLimit) return false
      if (!includeUnconfirmed && utxo.blockHeight === -1) return false

      // Advanced filtering if analytics are enabled
      if (this.enableAnalytics) {
        const utxoId = `${utxo.outpoint.txid}:${utxo.outpoint.outIdx}`

        // Health score filtering
        if (minHealthScore > 0) {
          const healthAssessment = this.utxoStore.healthAssessments.get(utxoId)
          if (!healthAssessment || healthAssessment.healthScore < minHealthScore) {
            return false
          }
        }

        // Privacy score filtering
        if (minPrivacyScore > 0) {
          const privacyScore = this.utxoStore.privacyScores.get(utxoId)
          if (!privacyScore || privacyScore.privacyScore < minPrivacyScore) {
            return false
          }
        }

        // Exclude suspicious UTXOs
        if (excludeSuspicious) {
          const healthAssessment = this.utxoStore.healthAssessments.get(utxoId)
          if (healthAssessment && healthAssessment.status === 'suspicious') {
            return false
          }
        }
      }

      return true
    })
  }

  getPerformanceMetrics () {
    // Calculate cache hit rate
    this.performanceMetrics.cacheHitRate =
      this.performanceMetrics.totalRequests > 0
        ? (this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests) * 100
        : 0

    return {
      cacheHitRate: Math.round(this.performanceMetrics.cacheHitRate * 100) / 100,
      totalRequests: this.performanceMetrics.totalRequests,
      cacheHits: this.performanceMetrics.cacheHits,
      averageResponseTime: Math.round(this.performanceMetrics.averageResponseTime),
      lastRefreshTime: this.performanceMetrics.lastRefreshTime,
      analyticsTime: this.performanceMetrics.analyticsTime || 0,
      utxoCount: {
        xec: this.utxoStore.xecUtxos.length
      }
    }
  }

  async refreshCache (addr) {
    try {
      return await this.initUtxoStore(addr, true)
    } catch (err) {
      throw new Error(`Cache refresh failed: ${err.message}`)
    }
  }

  clearCache () {
    this.utxoStore = {
      xecUtxos: [],
      lastUpdated: null,
      classifications: new Map(),
      healthAssessments: new Map(),
      privacyScores: new Map()
    }

    // Reset performance metrics
    this.performanceMetrics = {
      cacheHitRate: 0,
      totalRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastRefreshTime: null
    }
  }

  // Utility methods for coin selection and UTXO management

  _filterDustUtxos (utxos, dustLimit = this.dustLimit) {
    return utxos.filter(utxo => this._getUtxoValue(utxo) >= dustLimit)
  }

  _sortUtxosByValue (utxos, order = 'descending') {
    const sorted = [...utxos]

    if (order === 'ascending') {
      return sorted.sort((a, b) => this._getUtxoValue(a) - this._getUtxoValue(b))
    } else {
      return sorted.sort((a, b) => this._getUtxoValue(b) - this._getUtxoValue(a))
    }
  }

  selectUtxosForAmount (targetAmount, satsPerByte = 1.0) {
    try {
      const availableUtxos = this.getSpendableXecUtxos()

      if (availableUtxos.length === 0) {
        throw new Error('No spendable UTXOs available')
      }

      // Sort UTXOs by size (largest first for efficiency)
      const sortedUtxos = this._sortUtxosByValue(availableUtxos, 'descending')

      const selectedUtxos = []
      let totalAmount = 0
      let estimatedFee = 0

      for (const utxo of sortedUtxos) {
        selectedUtxos.push(utxo)
        totalAmount += this._getUtxoValue(utxo)

        // Estimate fee based on transaction size
        const numInputs = selectedUtxos.length
        const numOutputs = 2 // Assume 1 output + 1 change
        estimatedFee = this._calculateFee(numInputs, numOutputs, satsPerByte)

        // Check if we have enough for target amount + fee
        if (totalAmount >= targetAmount + estimatedFee) {
          const change = totalAmount - targetAmount - estimatedFee

          return {
            selectedUtxos,
            totalAmount,
            estimatedFee,
            change: change > this.dustLimit ? change : 0
          }
        }
      }

      throw new Error(`Insufficient funds. Need: ${targetAmount + estimatedFee}, Available: ${totalAmount}`)
    } catch (err) {
      throw new Error(`UTXO selection failed: ${err.message}`)
    }
  }

  _calculateFee (numInputs, numOutputs, satsPerByte) {
    // Estimate transaction size in bytes
    // Input: ~148 bytes each, Output: ~34 bytes each, overhead: ~10 bytes
    const estimatedSize = (numInputs * 148) + (numOutputs * 34) + 10
    return Math.ceil(estimatedSize * satsPerByte)
  }

  getTotalBalance () {
    const xecUtxos = this.utxoStore.xecUtxos
    let confirmed = 0
    let unconfirmed = 0

    for (const utxo of xecUtxos) {
      if (utxo.blockHeight === -1) {
        unconfirmed += this._getUtxoValue(utxo)
      } else {
        confirmed += this._getUtxoValue(utxo)
      }
    }

    return {
      confirmed,
      unconfirmed,
      total: confirmed + unconfirmed
    }
  }

  // Helper methods

  _isCacheValid (addr) {
    if (!this.utxoStore.lastUpdated) {
      return false
    }

    const timeSinceUpdate = Date.now() - this.utxoStore.lastUpdated
    return timeSinceUpdate < this.cacheTimeout
  }

  _updatePerformanceMetrics (responseTime) {
    this.performanceMetrics.totalResponseTime += responseTime
    this.performanceMetrics.averageResponseTime =
      this.performanceMetrics.totalResponseTime / this.performanceMetrics.totalRequests
    this.performanceMetrics.lastRefreshTime = Date.now()
  }

  // Advanced UTXO Analytics Methods

  async _performUtxoAnalytics (utxos, address) {
    try {
      // Parallel execution of analytics for performance
      const [classifications, healthReport, privacyAnalysis] = await Promise.all([
        this._classifyUtxos(utxos),
        this._assessUtxoHealth(utxos),
        this._analyzeUtxoPrivacy(utxos, address)
      ])

      // Store results in cache
      for (const [utxoId, classification] of classifications) {
        this.utxoStore.classifications.set(utxoId, classification)
      }

      for (const [utxoId, healthAssessment] of healthReport.assessments) {
        this.utxoStore.healthAssessments.set(utxoId, healthAssessment)
      }

      for (const [utxoId, privacyScore] of privacyAnalysis.assessments) {
        this.utxoStore.privacyScores.set(utxoId, privacyScore)
      }

      return {
        classifications,
        healthReport,
        privacyAnalysis
      }
    } catch (err) {
      // Analytics failure shouldn't break UTXO management
      console.warn('UTXO analytics failed:', err.message)
      return null
    }
  }

  async _classifyUtxos (utxos) {
    try {
      return this.classifier.classifyUtxos(utxos, this.currentBlockHeight)
    } catch (err) {
      console.warn('UTXO classification failed:', err.message)
      return new Map()
    }
  }

  async _assessUtxoHealth (utxos) {
    try {
      // Estimate current fee rate - in production, would fetch from network
      const currentFeeRate = 1.2 // Default fee rate
      return this.healthMonitor.monitorUtxoSet(utxos, this.utxoStore.classifications, currentFeeRate)
    } catch (err) {
      console.warn('UTXO health assessment failed:', err.message)
      return { assessments: new Map(), summary: {}, alerts: [] }
    }
  }

  async _analyzeUtxoPrivacy (utxos, address) {
    try {
      const context = {
        address,
        currentBlockHeight: this.currentBlockHeight,
        recentUtxos: utxos.filter(utxo => utxo.blockHeight === -1), // Unconfirmed as recent
        addressDiversity: 0.5 // Placeholder - would calculate from transaction history
      }

      return this.privacyScorer.analyzeWalletPrivacy(utxos, this.utxoStore.classifications, context)
    } catch (err) {
      console.warn('UTXO privacy analysis failed:', err.message)
      return { assessments: new Map(), summary: {}, recommendations: [] }
    }
  }

  // Public Analytics Interface

  getUtxoClassification (txid, outIdx) {
    const utxoId = `${txid}:${outIdx}`
    return this.utxoStore.classifications.get(utxoId)
  }

  getUtxoHealthAssessment (txid, outIdx) {
    const utxoId = `${txid}:${outIdx}`
    return this.utxoStore.healthAssessments.get(utxoId)
  }

  getUtxoPrivacyScore (txid, outIdx) {
    const utxoId = `${txid}:${outIdx}`
    return this.utxoStore.privacyScores.get(utxoId)
  }

  getAllClassifications () {
    return new Map(this.utxoStore.classifications)
  }

  getAllHealthAssessments () {
    return new Map(this.utxoStore.healthAssessments)
  }

  getAllPrivacyScores () {
    return new Map(this.utxoStore.privacyScores)
  }

  getAnalyticsSummary () {
    const classifications = this.utxoStore.classifications
    const healthAssessments = this.utxoStore.healthAssessments
    const privacyScores = this.utxoStore.privacyScores

    if (classifications.size === 0) {
      return { enabled: this.enableAnalytics, available: false }
    }

    // Calculate summary statistics
    const classificationStats = this.classifier.getClassificationStats(classifications)

    const healthScores = Array.from(healthAssessments.values()).map(h => h.healthScore)
    const avgHealthScore = healthScores.length > 0
      ? Math.round(healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length)
      : 0

    const privacyScoreValues = Array.from(privacyScores.values()).map(p => p.privacyScore)
    const avgPrivacyScore = privacyScoreValues.length > 0
      ? Math.round(privacyScoreValues.reduce((sum, score) => sum + score, 0) / privacyScoreValues.length)
      : 0

    const healthyUtxos = Array.from(healthAssessments.values()).filter(h => h.status === 'healthy').length
    const suspiciousUtxos = Array.from(healthAssessments.values()).filter(h => h.status === 'suspicious').length
    const highPrivacyUtxos = Array.from(privacyScores.values()).filter(p => p.privacyScore >= 80).length

    return {
      enabled: this.enableAnalytics,
      available: true,
      totalUtxos: this.utxoStore.xecUtxos.length,

      // Classification summary
      valueDistribution: classificationStats.byValue,
      ageDistribution: classificationStats.byAge,
      healthDistribution: classificationStats.byHealth,

      // Health summary
      averageHealthScore: avgHealthScore,
      healthyUtxos,
      suspiciousUtxos,

      // Privacy summary
      averagePrivacyScore: avgPrivacyScore,
      highPrivacyUtxos,
      lowPrivacyUtxos: privacyScoreValues.filter(score => score < 50).length,

      // Performance
      analyticsTime: this.performanceMetrics.analyticsTime
    }
  }

  // Advanced UTXO Selection with Analytics

  selectOptimalUtxos (targetAmount, options = {}) {
    const {
      prioritizeHealth = true,
      prioritizePrivacy = false,
      avoidSuspicious = true,
      satsPerByte = 1.0
    } = options

    try {
      const filterOptions = {
        includeUnconfirmed: options.includeUnconfirmed || false,
        minHealthScore: prioritizeHealth ? 50 : 0,
        minPrivacyScore: prioritizePrivacy ? 50 : 0,
        excludeSuspicious: avoidSuspicious
      }

      const availableUtxos = this.getSpendableXecUtxos(filterOptions)

      if (availableUtxos.length === 0) {
        throw new Error('No suitable UTXOs available for selection')
      }

      // Enhanced sorting based on analytics
      const sortedUtxos = this._sortUtxosForOptimalSelection(availableUtxos, {
        prioritizeHealth,
        prioritizePrivacy
      })

      return this._performCoinSelection(sortedUtxos, targetAmount, satsPerByte)
    } catch (err) {
      // Fallback to basic selection if analytics-enhanced selection fails
      console.warn('Optimal UTXO selection failed, falling back to basic selection:', err.message)
      return this.selectUtxosForAmount(targetAmount, satsPerByte)
    }
  }

  _sortUtxosForOptimalSelection (utxos, options = {}) {
    const { prioritizeHealth = false, prioritizePrivacy = false } = options

    return [...utxos].sort((a, b) => {
      // Get analytics data for sorting
      const aId = `${a.outpoint.txid}:${a.outpoint.outIdx}`
      const bId = `${b.outpoint.txid}:${b.outpoint.outIdx}`

      const aHealth = this.utxoStore.healthAssessments.get(aId)
      const bHealth = this.utxoStore.healthAssessments.get(bId)
      const aPrivacy = this.utxoStore.privacyScores.get(aId)
      const bPrivacy = this.utxoStore.privacyScores.get(bId)

      // Calculate composite score
      let aScore = this._getUtxoValue(a) // Base score on value
      let bScore = this._getUtxoValue(b)

      if (prioritizeHealth && aHealth && bHealth) {
        aScore += aHealth.healthScore * 1000 // Health bonus
        bScore += bHealth.healthScore * 1000
      }

      if (prioritizePrivacy && aPrivacy && bPrivacy) {
        aScore += aPrivacy.privacyScore * 500 // Privacy bonus
        bScore += bPrivacy.privacyScore * 500
      }

      return bScore - aScore // Descending order
    })
  }

  _performCoinSelection (utxos, targetAmount, satsPerByte) {
    // Enhanced coin selection algorithm (Phase 2 will implement BnB and Knapsack)
    const selectedUtxos = []
    let totalAmount = 0
    let estimatedFee = 0

    for (const utxo of utxos) {
      selectedUtxos.push(utxo)
      totalAmount += this._getUtxoValue(utxo)

      // Calculate fee for current selection
      const numInputs = selectedUtxos.length
      const numOutputs = 2 // Assume 1 output + 1 change
      estimatedFee = this._calculateFee(numInputs, numOutputs, satsPerByte)

      // Check if we have enough
      if (totalAmount >= targetAmount + estimatedFee) {
        const change = totalAmount - targetAmount - estimatedFee

        return {
          selectedUtxos,
          totalAmount,
          estimatedFee,
          change: change > this.dustLimit ? change : 0
        }
      }
    }

    throw new Error(`Insufficient funds. Need: ${targetAmount + estimatedFee}, Available: ${totalAmount}`)
  }

  // Configuration Management

  updateCurrentBlockHeight (blockHeight) {
    this.currentBlockHeight = blockHeight

    // Trigger re-classification if UTXOs are loaded and block height changed significantly
    if (this.utxoStore.xecUtxos.length > 0 && this.enableAnalytics) {
      // Re-classify if block height increased by more than 144 blocks (1 day)
      const lastClassification = Array.from(this.utxoStore.classifications.values())[0]
      if (!lastClassification || !lastClassification.lastUpdated ||
          Date.now() - lastClassification.lastUpdated > 24 * 60 * 60 * 1000) {
        // Trigger background re-classification
        this._performUtxoAnalytics(this.utxoStore.xecUtxos, null).catch(err => {
          console.warn('Background re-classification failed:', err.message)
        })
      }
    }
  }

  enableAnalytics (enable = true) {
    this.enableAnalytics = enable

    if (!enable) {
      // Clear analytics data if disabled
      this.utxoStore.classifications.clear()
      this.utxoStore.healthAssessments.clear()
      this.utxoStore.privacyScores.clear()
    }
  }

  // Maintenance and Cleanup

  clearAnalyticsCache () {
    this.utxoStore.classifications.clear()
    this.utxoStore.healthAssessments.clear()
    this.utxoStore.privacyScores.clear()

    // Clear analytics component histories
    this.healthMonitor.clearAlerts()
    this.privacyScorer.clearAnalysisHistory()
  }

  // Analytics Control Methods

  /**
   * Enable or disable UTXO analytics
   * @param {boolean} enable - Whether to enable analytics
   */
  setAnalyticsEnabled (enable = true) {
    this.enableAnalytics = enable

    if (!enable) {
      this.clearAnalyticsCache()
    }
  }

  /**
   * Check if analytics are enabled
   * @returns {boolean} - True if analytics are enabled
   */
  isAnalyticsEnabled () {
    return this.enableAnalytics !== false
  }
}

module.exports = Utxos
