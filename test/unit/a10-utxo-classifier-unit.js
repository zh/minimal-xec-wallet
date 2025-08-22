/*
  Unit tests for UTXO Classifier
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Unit under test
const UtxoClassifier = require('../../lib/utxo-analytics/UtxoClassifier')

// Test data
// Note: Mock UTXOs are created inline for better test isolation

describe('#UtxoClassifier - UTXO Classification Engine', () => {
  let sandbox, uut

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    uut = new UtxoClassifier()
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should instantiate classifier with default config', () => {
      assert.instanceOf(uut, UtxoClassifier)
      assert.property(uut, 'ageThresholds')
      assert.property(uut, 'valueThresholds')
      assert.property(uut, 'privacyConfig')
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        ageThresholds: { fresh: 10, recent: 200 },
        valueThresholds: { dust: 2000, micro: 10000 },
        dustLimit: 1000,
        debug: true
      }

      const classifier = new UtxoClassifier(customConfig)

      assert.equal(classifier.ageThresholds.fresh, 10)
      assert.equal(classifier.ageThresholds.recent, 200)
      assert.equal(classifier.valueThresholds.dust, 2000)
      assert.equal(classifier.dustLimit, 1000)
      assert.isTrue(classifier.debug)
    })
  })

  describe('#classifyUtxo', () => {
    it('should classify a single UTXO comprehensively', () => {
      const utxo = {
        outpoint: { txid: 'abc123', outIdx: 0 },
        sats: 50000, // 500 XEC
        blockHeight: 800100,
        script: '76a914389ffce9cd9ae88dcc0631e88a821ffdbe9bfe2615488ac'
      }
      const currentBlockHeight = 800200 // 100 blocks old

      const classification = uut.classifyUtxo(utxo, currentBlockHeight)

      // Basic structure
      assert.property(classification, 'id')
      assert.equal(classification.id, 'abc123:0')
      assert.equal(classification.txid, 'abc123')
      assert.equal(classification.outIdx, 0)

      // Age analysis
      assert.property(classification, 'age')
      assert.property(classification, 'ageInBlocks')
      assert.property(classification, 'ageScore')
      assert.equal(classification.ageInBlocks, 100)

      // Value analysis
      assert.property(classification, 'value')
      assert.property(classification, 'satsValue')
      assert.property(classification, 'valueScore')
      assert.equal(classification.satsValue, 50000)
      assert.equal(classification.value, 'medium') // 500 XEC = medium

      // Health assessment
      assert.property(classification, 'health')
      assert.property(classification, 'healthScore')
      assert.isNumber(classification.healthScore)

      // Privacy analysis
      assert.property(classification, 'privacy')
      assert.property(classification, 'privacyFactors')
      assert.isNumber(classification.privacy)

      // Metadata
      assert.property(classification, 'metadata')
      assert.isBoolean(classification.metadata.isConfirmed)
      assert.isBoolean(classification.metadata.isDust)
      assert.isBoolean(classification.metadata.isEconomical)
    })

    it('should handle unconfirmed UTXOs', () => {
      const utxo = {
        outpoint: { txid: 'def456', outIdx: 1 },
        sats: 10000,
        blockHeight: -1 // Unconfirmed
      }

      const classification = uut.classifyUtxo(utxo, 800000)

      assert.equal(classification.age, 'unconfirmed')
      assert.equal(classification.ageInBlocks, -1)
      assert.equal(classification.ageScore, 0)
      assert.isFalse(classification.metadata.isConfirmed)
    })

    it('should handle dust UTXOs', () => {
      const utxo = {
        outpoint: { txid: 'dust123', outIdx: 0 },
        sats: 500, // Below dust threshold
        blockHeight: 800000
      }

      const classification = uut.classifyUtxo(utxo, 800100)

      assert.equal(classification.value, 'dust')
      assert.equal(classification.health, 'dust')
      assert.equal(classification.valueScore, 0)
      assert.isTrue(classification.metadata.isDust)
    })

    it('should detect round number amounts', () => {
      const utxo = {
        outpoint: { txid: 'round123', outIdx: 0 },
        sats: 100000, // 1000 XEC (round number)
        blockHeight: 800000
      }

      const classification = uut.classifyUtxo(utxo, 800100)

      assert.isTrue(classification.privacyFactors.isRoundNumber)
      // Privacy score should be penalized
      assert.isBelow(classification.privacy, 100)
    })

    it('should handle token UTXOs', () => {
      const utxo = {
        outpoint: { txid: 'token123', outIdx: 0 },
        sats: 10000,
        blockHeight: 800000,
        token: { tokenId: 'sometoken123', amount: '100' }
      }

      const classification = uut.classifyUtxo(utxo, 800100)

      assert.isTrue(classification.metadata.hasToken)
      // Health score should get token bonus
      assert.isAbove(classification.healthScore, 0)
    })
  })

  describe('#classifyUtxos', () => {
    it('should classify multiple UTXOs efficiently', () => {
      const utxos = [
        {
          outpoint: { txid: 'utxo1', outIdx: 0 },
          sats: 10000,
          blockHeight: 800000
        },
        {
          outpoint: { txid: 'utxo2', outIdx: 1 },
          sats: 50000,
          blockHeight: 799900
        },
        {
          outpoint: { txid: 'utxo3', outIdx: 0 },
          sats: 1000000,
          blockHeight: -1
        }
      ]

      const classifications = uut.classifyUtxos(utxos, 800100)

      assert.instanceOf(classifications, Map)
      assert.equal(classifications.size, 3)

      // Check all UTXOs were classified
      assert.isTrue(classifications.has('utxo1:0'))
      assert.isTrue(classifications.has('utxo2:1'))
      assert.isTrue(classifications.has('utxo3:0'))

      // Verify different classifications
      const utxo1Class = classifications.get('utxo1:0')
      const utxo2Class = classifications.get('utxo2:1')
      const utxo3Class = classifications.get('utxo3:0')

      assert.equal(utxo1Class.value, 'small')
      assert.equal(utxo2Class.value, 'medium')
      assert.equal(utxo3Class.value, 'large')
      assert.equal(utxo3Class.age, 'unconfirmed')
    })

    it('should handle classification errors gracefully', () => {
      const utxos = [
        {
          outpoint: { txid: 'good1', outIdx: 0 },
          sats: 10000,
          blockHeight: 800000
        },
        {
          // Invalid UTXO - missing outpoint
          sats: 20000,
          blockHeight: 800000
        },
        {
          outpoint: { txid: 'good2', outIdx: 1 },
          sats: 30000,
          blockHeight: 800000
        }
      ]

      const classifications = uut.classifyUtxos(utxos, 800100)

      // Should classify valid UTXOs despite errors
      assert.equal(classifications.size, 2)
      assert.isTrue(classifications.has('good1:0'))
      assert.isTrue(classifications.has('good2:1'))
    })
  })

  describe('#_calculateAge', () => {
    it('should calculate age correctly', () => {
      const utxo = { blockHeight: 800000 }
      const currentHeight = 800150

      const age = uut._calculateAge(utxo, currentHeight)
      assert.equal(age, 150)
    })

    it('should handle unconfirmed UTXOs', () => {
      const utxo = { blockHeight: -1 }
      const age = uut._calculateAge(utxo, 800000)
      assert.equal(age, -1)
    })

    it('should handle edge case where current height equals UTXO height', () => {
      const utxo = { blockHeight: 800000 }
      const age = uut._calculateAge(utxo, 800000)
      assert.equal(age, 0)
    })
  })

  describe('#_classifyAge', () => {
    it('should classify ages correctly', () => {
      const tests = [
        { age: -1, expected: 'unconfirmed' },
        { age: 0, expected: 'fresh' },
        { age: 5, expected: 'fresh' },
        { age: 6, expected: 'fresh' },
        { age: 7, expected: 'recent' },
        { age: 144, expected: 'recent' },
        { age: 145, expected: 'mature' },
        { age: 1008, expected: 'mature' },
        { age: 1009, expected: 'aged' },
        { age: 4032, expected: 'aged' },
        { age: 4033, expected: 'ancient' }
      ]

      tests.forEach(test => {
        const utxo = { blockHeight: test.age === -1 ? -1 : 800000 - test.age }
        const result = uut._classifyAge(utxo, 800000)
        assert.equal(result, test.expected, `Age ${test.age} should be ${test.expected}`)
      })
    })
  })

  describe('#_classifyValue', () => {
    it('should classify values correctly', () => {
      const tests = [
        { sats: 500, expected: 'dust' },
        { sats: 1000, expected: 'micro' },
        { sats: 5000, expected: 'small' },
        { sats: 50000, expected: 'medium' },
        { sats: 500000, expected: 'large' },
        { sats: 5000000, expected: 'whale' },
        { sats: 10000000, expected: 'whale' }
      ]

      tests.forEach(test => {
        const result = uut._classifyValue(test.sats)
        assert.equal(result, test.expected, `${test.sats} sats should be ${test.expected}`)
      })
    })
  })

  describe('#_calculatePrivacyScore', () => {
    it('should calculate privacy scores', () => {
      const utxo = {
        outpoint: { txid: 'privacy123', outIdx: 0 },
        sats: 12345, // Non-round number
        blockHeight: 800000
      }

      const score = uut._calculatePrivacyScore(utxo, 12345, 100)

      assert.isNumber(score)
      assert.isAtLeast(score, 0)
      assert.isAtMost(score, 100)
    })

    it('should penalize round numbers', () => {
      const roundUtxo = {
        outpoint: { txid: 'round123', outIdx: 0 },
        sats: 100000, // 1000 XEC - round number
        blockHeight: 800000
      }

      const nonRoundUtxo = {
        outpoint: { txid: 'nonround123', outIdx: 0 },
        sats: 101234, // Non-round
        blockHeight: 800000
      }

      const roundScore = uut._calculatePrivacyScore(roundUtxo, 100000, 100)
      const nonRoundScore = uut._calculatePrivacyScore(nonRoundUtxo, 101234, 100)

      assert.isBelow(roundScore, nonRoundScore, 'Round numbers should have lower privacy scores')
    })

    it('should give age bonus', () => {
      const utxo = {
        outpoint: { txid: 'age123', outIdx: 0 },
        sats: 50000,
        blockHeight: 800000
      }

      const youngScore = uut._calculatePrivacyScore(utxo, 50000, 10) // Young
      const oldScore = uut._calculatePrivacyScore(utxo, 50000, 1000) // Old

      assert.isBelow(youngScore, oldScore, 'Older UTXOs should have better privacy')
    })
  })

  describe('#getClassificationStats', () => {
    it('should generate comprehensive statistics', () => {
      const classifications = new Map()

      // Add sample classifications
      classifications.set('utxo1:0', {
        age: 'fresh',
        value: 'small',
        health: 'healthy',
        privacy: 80,
        healthScore: 90,
        ageScore: 20,
        valueScore: 85,
        satsValue: 50000,
        metadata: { hasToken: false, isEconomical: true }
      })

      classifications.set('utxo2:1', {
        age: 'mature',
        value: 'dust',
        health: 'dust',
        privacy: 40,
        healthScore: 10,
        ageScore: 70,
        valueScore: 0,
        satsValue: 500,
        metadata: { hasToken: false, isEconomical: false }
      })

      const stats = uut.getClassificationStats(classifications)

      assert.equal(stats.total, 2)
      assert.equal(stats.byAge.fresh, 1)
      assert.equal(stats.byAge.mature, 1)
      assert.equal(stats.byValue.small, 1)
      assert.equal(stats.byValue.dust, 1)
      assert.equal(stats.byHealth.healthy, 1)
      assert.equal(stats.byHealth.dust, 1)

      assert.equal(stats.averagePrivacyScore, 60) // (80 + 40) / 2
      assert.equal(stats.averageHealthScore, 50) // (90 + 10) / 2
      assert.equal(stats.totalValue, 50500) // 50000 + 500
      assert.equal(stats.spendableValue, 50000) // Only economical UTXO
      assert.equal(stats.tokenUtxos, 0)
    })

    it('should handle empty classifications', () => {
      const stats = uut.getClassificationStats(new Map())

      assert.equal(stats.total, 0)
      assert.equal(stats.averagePrivacyScore, 0)
      assert.equal(stats.totalValue, 0)
    })
  })

  describe('#filterByClassification', () => {
    it('should filter UTXOs by criteria', () => {
      const classifications = new Map()

      classifications.set('good:0', {
        healthScore: 80,
        privacy: 70,
        age: 'mature',
        value: 'small',
        metadata: { hasToken: false, isConfirmed: true }
      })

      classifications.set('bad:0', {
        healthScore: 30,
        privacy: 20,
        age: 'unconfirmed',
        value: 'dust',
        metadata: { hasToken: false, isConfirmed: false }
      })

      classifications.set('token:0', {
        healthScore: 90,
        privacy: 80,
        age: 'mature',
        value: 'medium',
        metadata: { hasToken: true, isConfirmed: true }
      })

      // Filter by health score
      const highHealth = uut.filterByClassification(classifications, { minHealthScore: 50 })
      assert.deepEqual(highHealth, ['good:0', 'token:0'])

      // Filter by privacy score
      const highPrivacy = uut.filterByClassification(classifications, { minPrivacyScore: 60 })
      assert.deepEqual(highPrivacy, ['good:0', 'token:0'])

      // Filter excluding tokens
      const noTokens = uut.filterByClassification(classifications, { includeTokens: false, includeUnconfirmed: true })
      assert.deepEqual(noTokens, ['good:0', 'bad:0'])

      // Filter excluding unconfirmed
      const confirmedOnly = uut.filterByClassification(classifications, { includeUnconfirmed: false })
      assert.deepEqual(confirmedOnly, ['good:0', 'token:0'])

      // Filter by age
      const matureOnly = uut.filterByClassification(classifications, { allowedAges: ['mature'] })
      assert.deepEqual(matureOnly, ['good:0', 'token:0'])
    })
  })

  describe('#getOptimizationRecommendations', () => {
    it('should generate optimization recommendations', () => {
      const classifications = new Map()

      // Add dust UTXOs
      for (let i = 0; i < 8; i++) {
        classifications.set(`dust${i}:0`, {
          healthScore: 0,
          privacy: 30,
          age: 'recent',
          value: 'dust',
          health: 'dust',
          satsValue: 500,
          metadata: { isEconomical: false }
        })
      }

      // Add suspicious UTXOs
      classifications.set('suspicious:0', {
        healthScore: 20,
        privacy: 10,
        age: 'unconfirmed',
        value: 'micro',
        health: 'suspicious',
        satsValue: 1000,
        metadata: { isEconomical: false }
      })

      const recommendations = uut.getOptimizationRecommendations(classifications)

      assert.property(recommendations, 'recommendations')
      assert.property(recommendations, 'stats')
      assert.isArray(recommendations.recommendations)
      assert.isAbove(recommendations.recommendations.length, 0)

      // Should recommend dust consolidation
      const dustRec = recommendations.recommendations.find(r => r.type === 'consolidation')
      assert.isDefined(dustRec)
      assert.include(dustRec.description, '8 dust UTXOs')

      // Should recommend security measures
      const securityRec = recommendations.recommendations.find(r => r.type === 'security')
      assert.isDefined(securityRec)
    })
  })

  describe('#edge cases and error handling', () => {
    it('should handle invalid UTXO structure', () => {
      const invalidUtxo = { invalid: 'structure' }

      assert.throws(() => {
        uut.classifyUtxo(invalidUtxo, 800000)
      }, 'UTXO classification failed')
    })

    it('should handle missing sats value', () => {
      const utxo = {
        outpoint: { txid: 'nosats', outIdx: 0 },
        blockHeight: 800000
        // Missing sats/value
      }

      const classification = uut.classifyUtxo(utxo, 800100)
      assert.equal(classification.satsValue, 0)
      assert.equal(classification.value, 'dust')
    })

    it('should handle BigInt sats values', () => {
      const utxo = {
        outpoint: { txid: 'bigint', outIdx: 0 },
        sats: BigInt(50000),
        blockHeight: 800000
      }

      const classification = uut.classifyUtxo(utxo, 800100)
      assert.equal(classification.satsValue, 50000)
    })

    it('should handle string sats values', () => {
      const utxo = {
        outpoint: { txid: 'string', outIdx: 0 },
        sats: '75000',
        blockHeight: 800000
      }

      const classification = uut.classifyUtxo(utxo, 800100)
      assert.equal(classification.satsValue, 75000)
    })
  })

  describe('#performance', () => {
    it('should handle large UTXO sets efficiently', () => {
      // Generate 100 test UTXOs
      const utxos = []
      for (let i = 0; i < 100; i++) {
        utxos.push({
          outpoint: { txid: `perf${i}`, outIdx: 0 },
          sats: Math.floor(Math.random() * 1000000) + 1000,
          blockHeight: 800000 - Math.floor(Math.random() * 1000)
        })
      }

      const startTime = Date.now()
      const classifications = uut.classifyUtxos(utxos, 800000)
      const duration = Date.now() - startTime

      assert.equal(classifications.size, 100)
      assert.isBelow(duration, 1000, 'Should classify 100 UTXOs in under 1 second')
    })
  })
})
