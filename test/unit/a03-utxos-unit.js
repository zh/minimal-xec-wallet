/*
  Unit tests for XEC UTXO management using Chronik client.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Mocking data
const mockUtxos = require('./mocks/xec-utxo-mocks')
const mockWallet = require('./mocks/xec-wallet-mocks')

// Unit under test
const Utxos = require('../../lib/utxos')

describe('#utxos.js - XEC UTXO Management', () => {
  let sandbox, uut, mockChronik

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    mockChronik = {
      script: () => ({
        utxos: sandbox.stub().resolves(mockUtxos.simpleXecUtxos)
      })
    }

    const config = {
      chronik: mockChronik,
      ar: {
        getUtxos: sandbox.stub().resolves(mockUtxos.simpleXecUtxos)
      }
    }

    uut = new Utxos(config)
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should instantiate UTXO management class', () => {
      assert.instanceOf(uut, Utxos)
      assert.property(uut, 'chronik')
      assert.property(uut, 'utxoStore')
    })
  })

  describe('#initUtxoStore', () => {
    it('should initialize UTXO store for address', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      const result = await uut.initUtxoStore(address)

      assert.isTrue(result)
      assert.property(uut.utxoStore, 'xecUtxos')
      assert.isArray(uut.utxoStore.xecUtxos)
    })

    it('should handle force refresh', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      // First call
      await uut.initUtxoStore(address, false)
      const firstCall = uut.ar.getUtxos.callCount

      // Second call with force refresh
      await uut.initUtxoStore(address, true)
      const secondCall = uut.ar.getUtxos.callCount

      assert.isTrue(secondCall > firstCall)
    })

    it('should cache UTXOs and avoid redundant calls', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      await uut.initUtxoStore(address, false)
      await uut.initUtxoStore(address, false) // Should use cache

      assert.equal(uut.ar.getUtxos.callCount, 1)
    })
  })

  describe('#_fetchUtxosWithRetry', () => {
    it('should fetch UTXOs successfully on first try', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      const result = await uut._fetchUtxosWithRetry(address)

      assert.equal(result, mockUtxos.simpleXecUtxos)
      assert.equal(uut.ar.getUtxos.callCount, 1)
    })

    it('should retry on failure up to max retries', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      // Mock first two calls to fail, third to succeed
      uut.ar.getUtxos
        .onFirstCall().rejects(new Error('Network error'))
        .onSecondCall().rejects(new Error('Network error'))
        .onThirdCall().resolves(mockUtxos.simpleXecUtxos)

      const result = await uut._fetchUtxosWithRetry(address, 3)

      assert.equal(result, mockUtxos.simpleXecUtxos)
      assert.equal(uut.ar.getUtxos.callCount, 3)
    })

    it('should throw error after max retries exceeded', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      uut.ar.getUtxos.rejects(new Error('Persistent network error'))

      try {
        await uut._fetchUtxosWithRetry(address, 2)
        assert.fail('Should have thrown error after max retries')
      } catch (err) {
        assert.include(err.message, 'network error')
        assert.equal(uut.ar.getUtxos.callCount, 2)
      }
    })
  })

  describe('#getSpendableETokenUtxos', () => {
    it('should return empty array in Phase 1', () => {
      // Set up some UTXOs in store
      uut.utxoStore.xecUtxos = mockUtxos.mixedXecUtxos

      const result = uut.getSpendableETokenUtxos()

      // Phase 1: No eToken support yet
      assert.isArray(result)
      assert.equal(result.length, 0)
    })

    // TODO: Phase 2 - Add eToken UTXO filtering tests
  })

  describe('#getPerformanceMetrics', () => {
    it('should return performance metrics', () => {
      const metrics = uut.getPerformanceMetrics()

      assert.isObject(metrics)
      assert.property(metrics, 'cacheHitRate')
      assert.property(metrics, 'totalRequests')
      assert.property(metrics, 'averageResponseTime')
    })

    it('should track cache hit rate', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      // First call (cache miss)
      await uut.initUtxoStore(address, false)
      // Second call (cache hit)
      await uut.initUtxoStore(address, false)

      const metrics = uut.getPerformanceMetrics()
      assert.isNumber(metrics.cacheHitRate)
      assert.isTrue(metrics.cacheHitRate > 0)
    })
  })

  describe('#refreshCache', () => {
    it('should force refresh cached data', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      // Initialize cache
      await uut.initUtxoStore(address, false)
      const initialCalls = uut.ar.getUtxos.callCount

      // Refresh cache
      await uut.refreshCache(address)

      assert.isTrue(uut.ar.getUtxos.callCount > initialCalls)
    })
  })

  describe('#clearCache', () => {
    it('should clear all cached data', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      // Initialize cache
      await uut.initUtxoStore(address, false)
      assert.isArray(uut.utxoStore.xecUtxos)
      assert.isTrue(uut.utxoStore.xecUtxos.length > 0)

      // Clear cache
      uut.clearCache()

      assert.equal(uut.utxoStore.xecUtxos.length, 0)
    })
  })

  describe('#UTXO filtering and sorting', () => {
    it('should filter dust UTXOs', () => {
      const utxos = mockUtxos.mixedXecUtxos
      const dustLimit = 1000 // 10 XEC minimum

      const filtered = uut._filterDustUtxos(utxos, dustLimit)

      // Should exclude UTXOs below dust limit
      filtered.forEach(utxo => {
        const value = uut._getUtxoValue(utxo)
        assert.isTrue(value >= dustLimit)
      })
    })

    it('should sort UTXOs by value', () => {
      const utxos = [...mockUtxos.mixedXecUtxos]

      const sortedAsc = uut._sortUtxosByValue(utxos, 'asc')
      const sortedDesc = uut._sortUtxosByValue(utxos, 'desc')

      // Ascending order
      for (let i = 1; i < sortedAsc.length; i++) {
        assert.isTrue(uut._getUtxoValue(sortedAsc[i]) >= uut._getUtxoValue(sortedAsc[i - 1]))
      }

      // Descending order
      for (let i = 1; i < sortedDesc.length; i++) {
        assert.isTrue(uut._getUtxoValue(sortedDesc[i]) <= uut._getUtxoValue(sortedDesc[i - 1]))
      }
    })
  })

  describe('#Error handling', () => {
    it('should handle invalid address gracefully', async () => {
      const invalidAddress = 'invalid_address_format'

      try {
        await uut.initUtxoStore(invalidAddress)
        assert.fail('Should have thrown error for invalid address')
      } catch (err) {
        assert.include(err.message, 'invalid')
      }
    })

    it('should handle Chronik API errors', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]
      uut.ar.getUtxos.rejects(new Error('Chronik API error'))

      try {
        await uut.initUtxoStore(address)
        assert.fail('Should have thrown error for API failure')
      } catch (err) {
        assert.include(err.message, 'API error')
      }
    })
  })

  describe('#Performance with large UTXO sets', () => {
    it('should handle large UTXO sets efficiently', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]
      uut.ar.getUtxos.resolves({ utxos: mockUtxos.largeXecUtxos })

      const startTime = Date.now()
      await uut.initUtxoStore(address)
      const duration = Date.now() - startTime

      assert.isTrue(duration < 5000) // Should complete within 5 seconds
      assert.equal(uut.utxoStore.xecUtxos.length, 100)
    })
  })
})
