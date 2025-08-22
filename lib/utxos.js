/*
  Enhanced UTXO management for minimal XEC wallet

  Core functionality:
  - Fetch UTXOs from chronik
  - Basic validation and filtering
  - Simple caching
  - Essential security checks

  Advanced analytics (optional):
  - UTXO classification (age, value, privacy analysis)
  - Health monitoring and dust attack detection
  - Smart coin selection strategies
  - Optimization recommendations
*/

const SecurityValidator = require('./security')

// Optional analytics modules (loaded only when enabled)
let UtxoClassifier, UtxoHealthMonitor
try {
  UtxoClassifier = require('./utxo-analytics/UtxoClassifier')
  UtxoHealthMonitor = require('./utxo-analytics/UtxoHealthMonitor')
} catch (error) {
  // Analytics modules not available - continue with basic functionality
}

class Utxos {
  constructor (localConfig = {}) {
    this.chronik = localConfig.chronik
    this.ar = localConfig.ar

    if (!this.ar) {
      throw new Error('AdapterRouter instance required for UTXO management')
    }

    // Simple UTXO store
    this.utxoStore = {
      xecUtxos: [],
      lastUpdated: null,
      cacheKey: null
    }

    // Security validator
    this.security = new SecurityValidator(localConfig.security)

    // Simple configuration
    this.maxRetries = localConfig.maxRetries || 3
    this.retryDelay = localConfig.retryDelay || 1000
    this.cacheTimeout = localConfig.cacheTimeout || 30000 // 30 seconds

    // Analytics configuration
    this.analyticsConfig = localConfig.utxoAnalytics || { enabled: false }
    this.analyticsEnabled = !!(this.analyticsConfig.enabled && UtxoClassifier && UtxoHealthMonitor)

    // Initialize analytics modules if enabled
    this.classifier = null
    this.healthMonitor = null
    this.classifications = new Map()
    this.lastHealthReport = null

    if (this.analyticsEnabled) {
      try {
        this.classifier = new UtxoClassifier(this.analyticsConfig.classification)
        this.healthMonitor = new UtxoHealthMonitor(this.analyticsConfig.health)

        if (this.analyticsConfig.debug) {
          console.log('UTXO analytics enabled')
        }
      } catch (error) {
        console.warn('Failed to initialize UTXO analytics:', error.message)
        this.analyticsEnabled = false
      }
    }

    // Performance tracking (basic)
    this.performanceMetrics = {
      totalRequests: 0,
      cacheHits: 0,
      lastRefreshTime: null,
      totalResponseTime: 0,
      averageResponseTime: 0,
      analyticsTime: 0
    }
  }

  /**
   * Initialize UTXO store for an address
   * @param {string} addr - XEC address
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {boolean} - Success status
   */
  async initUtxoStore (addr, forceRefresh = false) {
    try {
      this.performanceMetrics.totalRequests++

      // Check cache validity
      if (!forceRefresh && this._isCacheValid(addr)) {
        this.performanceMetrics.cacheHits++
        return true
      }

      // Fetch fresh UTXO data
      const utxosResult = await this._fetchUtxosWithRetry(addr)

      // Process and store UTXOs
      this._processUtxos(utxosResult, addr)

      // Perform analytics if enabled
      if (this.analyticsEnabled) {
        await this._performAnalytics()
      }

      return true
    } catch (err) {
      throw new Error(`UTXO initialization failed: ${err.message}`)
    }
  }

  /**
   * Get spendable XEC UTXOs with enhanced filtering
   * @param {Object} options - Filtering options
   * @returns {Array} - Filtered UTXOs
   */
  getSpendableXecUtxos (options = {}) {
    const {
      includeUnconfirmed = false,
      excludeDustAttack = true,
      useClassifications = false,
      minHealthScore = 0,
      minPrivacyScore = 0,
      strategy = 'default'
    } = options

    let filteredUtxos = this.security.filterSecureUtxos(this.utxoStore.xecUtxos, {
      includeUnconfirmed,
      excludeDustAttack
    })

    // Apply classification-based filtering if analytics enabled
    if (useClassifications && this.analyticsEnabled && this.classifications.size > 0) {
      filteredUtxos = this._filterByClassifications(filteredUtxos, {
        minHealthScore,
        minPrivacyScore,
        strategy
      })
    }

    return {
      utxos: filteredUtxos,
      total: filteredUtxos.length,
      analyticsEnabled: this.analyticsEnabled
    }
  }

  /**
   * Enhanced UTXO selection with smart strategies
   * @param {number} targetAmount - Target amount in satoshis
   * @param {Object} options - Selection options
   * @returns {Object} - Selection result
   */
  selectOptimalUtxos (targetAmount, options = {}) {
    const {
      strategy = 'efficient',
      useClassifications = true,
      feeRate = 1.0
    } = options

    // Get spendable UTXOs with classification filtering if enabled
    const spendableUtxosResult = this.getSpendableXecUtxos({
      ...options,
      useClassifications: useClassifications && this.analyticsEnabled
    })

    const spendableUtxos = spendableUtxosResult.utxos || spendableUtxosResult

    if (spendableUtxos.length === 0) {
      throw new Error('No spendable UTXOs available')
    }

    // Use smart selection if classifications available
    if (useClassifications && this.analyticsEnabled && this.classifications.size > 0) {
      const result = this._selectWithClassifications(spendableUtxos, targetAmount, strategy, feeRate)
      result.strategy = strategy
      return result
    }

    // Fallback to basic selection
    const result = this._selectBasic(spendableUtxos, targetAmount, feeRate)
    result.strategy = strategy
    return result
  }

  /**
   * Get current balance
   * @returns {Object} - Balance information
   */
  getBalance () {
    const utxos = this.utxoStore.xecUtxos
    let confirmed = 0
    let unconfirmed = 0

    utxos.forEach(utxo => {
      const value = this._getUtxoValue(utxo)
      if (utxo.blockHeight === -1) {
        unconfirmed += value
      } else {
        confirmed += value
      }
    })

    return {
      confirmed,
      unconfirmed,
      total: confirmed + unconfirmed
    }
  }

  /**
   * Clear cache
   */
  clearCache () {
    this.utxoStore = {
      xecUtxos: [],
      lastUpdated: null,
      cacheKey: null
    }
  }

  /**
   * Get spendable eToken UTXOs (Phase 2 - not implemented)
   * @returns {Array} - Empty array for Phase 1
   */
  getSpendableETokenUtxos () {
    return []
  }

  /**
   * Refresh cache for address
   * @param {string} addr - Address to refresh
   * @returns {boolean} - Success status
   */
  async refreshCache (addr) {
    return await this.initUtxoStore(addr, true)
  }

  /**
   * Filter dust UTXOs (legacy method)
   * @param {Array} utxos - UTXOs to filter
   * @returns {Array} - Non-dust UTXOs
   */
  _filterDustUtxos (utxos) {
    return utxos.filter(utxo => this._getUtxoValue(utxo) >= 1000)
  }

  /**
   * Sort UTXOs by value (legacy method)
   * @param {Array} utxos - UTXOs to sort
   * @param {string} order - 'asc' or 'desc'
   * @returns {Array} - Sorted UTXOs
   */
  _sortUtxosByValue (utxos, order = 'desc') {
    return [...utxos].sort((a, b) => {
      const aValue = this._getUtxoValue(a)
      const bValue = this._getUtxoValue(b)
      return order === 'desc' ? bValue - aValue : aValue - bValue
    })
  }

  // Analytics Methods (available when analytics enabled)

  /**
   * Get UTXO classifications with aggregated statistics
   * @returns {Object} - Classification statistics and data
   */
  getUtxoClassifications () {
    if (!this.analyticsEnabled) {
      throw new Error('UTXO analytics not enabled')
    }

    const stats = this.classifier.getClassificationStats(this.classifications)
    const byPrivacy = Array.from(this.classifications.values())
      .sort((a, b) => b.privacy - a.privacy)
      .slice(0, 10) // Top 10 most private UTXOs

    return {
      byAge: stats.byAge,
      byValue: stats.byValue,
      byPrivacy: byPrivacy,
      statistics: {
        totalUtxos: stats.total,
        totalValue: stats.totalValue,
        averageAge: stats.averageAgeScore,
        averageValue: stats.averageValueScore,
        averagePrivacyScore: stats.averagePrivacyScore
      }
    }
  }

  /**
   * Get comprehensive wallet health report
   * @param {number} currentFeeRate - Current network fee rate
   * @returns {Object} - Health report
   */
  getWalletHealthReport (currentFeeRate = 1.0) {
    if (!this.analyticsEnabled) {
      throw new Error('UTXO analytics not enabled')
    }

    if (!this.lastHealthReport || this._shouldRefreshHealthReport()) {
      const rawReport = this.healthMonitor.monitorUtxoSet(
        this.utxoStore.xecUtxos,
        this.classifications,
        currentFeeRate
      )

      // Add overall health assessment
      const healthyPercentage = rawReport.summary.healthPercentage || 0
      let overallHealth = 'critical'
      if (healthyPercentage >= 80) overallHealth = 'healthy'
      else if (healthyPercentage >= 60) overallHealth = 'good'
      else if (healthyPercentage >= 40) overallHealth = 'fair'
      else if (healthyPercentage >= 20) overallHealth = 'poor'

      this.lastHealthReport = {
        overallHealth,
        metrics: {
          totalUtxos: rawReport.summary.total,
          healthyUtxos: rawReport.summary.healthy,
          unhealthyUtxos: rawReport.summary.unhealthy,
          dustUtxos: rawReport.summary.dust,
          suspiciousUtxos: rawReport.summary.suspicious
        },
        alerts: rawReport.alerts,
        recommendations: rawReport.recommendations,
        summary: rawReport.summary,
        assessments: rawReport.assessments
      }
    }

    return this.lastHealthReport
  }

  /**
   * Get optimization recommendations
   * @param {number} currentFeeRate - Current network fee rate
   * @returns {Object} - Optimization recommendations
   */
  getOptimizationRecommendations (currentFeeRate = 1.0) {
    if (!this.analyticsEnabled) {
      throw new Error('UTXO analytics not enabled')
    }

    const rawRecommendations = this.healthMonitor.generateOptimizationRecommendations(
      this.utxoStore.xecUtxos,
      currentFeeRate
    )

    // Transform to expected format
    const lowPrivacyUtxos = Array.from(this.classifications.values())
      .filter(c => c.privacy < 60)
      .map(c => c.id)

    return {
      consolidation: {
        ...rawRecommendations.consolidation,
        estimatedSavings: rawRecommendations.consolidation.longTermSavings || 0
      },
      privacy: {
        lowPrivacyUtxos: lowPrivacyUtxos,
        recommendations: rawRecommendations.recommendations.filter(r => r.type === 'privacy')
      },
      efficiency: {
        dustUtxos: rawRecommendations.analysis.dustUtxos,
        fragmentedValue: rawRecommendations.analysis.fragmentationScore
      }
    }
  }

  /**
   * Detect potential dust attacks
   * @param {string} address - Wallet address
   * @returns {Object} - Dust attack analysis
   */
  detectSecurityThreats (address) {
    if (!this.analyticsEnabled) {
      throw new Error('UTXO analytics not enabled')
    }

    const dustAttackResult = this.healthMonitor.detectDustAttack(this.utxoStore.xecUtxos, address)

    return {
      dustAttack: {
        detected: dustAttackResult.severity !== 'none',
        suspiciousUtxos: dustAttackResult.utxos || [],
        confidence: this._calculateConfidence(dustAttackResult.severity)
      },
      suspiciousPatterns: dustAttackResult.indicators || [],
      riskLevel: this._mapSeverityToRiskLevel(dustAttackResult.severity)
    }
  }

  _calculateConfidence (severity) {
    switch (severity) {
      case 'critical': return 90
      case 'high': return 75
      case 'medium': return 60
      case 'low': return 40
      default: return 0
    }
  }

  _mapSeverityToRiskLevel (severity) {
    switch (severity) {
      case 'critical': return 'critical'
      case 'high': return 'high'
      case 'medium': return 'medium'
      default: return 'low'
    }
  }

  /**
   * Get classification statistics
   * @returns {Object} - Classification statistics
   */
  getClassificationStats () {
    if (!this.analyticsEnabled) {
      throw new Error('UTXO analytics not enabled')
    }

    return this.classifier.getClassificationStats(this.classifications)
  }

  /**
   * Check if analytics features are available
   * @returns {boolean} - True if analytics enabled
   */
  hasAnalytics () {
    return this.analyticsEnabled
  }

  /**
   * Get performance metrics including analytics timing
   * @returns {Object} - Enhanced performance data
   */
  getPerformanceMetrics () {
    const baseMetrics = this._getBasePerformanceMetrics()

    if (this.analyticsEnabled) {
      baseMetrics.analyticsEnabled = true
      baseMetrics.classificationsCount = this.classifications.size
      baseMetrics.analyticsTime = this.performanceMetrics.analyticsTime
      baseMetrics.lastAnalyticsRun = this.lastHealthReport?.lastScan || null
    } else {
      baseMetrics.analyticsEnabled = false
    }

    return baseMetrics
  }

  // Private methods

  async _fetchUtxosWithRetry (addr, maxRetries = null) {
    const retryLimit = maxRetries || this.maxRetries
    let attempt = 1

    while (attempt <= retryLimit) {
      try {
        const utxosResult = await this.ar.getUtxos(addr)
        return utxosResult
      } catch (err) {
        if (attempt === retryLimit) {
          throw new Error(`Failed to fetch UTXOs after ${retryLimit} attempts: ${err.message}`)
        }

        await this._delay(this.retryDelay * attempt)
        attempt++
      }
    }
  }

  _processUtxos (utxosResult, addr) {
    if (!utxosResult || !Array.isArray(utxosResult.utxos)) {
      throw new Error('Invalid UTXO response format')
    }

    // Filter and validate UTXOs
    const validUtxos = utxosResult.utxos.filter(utxo => this._isValidUtxo(utxo))

    // Store UTXOs
    this.utxoStore.xecUtxos = validUtxos
    this.utxoStore.lastUpdated = Date.now()
    this.utxoStore.cacheKey = addr
    this.performanceMetrics.lastRefreshTime = Date.now()
  }

  _isValidUtxo (utxo) {
    return this.security.isValidUtxoStructure(utxo) && this._getUtxoValue(utxo) > 0
  }

  _getUtxoValue (utxo) {
    if (utxo.sats !== undefined) {
      return typeof utxo.sats === 'bigint' ? Number(utxo.sats) : parseInt(utxo.sats)
    }
    if (utxo.value !== undefined) {
      return typeof utxo.value === 'bigint' ? Number(utxo.value) : parseInt(utxo.value)
    }
    return 0
  }

  _isCacheValid (addr) {
    return (
      this.utxoStore.cacheKey === addr &&
      this.utxoStore.lastUpdated &&
      (Date.now() - this.utxoStore.lastUpdated) < this.cacheTimeout
    )
  }

  _delay (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Analytics Private Methods

  /**
   * Perform UTXO analytics (classification and health monitoring)
   * @private
   */
  async _performAnalytics () {
    if (!this.analyticsEnabled || this.utxoStore.xecUtxos.length === 0) {
      return
    }

    try {
      const startTime = Date.now()

      // Get current block height for age calculations (placeholder - needs real implementation)
      const currentBlockHeight = await this._getCurrentBlockHeight()

      // Classify UTXOs
      this.classifications = this.classifier.classifyUtxos(
        this.utxoStore.xecUtxos,
        currentBlockHeight
      )

      // Clear cached health report to force refresh
      this.lastHealthReport = null

      const analyticsTime = Date.now() - startTime
      this.performanceMetrics.analyticsTime = analyticsTime

      if (this.analyticsConfig.debug) {
        console.log(`Analytics completed in ${analyticsTime}ms: ${this.classifications.size} UTXOs classified`)
      }
    } catch (error) {
      console.warn('Analytics processing failed:', error.message)
      // Continue without analytics rather than failing completely
    }
  }

  /**
   * Get current block height (placeholder implementation)
   * @private
   * @returns {number} - Current block height
   */
  async _getCurrentBlockHeight () {
    // This would need to be implemented with actual chronik call
    // For now, return a reasonable default
    return 800000 // Placeholder
  }

  /**
   * Filter UTXOs by classification criteria
   * @private
   * @param {Array} utxos - UTXOs to filter
   * @param {Object} criteria - Filter criteria
   * @returns {Array} - Filtered UTXOs
   */
  _filterByClassifications (utxos, criteria) {
    const { minHealthScore, minPrivacyScore, strategy } = criteria

    return utxos.filter(utxo => {
      const utxoId = `${utxo.outpoint.txid}:${utxo.outpoint.outIdx}`
      const classification = this.classifications.get(utxoId)

      if (!classification) return true // Include unclassified UTXOs

      // Apply filters based on strategy
      switch (strategy) {
        case 'privacy':
          return classification.privacy >= Math.max(60, minPrivacyScore)
        case 'health':
          return classification.healthScore >= Math.max(70, minHealthScore)
        case 'efficiency':
          return classification.metadata.isEconomical
        default:
          return (
            classification.healthScore >= minHealthScore &&
            classification.privacy >= minPrivacyScore
          )
      }
    })
  }

  /**
   * Smart UTXO selection using classifications
   * @private
   * @param {Array} utxos - Available UTXOs
   * @param {number} targetAmount - Target amount
   * @param {string} strategy - Selection strategy
   * @param {number} feeRate - Fee rate
   * @returns {Object} - Selection result
   */
  _selectWithClassifications (utxos, targetAmount, strategy, feeRate) {
    // Get sorted UTXOs based on strategy
    const sortedUtxos = this._sortUtxosByStrategy(utxos, strategy)

    return this._selectFromSorted(sortedUtxos, targetAmount, feeRate)
  }

  /**
   * Sort UTXOs by selection strategy
   * @private
   * @param {Array} utxos - UTXOs to sort
   * @param {string} strategy - Selection strategy
   * @returns {Array} - Sorted UTXOs
   */
  _sortUtxosByStrategy (utxos, strategy) {
    return [...utxos].sort((a, b) => {
      const aId = `${a.outpoint.txid}:${a.outpoint.outIdx}`
      const bId = `${b.outpoint.txid}:${b.outpoint.outIdx}`
      const aClassification = this.classifications.get(aId)
      const bClassification = this.classifications.get(bId)

      // Fallback to value-based sorting if no classification
      if (!aClassification || !bClassification) {
        return this._getUtxoValue(b) - this._getUtxoValue(a)
      }

      switch (strategy) {
        case 'privacy':
          // Prefer higher privacy scores, then age
          if (aClassification.privacy !== bClassification.privacy) {
            return bClassification.privacy - aClassification.privacy
          }
          return bClassification.ageScore - aClassification.ageScore

        case 'efficient':
          // Prefer economical UTXOs, then efficiency
          if (aClassification.metadata.isEconomical !== bClassification.metadata.isEconomical) {
            return aClassification.metadata.isEconomical ? -1 : 1
          }
          return bClassification.valueScore - aClassification.valueScore

        case 'balanced': {
          // Balanced scoring considering all factors
          const aScore = (aClassification.healthScore + aClassification.privacy + aClassification.valueScore) / 3
          const bScore = (bClassification.healthScore + bClassification.privacy + bClassification.valueScore) / 3
          return bScore - aScore
        }

        case 'conservative':
          // Prefer confirmed, older UTXOs
          if (aClassification.metadata.isConfirmed !== bClassification.metadata.isConfirmed) {
            return aClassification.metadata.isConfirmed ? -1 : 1
          }
          return bClassification.ageScore - aClassification.ageScore

        default:
          // Default to health score
          return bClassification.healthScore - aClassification.healthScore
      }
    })
  }

  /**
   * Basic UTXO selection (fallback when no classifications)
   * @private
   * @param {Array} utxos - Available UTXOs
   * @param {number} targetAmount - Target amount
   * @param {number} feeRate - Fee rate
   * @returns {Object} - Selection result
   */
  _selectBasic (utxos, targetAmount, feeRate) {
    // Sort by value descending (largest first)
    const sortedUtxos = utxos.sort((a, b) => {
      return this._getUtxoValue(b) - this._getUtxoValue(a)
    })

    return this._selectFromSorted(sortedUtxos, targetAmount, feeRate)
  }

  /**
   * Select UTXOs from sorted array
   * @private
   * @param {Array} sortedUtxos - Pre-sorted UTXOs
   * @param {number} targetAmount - Target amount
   * @param {number} feeRate - Fee rate
   * @returns {Object} - Selection result
   */
  _selectFromSorted (sortedUtxos, targetAmount, feeRate) {
    const selectedUtxos = []
    let totalAmount = 0
    const inputCost = 148 // P2PKH input size in bytes

    for (const utxo of sortedUtxos) {
      const utxoValue = this._getUtxoValue(utxo)
      selectedUtxos.push(utxo)
      totalAmount += utxoValue

      // Estimate fee
      const estimatedFee = Math.ceil((selectedUtxos.length * inputCost + 34 + 10) * feeRate)

      if (totalAmount >= targetAmount + estimatedFee) {
        const finalFee = Math.ceil((selectedUtxos.length * inputCost + 34 + 10) * feeRate)
        const change = totalAmount - targetAmount - finalFee

        return {
          utxos: selectedUtxos,
          totalValue: totalAmount,
          estimatedFee: finalFee,
          change: Math.max(0, change),
          txSize: selectedUtxos.length * inputCost + 34 + 10,
          strategy: 'basic'
        }
      }
    }

    // Check if we have enough
    const finalFee = Math.ceil((selectedUtxos.length * inputCost + 34 + 10) * feeRate)
    if (totalAmount < targetAmount + finalFee) {
      throw new Error('Insufficient funds')
    }

    return {
      utxos: selectedUtxos,
      totalValue: totalAmount,
      estimatedFee: finalFee,
      change: totalAmount - targetAmount - finalFee,
      txSize: selectedUtxos.length * inputCost + 34 + 10,
      strategy: 'basic'
    }
  }

  /**
   * Check if health report should be refreshed
   * @private
   * @returns {boolean} - True if refresh needed
   */
  _shouldRefreshHealthReport () {
    if (!this.lastHealthReport) return true

    const age = Date.now() - this.lastHealthReport.lastScan
    const maxAge = this.analyticsConfig.healthRefreshInterval || 300000 // 5 minutes

    return age > maxAge
  }

  /**
   * Get base performance metrics (backwards compatibility)
   * @private
   * @returns {Object} - Base performance metrics
   */
  _getBasePerformanceMetrics () {
    const cacheHitRate = this.performanceMetrics.totalRequests > 0
      ? (this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests) * 100
      : 0

    return {
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      totalRequests: this.performanceMetrics.totalRequests,
      cacheHits: this.performanceMetrics.cacheHits,
      averageResponseTime: this.performanceMetrics.averageResponseTime,
      lastRefreshTime: this.performanceMetrics.lastRefreshTime,
      utxoCount: this.utxoStore.xecUtxos.length
    }
  }
}

module.exports = Utxos
