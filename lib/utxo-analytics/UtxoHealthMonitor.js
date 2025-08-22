/*
  UTXO Health Monitoring System for minimal-xec-wallet

  Provides real-time health assessment and monitoring for UTXOs including:
  - Health status tracking (healthy, at-risk, unhealthy, stuck)
  - Dust attack detection and prevention
  - Economic viability analysis
  - Consolidation recommendations
  - Performance impact assessment
*/

'use strict'

class UtxoHealthMonitor {
  constructor (config = {}) {
    // Health assessment thresholds
    this.healthConfig = {
      dustLimit: config.dustLimit || 546,
      economicalThreshold: config.economicalThreshold || 2.0, // 2x input cost
      stuckThreshold: config.stuckThreshold || 144, // blocks before considering stuck
      suspiciousPatterns: config.suspiciousPatterns || {
        dustAttackSize: 10, // Number of micro-UTXOs to trigger alert
        rapidDeposits: 5, // Rapid deposits within timeframe
        timeWindow: 3600000 // 1 hour in milliseconds
      }
    }

    // Monitoring state
    this.healthHistory = new Map() // UTXO ID -> health history
    this.alerts = []
    this.lastScan = null
    this.dustAttackPatterns = new Map() // Address -> pattern data

    // Performance metrics
    this.metrics = {
      totalScanned: 0,
      healthyCount: 0,
      unhealthyCount: 0,
      dustCount: 0,
      stuckCount: 0,
      lastUpdateTime: null
    }

    // Debug mode
    this.debug = config.debug || false
  }

  /**
   * Comprehensive health assessment of a single UTXO
   * @param {Object} utxo - UTXO to assess
   * @param {Object} classification - Optional pre-computed classification
   * @param {number} currentFeeRate - Current network fee rate (sats/byte)
   * @returns {Object} Detailed health assessment
   */
  assessUtxoHealth (utxo, classification = null, currentFeeRate = 1.0) {
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

      const utxoId = `${txid}:${outIdx}`
      const satsValue = this._extractSatsFromUtxo(utxo)

      // Basic health indicators
      const isDust = satsValue < this.healthConfig.dustLimit
      const isEconomical = this._isEconomicalToSpend(satsValue, currentFeeRate)
      const isConfirmed = utxo.blockHeight !== -1
      const isStuck = this._isStuckUtxo(utxo)
      const isSuspicious = this._isSuspiciousUtxo(utxo, satsValue)

      // Determine primary health status
      let status = 'healthy'
      let severity = 'none'
      const recommendations = []

      if (isDust) {
        status = 'dust'
        severity = 'critical'
        recommendations.push('Consider consolidating with other UTXOs')
      } else if (isSuspicious) {
        status = 'suspicious'
        severity = 'high'
        recommendations.push('Quarantine - possible dust attack')
        recommendations.push('Do not spend without careful analysis')
      } else if (!isConfirmed) {
        status = 'unconfirmed'
        severity = 'low'
        recommendations.push('Wait for confirmation')
      } else if (isStuck) {
        status = 'stuck'
        severity = 'medium'
        recommendations.push('Consider using Child-Pays-For-Parent (CPFP)')
      } else if (!isEconomical) {
        status = 'uneconomical'
        severity = 'medium'
        recommendations.push('Wait for lower fee rates or consolidate')
      }

      // Calculate detailed health metrics
      const healthScore = this._calculateDetailedHealthScore(utxo, satsValue, currentFeeRate)
      const spendingCost = this._calculateSpendingCost(utxo, currentFeeRate)
      const efficiency = satsValue > 0 ? (satsValue - spendingCost) / satsValue : 0

      const healthAssessment = {
        utxoId,
        status,
        severity,
        healthScore,

        // Economic analysis
        economic: {
          isEconomical,
          spendingCost,
          efficiency: Math.max(0, efficiency),
          profitMargin: satsValue - spendingCost,
          breakEvenFeeRate: this._calculateBreakEvenFeeRate(satsValue),
          feeEfficiency: this._calculateFeeEfficiency(satsValue, currentFeeRate)
        },

        // Risk analysis
        risks: {
          isDust,
          isStuck,
          isSuspicious,
          isUnconfirmed: !isConfirmed,
          hasToken: utxo.token !== undefined,
          riskFactors: this._identifyRiskFactors(utxo, satsValue)
        },

        // Recommendations
        recommendations,

        // Technical details
        technical: {
          satsValue,
          blockHeight: utxo.blockHeight,
          estimatedInputSize: this._estimateInputSize(utxo),
          currentFeeRate,
          hasToken: utxo.token !== undefined
        },

        // Timestamps
        assessedAt: Date.now(),
        lastUpdated: Date.now()
      }

      // Update health history
      this._updateHealthHistory(utxoId, healthAssessment)

      if (this.debug) {
        console.log(`Health assessed for ${utxoId}: ${status} (${healthScore}/100)`)
      }

      return healthAssessment
    } catch (err) {
      console.warn(`Health assessment failed for ${utxo.outpoint?.txid}:${utxo.outpoint?.outIdx}:`, err.message)
      throw new Error(`Health assessment failed: ${err.message}`)
    }
  }

  /**
   * Monitor health status of multiple UTXOs
   * @param {Array} utxos - Array of UTXOs to monitor
   * @param {Map} classifications - Optional UTXO classifications
   * @param {number} currentFeeRate - Current network fee rate
   * @returns {Object} Comprehensive health report
   */
  monitorUtxoSet (utxos, classifications = null, currentFeeRate = 1.0) {
    try {
      const healthAssessments = new Map()
      const alerts = []
      const summary = {
        total: utxos.length,
        healthy: 0,
        atRisk: 0,
        unhealthy: 0,
        dust: 0,
        stuck: 0,
        suspicious: 0,
        unconfirmed: 0,
        totalValue: 0,
        spendableValue: 0,
        uneconomicalValue: 0,
        tokenUtxos: 0
      }

      // Assess each UTXO
      for (const utxo of utxos) {
        try {
          // Handle different UTXO formats for classification lookup
          const txid = utxo.outpoint?.txid || utxo.tx_hash || utxo.txid
          const outIdx = utxo.outpoint?.outIdx !== undefined
            ? utxo.outpoint.outIdx
            : utxo.tx_pos !== undefined ? utxo.tx_pos : utxo.outIdx
          const classification = classifications?.get(`${txid}:${outIdx}`)
          const assessment = this.assessUtxoHealth(utxo, classification, currentFeeRate)

          healthAssessments.set(assessment.utxoId, assessment)

          // Update summary statistics
          summary.totalValue += assessment.technical.satsValue

          // Count token UTXOs
          if (assessment.technical.hasToken) summary.tokenUtxos++

          switch (assessment.status) {
            case 'healthy':
              summary.healthy++
              summary.spendableValue += assessment.technical.satsValue
              break
            case 'dust':
              summary.dust++
              summary.uneconomicalValue += assessment.technical.satsValue
              break
            case 'stuck':
              summary.stuck++
              break
            case 'suspicious':
              summary.suspicious++
              alerts.push(this._createSuspiciousUtxoAlert(assessment))
              break
            case 'uneconomical':
              summary.atRisk++
              summary.uneconomicalValue += assessment.technical.satsValue
              break
            case 'unconfirmed':
              summary.unconfirmed++
              summary.spendableValue += assessment.technical.satsValue // Usually spendable
              break
            default:
              summary.atRisk++
          }

          // Generate alerts for critical issues
          if (assessment.severity === 'critical' || assessment.severity === 'high') {
            alerts.push(this._createHealthAlert(assessment))
          }
        } catch (err) {
          if (this.debug) {
            console.warn(`Failed to assess UTXO ${utxo.outpoint?.txid}:${utxo.outpoint?.outIdx}:`, err.message)
          }
        }
      }

      // Analyze patterns and generate system-wide alerts
      const patternAlerts = this._analyzeHealthPatterns(healthAssessments)
      alerts.push(...patternAlerts)

      // Calculate health metrics
      summary.healthPercentage = summary.total > 0 ? (summary.healthy / summary.total) * 100 : 0
      summary.spendablePercentage = summary.totalValue > 0 ? (summary.spendableValue / summary.totalValue) * 100 : 0

      // Update monitoring metrics
      this._updateMonitoringMetrics(summary)

      const report = {
        summary,
        assessments: healthAssessments,
        alerts,
        recommendations: this._generateSystemRecommendations(summary),
        lastScan: Date.now(),
        feeRate: currentFeeRate
      }

      this.lastScan = Date.now()
      this.alerts.push(...alerts)

      if (this.debug) {
        console.log(`Health monitoring complete: ${summary.healthy}/${summary.total} healthy UTXOs`)
      }

      return report
    } catch (err) {
      console.warn('UTXO set monitoring failed:', err.message)
      throw new Error(`UTXO set monitoring failed: ${err.message}`)
    }
  }

  /**
   * Detect potential dust attacks
   * @param {Array} utxos - Recent UTXOs to analyze
   * @param {string} address - Wallet address being analyzed
   * @returns {Object} Dust attack analysis
   */
  detectDustAttack (utxos, address) {
    try {
      // Validate inputs
      if (!Array.isArray(utxos)) {
        throw new Error('UTXOs must be an array')
      }

      // Validate UTXO structures
      for (const utxo of utxos) {
        if (!utxo || typeof utxo !== 'object') {
          throw new Error('Invalid UTXO: must be an object')
        }
        if (!utxo.outpoint && !utxo.tx_hash && !utxo.txid) {
          throw new Error('Invalid UTXO: missing transaction identifier')
        }
      }

      const suspiciousPattern = {
        address,
        detectedAt: Date.now(),
        severity: 'none',
        indicators: [],
        utxos: [],
        recommendations: []
      }

      // Analyze UTXO patterns
      const microUtxos = utxos.filter(utxo => {
        const value = this._extractSatsFromUtxo(utxo)
        return value > this.healthConfig.dustLimit && value < this.healthConfig.dustLimit * 5
      })

      const recentMicroUtxos = microUtxos.filter(utxo => {
        // Check if received recently (within time window)
        return utxo.blockHeight === -1 || this._isRecentUtxo(utxo)
      })

      // Check for dust attack indicators
      if (recentMicroUtxos.length >= this.healthConfig.suspiciousPatterns.dustAttackSize) {
        suspiciousPattern.severity = 'high'
        suspiciousPattern.indicators.push('Multiple micro-UTXOs received rapidly')
        suspiciousPattern.utxos = recentMicroUtxos
        suspiciousPattern.recommendations.push('Do not spend micro-UTXOs')
        suspiciousPattern.recommendations.push('Consider using privacy features')
      }

      // Check for round number patterns (common in attacks)
      const roundNumberUtxos = recentMicroUtxos.filter(utxo => {
        const value = this._extractSatsFromUtxo(utxo)
        return this._isRoundNumber(value)
      })

      if (roundNumberUtxos.length >= 3) {
        suspiciousPattern.severity = suspiciousPattern.severity === 'high' ? 'critical' : 'high'
        suspiciousPattern.indicators.push('Round number amounts detected')
      }

      // Check for identical amounts (strong indicator)
      const amountGroups = new Map()
      recentMicroUtxos.forEach(utxo => {
        const value = this._extractSatsFromUtxo(utxo)
        const count = amountGroups.get(value) || 0
        amountGroups.set(value, count + 1)
      })

      for (const [amount, count] of amountGroups) {
        if (count >= 3) {
          suspiciousPattern.severity = 'critical'
          suspiciousPattern.indicators.push(`${count} identical amounts of ${amount} sats`)
        }
      }

      // Check for rapid sequence deposits
      if (recentMicroUtxos.length >= this.healthConfig.suspiciousPatterns.rapidDeposits) {
        suspiciousPattern.indicators.push('Rapid sequence of small deposits')
        if (suspiciousPattern.severity === 'none') suspiciousPattern.severity = 'medium'
      }

      // Store pattern for tracking
      if (suspiciousPattern.severity !== 'none') {
        this.dustAttackPatterns.set(address, suspiciousPattern)

        if (this.debug) {
          console.log(`Dust attack detected for ${address}: ${suspiciousPattern.severity} severity`)
        }
      }

      return suspiciousPattern
    } catch (err) {
      console.warn('Dust attack detection failed:', err.message)
      throw new Error(`Dust attack detection failed: ${err.message}`)
    }
  }

  // Private Methods

  _extractSatsFromUtxo (utxo) {
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
    const inputCost = 148 * feeRate // P2PKH input size
    return satsValue > inputCost * this.healthConfig.economicalThreshold
  }

  _isStuckUtxo (utxo) {
    // Simple stuck detection - unconfirmed for too long
    // In real implementation, would check mempool time
    return utxo.blockHeight === -1 // Placeholder - needs mempool time tracking
  }

  _isSuspiciousUtxo (utxo, satsValue) {
    // Detect suspicious patterns
    return (
      satsValue > this.healthConfig.dustLimit &&
      satsValue < this.healthConfig.dustLimit * 2 &&
      utxo.blockHeight === -1
    )
  }

  _calculateDetailedHealthScore (utxo, satsValue, feeRate) {
    let score = 100

    // Economic viability
    if (!this._isEconomicalToSpend(satsValue, feeRate)) score -= 40
    if (satsValue < this.healthConfig.dustLimit) score = 0

    // Confirmation status
    if (utxo.blockHeight === -1) score -= 20

    // Suspicious patterns
    if (this._isSuspiciousUtxo(utxo, satsValue)) score -= 30

    // Fee efficiency penalty (progressive)
    const efficiency = this._calculateFeeEfficiency(satsValue, feeRate)
    if (efficiency < 0.5) {
      score -= 20
    } else if (efficiency < 0.8) {
      score -= 10
    } else if (efficiency < 0.95) {
      score -= 5
    } else if (efficiency < 0.99) {
      score -= 2
    }

    // Token bonus (tokens have additional value)
    if (utxo.token) score += 10

    return Math.max(0, Math.min(100, score))
  }

  _calculateSpendingCost (utxo, feeRate) {
    const inputSize = this._estimateInputSize(utxo)
    return inputSize * feeRate
  }

  _calculateBreakEvenFeeRate (satsValue) {
    const inputSize = 148 // Standard P2PKH
    return satsValue / (inputSize * this.healthConfig.economicalThreshold)
  }

  _calculateFeeEfficiency (satsValue, feeRate) {
    const spendingCost = this._calculateSpendingCost({ script: '' }, feeRate)
    return Math.max(0, (satsValue - spendingCost) / satsValue)
  }

  _estimateInputSize (utxo) {
    // Simplified input size estimation
    if (utxo.token) return 160 // Token inputs are slightly larger
    return 148 // P2PKH standard size
  }

  _identifyRiskFactors (utxo, satsValue) {
    const factors = []

    if (satsValue < this.healthConfig.dustLimit * 2) factors.push('very_small_value')
    if (utxo.blockHeight === -1) factors.push('unconfirmed')
    if (utxo.isCoinbase) factors.push('coinbase_maturity')
    if (this._isRoundNumber(satsValue)) factors.push('round_number_amount')
    if (utxo.token) factors.push('token_utxo')

    return factors
  }

  _isRoundNumber (satsValue) {
    const xecValue = satsValue / 100
    return xecValue % 1 === 0 && (xecValue % 10 === 0 || xecValue % 100 === 0)
  }

  _isRecentUtxo (utxo) {
    // Placeholder - would check actual time difference in real implementation
    return true
  }

  _updateHealthHistory (utxoId, assessment) {
    if (!this.healthHistory.has(utxoId)) {
      this.healthHistory.set(utxoId, [])
    }

    const history = this.healthHistory.get(utxoId)
    history.push({
      timestamp: assessment.assessedAt,
      status: assessment.status,
      healthScore: assessment.healthScore,
      feeRate: assessment.technical.currentFeeRate
    })

    // Keep only last 10 assessments
    if (history.length > 10) {
      history.shift()
    }
  }

  _createSuspiciousUtxoAlert (assessment) {
    return {
      type: 'suspicious_utxo',
      severity: assessment.severity,
      utxoId: assessment.utxoId,
      message: `Suspicious UTXO detected: ${assessment.risks.riskFactors.join(', ')}`,
      recommendations: assessment.recommendations,
      timestamp: Date.now()
    }
  }

  _createHealthAlert (assessment) {
    return {
      type: 'health_issue',
      severity: assessment.severity,
      utxoId: assessment.utxoId,
      message: `UTXO health issue: ${assessment.status}`,
      recommendations: assessment.recommendations,
      timestamp: Date.now()
    }
  }

  _analyzeHealthPatterns (assessments) {
    const alerts = []
    const statusCounts = new Map()

    // Count status occurrences
    for (const assessment of assessments.values()) {
      const count = statusCounts.get(assessment.status) || 0
      statusCounts.set(assessment.status, count + 1)
    }

    // Generate pattern-based alerts
    const dustCount = statusCounts.get('dust') || 0
    const suspiciousCount = statusCounts.get('suspicious') || 0
    const uneconomicalCount = statusCounts.get('uneconomical') || 0

    if (dustCount > 10) {
      alerts.push({
        type: 'wallet_fragmentation',
        severity: 'medium',
        message: `High number of dust UTXOs detected (${dustCount})`,
        recommendations: ['Consider UTXO consolidation', 'Review dust management strategy'],
        timestamp: Date.now()
      })
    }

    if (suspiciousCount > 3) {
      alerts.push({
        type: 'potential_attack',
        severity: 'high',
        message: `Multiple suspicious UTXOs detected (${suspiciousCount})`,
        recommendations: ['Enable privacy mode', 'Avoid spending suspicious UTXOs'],
        timestamp: Date.now()
      })
    }

    if (uneconomicalCount > assessments.size * 0.3) {
      alerts.push({
        type: 'economic_inefficiency',
        severity: 'medium',
        message: `High percentage of uneconomical UTXOs (${uneconomicalCount})`,
        recommendations: ['Wait for lower fees', 'Consider consolidation'],
        timestamp: Date.now()
      })
    }

    return alerts
  }

  _generateSystemRecommendations (summary) {
    const recommendations = []

    if (summary.dust > 0) {
      recommendations.push({
        type: 'consolidation',
        priority: 'medium',
        message: `Consider consolidating ${summary.dust} dust UTXOs`,
        action: 'consolidate_dust',
        estimatedSavings: 'Reduce transaction complexity'
      })
    }

    if (summary.spendablePercentage < 80) {
      recommendations.push({
        type: 'wallet_health',
        priority: 'high',
        message: `Only ${summary.spendablePercentage.toFixed(1)}% of wallet value is economically spendable`,
        action: 'improve_utxo_management',
        estimatedSavings: 'Improve spending efficiency'
      })
    }

    if (summary.suspicious > 0) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        message: `${summary.suspicious} suspicious UTXOs detected - possible attack`,
        action: 'enable_privacy_features',
        estimatedSavings: 'Protect privacy'
      })
    }

    if (summary.unconfirmed > summary.total * 0.2) {
      recommendations.push({
        type: 'confirmation',
        priority: 'low',
        message: `High number of unconfirmed UTXOs (${summary.unconfirmed})`,
        action: 'wait_for_confirmations',
        estimatedSavings: 'Reduce transaction risk'
      })
    }

    return recommendations
  }

  _updateMonitoringMetrics (summary) {
    this.metrics = {
      totalScanned: summary.total,
      healthyCount: summary.healthy,
      unhealthyCount: summary.unhealthy + summary.atRisk,
      dustCount: summary.dust,
      stuckCount: summary.stuck,
      lastUpdateTime: Date.now()
    }
  }

  // Public Interface Methods

  /**
   * Get health history for a specific UTXO
   * @param {string} utxoId - UTXO identifier
   * @returns {Array} Health history
   */
  getHealthHistory (utxoId) {
    return this.healthHistory.get(utxoId) || []
  }

  /**
   * Get active alerts from the last 24 hours
   * @returns {Array} Recent alerts
   */
  getActiveAlerts () {
    const recentAlerts = this.alerts.filter(alert =>
      Date.now() - alert.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    )
    return recentAlerts
  }

  /**
   * Get current monitoring metrics
   * @returns {Object} Monitoring metrics
   */
  getMonitoringMetrics () {
    return { ...this.metrics }
  }

  /**
   * Clear all stored alerts
   */
  clearAlerts () {
    this.alerts = []
  }

  /**
   * Get detected dust attack patterns
   * @returns {Map} Dust attack patterns by address
   */
  getDustAttackPatterns () {
    return new Map(this.dustAttackPatterns)
  }

  /**
   * Generate recommendations for UTXO optimization
   * @param {Array} utxos - UTXOs to analyze
   * @param {number} currentFeeRate - Current fee rate
   * @returns {Object} Optimization recommendations
   */
  generateOptimizationRecommendations (utxos, currentFeeRate = 1.0) {
    const healthReport = this.monitorUtxoSet(utxos, null, currentFeeRate)

    return {
      analysis: {
        totalUtxos: healthReport.summary.total,
        dustUtxos: healthReport.summary.dust,
        fragmentationScore: Math.max(0, 100 - (healthReport.summary.dust * 10)),
        efficiencyScore: healthReport.summary.spendablePercentage
      },
      recommendations: healthReport.recommendations,
      consolidation: {
        recommended: healthReport.summary.dust > 5,
        candidateUtxos: healthReport.summary.dust + healthReport.summary.atRisk,
        estimatedCost: this._estimateConsolidationCost(healthReport.summary.dust, currentFeeRate),
        longTermSavings: this._estimateLongTermSavings(healthReport.summary.dust),
        breakEvenTxCount: Math.ceil(this._estimateConsolidationCost(healthReport.summary.dust, currentFeeRate) / (currentFeeRate * 148))
      }
    }
  }

  _estimateConsolidationCost (dustCount, feeRate) {
    // Estimate cost to consolidate dust UTXOs
    const inputSize = dustCount * 148 // Each dust UTXO as input
    const outputSize = 34 // Single consolidated output
    const overhead = 10 // Transaction overhead
    return (inputSize + outputSize + overhead) * feeRate
  }

  _estimateLongTermSavings (dustCount) {
    // Estimate long-term savings from consolidation
    return dustCount * 148 * 2 // Assume 2 sat/byte average future fee
  }
}

module.exports = UtxoHealthMonitor
