/*
  Unit tests for UTXO Health Monitor
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Unit under test
const UtxoHealthMonitor = require('../../lib/utxo-analytics/UtxoHealthMonitor')

describe('#UtxoHealthMonitor - UTXO Health Monitoring System', () => {
  let sandbox, uut

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    uut = new UtxoHealthMonitor()
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should instantiate health monitor with default config', () => {
      assert.instanceOf(uut, UtxoHealthMonitor)
      assert.property(uut, 'healthConfig')
      assert.property(uut, 'healthHistory')
      assert.property(uut, 'alerts')
      assert.property(uut, 'metrics')
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        dustLimit: 1000,
        economicalThreshold: 3.0,
        suspiciousPatterns: {
          dustAttackSize: 5,
          rapidDeposits: 3
        },
        debug: true
      }

      const monitor = new UtxoHealthMonitor(customConfig)

      assert.equal(monitor.healthConfig.dustLimit, 1000)
      assert.equal(monitor.healthConfig.economicalThreshold, 3.0)
      assert.equal(monitor.healthConfig.suspiciousPatterns.dustAttackSize, 5)
      assert.isTrue(monitor.debug)
    })
  })

  describe('#assessUtxoHealth', () => {
    it('should assess UTXO health comprehensively', () => {
      const utxo = {
        outpoint: { txid: 'health123', outIdx: 0 },
        sats: 50000, // 500 XEC
        blockHeight: 800100
      }
      const currentFeeRate = 1.0

      const assessment = uut.assessUtxoHealth(utxo, null, currentFeeRate)

      // Basic structure
      assert.property(assessment, 'utxoId')
      assert.equal(assessment.utxoId, 'health123:0')
      assert.property(assessment, 'status')
      assert.property(assessment, 'severity')
      assert.property(assessment, 'healthScore')

      // Economic analysis
      assert.property(assessment, 'economic')
      assert.property(assessment.economic, 'isEconomical')
      assert.property(assessment.economic, 'spendingCost')
      assert.property(assessment.economic, 'efficiency')
      assert.property(assessment.economic, 'profitMargin')
      assert.property(assessment.economic, 'breakEvenFeeRate')

      // Risk analysis
      assert.property(assessment, 'risks')
      assert.property(assessment.risks, 'isDust')
      assert.property(assessment.risks, 'isSuspicious')
      assert.property(assessment.risks, 'riskFactors')

      // Technical details
      assert.property(assessment, 'technical')
      assert.equal(assessment.technical.satsValue, 50000)
      assert.equal(assessment.technical.currentFeeRate, 1.0)

      // Should be healthy for this UTXO
      assert.equal(assessment.status, 'healthy')
      assert.isAbove(assessment.healthScore, 70)
    })

    it('should identify dust UTXOs', () => {
      const dustUtxo = {
        outpoint: { txid: 'dust123', outIdx: 0 },
        sats: 300, // Below dust limit
        blockHeight: 800000
      }

      const assessment = uut.assessUtxoHealth(dustUtxo)

      assert.equal(assessment.status, 'dust')
      assert.equal(assessment.severity, 'critical')
      assert.isTrue(assessment.risks.isDust)
      assert.equal(assessment.healthScore, 0)
      assert.include(assessment.recommendations[0], 'consolidating')
    })

    it('should identify suspicious UTXOs', () => {
      const suspiciousUtxo = {
        outpoint: { txid: 'suspicious123', outIdx: 0 },
        sats: 600, // Just above dust limit
        blockHeight: -1 // Unconfirmed
      }

      const assessment = uut.assessUtxoHealth(suspiciousUtxo)

      assert.equal(assessment.status, 'suspicious')
      assert.equal(assessment.severity, 'high')
      assert.isTrue(assessment.risks.isSuspicious)
      assert.include(assessment.recommendations[0], 'Quarantine')
    })

    it('should identify uneconomical UTXOs', () => {
      const uneconomicalUtxo = {
        outpoint: { txid: 'uneconomical123', outIdx: 0 },
        sats: 1000, // Small amount
        blockHeight: 800000
      }
      const highFeeRate = 10.0 // High fee rate makes it uneconomical

      const assessment = uut.assessUtxoHealth(uneconomicalUtxo, null, highFeeRate)

      assert.equal(assessment.status, 'uneconomical')
      assert.equal(assessment.severity, 'medium')
      assert.isFalse(assessment.economic.isEconomical)
      assert.include(assessment.recommendations[0], 'lower fee rates')
    })

    it('should identify unconfirmed UTXOs', () => {
      const unconfirmedUtxo = {
        outpoint: { txid: 'unconfirmed123', outIdx: 0 },
        sats: 50000,
        blockHeight: -1 // Unconfirmed
      }

      const assessment = uut.assessUtxoHealth(unconfirmedUtxo)

      assert.equal(assessment.status, 'unconfirmed')
      assert.equal(assessment.severity, 'low')
      assert.isTrue(assessment.risks.isUnconfirmed)
      assert.include(assessment.recommendations[0], 'confirmation')
    })

    it('should handle token UTXOs', () => {
      const tokenUtxo = {
        outpoint: { txid: 'token123', outIdx: 0 },
        sats: 10000,
        blockHeight: 800000,
        token: { tokenId: 'sometoken123', amount: '100' }
      }

      const assessment = uut.assessUtxoHealth(tokenUtxo)

      assert.isTrue(assessment.risks.hasToken)
      assert.isTrue(assessment.technical.hasToken)
      // Health score should get token bonus
      assert.isAbove(assessment.healthScore, 0)
    })

    it('should calculate economic metrics correctly', () => {
      const utxo = {
        outpoint: { txid: 'economic123', outIdx: 0 },
        sats: 50000,
        blockHeight: 800000
      }
      const feeRate = 2.0

      const assessment = uut.assessUtxoHealth(utxo, null, feeRate)

      // Spending cost should be input size * fee rate
      assert.equal(assessment.economic.spendingCost, 148 * 2.0) // 296 sats

      // Efficiency should be (value - cost) / value
      const expectedEfficiency = (50000 - 296) / 50000
      assert.approximately(assessment.economic.efficiency, expectedEfficiency, 0.01)

      // Profit margin
      assert.equal(assessment.economic.profitMargin, 50000 - 296)

      // Break-even fee rate
      const expectedBreakEven = 50000 / (148 * 2.0) // economicalThreshold = 2.0
      assert.approximately(assessment.economic.breakEvenFeeRate, expectedBreakEven, 0.01)
    })
  })

  describe('#monitorUtxoSet', () => {
    it('should monitor multiple UTXOs and generate comprehensive report', () => {
      const utxos = [
        {
          outpoint: { txid: 'healthy1', outIdx: 0 },
          sats: 50000,
          blockHeight: 800000
        },
        {
          outpoint: { txid: 'dust1', outIdx: 0 },
          sats: 300,
          blockHeight: 800000
        },
        {
          outpoint: { txid: 'suspicious1', outIdx: 0 },
          sats: 600,
          blockHeight: -1
        },
        {
          outpoint: { txid: 'uneconomical1', outIdx: 0 },
          sats: 1000,
          blockHeight: 800000
        }
      ]

      const report = uut.monitorUtxoSet(utxos, null, 5.0) // High fee rate

      // Report structure
      assert.property(report, 'summary')
      assert.property(report, 'assessments')
      assert.property(report, 'alerts')
      assert.property(report, 'recommendations')

      // Summary counts
      assert.equal(report.summary.total, 4)
      assert.equal(report.summary.healthy, 1)
      assert.equal(report.summary.dust, 1)
      assert.equal(report.summary.suspicious, 1)
      assert.equal(report.summary.atRisk, 1) // uneconomical

      // Should have assessments for all UTXOs
      assert.equal(report.assessments.size, 4)

      // Should generate alerts for critical issues
      assert.isArray(report.alerts)
      assert.isAbove(report.alerts.length, 0)

      // Should have recommendations
      assert.isArray(report.recommendations)
      assert.isAbove(report.recommendations.length, 0)

      // Calculate percentages
      assert.equal(report.summary.healthPercentage, 25) // 1/4 = 25%
      assert.isNumber(report.summary.spendablePercentage)
    })

    it('should track token UTXOs separately', () => {
      const utxos = [
        {
          outpoint: { txid: 'regular1', outIdx: 0 },
          sats: 50000,
          blockHeight: 800000
        },
        {
          outpoint: { txid: 'token1', outIdx: 0 },
          sats: 10000,
          blockHeight: 800000,
          token: { tokenId: 'token123', amount: '100' }
        }
      ]

      const report = uut.monitorUtxoSet(utxos)

      assert.equal(report.summary.total, 2)
      assert.equal(report.summary.tokenUtxos, 1)
    })

    it('should handle empty UTXO set', () => {
      const report = uut.monitorUtxoSet([])

      assert.equal(report.summary.total, 0)
      assert.equal(report.summary.healthPercentage, 0)
      assert.equal(report.assessments.size, 0)
    })

    it('should generate pattern-based alerts', () => {
      // Create many dust UTXOs to trigger fragmentation alert
      const utxos = []
      for (let i = 0; i < 15; i++) {
        utxos.push({
          outpoint: { txid: `dust${i}`, outIdx: 0 },
          sats: 300,
          blockHeight: 800000
        })
      }

      const report = uut.monitorUtxoSet(utxos)

      // Should generate wallet fragmentation alert
      const fragmentationAlert = report.alerts.find(alert =>
        alert.type === 'wallet_fragmentation'
      )
      assert.isDefined(fragmentationAlert)
      assert.equal(fragmentationAlert.severity, 'medium')
      assert.include(fragmentationAlert.message, 'dust UTXOs')
    })
  })

  describe('#detectDustAttack', () => {
    it('should detect dust attack patterns', () => {
      // Create suspicious pattern: many micro-UTXOs
      const utxos = []
      for (let i = 0; i < 12; i++) {
        utxos.push({
          outpoint: { txid: `attack${i}`, outIdx: 0 },
          sats: 1050 + i, // Non-round micro amounts to avoid round number escalation
          blockHeight: -1 // Recent/unconfirmed
        })
      }

      const analysis = uut.detectDustAttack(utxos, 'ecash:qp2rmj8heytjrksxm2xrjs0hncnvl08xwgkweawu9h')

      assert.equal(analysis.severity, 'high')
      assert.isArray(analysis.indicators)
      assert.isAbove(analysis.indicators.length, 0)
      assert.include(analysis.indicators[0], 'micro-UTXOs')
      assert.isArray(analysis.utxos)
      assert.equal(analysis.utxos.length, 12)
      assert.isArray(analysis.recommendations)
      assert.include(analysis.recommendations[0], 'micro-UTXOs')
    })

    it('should detect round number patterns', () => {
      const utxos = [
        {
          outpoint: { txid: 'round1', outIdx: 0 },
          sats: 1000, // 10 XEC
          blockHeight: -1
        },
        {
          outpoint: { txid: 'round2', outIdx: 0 },
          sats: 1000, // Same amount
          blockHeight: -1
        },
        {
          outpoint: { txid: 'round3', outIdx: 0 },
          sats: 1000, // Same amount
          blockHeight: -1
        }
      ]

      const analysis = uut.detectDustAttack(utxos, 'ecash:qp2rmj8heytjrksxm2xrjs0hncnvl08xwgkweawu9h')

      assert.isAbove(analysis.indicators.length, 0)
      assert.include(analysis.indicators.join(' '), 'Round number')
    })

    it('should detect identical amounts', () => {
      const utxos = []
      // Create 5 UTXOs with identical amounts
      for (let i = 0; i < 5; i++) {
        utxos.push({
          outpoint: { txid: `identical${i}`, outIdx: 0 },
          sats: 1234, // Identical amount
          blockHeight: -1
        })
      }

      const analysis = uut.detectDustAttack(utxos, 'ecash:qp2rmj8heytjrksxm2xrjs0hncnvl08xwgkweawu9h')

      assert.equal(analysis.severity, 'critical')
      const identicalIndicator = analysis.indicators.find(indicator =>
        indicator.includes('identical amounts')
      )
      assert.isDefined(identicalIndicator)
      assert.include(identicalIndicator, '5 identical amounts of 1234 sats')
    })

    it('should not detect false positives', () => {
      const normalUtxos = [
        {
          outpoint: { txid: 'normal1', outIdx: 0 },
          sats: 50000,
          blockHeight: 800000
        },
        {
          outpoint: { txid: 'normal2', outIdx: 0 },
          sats: 75000,
          blockHeight: 799900
        }
      ]

      const analysis = uut.detectDustAttack(normalUtxos, 'ecash:qp2rmj8heytjrksxm2xrjs0hncnvl08xwgkweawu9h')

      assert.equal(analysis.severity, 'none')
      assert.equal(analysis.indicators.length, 0)
      assert.equal(analysis.utxos.length, 0)
    })
  })

  describe('#generateOptimizationRecommendations', () => {
    it('should generate comprehensive optimization recommendations', () => {
      const utxos = []

      // Add dust UTXOs
      for (let i = 0; i < 8; i++) {
        utxos.push({
          outpoint: { txid: `dust${i}`, outIdx: 0 },
          sats: 400,
          blockHeight: 800000
        })
      }

      // Add healthy UTXOs
      utxos.push({
        outpoint: { txid: 'healthy1', outIdx: 0 },
        sats: 100000,
        blockHeight: 800000
      })

      const recommendations = uut.generateOptimizationRecommendations(utxos, 1.0)

      assert.property(recommendations, 'analysis')
      assert.property(recommendations, 'recommendations')
      assert.property(recommendations, 'consolidation')

      // Analysis
      assert.equal(recommendations.analysis.totalUtxos, 9)
      assert.equal(recommendations.analysis.dustUtxos, 8)
      assert.isNumber(recommendations.analysis.fragmentationScore)
      assert.isNumber(recommendations.analysis.efficiencyScore)

      // Consolidation analysis
      assert.isTrue(recommendations.consolidation.recommended)
      assert.equal(recommendations.consolidation.candidateUtxos, 8) // All dust
      assert.isNumber(recommendations.consolidation.estimatedCost)
      assert.isNumber(recommendations.consolidation.longTermSavings)
      assert.isNumber(recommendations.consolidation.breakEvenTxCount)
    })
  })

  describe('#health tracking and history', () => {
    it('should track health history for UTXOs', () => {
      const utxo = {
        outpoint: { txid: 'tracked', outIdx: 0 },
        sats: 50000,
        blockHeight: 800000
      }

      // Assess multiple times
      uut.assessUtxoHealth(utxo, null, 1.0)
      uut.assessUtxoHealth(utxo, null, 2.0)
      uut.assessUtxoHealth(utxo, null, 5.0)

      const history = uut.getHealthHistory('tracked:0')

      assert.isArray(history)
      assert.equal(history.length, 3)

      // Should track different fee rates
      assert.equal(history[0].feeRate, 1.0)
      assert.equal(history[1].feeRate, 2.0)
      assert.equal(history[2].feeRate, 5.0)

      // Health scores should change with fee rates
      assert.isAbove(history[0].healthScore, history[2].healthScore)
    })

    it('should limit history to 10 entries', () => {
      const utxo = {
        outpoint: { txid: 'history', outIdx: 0 },
        sats: 50000,
        blockHeight: 800000
      }

      // Assess 15 times
      for (let i = 0; i < 15; i++) {
        uut.assessUtxoHealth(utxo, null, 1.0)
      }

      const history = uut.getHealthHistory('history:0')
      assert.equal(history.length, 10) // Should be limited to 10
    })
  })

  describe('#alerts and monitoring', () => {
    it('should track and retrieve active alerts', () => {
      const utxos = [
        {
          outpoint: { txid: 'suspicious1', outIdx: 0 },
          sats: 600,
          blockHeight: -1
        }
      ]

      uut.monitorUtxoSet(utxos)

      const alerts = uut.getActiveAlerts()
      assert.isArray(alerts)
      assert.isAbove(alerts.length, 0)

      const suspiciousAlert = alerts.find(alert => alert.type === 'suspicious_utxo')
      assert.isDefined(suspiciousAlert)
    })

    it('should clear alerts', () => {
      // Generate some alerts first
      const utxos = [
        {
          outpoint: { txid: 'suspicious1', outIdx: 0 },
          sats: 600,
          blockHeight: -1
        }
      ]
      uut.monitorUtxoSet(utxos)

      assert.isAbove(uut.getActiveAlerts().length, 0)

      uut.clearAlerts()
      assert.equal(uut.alerts.length, 0)
    })

    it('should provide monitoring metrics', () => {
      const utxos = [
        {
          outpoint: { txid: 'metric1', outIdx: 0 },
          sats: 50000,
          blockHeight: 800000
        }
      ]

      uut.monitorUtxoSet(utxos)

      const metrics = uut.getMonitoringMetrics()
      assert.property(metrics, 'totalScanned')
      assert.property(metrics, 'healthyCount')
      assert.property(metrics, 'lastUpdateTime')

      assert.equal(metrics.totalScanned, 1)
      assert.equal(metrics.healthyCount, 1)
    })
  })

  describe('#edge cases and error handling', () => {
    it('should handle invalid UTXO structure gracefully', () => {
      const invalidUtxo = { invalid: 'structure' }

      assert.throws(() => {
        uut.assessUtxoHealth(invalidUtxo)
      }, 'Health assessment failed')
    })

    it('should handle missing sats value', () => {
      const utxo = {
        outpoint: { txid: 'nosats', outIdx: 0 },
        blockHeight: 800000
        // Missing sats
      }

      const assessment = uut.assessUtxoHealth(utxo)
      assert.equal(assessment.technical.satsValue, 0)
      assert.equal(assessment.status, 'dust')
    })

    it('should handle BigInt and string sats values', () => {
      const bigIntUtxo = {
        outpoint: { txid: 'bigint', outIdx: 0 },
        sats: BigInt(50000),
        blockHeight: 800000
      }

      const stringUtxo = {
        outpoint: { txid: 'string', outIdx: 0 },
        sats: '75000',
        blockHeight: 800000
      }

      const bigIntAssessment = uut.assessUtxoHealth(bigIntUtxo)
      const stringAssessment = uut.assessUtxoHealth(stringUtxo)

      assert.equal(bigIntAssessment.technical.satsValue, 50000)
      assert.equal(stringAssessment.technical.satsValue, 75000)
    })

    it('should handle dust attack detection errors gracefully', () => {
      const invalidUtxos = [{ invalid: 'structure' }]

      assert.throws(() => {
        uut.detectDustAttack(invalidUtxos, 'address')
      }, 'Dust attack detection failed')
    })
  })

  describe('#performance', () => {
    it('should monitor large UTXO sets efficiently', () => {
      // Generate 50 test UTXOs
      const utxos = []
      for (let i = 0; i < 50; i++) {
        utxos.push({
          outpoint: { txid: `perf${i}`, outIdx: 0 },
          sats: Math.floor(Math.random() * 100000) + 1000,
          blockHeight: 800000 - Math.floor(Math.random() * 100)
        })
      }

      const startTime = Date.now()
      const report = uut.monitorUtxoSet(utxos)
      const duration = Date.now() - startTime

      assert.equal(report.assessments.size, 50)
      assert.isBelow(duration, 1000, 'Should monitor 50 UTXOs in under 1 second')
    })
  })
})
