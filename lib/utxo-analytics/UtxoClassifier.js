/*
  Advanced UTXO Classification Engine for minimal-xec-wallet

  Provides comprehensive UTXO analysis including:
  - Age classification (fresh, recent, mature, aged, ancient)
  - Value categorization (dust, micro, small, medium, large, whale)
  - Privacy scoring (0-100 based on fingerprinting risks)
  - Health assessment (healthy, at-risk, unhealthy)
  - Metadata extraction for optimization decisions
*/

'use strict'

class UtxoClassifier {
  constructor (config = {}) {
    // Age thresholds in blocks (XEC has ~10 minute blocks)
    this.ageThresholds = {
      fresh: config.ageThresholds?.fresh || 6, // ~1 hour
      recent: config.ageThresholds?.recent || 144, // ~1 day
      mature: config.ageThresholds?.mature || 1008, // ~1 week
      aged: config.ageThresholds?.aged || 4032 // ~1 month
    }

    // Value thresholds in satoshis (XEC: 1 XEC = 100 satoshis)
    this.valueThresholds = {
      dust: config.valueThresholds?.dust || 1000, // 10 XEC
      micro: config.valueThresholds?.micro || 5000, // 50 XEC
      small: config.valueThresholds?.small || 50000, // 500 XEC
      medium: config.valueThresholds?.medium || 500000, // 5000 XEC
      large: config.valueThresholds?.large || 5000000 // 50000 XEC
    }

    // Dust and fee limits (XEC specific)
    this.dustLimit = config.dustLimit || 546
    this.standardInputSize = config.standardInputSize || 148 // P2PKH input bytes

    // Privacy analysis parameters
    this.privacyConfig = {
      roundNumberPenalty: config.privacyConfig?.roundNumberPenalty || 15,
      ageBonus: config.privacyConfig?.ageBonus || 20,
      commonScriptBonus: config.privacyConfig?.commonScriptBonus || 10,
      suspiciousPatternPenalty: config.privacyConfig?.suspiciousPatternPenalty || 25
    }

    // Debug mode
    this.debug = config.debug || false
  }

  /**
   * Comprehensively classify a single UTXO
   * @param {Object} utxo - UTXO to classify
   * @param {number} currentBlockHeight - Current blockchain height for age calculation
   * @returns {Object} Complete UTXO classification
   */
  classifyUtxo (utxo, currentBlockHeight = 0) {
    try {
      // Validate UTXO structure
      if (!utxo || typeof utxo !== 'object') {
        throw new Error('Invalid UTXO: must be an object')
      }

      // Handle different UTXO formats (outpoint vs direct properties)
      const txid = utxo.outpoint?.txid || utxo.tx_hash || utxo.txid
      const outIdx = utxo.outpoint?.outIdx !== undefined
        ? utxo.outpoint.outIdx
        : utxo.tx_pos !== undefined ? utxo.tx_pos : utxo.outIdx

      if (!txid || outIdx === undefined || outIdx === null) {
        throw new Error('Invalid UTXO: missing txid or output index')
      }

      const satsValue = this._extractSatsFromUtxo(utxo)
      const ageInBlocks = this._calculateAge(utxo, currentBlockHeight)

      const classification = {
        // Identifiers
        id: `${txid}:${outIdx}`,
        txid: txid,
        outIdx: outIdx,

        // Age analysis
        age: this._classifyAge(utxo, currentBlockHeight),
        ageInBlocks: ageInBlocks,
        ageScore: this._calculateAgeScore(ageInBlocks),

        // Value analysis
        value: this._classifyValue(satsValue),
        satsValue: satsValue,
        valueScore: this._calculateValueScore(satsValue),

        // Health assessment
        health: this._assessHealth(utxo, satsValue),
        healthScore: this._calculateHealthScore(utxo, satsValue),

        // Privacy analysis
        privacy: this._calculatePrivacyScore(utxo, satsValue, ageInBlocks),
        privacyFactors: this._analyzePrivacyFactors(utxo, satsValue),

        // Technical metadata
        metadata: {
          isCoinbase: utxo.isCoinbase || false,
          isConfirmed: utxo.blockHeight !== -1,
          blockHeight: utxo.blockHeight,
          scriptType: this._detectScriptType(utxo.script),
          estimatedInputSize: this._estimateInputSize(utxo),
          isDust: satsValue < this.valueThresholds.dust,
          isEconomical: this._isEconomicalToSpend(satsValue, 1.0), // at 1 sat/byte
          hasToken: utxo.token !== undefined
        },

        // Timestamps
        classifiedAt: Date.now(),
        lastUpdated: Date.now()
      }

      if (this.debug) {
        console.log(`Classified UTXO ${classification.id}: ${classification.value}/${classification.age} (${classification.healthScore}/100)`)
      }

      return classification
    } catch (err) {
      console.warn(`UTXO classification failed for ${utxo.outpoint?.txid}:${utxo.outpoint?.outIdx}:`, err.message)
      throw new Error(`UTXO classification failed: ${err.message}`)
    }
  }

  /**
   * Classify multiple UTXOs efficiently
   * @param {Array} utxos - Array of UTXOs to classify
   * @param {number} currentBlockHeight - Current blockchain height
   * @returns {Map} Map of UTXO ID to classification
   */
  classifyUtxos (utxos, currentBlockHeight = 0) {
    const classifications = new Map()
    let successCount = 0
    let errorCount = 0

    for (const utxo of utxos) {
      try {
        const classification = this.classifyUtxo(utxo, currentBlockHeight)
        classifications.set(classification.id, classification)
        successCount++
      } catch (err) {
        errorCount++
        if (this.debug) {
          console.warn(`Failed to classify UTXO ${utxo.outpoint?.txid}:${utxo.outpoint?.outIdx}:`, err.message)
        }
      }
    }

    if (this.debug) {
      console.log(`Classification complete: ${successCount} success, ${errorCount} errors`)
    }

    return classifications
  }

  // Age Classification Methods

  _calculateAge (utxo, currentBlockHeight) {
    if (utxo.blockHeight === -1) return -1 // Unconfirmed
    return Math.max(0, currentBlockHeight - utxo.blockHeight)
  }

  _classifyAge (utxo, currentBlockHeight) {
    if (utxo.blockHeight === -1) return 'unconfirmed'

    const age = this._calculateAge(utxo, currentBlockHeight)

    if (age <= this.ageThresholds.fresh) return 'fresh'
    if (age <= this.ageThresholds.recent) return 'recent'
    if (age <= this.ageThresholds.mature) return 'mature'
    if (age <= this.ageThresholds.aged) return 'aged'
    return 'ancient'
  }

  _calculateAgeScore (ageInBlocks) {
    if (ageInBlocks === -1) return 0 // Unconfirmed
    if (ageInBlocks === 0) return 10 // Same block

    // Logarithmic scoring: older = better (up to a point)
    const maxScore = 100
    const ageScore = Math.min(maxScore, Math.log10(ageInBlocks + 1) * 25)
    return Math.round(ageScore)
  }

  // Value Classification Methods

  _classifyValue (satsValue) {
    if (satsValue < this.valueThresholds.dust) return 'dust'
    if (satsValue < this.valueThresholds.micro) return 'micro'
    if (satsValue < this.valueThresholds.small) return 'small'
    if (satsValue < this.valueThresholds.medium) return 'medium'
    if (satsValue < this.valueThresholds.large) return 'large'
    return 'whale'
  }

  _calculateValueScore (satsValue) {
    // Score based on spendability and efficiency
    if (satsValue < this.valueThresholds.dust) return 0 // Dust = unusable

    // Optimal range: medium values (efficient to spend, not too large for privacy)
    const optimalMin = this.valueThresholds.small
    const optimalMax = this.valueThresholds.medium

    if (satsValue >= optimalMin && satsValue <= optimalMax) {
      return 100 // Perfect score for optimal range
    }

    if (satsValue < optimalMin) {
      // Small values: score based on efficiency
      return Math.round((satsValue / optimalMin) * 80)
    }

    // Large values: diminishing returns (privacy concerns)
    const largenessPenalty = Math.min(30, Math.log10(satsValue / optimalMax) * 10)
    return Math.max(50, 100 - largenessPenalty)
  }

  // Health Assessment Methods

  _assessHealth (utxo, satsValue) {
    if (satsValue < this.valueThresholds.dust) return 'dust'
    if (utxo.blockHeight === -1) return 'unconfirmed'
    if (!this._isEconomicalToSpend(satsValue, 2.0)) return 'uneconomical'
    if (this._isSuspiciousDust(utxo, satsValue)) return 'suspicious'
    if (satsValue < this.valueThresholds.micro) return 'at-risk'
    return 'healthy'
  }

  _calculateHealthScore (utxo, satsValue) {
    let score = 100

    // Dust penalty
    if (satsValue < this.valueThresholds.dust) score = 0

    // Unconfirmed penalty
    if (utxo.blockHeight === -1) score -= 30

    // Economic viability
    if (!this._isEconomicalToSpend(satsValue, 1.0)) score -= 40
    if (!this._isEconomicalToSpend(satsValue, 2.0)) score -= 20

    // Suspicious pattern detection
    if (this._isSuspiciousDust(utxo, satsValue)) score -= 50

    // Token UTXOs (need special handling)
    if (utxo.token) score += 10 // Tokens have additional value

    // Coinbase maturity (if applicable)
    if (utxo.isCoinbase && utxo.blockHeight !== -1) {
      const maturityBlocks = 100 // XEC coinbase maturity
      const currentAge = utxo.blockHeight // Approximation
      if (currentAge < maturityBlocks) score -= 30
    }

    return Math.max(0, Math.min(100, score))
  }

  // Privacy Analysis Methods

  _calculatePrivacyScore (utxo, satsValue, ageInBlocks) {
    let score = 100 // Start with perfect privacy
    const factors = this._analyzePrivacyFactors(utxo, satsValue)

    // Apply privacy penalties/bonuses
    if (factors.isRoundNumber) score -= this.privacyConfig.roundNumberPenalty
    if (factors.isSuspiciousAmount) score -= this.privacyConfig.suspiciousPatternPenalty
    if (factors.isCommonScript) score += this.privacyConfig.commonScriptBonus

    // Age bonus (older = more private due to time mixing)
    if (ageInBlocks > 0) {
      const ageBonus = Math.min(this.privacyConfig.ageBonus, Math.log10(ageInBlocks + 1) * 5)
      score += ageBonus
    }

    // Unconfirmed penalty
    if (ageInBlocks === -1) score -= 20

    // Value-based adjustments
    if (satsValue < this.valueThresholds.dust) score -= 30 // Dust is often surveillance
    if (this._isVeryLargeAmount(satsValue)) score -= 15 // Large amounts more trackable

    // Token UTXOs have different privacy characteristics
    if (utxo.token) score -= 10 // Tokens are more traceable

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  _analyzePrivacyFactors (utxo, satsValue) {
    return {
      isRoundNumber: this._isRoundNumber(satsValue),
      isSuspiciousAmount: this._isSuspiciousAmount(satsValue),
      isCommonScript: this._isCommonScriptType(utxo.script),
      isVeryLarge: this._isVeryLargeAmount(satsValue),
      hasSuspiciousTiming: false, // TODO: Implement timing analysis
      scriptComplexity: this._analyzeScriptComplexity(utxo.script),
      hasToken: utxo.token !== undefined
    }
  }

  // Utility Methods

  _extractSatsFromUtxo (utxo) {
    // Handle both string and BigInt sats values from Chronik API
    const sats = utxo.sats || utxo.value || 0

    if (typeof sats === 'bigint') {
      return Number(sats)
    } else if (typeof sats === 'string') {
      return parseInt(sats) || 0
    } else {
      return parseInt(sats) || 0
    }
  }

  _isEconomicalToSpend (satsValue, feeRate) {
    const inputCost = this.standardInputSize * feeRate
    return satsValue > inputCost * 2 // At least 2x the cost to spend
  }

  _isSuspiciousDust (utxo, satsValue) {
    // Detect potential dust attacks
    return (
      satsValue > this.dustLimit &&
      satsValue < this.dustLimit * 2 && // Just above dust limit
      utxo.blockHeight === -1 // Unconfirmed
    )
  }

  _isRoundNumber (satsValue) {
    // Detect round numbers that might be fingerprints (XEC specific)
    const xecValue = satsValue / 100 // Convert to XEC
    return (
      xecValue % 1 === 0 && // Whole XEC amounts
      (xecValue % 10 === 0 || xecValue % 100 === 0 || xecValue % 1000 === 0)
    )
  }

  _isSuspiciousAmount (satsValue) {
    // Detect amounts that might be surveillance markers
    const commonSurveillanceAmounts = [547, 1000, 10000, 100000] // satoshis
    return commonSurveillanceAmounts.includes(satsValue)
  }

  _isVeryLargeAmount (satsValue) {
    return satsValue > this.valueThresholds.large
  }

  _detectScriptType (script) {
    if (!script || typeof script !== 'string') return 'unknown'

    // Basic script type detection based on script patterns
    if (script.length === 50) return 'p2pkh' // 25 bytes = 50 hex chars
    if (script.length === 44) return 'p2sh' // 22 bytes = 44 hex chars
    return 'other'
  }

  _isCommonScriptType (script) {
    const scriptType = this._detectScriptType(script)
    return scriptType === 'p2pkh' // Most common and private
  }

  _analyzeScriptComplexity (script) {
    if (!script) return 'unknown'

    // Simple complexity analysis
    if (script.length <= 50) return 'simple'
    if (script.length <= 100) return 'medium'
    return 'complex'
  }

  _estimateInputSize (utxo) {
    const scriptType = this._detectScriptType(utxo.script)

    switch (scriptType) {
      case 'p2pkh': return 148 // Standard P2PKH input
      case 'p2sh': return 180 // Typical P2SH input
      default: return 200 // Conservative estimate
    }
  }

  // Statistics and Analysis Methods

  /**
   * Generate comprehensive statistics from classifications
   * @param {Map} classifications - Map of classifications
   * @returns {Object} Statistics summary
   */
  getClassificationStats (classifications) {
    const stats = {
      total: classifications.size,
      byAge: { unconfirmed: 0, fresh: 0, recent: 0, mature: 0, aged: 0, ancient: 0 },
      byValue: { dust: 0, micro: 0, small: 0, medium: 0, large: 0, whale: 0 },
      byHealth: { healthy: 0, 'at-risk': 0, uneconomical: 0, suspicious: 0, dust: 0, unconfirmed: 0 },
      averagePrivacyScore: 0,
      averageHealthScore: 0,
      averageAgeScore: 0,
      averageValueScore: 0,
      totalValue: 0,
      spendableValue: 0,
      tokenUtxos: 0
    }

    if (classifications.size === 0) return stats

    let privacySum = 0
    let healthSum = 0
    let ageSum = 0
    let valueSum = 0

    for (const classification of classifications.values()) {
      // Count by categories
      stats.byAge[classification.age]++
      stats.byValue[classification.value]++
      stats.byHealth[classification.health]++

      // Sum values and scores
      stats.totalValue += classification.satsValue
      privacySum += classification.privacy
      healthSum += classification.healthScore
      ageSum += classification.ageScore
      valueSum += classification.valueScore

      // Count special types
      if (classification.metadata.hasToken) stats.tokenUtxos++
      if (classification.metadata.isEconomical) {
        stats.spendableValue += classification.satsValue
      }
    }

    // Calculate averages
    stats.averagePrivacyScore = Math.round(privacySum / classifications.size)
    stats.averageHealthScore = Math.round(healthSum / classifications.size)
    stats.averageAgeScore = Math.round(ageSum / classifications.size)
    stats.averageValueScore = Math.round(valueSum / classifications.size)

    return stats
  }

  /**
   * Get UTXOs filtered by classification criteria
   * @param {Map} classifications - Classifications map
   * @param {Object} criteria - Filter criteria
   * @returns {Array} Filtered UTXO IDs
   */
  filterByClassification (classifications, criteria = {}) {
    const {
      minHealthScore = 0,
      minPrivacyScore = 0,
      allowedAges = [],
      allowedValues = [],
      includeTokens = true,
      includeUnconfirmed = false
    } = criteria

    const filtered = []

    for (const [utxoId, classification] of classifications) {
      // Health score filter
      if (classification.healthScore < minHealthScore) continue

      // Privacy score filter
      if (classification.privacy < minPrivacyScore) continue

      // Age filter
      if (allowedAges.length > 0 && !allowedAges.includes(classification.age)) continue

      // Value filter
      if (allowedValues.length > 0 && !allowedValues.includes(classification.value)) continue

      // Token filter
      if (!includeTokens && classification.metadata.hasToken) continue

      // Confirmation filter
      if (!includeUnconfirmed && !classification.metadata.isConfirmed) continue

      filtered.push(utxoId)
    }

    return filtered
  }

  /**
   * Get optimization recommendations based on classifications
   * @param {Map} classifications - Classifications map
   * @returns {Object} Optimization recommendations
   */
  getOptimizationRecommendations (classifications) {
    const stats = this.getClassificationStats(classifications)
    const recommendations = []

    // Dust consolidation
    if (stats.byValue.dust > 5) {
      recommendations.push({
        type: 'consolidation',
        priority: 'medium',
        title: 'Consolidate dust UTXOs',
        description: `${stats.byValue.dust} dust UTXOs detected`,
        action: 'consolidate_dust',
        estimatedSavings: 'Reduce transaction complexity'
      })
    }

    // Privacy improvements
    if (stats.averagePrivacyScore < 60) {
      recommendations.push({
        type: 'privacy',
        priority: 'medium',
        title: 'Improve UTXO privacy',
        description: `Average privacy score is ${stats.averagePrivacyScore}/100`,
        action: 'wait_for_aging',
        estimatedSavings: 'Better transaction privacy'
      })
    }

    // Health issues
    if (stats.byHealth.suspicious > 0) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        title: 'Address suspicious UTXOs',
        description: `${stats.byHealth.suspicious} suspicious UTXOs detected`,
        action: 'quarantine_suspicious',
        estimatedSavings: 'Prevent privacy attacks'
      })
    }

    // Economic efficiency
    const economicalPercentage = (stats.spendableValue / stats.totalValue) * 100
    if (economicalPercentage < 80) {
      recommendations.push({
        type: 'efficiency',
        priority: 'low',
        title: 'Improve economic efficiency',
        description: `Only ${economicalPercentage.toFixed(1)}% of value is economically spendable`,
        action: 'consolidate_small_utxos',
        estimatedSavings: 'Reduce transaction fees'
      })
    }

    return {
      recommendations,
      stats,
      priority: recommendations.length > 0
        ? Math.max(...recommendations.map(r =>
            r.priority === 'high' ? 3 : r.priority === 'medium' ? 2 : 1
          ))
        : 0
    }
  }
}

module.exports = UtxoClassifier
