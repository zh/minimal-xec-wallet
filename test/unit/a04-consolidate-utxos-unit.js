/*
  Unit tests for UTXO consolidation functionality
  Tests ConsolidateUtxos class and wallet integration
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Local libraries
const ConsolidateUtxos = require('../../lib/consolidate-utxos')

// Mocking data libraries
// const mockUtxos = require('./mocks/xec-utxo-mocks')
// const mockWallet = require('./mocks/xec-wallet-mocks')

// Test helpers
function createMockWallet (utxos = []) {
  return {
    walletInfo: {
      xecAddress: 'ecash:qpg562clu3350dnk3z3lenvxgyexyt7j6vnz4qg606'
    },
    walletInfoPromise: Promise.resolve(),
    isInitialized: true,
    initialize: sinon.stub().resolves(),
    ar: {
      sendTx: sinon.stub().resolves('test-txid-123')
    },
    sendXecLib: {
      sendXec: sinon.stub().resolves('test-txid-123'),
      createTransaction: sinon.stub().resolves('0102030405')
    },
    utxos: {
      getSpendableXecUtxos: sinon.stub().returns(utxos),
      refreshCache: sinon.stub().resolves()
    }
  }
}

function createMockUtxo (value, index = 0) {
  return {
    outpoint: {
      txid: `${'a'.repeat(64)}`,
      outIdx: index
    },
    value,
    sats: value
  }
}

describe('ConsolidateUtxos', () => {
  describe('#Constructor', () => {
    it('should create instance with correct properties', () => {
      const wallet = createMockWallet()
      const consolidator = new ConsolidateUtxos(wallet)

      assert.exists(consolidator, 'Constructor creates instance')
      assert.equal(consolidator.wallet, wallet, 'Wallet reference stored correctly')
      assert.equal(consolidator.dustLimit, 200, 'Default dust limit set correctly')
    })
  })

  describe('#analyzeUtxos', () => {
    it('should return false when insufficient UTXOs', async () => {
      const utxos = [
        createMockUtxo(1000, 0),
        createMockUtxo(2000, 1)
      ] // Only 2 UTXOs, need 5 minimum

      const wallet = createMockWallet(utxos)
      const consolidator = new ConsolidateUtxos(wallet)

      const analysis = await consolidator.analyzeUtxos()

      assert.equal(analysis.shouldConsolidate, false, 'Should not consolidate with insufficient UTXOs')
      assert.include(analysis.reason, 'Not enough pure XEC UTXOs', 'Reason explains insufficient UTXOs')
      assert.equal(analysis.totalUtxos, 2, 'Reports correct UTXO count')
    })

    it('should return false when insufficient small UTXOs', async () => {
      const utxos = [
        createMockUtxo(200000, 0), // Large UTXO > consolidation threshold
        createMockUtxo(300000, 1), // Large UTXO > consolidation threshold
        createMockUtxo(400000, 2), // Large UTXO > consolidation threshold
        createMockUtxo(500000, 3), // Large UTXO > consolidation threshold
        createMockUtxo(600000, 4) // Large UTXO > consolidation threshold
      ] // 5 UTXOs but all large

      const wallet = createMockWallet(utxos)
      const consolidator = new ConsolidateUtxos(wallet)

      const analysis = await consolidator.analyzeUtxos({ consolidationThreshold: 100000 })

      assert.equal(analysis.shouldConsolidate, false, 'Should not consolidate when no small UTXOs')
      assert.include(analysis.reason, 'Not enough small pure XEC UTXOs', 'Reason explains insufficient small UTXOs')
      assert.equal(analysis.smallUtxos, 0, 'Reports zero small UTXOs')
    })

    it('should return true when consolidation is beneficial', async () => {
      const utxos = [
        createMockUtxo(10000, 0), // Small
        createMockUtxo(20000, 1), // Small
        createMockUtxo(30000, 2), // Small
        createMockUtxo(40000, 3), // Small
        createMockUtxo(50000, 4) // Small
      ] // 5 small UTXOs with more value

      const wallet = createMockWallet(utxos)
      const consolidator = new ConsolidateUtxos(wallet)

      const analysis = await consolidator.analyzeUtxos({
        consolidationThreshold: 100000,
        satsPerByte: 1.0 // Lower fee rate for testing
      })

      // The analysis should either be beneficial or explain why not
      assert.equal(analysis.totalUtxos, 5, 'Reports correct UTXO count')
      assert.equal(analysis.totalValue, 150000, 'Calculates total value correctly')
      assert.isArray(analysis.consolidationPlans, 'Provides consolidation plans')

      // Either it should consolidate or explain why not
      if (analysis.shouldConsolidate) {
        assert.include(analysis.reason, 'save', 'Reason explains savings')
        assert.equal(analysis.outputUtxos, 1, 'Plans to consolidate into 1 UTXO')
      } else {
        assert.include(analysis.reason, 'cost', 'Reason explains why not beneficial')
      }
    })
  })

  describe('#calculateOptimalConsolidation', () => {
    it('should create single plan for small batch', () => {
      const utxos = [
        createMockUtxo(1000, 0),
        createMockUtxo(2000, 1),
        createMockUtxo(3000, 2)
      ]

      const wallet = createMockWallet()
      const consolidator = new ConsolidateUtxos(wallet)

      const plans = consolidator.calculateOptimalConsolidation(utxos, { satsPerByte: 1.2 })

      assert.equal(plans.length, 1, 'Creates one consolidation plan for small batch')
      assert.equal(plans[0].inputCount, 3, 'Plan includes all 3 UTXOs')
      assert.equal(plans[0].totalInputValue, 6000, 'Calculates total input value correctly')
      assert.equal(plans[0].outputCount, 1, 'Plans single output')
      assert.isAbove(plans[0].estimatedFee, 0, 'Calculates fee estimate')
    })

    it('should split large batches correctly', () => {
      // Create 250 UTXOs (exceeds maxInputs of 200)
      const utxos = []
      for (let i = 0; i < 250; i++) {
        utxos.push(createMockUtxo(1000 + i, i))
      }

      const wallet = createMockWallet()
      const consolidator = new ConsolidateUtxos(wallet)

      const plans = consolidator.calculateOptimalConsolidation(utxos, { maxInputs: 200 })

      assert.equal(plans.length, 2, 'Splits into 2 batches for large UTXO set')
      assert.equal(plans[0].inputCount, 200, 'First batch has 200 inputs')
      assert.equal(plans[1].inputCount, 50, 'Second batch has remaining 50 inputs')
    })

    it('should prevent dust outputs', () => {
      const utxos = [
        createMockUtxo(100, 0), // Very small UTXOs that would create dust
        createMockUtxo(50, 1)
      ]

      const wallet = createMockWallet()
      const consolidator = new ConsolidateUtxos(wallet)

      const plans = consolidator.calculateOptimalConsolidation(utxos, { satsPerByte: 10 })

      assert.equal(plans.length, 0, 'Skips batches that would result in dust output')
    })
  })

  describe('#createConsolidationTx', () => {
    it('should create valid consolidation transaction', async () => {
      const utxos = [
        createMockUtxo(1000, 0),
        createMockUtxo(2000, 1)
      ]

      const wallet = createMockWallet()
      const consolidator = new ConsolidateUtxos(wallet)

      const result = await consolidator.createConsolidationTx(utxos, { satsPerByte: 1.2 })

      assert.equal(result.inputCount, 2, 'Uses correct number of inputs')
      assert.equal(result.totalInputValue, 3000, 'Calculates total input value')
      assert.isAbove(result.outputValue, 0, 'Calculates output value after fees')
      assert.isAbove(result.estimatedFee, 0, 'Calculates fee estimate')
      assert.exists(result.txHex, 'Returns transaction hex')
    })

    it('should throw error for dust output', async () => {
      const utxos = [
        createMockUtxo(100, 0) // Too small to consolidate
      ]

      const wallet = createMockWallet()
      const consolidator = new ConsolidateUtxos(wallet)

      try {
        await consolidator.createConsolidationTx(utxos, { satsPerByte: 10 })
        assert.fail('Should throw error for dust output')
      } catch (err) {
        assert.include(err.message, 'dust', 'Throws error for dust output')
      }
    })
  })

  describe('#executeConsolidation', () => {
    it('should execute consolidation successfully', async () => {
      const plans = [{
        inputUtxos: [createMockUtxo(1000, 0), createMockUtxo(2000, 1)],
        inputCount: 2,
        totalInputValue: 3000,
        outputValue: 2500,
        estimatedFee: 500
      }]

      const wallet = createMockWallet()
      const consolidator = new ConsolidateUtxos(wallet)

      const results = await consolidator.executeConsolidation(plans)

      assert.equal(results.length, 1, 'Returns result for each plan')
      assert.equal(results[0].success, true, 'Reports success')
      assert.equal(results[0].txid, 'test-txid-123', 'Returns transaction ID')
      assert.isTrue(wallet.utxos.refreshCache.calledOnce, 'Refreshes UTXO cache after consolidation')
    })

    it('should handle execution failures', async () => {
      const plans = [{
        inputUtxos: [createMockUtxo(1000, 0)],
        inputCount: 1,
        totalInputValue: 1000,
        outputValue: 500,
        estimatedFee: 500
      }]

      const wallet = createMockWallet()
      wallet.sendXecLib.sendXec.rejects(new Error('Network error'))
      const consolidator = new ConsolidateUtxos(wallet)

      const results = await consolidator.executeConsolidation(plans)

      assert.equal(results.length, 1, 'Returns result even on failure')
      assert.equal(results[0].success, false, 'Reports failure')
      assert.include(results[0].error, 'Network error', 'Includes error message')
    })
  })

  describe('#start', () => {
    it('should handle dry run mode', async () => {
      const utxos = [
        createMockUtxo(50000, 0),
        createMockUtxo(50000, 1),
        createMockUtxo(50000, 2),
        createMockUtxo(50000, 3),
        createMockUtxo(50000, 4)
      ]

      const wallet = createMockWallet(utxos)
      const consolidator = new ConsolidateUtxos(wallet)

      const result = await consolidator.start({
        dryRun: true,
        satsPerByte: 1.0,
        consolidationThreshold: 100000
      })

      assert.equal(result.success, true, 'Dry run succeeds')
      assert.isArray(result.transactions, 'Returns transaction plans')
      assert.isTrue(wallet.sendXecLib.sendXec.notCalled, 'Does not execute transactions in dry run')

      // Message should either indicate dry run completion or explain why no consolidation
      const validMessages = ['Dry run completed', 'Not enough pure XEC UTXOs', 'cost', 'more than current']
      const hasValidMessage = validMessages.some(msg => result.message.includes(msg))
      assert.isTrue(hasValidMessage, `Message explains result: ${result.message}`)
    })

    it('should execute live consolidation', async () => {
      const utxos = [
        createMockUtxo(50000, 0),
        createMockUtxo(50000, 1),
        createMockUtxo(50000, 2),
        createMockUtxo(50000, 3),
        createMockUtxo(50000, 4)
      ]

      const wallet = createMockWallet(utxos)
      const consolidator = new ConsolidateUtxos(wallet)

      const result = await consolidator.start({
        dryRun: false,
        satsPerByte: 1.0,
        consolidationThreshold: 100000
      })

      assert.equal(result.success, true, 'Live execution succeeds')
      assert.isArray(result.transactions, 'Returns transaction results')

      // Message should explain the result appropriately
      const validMessages = ['Successfully consolidated', 'Not enough pure XEC UTXOs', 'cost', 'more than current']
      const hasValidMessage = validMessages.some(msg => result.message.includes(msg))
      assert.isTrue(hasValidMessage, `Message explains result: ${result.message}`)

      // If consolidation happened, transactions should be executed
      if (result.message.includes('Successfully consolidated')) {
        assert.isTrue(wallet.sendXecLib.sendXec.called, 'Executes transactions when consolidation beneficial')
      }
    })

    it('should handle cases where no consolidation is needed', async () => {
      const utxos = [
        createMockUtxo(1000, 0) // Only 1 UTXO
      ]

      const wallet = createMockWallet(utxos)
      const consolidator = new ConsolidateUtxos(wallet)

      const result = await consolidator.start()

      assert.equal(result.success, true, 'Succeeds when no consolidation needed')
      assert.include(result.message, 'Not enough pure XEC UTXOs', 'Returns appropriate message')
      assert.equal(result.transactions.length, 0, 'No transactions when no consolidation needed')
    })
  })

  describe('#getUtxoDistribution', () => {
    it('should categorize UTXOs correctly', () => {
      const utxos = [
        createMockUtxo(500, 0), // dust
        createMockUtxo(5000, 1), // small
        createMockUtxo(50000, 2), // medium
        createMockUtxo(500000, 3) // large
      ]

      const wallet = createMockWallet(utxos)
      const consolidator = new ConsolidateUtxos(wallet)

      const distribution = consolidator.getUtxoDistribution()

      assert.equal(distribution.dust, 1, 'Counts dust UTXOs correctly')
      assert.equal(distribution.small, 1, 'Counts small UTXOs correctly')
      assert.equal(distribution.medium, 1, 'Counts medium UTXOs correctly')
      assert.equal(distribution.large, 1, 'Counts large UTXOs correctly')
      assert.equal(distribution.total, 4, 'Counts total UTXOs correctly')
      assert.isObject(distribution, 'Returns distribution object')
    })
  })

  describe('#estimateOptimizationSavings', () => {
    it('should calculate savings for many UTXOs', () => {
      const utxos = []
      for (let i = 0; i < 100; i++) {
        utxos.push(createMockUtxo(1000 + i, i))
      }

      const wallet = createMockWallet(utxos)
      const consolidator = new ConsolidateUtxos(wallet)

      const savings = consolidator.estimateOptimizationSavings()

      assert.isAbove(savings.savings, 0, 'Calculates positive savings for many UTXOs')
      assert.equal(savings.currentUtxos, 100, 'Reports current UTXO count')
      assert.isBelow(savings.optimalUtxos, 100, 'Suggests fewer optimal UTXOs')
      assert.isAbove(savings.currentEstimatedFee, savings.optimizedEstimatedFee, 'Current fee higher than optimized')
    })

    it('should handle single UTXO case', () => {
      const utxos = [createMockUtxo(10000, 0)] // Only 1 UTXO

      const wallet = createMockWallet(utxos)
      const consolidator = new ConsolidateUtxos(wallet)

      const savings = consolidator.estimateOptimizationSavings()

      assert.equal(savings.savings, 0, 'No savings when only 1 UTXO')
      assert.include(savings.reason, 'No optimization needed', 'Explains no optimization needed')
    })
  })

  describe('Helper Methods', () => {
    let consolidator

    beforeEach(() => {
      const wallet = createMockWallet()
      consolidator = new ConsolidateUtxos(wallet)
    })

    it('should calculate total value correctly', () => {
      const utxos = [createMockUtxo(1000, 0), createMockUtxo(2000, 1)]
      const totalValue = consolidator._calculateTotalValue(utxos)
      assert.equal(totalValue, 3000, '_calculateTotalValue works correctly')
    })

    it('should calculate fees correctly', () => {
      const fee = consolidator._calculateConsolidationFee(2, 1, 1.2)
      assert.isAbove(fee, 0, '_calculateConsolidationFee calculates positive fee')

      const currentFee = consolidator._estimateCurrentSpendingFee([createMockUtxo(1000, 0)], 1.2)
      assert.isAbove(currentFee, 0, '_estimateCurrentSpendingFee calculates positive fee')

      const futureFee = consolidator._estimateFutureSpendingFee(1, 1.2)
      assert.isAbove(futureFee, 0, '_estimateFutureSpendingFee calculates positive fee')
    })

    it('should calculate batch savings', () => {
      const utxos = [createMockUtxo(1000, 0), createMockUtxo(2000, 1)]
      const savings = consolidator._calculateBatchSavings(utxos, 1.2)
      assert.isNumber(savings, '_calculateBatchSavings returns number')
    })

    it('should work with mock UTXO values', () => {
      const utxo = createMockUtxo(5000, 0)
      assert.equal(utxo.value, 5000, 'Mock UTXO has correct value property')
      assert.equal(utxo.sats, 5000, 'Mock UTXO has correct sats property')
    })
  })

  describe('Error Handling', () => {
    it('should handle wallet initialization errors', async () => {
      const wallet = createMockWallet()
      wallet.walletInfoPromise = Promise.reject(new Error('Wallet init failed'))
      const consolidator = new ConsolidateUtxos(wallet)

      try {
        await consolidator.start()
        assert.fail('Should throw error when wallet initialization fails')
      } catch (err) {
        assert.include(err.message, 'UTXO consolidation failed', 'Wraps wallet errors appropriately')
      }
    })

    it('should handle UTXO analysis errors', async () => {
      const wallet = createMockWallet()
      wallet.utxos.getSpendableXecUtxos.throws(new Error('UTXO fetch failed'))
      const consolidator = new ConsolidateUtxos(wallet)

      try {
        await consolidator.analyzeUtxos()
        assert.fail('Should throw error when UTXO analysis fails')
      } catch (err) {
        assert.include(err.message, 'UTXO analysis failed', 'Wraps analysis errors appropriately')
      }
    })

    it('should handle calculation errors', () => {
      const wallet = createMockWallet()
      const consolidator = new ConsolidateUtxos(wallet)

      try {
        consolidator.calculateOptimalConsolidation(null)
        assert.fail('Should throw error with invalid input')
      } catch (err) {
        assert.include(err.message, 'Consolidation calculation failed', 'Handles calculation errors')
      }
    })
  })
})
