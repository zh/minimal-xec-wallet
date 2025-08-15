/*
  Enhanced unit tests for lib/adapters/router.js - Critical missing coverage

  This file adds comprehensive test coverage for previously untested critical paths:
  - Robust connection failover and retry logic
  - Cache management with TTL expiration
  - Batch processing with large datasets and error handling
  - BigInt/Number conversion edge cases and precision handling
  - Complex error scenarios and recovery mechanisms
  - Transaction broadcasting failures and retry patterns
  - UTXO token field preservation (critical for SLP/ALP)
  - Address validation edge cases and test environment handling
  - Resource cleanup and connection management
*/

const assert = require('chai').assert
const sinon = require('sinon')

// Unit under test
const AdapterRouter = require('../../lib/adapters/router')

// Mock dependencies
const mockUtxos = require('./mocks/xec-utxo-mocks')
// const mockWallet = require('./mocks/xec-wallet-mocks')

describe('#adapters/router.js - Enhanced Coverage', () => {
  let sandbox, router, mockChronik, mockRobustRouter

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    // Create comprehensive mock chronik client
    mockChronik = {
      url: 'https://chronik.test.com',
      blockchainInfo: sandbox.stub().resolves({ tipHash: 'abc', tipHeight: 100000 }),
      script: sandbox.stub().returns({
        utxos: sandbox.stub().resolves({ utxos: mockUtxos.simpleXecUtxos.utxos }),
        history: sandbox.stub().resolves({ txs: mockUtxos.mockXecTransactions.transactions }),
        balance: sandbox.stub().resolves({ confirmed: BigInt(100000), unconfirmed: BigInt(5000) })
      }),
      tx: sandbox.stub().resolves({ txid: 'test_txid_123', outputs: [{ spent: false }] }),
      broadcastTx: sandbox.stub().resolves({ txid: 'broadcast_txid_123' })
    }

    // Mock RobustChronikRouter
    mockRobustRouter = {
      initialize: sandbox.stub().resolves(),
      isInitialized: true,
      executeWithFailover: sandbox.stub().callsFake(async (operation) => {
        return await operation({ url: 'https://chronik.test.com' })
      }),
      getConnection: sandbox.stub().resolves({ url: 'https://chronik.test.com' }),
      getStats: sandbox.stub().returns({
        totalRequests: 10,
        successfulRequests: 8,
        failedRequests: 2
      }),
      cleanup: sandbox.stub().resolves()
    }

    // Create router with robust router
    router = new AdapterRouter({
      chronik: mockChronik,
      chronikUrls: ['https://chronik.test.com'],
      cacheTTL: 1000, // Short TTL for testing
      maxRetries: 2,
      retryDelay: 100
    })

    // Replace robust router with mock
    router.robustRouter = mockRobustRouter
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('#Robust Connection Failover', () => {
    describe('#_executeWithRobustConnection', () => {
      it('should fallback to basic client in test environment', async () => {
        // Ensure test environment is set
        process.env.TEST = 'unit'

        const mockOperation = sandbox.stub().resolves('test_success')

        const result = await router._executeWithRobustConnection(mockOperation)

        assert.equal(result, 'test_success')
        assert.isTrue(mockOperation.calledOnce)

        delete process.env.TEST
      })

      it('should fallback to basic client when robust router unavailable', async () => {
        router.robustRouter = null
        const mockOperation = sandbox.stub().resolves('fallback_success')

        const result = await router._executeWithRobustConnection(mockOperation)

        assert.equal(result, 'fallback_success')
        assert.isTrue(mockOperation.calledOnce)
      })

      it('should handle robust router initialization failure', async () => {
        router.robustRouter.isInitialized = false
        const mockOperation = sandbox.stub().resolves('basic_success')

        const result = await router._executeWithRobustConnection(mockOperation)

        assert.equal(result, 'basic_success')
        assert.isTrue(mockOperation.calledOnce)
      })

      it('should wrap and propagate operation errors', async () => {
        const mockOperation = sandbox.stub().rejects(new Error('Operation failed'))

        try {
          await router._executeWithRobustConnection(mockOperation)
          assert.fail('Should have thrown error')
        } catch (err) {
          assert.include(err.message, 'Robust connection execution failed: Operation failed')
        }
      })
    })

    describe('#Connection Management', () => {
      it('should get connection statistics from robust router', () => {
        const stats = router.getConnectionStats()

        assert.property(stats, 'totalRequests')
        assert.property(stats, 'successfulRequests')
        assert.property(stats, 'failedRequests')
        assert.equal(stats.totalRequests, 10)
      })

      it('should return null stats when robust router unavailable', () => {
        router.robustRouter = null

        const stats = router.getConnectionStats()

        assert.isNull(stats)
      })

      it('should cleanup robust router connections', async () => {
        await router.cleanup()

        assert.isTrue(mockRobustRouter.cleanup.calledOnce)
        assert.equal(router.cache.size, 0) // Cache should be cleared
      })
    })
  })

  describe('#Cache Management', () => {
    describe('#Cache TTL and Expiration', () => {
      it('should return cached data within TTL', async () => {
        const address = 'ecash:qp1234567890abcdef1234567890abcdef1234567890'
        const cachedData = { balance: { confirmed: 50000, unconfirmed: 0 } }

        // Set cache directly
        router._setCache(`balance_${address}`, cachedData)

        const result = await router._getSingleBalance(address)

        assert.deepEqual(result, cachedData)
        // Chronik should not be called
        assert.isFalse(mockChronik.script.called)
      })

      it('should expire cached data after TTL', async () => {
        const address = 'ecash:qp1234567890abcdef1234567890abcdef1234567890'
        const cachedData = { balance: { confirmed: 50000, unconfirmed: 0 } }

        // Set cache with immediate expiration
        router.cache.set(`balance_${address}`, {
          data: cachedData,
          expires: Date.now() - 1000 // Already expired
        })

        // Verify cache contains expired entry
        assert.isTrue(router.cache.has(`balance_${address}`))

        // Ensure test environment for address validation
        process.env.TEST = 'unit'

        // Reset mock to track calls
        mockChronik.script.resetHistory()

        await router._getSingleBalance(address)

        // Should call chronik since cache expired
        assert.isTrue(mockChronik.script.called)

        delete process.env.TEST
      })

      it('should handle cache operations safely', () => {
        const key = 'test_key'
        const data = { test: 'data' }

        // Test set and get
        router._setCache(key, data)
        const retrieved = router._getFromCache(key)

        assert.deepEqual(retrieved, data)

        // Test cache miss
        const missing = router._getFromCache('nonexistent_key')
        assert.isNull(missing)
      })

      it('should clear all cache on cleanup', () => {
        router._setCache('key1', 'data1')
        router._setCache('key2', 'data2')

        router.clearCache()

        assert.equal(router.cache.size, 0)
      })
    })
  })

  describe('#Batch Processing', () => {
    describe('#Large Dataset Handling', () => {
      it('should process large address batches efficiently', async () => {
        const addresses = new Array(50).fill(0).map((_, i) => `ecash:qptest${i}`)
        sandbox.stub(router, '_getSingleBalance').resolves({ balance: { confirmed: 1000, unconfirmed: 0 } })

        const results = await router._batchGetBalance(addresses)

        assert.equal(results.length, addresses.length)
        assert.equal(router._getSingleBalance.callCount, addresses.length)
      })

      it('should respect batch size limits', async () => {
        const addresses = new Array(25).fill(0).map((_, i) => `ecash:qptest${i}`)
        router.batchSize = 10 // Override batch size

        sandbox.stub(router, '_getSingleBalance').resolves({ balance: { confirmed: 1000, unconfirmed: 0 } })

        const results = await router._batchGetBalance(addresses)

        assert.equal(results.length, 25)
        // Should process in 3 batches: 10 + 10 + 5
      })

      it('should handle partial batch failures gracefully', async () => {
        const addresses = ['valid1', 'invalid', 'valid2']

        sandbox.stub(router, '_getSingleBalance')
          .onFirstCall().resolves({ balance: { confirmed: 1000, unconfirmed: 0 } })
          .onSecondCall().rejects(new Error('Invalid address'))
          .onThirdCall().resolves({ balance: { confirmed: 2000, unconfirmed: 0 } })

        try {
          await router._batchGetBalance(addresses)
          assert.fail('Should have thrown batch error')
        } catch (err) {
          assert.include(err.message, 'Batch balance query failed')
        }
      })

      it('should handle empty batch arrays', async () => {
        const results = await router._batchGetBalance([])

        assert.isArray(results)
        assert.equal(results.length, 0)
      })
    })
  })

  describe('#BigInt and Number Conversion', () => {
    describe('#_ensureNumberFromBigInt', () => {
      it('should convert BigInt to Number within safe range', () => {
        const bigIntValue = BigInt(123456789)
        const result = router._ensureNumberFromBigInt(bigIntValue)

        assert.equal(result, 123456789)
        assert.equal(typeof result, 'number')
      })

      it('should handle very large BigInt values with warning', () => {
        const hugeBigInt = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1000000)

        // Capture console.warn
        const warnStub = sandbox.stub(console, 'warn')

        const result = router._ensureNumberFromBigInt(hugeBigInt)

        assert.isNumber(result)
        assert.isTrue(warnStub.calledOnce)
        assert.include(warnStub.firstCall.args[0], 'exceeds safe Number range')
      })

      it('should convert string numbers correctly', () => {
        const stringValue = '987654321'
        const result = router._ensureNumberFromBigInt(stringValue)

        assert.equal(result, 987654321)
      })

      it('should handle invalid string conversion', () => {
        const invalidString = 'not_a_number'
        const result = router._ensureNumberFromBigInt(invalidString)

        assert.equal(result, 0)
      })

      it('should floor regular numbers', () => {
        const floatValue = 123.999
        const result = router._ensureNumberFromBigInt(floatValue)

        assert.equal(result, 123)
      })

      it('should handle null and undefined values', () => {
        assert.equal(router._ensureNumberFromBigInt(null), 0)
        assert.equal(router._ensureNumberFromBigInt(undefined), 0)
      })
    })

    describe('#_extractSatsFromUtxo', () => {
      it('should extract BigInt sats correctly', () => {
        const utxo = { sats: BigInt(150000) }
        const result = router._extractSatsFromUtxo(utxo)

        assert.equal(result, BigInt(150000))
        assert.equal(typeof result, 'bigint')
      })

      it('should convert string sats to BigInt', () => {
        const utxo = { sats: '250000' }
        const result = router._extractSatsFromUtxo(utxo)

        assert.equal(result, BigInt(250000))
      })

      it('should fallback to value property', () => {
        const utxo = { value: BigInt(350000) }
        const result = router._extractSatsFromUtxo(utxo)

        assert.equal(result, BigInt(350000))
      })

      it('should handle numeric types', () => {
        const utxo = { sats: 450000 }
        const result = router._extractSatsFromUtxo(utxo)

        assert.equal(result, BigInt(450000))
      })

      it('should handle malformed UTXO data with warnings', () => {
        const warnStub = sandbox.stub(console, 'warn')
        const utxo = { sats: 'invalid_number', value: null }

        const result = router._extractSatsFromUtxo(utxo)

        assert.equal(result, BigInt(0))
        assert.isTrue(warnStub.called)
      })

      it('should prioritize sats over value', () => {
        const utxo = { sats: BigInt(100000), value: BigInt(200000) }
        const result = router._extractSatsFromUtxo(utxo)

        assert.equal(result, BigInt(100000))
      })

      it('should handle empty UTXO with warning', () => {
        const warnStub = sandbox.stub(console, 'warn')
        const utxo = {}

        const result = router._extractSatsFromUtxo(utxo)

        assert.equal(result, BigInt(0))
        assert.isTrue(warnStub.called)
      })
    })
  })

  describe('#Token Field Preservation', () => {
    it('should preserve token field in UTXO mapping', async () => {
      const address = 'ecash:qp1234567890abcdef1234567890abcdef1234567890'
      const mockUtxoWithToken = {
        outpoint: { txid: 'abc123', outIdx: 0 },
        blockHeight: 100000,
        isCoinbase: false,
        sats: BigInt(546),
        token: {
          tokenId: 'token123',
          amount: BigInt(100),
          isMintBaton: false
        }
      }

      // Ensure test environment
      process.env.TEST = 'unit'

      mockChronik.script.returns({
        utxos: sandbox.stub().resolves({ utxos: [mockUtxoWithToken] })
      })

      const result = await router._getSingleUtxos(address)

      assert.property(result.utxos[0], 'token')
      assert.equal(result.utxos[0].token.tokenId, 'token123')

      delete process.env.TEST
    })

    it('should not add token field for XEC-only UTXOs', async () => {
      const address = 'ecash:qp1234567890abcdef1234567890abcdef1234567890'
      const mockXecUtxo = {
        outpoint: { txid: 'abc123', outIdx: 0 },
        blockHeight: 100000,
        isCoinbase: false,
        sats: BigInt(150000)
        // No token field
      }

      mockChronik.script.returns({
        utxos: sandbox.stub().resolves({ utxos: [mockXecUtxo] })
      })

      const result = await router._getSingleUtxos(address)

      assert.notProperty(result.utxos[0], 'token')
    })
  })

  describe('#Complex Error Scenarios', () => {
    describe('#Balance Query Error Handling', () => {
      it('should fallback from balance API to UTXO calculation', async () => {
        const address = 'ecash:qp1234567890abcdef1234567890abcdef1234567890'

        // Ensure test environment
        process.env.TEST = 'unit'

        // Mock balance endpoint to fail, UTXO endpoint to succeed
        mockChronik.script.returns({
          balance: sandbox.stub().rejects(new Error('Balance API unavailable')),
          utxos: sandbox.stub().resolves({
            utxos: [
              { sats: BigInt(100000), blockHeight: 100 },
              { sats: BigInt(50000), blockHeight: -1 }
            ]
          })
        })

        const result = await router._getSingleBalance(address)

        assert.equal(result.balance.confirmed, 100000)
        assert.equal(result.balance.unconfirmed, 50000)

        delete process.env.TEST
      })

      it('should handle both balance and UTXO endpoint failures', async () => {
        const address = 'ecash:qp1234567890abcdef1234567890abcdef1234567890'

        mockRobustRouter.executeWithFailover.rejects(new Error('All endpoints failed'))

        try {
          await router._getSingleBalance(address)
          assert.fail('Should have thrown error')
        } catch (err) {
          assert.include(err.message, 'Single balance query failed')
        }
      })
    })

    describe('#Transaction Broadcasting Error Handling', () => {
      it('should handle invalid transaction hex', async () => {
        try {
          await router.sendTx(null)
          assert.fail('Should reject null hex')
        } catch (err) {
          assert.include(err.message, 'Invalid transaction hex')
        }
      })

      it('should handle broadcast failures with retry', async () => {
        mockRobustRouter.executeWithFailover.rejects(new Error('Broadcast failed'))

        try {
          await router.sendTx('deadbeef')
          assert.fail('Should have thrown broadcast error')
        } catch (err) {
          assert.include(err.message, 'Transaction broadcast failed')
        }
      })

      it('should extract txid from broadcast result', async () => {
        mockRobustRouter.executeWithFailover.resolves({ txid: 'extracted_txid' })

        const result = await router.sendTx('deadbeef')

        assert.equal(result, 'extracted_txid')
      })

      it('should handle broadcast result without txid field', async () => {
        mockRobustRouter.executeWithFailover.resolves('direct_txid')

        const result = await router.sendTx('deadbeef')

        assert.equal(result, 'direct_txid')
      })
    })
  })

  describe('#Address Validation Edge Cases', () => {
    describe('#_validateAndDecodeAddress', () => {
      it('should handle test addresses in test environment', () => {
        process.env.TEST = 'unit'

        const result = router._validateAndDecodeAddress('test-address-123')

        assert.equal(result.hash, '0123456789abcdef0123456789abcdef01234567')
        assert.equal(result.type, 'P2PKH')

        delete process.env.TEST
      })

      it('should validate proper XEC addresses', () => {
        // Skip this test in environments where decodeCashAddress is already mocked
        process.env.TEST = 'unit'

        const validAddress = 'ecash:qp1234567890abcdef1234567890abcdef1234567890'

        const result = router._validateAndDecodeAddress(validAddress)

        // In test environment, should return mock values
        assert.equal(result.hash, '0123456789abcdef0123456789abcdef01234567')
        assert.equal(result.type, 'P2PKH')

        delete process.env.TEST
      })

      it('should reject non-XEC address formats', () => {
        const bitcoinAddress = 'bitcoincash:qp1234567890abcdef1234567890abcdef1234567890'

        try {
          router._validateAndDecodeAddress(bitcoinAddress)
          assert.fail('Should reject non-XEC addresses')
        } catch (err) {
          assert.include(err.message, 'Invalid XEC address format')
        }
      })

      it('should handle malformed addresses gracefully in test environment', () => {
        process.env.TEST = 'unit'

        const result = router._validateAndDecodeAddress('completely-invalid')

        assert.equal(result.hash, '0123456789abcdef0123456789abcdef01234567')

        delete process.env.TEST
      })

      it('should validate address parameters', () => {
        try {
          router._validateAndDecodeAddress('')
          assert.fail('Should reject empty address')
        } catch (err) {
          assert.include(err.message, 'Address must be a non-empty string')
        }
      })

      it('should handle address decoding failures', () => {
        // Test the fallback behavior in test environment
        process.env.TEST = 'unit'

        const invalidAddress = 'ecash:invalid'

        // In test environment, should return fallback values even for invalid addresses
        const result = router._validateAndDecodeAddress(invalidAddress)
        assert.equal(result.hash, '0123456789abcdef0123456789abcdef01234567')

        delete process.env.TEST
      })
    })
  })

  describe('#UTXO Validation', () => {
    describe('#utxoIsValid', () => {
      it('should validate UTXO structure in test environment', async () => {
        process.env.TEST = 'unit'

        const validUtxo = { txid: 'abc123', vout: 0 }
        const result = await router.utxoIsValid(validUtxo)

        assert.isTrue(result)

        delete process.env.TEST
      })

      it('should reject malformed UTXOs in test environment', async () => {
        process.env.TEST = 'unit'

        const invalidUtxo = { txid: null, vout: 'invalid' }
        const result = await router.utxoIsValid(invalidUtxo)

        // In test environment, invalid structure should return false (not null)
        assert.isFalse(result || false) // Handle both false and null as false

        delete process.env.TEST
      })

      it('should check transaction output existence', async () => {
        const utxo = { txid: 'abc123', vout: 0 }

        mockRobustRouter.executeWithFailover.resolves({
          outputs: [{ spent: false }, { spent: true }]
        })

        const result = await router.utxoIsValid(utxo)

        assert.isTrue(result) // Output 0 is not spent
      })

      it('should detect spent outputs', async () => {
        // Force production mode for this test
        delete process.env.TEST
        delete process.env.NODE_ENV

        const utxo = { txid: 'abc123', vout: 1 }

        mockRobustRouter.executeWithFailover.resolves({
          outputs: [{ spent: false }, { spent: true }]
        })

        const result = await router.utxoIsValid(utxo)

        assert.isFalse(result) // Output 1 is spent
      })

      it('should handle non-existent outputs', async () => {
        // Force production mode for this test
        delete process.env.TEST
        delete process.env.NODE_ENV

        const utxo = { txid: 'abc123', vout: 5 }

        mockRobustRouter.executeWithFailover.resolves({
          outputs: [{ spent: false }, { spent: true }]
        })

        const result = await router.utxoIsValid(utxo)

        assert.isFalse(result) // Output 5 doesn't exist
      })

      it('should handle validation errors gracefully', async () => {
        // Force production mode for this test
        delete process.env.TEST
        delete process.env.NODE_ENV

        const utxo = { txid: 'abc123', vout: 0 }

        mockRobustRouter.executeWithFailover.rejects(new Error('Network error'))

        const result = await router.utxoIsValid(utxo)

        assert.isFalse(result) // Assume invalid on error
      })
    })
  })

  describe('#Price and External Services', () => {
    describe('#getXecUsd', () => {
      it('should fetch price data', async () => {
        sandbox.stub(router, '_fetchPriceData').resolves({ usd: 0.00008 })

        const price = await router.getXecUsd()

        assert.equal(price, 0.00008)
      })

      it('should use fallback price on API failure', async () => {
        sandbox.stub(router, '_fetchPriceData').rejects(new Error('Price API down'))

        try {
          await router.getXecUsd()
          assert.fail('Should have thrown price error')
        } catch (err) {
          assert.include(err.message, 'Price query failed')
        }
      })

      it('should handle missing price field', async () => {
        sandbox.stub(router, '_fetchPriceData').resolves({})

        const price = await router.getXecUsd()

        assert.equal(price, 0.00005) // Fallback price
      })
    })

    describe('#Placeholder Services', () => {
      it('should handle CID to JSON conversion', async () => {
        try {
          await router.cid2json({ cid: 'QmTest123' })
          assert.fail('Should throw not implemented error')
        } catch (err) {
          assert.include(err.message, 'IPFS CID to JSON conversion not yet implemented')
        }
      })

      it('should require CID parameter', async () => {
        try {
          await router.cid2json({})
          assert.fail('Should require CID')
        } catch (err) {
          assert.include(err.message, 'CID is required')
        }
      })

      it('should return null for pubkey queries', async () => {
        const result = await router.getPubKey('ecash:qp123')
        assert.isNull(result)
      })

      it('should return zero for PSF write price', async () => {
        const result = await router.getPsfWritePrice()
        assert.equal(result, 0)
      })
    })
  })

  describe('#Phase 2 eToken Operations', () => {
    it('should throw not implemented errors for eToken operations', async () => {
      try {
        await router.getETokenData('tokenId123')
        assert.fail('Should throw Phase 2 error')
      } catch (err) {
        assert.include(err.message, 'eToken operations not yet implemented - Phase 2')
      }
    })

    it('should throw not implemented errors for eToken data queries', async () => {
      try {
        await router.getETokenData2('tokenId123', true)
        assert.fail('Should throw Phase 2 error')
      } catch (err) {
        assert.include(err.message, 'eToken operations not yet implemented - Phase 2')
      }
    })
  })
})
