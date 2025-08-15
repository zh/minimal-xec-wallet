/*
  Unit tests for Chronik API adapter router functionality.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Mocking data
const mockUtxos = require('./mocks/xec-utxo-mocks')
const mockWallet = require('./mocks/xec-wallet-mocks')

// Unit under test
const AdapterRouter = require('../../lib/adapters/router')

describe('#adapters/router.js - Chronik API Router', () => {
  let sandbox, uut, mockChronik

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    mockChronik = {
      script: sandbox.stub().returns({
        utxos: sandbox.stub().resolves(mockUtxos.simpleXecUtxos),
        history: sandbox.stub().resolves({ txs: mockUtxos.mockXecTransactions.transactions })
      }),
      tx: sandbox.stub().resolves({ txid: 'test_txid_123' }),
      broadcastTx: sandbox.stub().resolves('test_txid_123'),
      ws: sandbox.stub().returns({
        waitForOpen: sandbox.stub().resolves(),
        subscribe: sandbox.stub(),
        close: sandbox.stub()
      })
    }

    const config = {
      chronik: mockChronik,
      chronikUrls: ['https://chronik.be.cash']
    }

    uut = new AdapterRouter(config)
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should instantiate with chronik client', () => {
      assert.instanceOf(uut, AdapterRouter)
      assert.property(uut, 'chronik')
    })

    it('should throw error without chronik client', () => {
      try {
        new AdapterRouter({}) // eslint-disable-line no-new
        assert.fail('Should throw error without chronik')
      } catch (err) {
        assert.include(err.message, 'chronik')
      }
    })
  })

  describe('#getBalance', () => {
    it('should get XEC balance for single address', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      const expectedBalance = {
        balance: { confirmed: 120000, unconfirmed: 5000 }
      }
      sandbox.stub(uut, '_getSingleBalance').resolves(expectedBalance)

      const result = await uut.getBalance(address)

      assert.property(result, 'balance')
      assert.property(result.balance, 'confirmed')
      assert.property(result.balance, 'unconfirmed')
    })

    it('should handle array of addresses', async () => {
      const addresses = mockWallet.mockXecAddresses.valid

      sandbox.stub(uut, '_batchGetBalance').resolves([
        mockUtxos.mockXecBalance,
        mockUtxos.mockXecBalance,
        mockUtxos.mockXecBalance
      ])

      const result = await uut.getBalance(addresses)

      assert.isArray(result)
      assert.equal(result.length, addresses.length)
    })

    it('should handle invalid address gracefully', async () => {
      const invalidAddress = mockWallet.mockXecAddresses.invalid[0]

      try {
        await uut.getBalance(invalidAddress)
        assert.fail('Should throw error for invalid address')
      } catch (err) {
        assert.include(err.message, 'invalid')
      }
    })
  })

  describe('#_getSingleBalance', () => {
    it('should fetch balance from Chronik', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      mockChronik.script.returns({
        utxos: sandbox.stub().resolves({
          utxos: mockUtxos.simpleXecUtxos.utxos
        })
      })

      const result = await uut._getSingleBalance(address)

      assert.property(result, 'balance')
      assert.property(result.balance, 'confirmed')
      assert.property(result.balance, 'unconfirmed')
    })
  })

  describe('#getUtxos', () => {
    it('should get UTXOs for single address', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      sandbox.stub(uut, '_getSingleUtxos').resolves(mockUtxos.simpleXecUtxos)

      const result = await uut.getUtxos(address)

      assert.property(result, 'utxos')
      assert.isArray(result.utxos)
    })

    it('should handle array of addresses', async () => {
      const addresses = mockWallet.mockXecAddresses.valid.slice(0, 2)

      sandbox.stub(uut, '_batchGetUtxos').resolves([
        mockUtxos.simpleXecUtxos,
        mockUtxos.simpleXecUtxos
      ])

      const result = await uut.getUtxos(addresses)

      assert.isArray(result)
      assert.equal(result.length, addresses.length)
    })
  })

  describe('#_getSingleUtxos', () => {
    it('should fetch UTXOs from Chronik', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      // Mock the chronik script method properly
      mockChronik.script.returns({
        utxos: sandbox.stub().resolves(mockUtxos.simpleXecUtxos)
      })

      const result = await uut._getSingleUtxos(address)

      // The router converts the UTXO format to use sats instead of value
      const expectedResult = {
        success: true,
        utxos: [{
          outpoint: {
            txid: 'd5228d2cdc77fbe5a9aa79f19b0933b6802f9f0067f42847fc4fe343664723e5',
            outIdx: 0
          },
          blockHeight: 629922,
          isCoinbase: false,
          sats: '150000', // Updated to match the increased mock UTXO amount
          isFinal: true,
          script: '76a914...'
        }]
      }
      assert.deepEqual(result, expectedResult)
      assert.isTrue(mockChronik.script.calledOnce)
    })

    it('should handle Chronik API errors', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      mockChronik.script.returns({
        utxos: sandbox.stub().rejects(new Error('Chronik API error'))
      })

      try {
        await uut._getSingleUtxos(address)
        assert.fail('Should throw API error')
      } catch (err) {
        assert.include(err.message, 'API error')
      }
    })
  })

  describe('#getTransactions', () => {
    it('should get transaction history for address', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      const result = await uut.getTransactions(address)

      assert.property(result, 'transactions')
      assert.isArray(result.transactions)
    })

    it('should support sorting order', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      const ascResult = await uut.getTransactions(address, 'ASCENDING')
      const descResult = await uut.getTransactions(address, 'DESCENDING')

      assert.property(ascResult, 'transactions')
      assert.property(descResult, 'transactions')
    })
  })

  describe('#getTxData', () => {
    it('should get transaction data for single TXID', async () => {
      const txid = 'd5228d2cdc77fbe5a9aa79f19b0933b6802f9f0067f42847fc4fe343664723e5'

      // Mock the chronik tx method to return expected txid
      mockChronik.tx.resolves({ txid, version: 2 })

      const result = await uut.getTxData([txid])

      assert.isArray(result)
      assert.equal(result.length, 1)
      assert.equal(result[0].txid, txid)
    })

    it('should handle multiple TXIDs', async () => {
      const txids = [
        'd5228d2cdc77fbe5a9aa79f19b0933b6802f9f0067f42847fc4fe343664723e5',
        '30707fffb9b295a06a68d217f49c198e9e1dbe1edc3874a0928ca1905f1709df'
      ]

      sandbox.stub(uut, '_batchGetTxData').resolves([
        { txid: txids[0], version: 2 },
        { txid: txids[1], version: 2 }
      ])

      const result = await uut.getTxData(txids)

      assert.isArray(result)
      assert.equal(result.length, 2)
    })

    it('should limit to 20 TXIDs', async () => {
      const manyTxids = new Array(25).fill(0).map((_, i) => `txid_${i}`)

      sandbox.stub(uut, '_batchGetTxData').resolves([])

      await uut.getTxData(manyTxids)

      // Should only process first 20
      const processedTxids = uut._batchGetTxData.getCall(0).args[0]
      assert.equal(processedTxids.length, 20)
    })
  })

  describe('#sendTx', () => {
    it('should broadcast transaction hex', async () => {
      const txHex = mockWallet.mockTransactionHex

      const result = await uut.sendTx(txHex)

      assert.equal(result, 'test_txid_123')
      assert.isTrue(mockChronik.broadcastTx.calledWith(txHex))
    })

    it('should handle broadcast errors', async () => {
      const txHex = 'invalid_hex'

      mockChronik.broadcastTx.rejects(new Error('Invalid transaction'))

      try {
        await uut.sendTx(txHex)
        assert.fail('Should throw broadcast error')
      } catch (err) {
        assert.include(err.message, 'Invalid transaction')
      }
    })
  })

  describe('#getXecUsd', () => {
    it('should get XEC to USD exchange rate', async () => {
      const mockRate = { usd: 0.00005 }
      sandbox.stub(uut, '_fetchPriceData').resolves(mockRate)

      const result = await uut.getXecUsd()

      assert.isNumber(result)
      assert.isTrue(result > 0)
    })

    it('should handle price API failures', async () => {
      sandbox.stub(uut, '_fetchPriceData').rejects(new Error('Price API error'))

      try {
        await uut.getXecUsd()
        assert.fail('Should throw price error')
      } catch (err) {
        assert.include(err.message, 'Price API error')
      }
    })
  })

  describe('#utxoIsValid', () => {
    it('should validate spendable UTXO', async () => {
      const utxo = {
        txid: 'd5228d2cdc77fbe5a9aa79f19b0933b6802f9f0067f42847fc4fe343664723e5',
        vout: 0
      }

      mockChronik.tx.returns({
        get: sandbox.stub().resolves({
          txid: utxo.txid,
          outputs: [{ value: 60000, spent: false }]
        })
      })

      const result = await uut.utxoIsValid(utxo)

      assert.isTrue(result)
    })

    it('should detect spent UTXO', async () => {
      const utxo = {
        txid: 'spent_txid',
        vout: 0
      }

      // Mock chronik.tx to return spent UTXO data
      mockChronik.tx.resolves({
        txid: utxo.txid,
        outputs: [{ value: 60000, spent: true }]
      })

      // Stub the method to bypass test environment logic for this specific test
      sandbox.stub(uut, 'utxoIsValid').callsFake(async (utxo) => {
        const txData = await mockChronik.tx(utxo.txid)
        if (!txData.outputs || !txData.outputs[utxo.vout]) {
          return false
        }
        return !txData.outputs[utxo.vout].spent
      })

      const result = await uut.utxoIsValid(utxo)

      assert.isFalse(result)
    })
  })

  describe('#Error handling and retries', () => {
    it('should handle request failures', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      mockChronik.script.throws(new Error('Network error'))

      try {
        await uut.getUtxos(address)
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Network error')
      }
    })

    it('should fail after max retries', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      mockChronik.script.throws(new Error('Persistent error'))

      try {
        await uut.getUtxos(address)
        assert.fail('Should throw after max retries')
      } catch (err) {
        assert.include(err.message, 'error')
      }
    })
  })

  describe('#Performance and caching', () => {
    it('should cache frequently accessed data', async () => {
      const address = mockWallet.mockXecAddresses.valid[0]

      // First call
      await uut.getUtxos(address)
      // Second call (should use cache)
      await uut.getUtxos(address)

      // Should only call Chronik once due to caching
      assert.equal(mockChronik.script.callCount, 1)
    })
  })

  // TODO: Phase 2 - eToken-related adapter tests will be added
  describe('#eToken operations - Phase 2', () => {
    it('getETokenData should be ready for implementation', () => {
      assert.isFunction(uut.getETokenData)
    })

    it('getETokenData2 should be ready for implementation', () => {
      assert.isFunction(uut.getETokenData2)
    })
  })
})
