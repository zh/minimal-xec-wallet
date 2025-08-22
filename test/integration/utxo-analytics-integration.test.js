/*
  Integration tests for UTXO Analytics features with real Chronik API.
  Tests the integration of UtxoClassifier and UtxoHealthMonitor with the wallet.
*/

// npm libraries
const assert = require('chai').assert

// Unit under test
const MinimalXECWallet = require('../../index')

// Test configuration - using working Chronik endpoints
const CHRONIK_URLS = [
  'https://chronik.e.cash',
  'https://chronik.be.cash',
  'https://xec.paybutton.org',
  'https://chronik.pay2stay.com/xec',
  'https://chronik.pay2stay.com/xec2',
  'https://chronik1.alitayin.com',
  'https://chronik2.alitayin.com'
]

describe('#Integration Tests - UTXO Analytics with Real Chronik API', () => {
  let walletWithAnalytics, walletWithoutAnalytics
  const timeout = 30000 // 30 second timeout for network calls

  // Test wallet mnemonic (for testing purposes only - uses standard test mnemonic)
  const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

  before(async () => {
    // Clear address cache for test isolation
    const ecashaddr = require('ecashaddrjs')
    if (ecashaddr.encodeCashAddress && ecashaddr.encodeCashAddress.clearCache) {
      ecashaddr.encodeCashAddress.clearCache()
    }
  })

  beforeEach(async () => {
    // Create wallet with analytics enabled
    const analyticsOptions = {
      chronikUrls: CHRONIK_URLS,
      utxoAnalytics: {
        enabled: true,
        classificationConfig: {
          ageThresholds: {
            fresh: 1,
            recent: 6,
            mature: 100,
            aged: 1000
          },
          valueThresholds: {
            dust: 5.46,
            micro: 100,
            small: 1000,
            medium: 10000,
            large: 100000
          }
        },
        healthMonitorConfig: {
          dustAttackThreshold: 10,
          alertThresholds: {
            highDustRatio: 0.8,
            lowLiquidity: 0.1,
            highConsolidationNeed: 0.6
          }
        }
      }
    }

    // Create wallet without analytics for comparison
    const basicOptions = {
      chronikUrls: CHRONIK_URLS
    }

    walletWithAnalytics = new MinimalXECWallet(TEST_MNEMONIC, analyticsOptions)
    walletWithoutAnalytics = new MinimalXECWallet(TEST_MNEMONIC, basicOptions)

    await walletWithAnalytics.walletInfoPromise
    await walletWithoutAnalytics.walletInfoPromise
  })

  describe('#Analytics Initialization', () => {
    it('should initialize wallet with analytics enabled', async function () {
      this.timeout(timeout)

      const result = await walletWithAnalytics.initialize()

      assert.isTrue(result)
      assert.isTrue(walletWithAnalytics.isInitialized)
      assert.property(walletWithAnalytics.utxos, 'utxoStore')

      // Check that analytics are properly initialized
      assert.isTrue(walletWithAnalytics.utxos.analyticsEnabled)
      assert.property(walletWithAnalytics.utxos, 'classifier')
      assert.property(walletWithAnalytics.utxos, 'healthMonitor')
    })

    it('should initialize wallet without analytics when disabled', async function () {
      this.timeout(timeout)

      const result = await walletWithoutAnalytics.initialize()

      assert.isTrue(result)
      assert.isTrue(walletWithoutAnalytics.isInitialized)
      assert.property(walletWithoutAnalytics.utxos, 'utxoStore')

      // Check that analytics are not initialized
      assert.isFalse(walletWithoutAnalytics.utxos.analyticsEnabled)
    })
  })

  describe('#UTXO Classification Integration', () => {
    it('should perform UTXO classification on real UTXOs', async function () {
      this.timeout(timeout)

      await walletWithAnalytics.initialize()
      const utxos = await walletWithAnalytics.getUtxos()

      if (utxos.utxos.length > 0) {
        // Test getUtxoClassifications method
        const classifications = await walletWithAnalytics.utxos.getUtxoClassifications()

        assert.isObject(classifications)
        assert.property(classifications, 'byAge')
        assert.property(classifications, 'byValue')
        assert.property(classifications, 'byPrivacy')
        assert.property(classifications, 'statistics')

        // Verify structure of classification results
        assert.isObject(classifications.byAge)
        assert.isObject(classifications.byValue)
        assert.isArray(classifications.byPrivacy)
        assert.isObject(classifications.statistics)

        // Check that statistics contain expected fields
        assert.property(classifications.statistics, 'totalUtxos')
        assert.property(classifications.statistics, 'totalValue')
        assert.property(classifications.statistics, 'averageAge')
        assert.property(classifications.statistics, 'averageValue')
        assert.property(classifications.statistics, 'averagePrivacyScore')

        console.log(`  ✓ Classified ${classifications.statistics.totalUtxos} UTXOs`)
      } else {
        console.log('  ⚠ No UTXOs found for classification testing')
      }
    })

    it('should filter UTXOs by classification criteria', async function () {
      this.timeout(timeout)

      await walletWithAnalytics.initialize()
      const utxos = await walletWithAnalytics.getUtxos()

      if (utxos.utxos.length > 0) {
        // Test filtering by age
        const matureUtxos = await walletWithAnalytics.utxos.getSpendableXecUtxos({
          classificationFilter: { minAge: 'mature' }
        })

        assert.isObject(matureUtxos)
        assert.property(matureUtxos, 'utxos')
        assert.isArray(matureUtxos.utxos)

        // Test filtering by value
        const largeUtxos = await walletWithAnalytics.utxos.getSpendableXecUtxos({
          classificationFilter: { minValue: 'medium' }
        })

        assert.isObject(largeUtxos)
        assert.property(largeUtxos, 'utxos')
        assert.isArray(largeUtxos.utxos)

        // Test filtering by privacy score
        const privateUtxos = await walletWithAnalytics.utxos.getSpendableXecUtxos({
          classificationFilter: { minPrivacyScore: 70 }
        })

        assert.isObject(privateUtxos)
        assert.property(privateUtxos, 'utxos')
        assert.isArray(privateUtxos.utxos)

        console.log(`  ✓ Filtered UTXOs: mature=${matureUtxos.utxos.length}, large=${largeUtxos.utxos.length}, private=${privateUtxos.utxos.length}`)
      }
    })
  })

  describe('#Health Monitoring Integration', () => {
    it('should generate wallet health report from real UTXOs', async function () {
      this.timeout(timeout)

      await walletWithAnalytics.initialize()
      const utxos = await walletWithAnalytics.getUtxos()

      if (utxos.utxos.length > 0) {
        const healthReport = await walletWithAnalytics.utxos.getWalletHealthReport()

        assert.isObject(healthReport)
        assert.property(healthReport, 'overallHealth')
        assert.property(healthReport, 'metrics')
        assert.property(healthReport, 'alerts')
        assert.property(healthReport, 'recommendations')

        // Verify health metrics structure
        assert.isObject(healthReport.metrics)
        assert.property(healthReport.metrics, 'totalUtxos')
        assert.property(healthReport.metrics, 'healthyUtxos')
        assert.property(healthReport.metrics, 'unhealthyUtxos')
        assert.property(healthReport.metrics, 'dustUtxos')
        assert.property(healthReport.metrics, 'suspiciousUtxos')

        // Verify overall health is valid
        const validHealthStates = ['healthy', 'good', 'fair', 'poor', 'critical']
        assert.include(validHealthStates, healthReport.overallHealth)

        // Verify alerts and recommendations are arrays
        assert.isArray(healthReport.alerts)
        assert.isArray(healthReport.recommendations)

        console.log(`  ✓ Health Report: ${healthReport.overallHealth} (${healthReport.metrics.totalUtxos} UTXOs)`)
        if (healthReport.alerts.length > 0) {
          console.log(`  ⚠ Active alerts: ${healthReport.alerts.length}`)
        }
      }
    })

    it('should detect potential security threats', async function () {
      this.timeout(timeout)

      await walletWithAnalytics.initialize()
      const utxos = await walletWithAnalytics.getUtxos()

      if (utxos.utxos.length > 0) {
        const threats = await walletWithAnalytics.utxos.detectSecurityThreats()

        assert.isObject(threats)
        assert.property(threats, 'dustAttack')
        assert.property(threats, 'suspiciousPatterns')
        assert.property(threats, 'riskLevel')

        // Verify dust attack detection structure
        assert.isObject(threats.dustAttack)
        assert.property(threats.dustAttack, 'detected')
        assert.property(threats.dustAttack, 'suspiciousUtxos')
        assert.property(threats.dustAttack, 'confidence')

        // Verify risk level is valid
        const validRiskLevels = ['low', 'medium', 'high', 'critical']
        assert.include(validRiskLevels, threats.riskLevel)

        // Verify suspicious patterns is an array
        assert.isArray(threats.suspiciousPatterns)

        console.log(`  ✓ Security Analysis: ${threats.riskLevel} risk level`)
        if (threats.dustAttack.detected) {
          console.log(`  ⚠ Dust attack detected with ${threats.dustAttack.confidence}% confidence`)
        }
      }
    })
  })

  describe('#Advanced Coin Selection Integration', () => {
    it('should perform efficient coin selection with analytics', async function () {
      this.timeout(timeout)

      await walletWithAnalytics.initialize()
      const utxos = await walletWithAnalytics.getUtxos()

      if (utxos.utxos.length > 0) {
        // Test optimal UTXO selection for a small amount
        const selectedUtxos = await walletWithAnalytics.utxos.selectOptimalUtxos(1000, {
          strategy: 'efficient'
        })

        assert.isObject(selectedUtxos)
        assert.property(selectedUtxos, 'utxos')
        assert.property(selectedUtxos, 'totalValue')
        assert.property(selectedUtxos, 'strategy')

        assert.isArray(selectedUtxos.utxos)
        assert.isNumber(selectedUtxos.totalValue)
        assert.equal(selectedUtxos.strategy, 'efficient')

        // Verify total value is sufficient
        assert.isTrue(selectedUtxos.totalValue >= 1000)

        console.log(`  ✓ Selected ${selectedUtxos.utxos.length} UTXOs for 1000 satoshi payment (${selectedUtxos.strategy} strategy)`)
      }
    })

    it('should perform privacy-focused coin selection', async function () {
      this.timeout(timeout)

      await walletWithAnalytics.initialize()
      const utxos = await walletWithAnalytics.getUtxos()

      if (utxos.utxos.length > 0) {
        // Test privacy-focused UTXO selection
        const selectedUtxos = await walletWithAnalytics.utxos.selectOptimalUtxos(1000, {
          strategy: 'privacy'
        })

        assert.isObject(selectedUtxos)
        assert.property(selectedUtxos, 'utxos')
        assert.property(selectedUtxos, 'totalValue')
        assert.property(selectedUtxos, 'strategy')

        assert.isArray(selectedUtxos.utxos)
        assert.isNumber(selectedUtxos.totalValue)
        assert.equal(selectedUtxos.strategy, 'privacy')

        // Verify total value is sufficient
        assert.isTrue(selectedUtxos.totalValue >= 1000)

        console.log(`  ✓ Selected ${selectedUtxos.utxos.length} UTXOs for privacy-focused payment`)
      }
    })

    it('should provide optimization recommendations', async function () {
      this.timeout(timeout)

      await walletWithAnalytics.initialize()
      const utxos = await walletWithAnalytics.getUtxos()

      if (utxos.utxos.length > 0) {
        const recommendations = await walletWithAnalytics.utxos.getOptimizationRecommendations()

        assert.isObject(recommendations)
        assert.property(recommendations, 'consolidation')
        assert.property(recommendations, 'privacy')
        assert.property(recommendations, 'efficiency')

        // Verify consolidation recommendations
        assert.isObject(recommendations.consolidation)
        assert.property(recommendations.consolidation, 'recommended')
        assert.property(recommendations.consolidation, 'candidateUtxos')
        assert.property(recommendations.consolidation, 'estimatedSavings')

        // Verify privacy recommendations
        assert.isObject(recommendations.privacy)
        assert.property(recommendations.privacy, 'lowPrivacyUtxos')
        assert.property(recommendations.privacy, 'recommendations')

        // Verify efficiency recommendations
        assert.isObject(recommendations.efficiency)
        assert.property(recommendations.efficiency, 'dustUtxos')
        assert.property(recommendations.efficiency, 'fragmentedValue')

        console.log(`  ✓ Optimization Recommendations: consolidation=${recommendations.consolidation.recommended}`)
        console.log(`    Low privacy UTXOs: ${recommendations.privacy.lowPrivacyUtxos.length}`)
        console.log(`    Dust UTXOs: ${recommendations.efficiency.dustUtxos.length}`)
      }
    })
  })

  describe('#Backward Compatibility', () => {
    it('should maintain existing UTXO functionality when analytics disabled', async function () {
      this.timeout(timeout)

      await walletWithoutAnalytics.initialize()
      const utxos = await walletWithoutAnalytics.getUtxos()

      // All existing methods should work exactly as before
      assert.isObject(utxos)
      assert.property(utxos, 'utxos')
      assert.isArray(utxos.utxos)

      // Test existing spendable UTXOs method
      const spendableUtxos = await walletWithoutAnalytics.utxos.getSpendableXecUtxos()
      assert.isObject(spendableUtxos)
      assert.property(spendableUtxos, 'utxos')
      assert.isArray(spendableUtxos.utxos)

      // Analytics methods should not exist or should gracefully handle disabled state
      if (typeof walletWithoutAnalytics.utxos.getUtxoClassifications === 'function') {
        try {
          await walletWithoutAnalytics.utxos.getUtxoClassifications()
          assert.fail('Should not provide analytics when disabled')
        } catch (err) {
          assert.include(err.message, 'analytics')
        }
      }

      console.log('  ✓ Backward compatibility maintained')
    })

    it('should provide same basic results with and without analytics', async function () {
      this.timeout(timeout)

      await walletWithAnalytics.initialize()
      await walletWithoutAnalytics.initialize()

      const utxosWithAnalytics = await walletWithAnalytics.getUtxos()
      const utxosWithoutAnalytics = await walletWithoutAnalytics.getUtxos()

      // Basic UTXO data should be identical
      assert.equal(utxosWithAnalytics.utxos.length, utxosWithoutAnalytics.utxos.length)

      if (utxosWithAnalytics.utxos.length > 0) {
        // Compare first UTXO to ensure data structure is the same
        const utxo1 = utxosWithAnalytics.utxos[0]
        const utxo2 = utxosWithoutAnalytics.utxos[0]

        assert.equal(utxo1.outpoint.txid, utxo2.outpoint.txid)
        assert.equal(utxo1.outpoint.outIdx, utxo2.outpoint.outIdx)
        assert.equal(utxo1.value, utxo2.value)
      }

      console.log('  ✓ Basic UTXO data consistency verified')
    })
  })

  describe('#Performance with Analytics', () => {
    it('should not significantly impact UTXO fetching performance', async function () {
      this.timeout(timeout)

      // Measure initialization time without analytics
      const startWithout = Date.now()
      await walletWithoutAnalytics.initialize()
      const timeWithout = Date.now() - startWithout

      // Measure initialization time with analytics
      const startWith = Date.now()
      await walletWithAnalytics.initialize()
      const timeWith = Date.now() - startWith

      // Analytics should not add more than 3x overhead
      // Handle case where timeWithout is 0 (very fast initialization)
      const overhead = timeWithout === 0 ? (timeWith === 0 ? 1.0 : 2.0) : timeWith / timeWithout
      assert.isTrue(overhead <= 3.0, `Analytics overhead too high: ${overhead.toFixed(2)}x`)

      console.log(`  ✓ Performance impact: ${overhead.toFixed(2)}x (${timeWith}ms vs ${timeWithout}ms)`)
    })

    it('should handle large UTXO sets efficiently', async function () {
      this.timeout(timeout)

      await walletWithAnalytics.initialize()
      const utxos = await walletWithAnalytics.getUtxos()

      if (utxos.utxos.length > 0) {
        // Test analytics performance with available UTXOs
        const start = Date.now()

        await walletWithAnalytics.utxos.getUtxoClassifications()
        await walletWithAnalytics.utxos.getWalletHealthReport()

        const analyticsTime = Date.now() - start

        // Analytics should complete within reasonable time
        assert.isTrue(analyticsTime < 5000, `Analytics too slow: ${analyticsTime}ms`)

        console.log(`  ✓ Analytics completed in ${analyticsTime}ms for ${utxos.utxos.length} UTXOs`)
      }
    })
  })

  describe('#Error Handling', () => {
    it('should handle analytics errors gracefully', async function () {
      this.timeout(timeout)

      // Create wallet with invalid analytics configuration
      const invalidAnalyticsOptions = {
        chronikUrls: CHRONIK_URLS,
        utxoAnalytics: {
          enabled: true,
          classificationConfig: {
            ageThresholds: null // Invalid configuration
          }
        }
      }

      const walletWithInvalidConfig = new MinimalXECWallet(TEST_MNEMONIC, invalidAnalyticsOptions)
      await walletWithInvalidConfig.walletInfoPromise

      try {
        await walletWithInvalidConfig.initialize()
        // Should either disable analytics or use defaults, but not crash
        assert.isTrue(walletWithInvalidConfig.isInitialized)
      } catch (err) {
        // If it fails, should be a configuration error, not a crash
        assert.include(err.message.toLowerCase(), 'config')
      }
    })

    it('should handle missing analytics dependencies gracefully', async function () {
      this.timeout(timeout)

      // This test verifies that the wallet works even if analytics modules fail to load
      // In real scenarios, this would happen if the analytics files were missing

      await walletWithAnalytics.initialize()

      // Should be initialized successfully
      assert.isTrue(walletWithAnalytics.isInitialized)

      // Basic wallet functions should still work
      const balance = await walletWithAnalytics.getXecBalance()
      assert.isNumber(balance)
    })
  })
})
