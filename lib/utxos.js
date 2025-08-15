/*
  Simplified UTXO management for minimal XEC wallet

  Core functionality only:
  - Fetch UTXOs from chronik
  - Basic validation and filtering
  - Simple caching
  - Essential security checks
*/

const SecurityValidator = require('./security')

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

    // Performance tracking (basic)
    this.performanceMetrics = {
      totalRequests: 0,
      cacheHits: 0,
      lastRefreshTime: null,
      totalResponseTime: 0,
      averageResponseTime: 0
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

      return true
    } catch (err) {
      throw new Error(`UTXO initialization failed: ${err.message}`)
    }
  }

  /**
   * Get spendable XEC UTXOs with basic filtering
   * @param {Object} options - Filtering options
   * @returns {Array} - Filtered UTXOs
   */
  getSpendableXecUtxos (options = {}) {
    const {
      includeUnconfirmed = false,
      excludeDustAttack = true
    } = options

    // Use security validator for filtering
    return this.security.filterSecureUtxos(this.utxoStore.xecUtxos, {
      includeUnconfirmed,
      excludeDustAttack
    })
  }

  /**
   * Simple UTXO selection (largest first)
   * @param {number} targetAmount - Target amount in satoshis
   * @param {Object} options - Selection options
   * @returns {Object} - Selection result
   */
  selectOptimalUtxos (targetAmount, options = {}) {
    const spendableUtxos = this.getSpendableXecUtxos(options)

    if (spendableUtxos.length === 0) {
      throw new Error('No spendable UTXOs available')
    }

    // Sort by value descending (largest first)
    const sortedUtxos = spendableUtxos.sort((a, b) => {
      const aValue = this._getUtxoValue(a)
      const bValue = this._getUtxoValue(b)
      return bValue - aValue
    })

    // Simple greedy selection
    const selectedUtxos = []
    let totalAmount = 0
    const inputCost = 148 // P2PKH input size in bytes

    for (const utxo of sortedUtxos) {
      const utxoValue = this._getUtxoValue(utxo)
      selectedUtxos.push(utxo)
      totalAmount += utxoValue

      // Estimate fee
      const estimatedFee = selectedUtxos.length * inputCost + 34 + 10 // inputs + output + overhead

      if (totalAmount >= targetAmount + estimatedFee) {
        break
      }
    }

    // Check if we have enough
    const finalFee = selectedUtxos.length * inputCost + 34 + 10
    if (totalAmount < targetAmount + finalFee) {
      throw new Error('Insufficient funds')
    }

    return {
      selectedUtxos,
      totalAmount,
      estimatedFee: finalFee,
      change: totalAmount - targetAmount - finalFee
    }
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
   * Get performance metrics
   * @returns {Object} - Performance data
   */
  getPerformanceMetrics () {
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
}

module.exports = Utxos
