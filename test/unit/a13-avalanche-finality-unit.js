/*
  Unit tests for Avalanche Pre-Consensus finality feature.
  Tests the new awaitFinality option across all transaction methods.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Unit under test
const MinimalXECWallet = require('../../index')

describe('#Avalanche Pre-Consensus Finality', () => {
  let sandbox, uut

  beforeEach(async () => {
    sandbox = sinon.createSandbox()

    // Create wallet instance with test mnemonic
    uut = new MinimalXECWallet('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')

    // Wait for wallet creation
    await uut.walletInfoPromise
  })

  afterEach(() => sandbox.restore())

  describe('#Constructor - avalancheOptions', () => {
    it('should have default avalanche options', () => {
      assert.property(uut, 'avalancheOptions')
      assert.property(uut.avalancheOptions, 'enabled')
      assert.property(uut.avalancheOptions, 'defaultAwaitFinality')
      assert.property(uut.avalancheOptions, 'finalityTimeout')
    })

    it('should have correct default values', () => {
      assert.equal(uut.avalancheOptions.enabled, true)
      assert.equal(uut.avalancheOptions.defaultAwaitFinality, false)
      assert.equal(uut.avalancheOptions.finalityTimeout, 30000)
    })

    it('should allow custom avalanche options', async () => {
      const customWallet = new MinimalXECWallet(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        {
          avalanche: {
            enabled: false,
            defaultAwaitFinality: true,
            finalityTimeout: 60000
          }
        }
      )

      await customWallet.walletInfoPromise

      assert.equal(customWallet.avalancheOptions.enabled, false)
      assert.equal(customWallet.avalancheOptions.defaultAwaitFinality, true)
      assert.equal(customWallet.avalancheOptions.finalityTimeout, 60000)
    })

    it('should allow partial avalanche options', async () => {
      const customWallet = new MinimalXECWallet(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        {
          avalanche: {
            finalityTimeout: 45000
          }
        }
      )

      await customWallet.walletInfoPromise

      // Should use defaults for unspecified options
      assert.equal(customWallet.avalancheOptions.enabled, true)
      assert.equal(customWallet.avalancheOptions.defaultAwaitFinality, false)
      assert.equal(customWallet.avalancheOptions.finalityTimeout, 45000)
    })
  })

  describe('#broadcast - awaitFinality option', () => {
    it('should broadcast without finality by default', async () => {
      const sendTxStub = sandbox.stub(uut.ar, 'sendTx').resolves('txid_123')
      sandbox.stub(uut.ar, 'sendTxAndFinalize').resolves('finalized_txid_123')

      const result = await uut.broadcast({ hex: 'test_hex' })

      assert.equal(result, 'txid_123')
      assert.isTrue(sendTxStub.calledOnce)
    })

    it('should await finality when awaitFinality is true', async () => {
      sandbox.stub(uut.ar, 'sendTx').resolves('txid_123')
      const finalizeStub = sandbox.stub(uut.ar, 'sendTxAndFinalize').resolves('finalized_txid_123')

      const result = await uut.broadcast({ hex: 'test_hex', awaitFinality: true })

      assert.equal(result, 'finalized_txid_123')
      assert.isTrue(finalizeStub.calledOnce)
    })

    it('should use custom timeout when provided', async () => {
      const finalizeStub = sandbox.stub(uut.ar, 'sendTxAndFinalize').resolves('finalized_txid_123')

      await uut.broadcast({ hex: 'test_hex', awaitFinality: true, timeout: 60000 })

      assert.isTrue(finalizeStub.calledWith('test_hex', 60000))
    })

    it('should require hex parameter', async () => {
      try {
        await uut.broadcast({})
        assert.fail('Should throw error for missing hex')
      } catch (err) {
        assert.include(err.message, 'hex is required')
      }
    })
  })

  describe('#broadcastAndFinalize - convenience method', () => {
    it('should always wait for finality', async () => {
      const finalizeStub = sandbox.stub(uut.ar, 'sendTxAndFinalize').resolves('finalized_txid_123')

      const result = await uut.broadcastAndFinalize({ hex: 'test_hex' })

      assert.equal(result, 'finalized_txid_123')
      assert.isTrue(finalizeStub.calledOnce)
    })

    it('should use default timeout from avalancheOptions', async () => {
      const finalizeStub = sandbox.stub(uut.ar, 'sendTxAndFinalize').resolves('finalized_txid_123')

      await uut.broadcastAndFinalize({ hex: 'test_hex' })

      assert.isTrue(finalizeStub.calledWith('test_hex', 30000))
    })

    it('should allow custom timeout', async () => {
      const finalizeStub = sandbox.stub(uut.ar, 'sendTxAndFinalize').resolves('finalized_txid_123')

      await uut.broadcastAndFinalize({ hex: 'test_hex', timeout: 45000 })

      assert.isTrue(finalizeStub.calledWith('test_hex', 45000))
    })

    it('should throw if Avalanche is disabled', async () => {
      uut.avalancheOptions.enabled = false

      try {
        await uut.broadcastAndFinalize({ hex: 'test_hex' })
        assert.fail('Should throw error when Avalanche is disabled')
      } catch (err) {
        assert.include(err.message, 'Avalanche features are disabled')
      }
    })

    it('should require hex parameter', async () => {
      try {
        await uut.broadcastAndFinalize({})
        assert.fail('Should throw error for missing hex')
      } catch (err) {
        assert.include(err.message, 'hex is required')
      }
    })
  })

  describe('#defaultAwaitFinality behavior', () => {
    it('should use defaultAwaitFinality when awaitFinality not specified', async () => {
      // Create wallet with defaultAwaitFinality: true
      const finalityWallet = new MinimalXECWallet(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        {
          avalanche: {
            defaultAwaitFinality: true
          }
        }
      )

      await finalityWallet.walletInfoPromise

      const finalizeStub = sandbox.stub(finalityWallet.ar, 'sendTxAndFinalize').resolves('finalized_txid')
      sandbox.stub(finalityWallet.ar, 'sendTx').resolves('txid')

      // Call without specifying awaitFinality - should use default (true)
      await finalityWallet.broadcast({ hex: 'test_hex' })

      assert.isTrue(finalizeStub.calledOnce)
    })

    it('should override defaultAwaitFinality when explicitly set to false', async () => {
      // Create wallet with defaultAwaitFinality: true
      const finalityWallet = new MinimalXECWallet(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        {
          avalanche: {
            defaultAwaitFinality: true
          }
        }
      )

      await finalityWallet.walletInfoPromise

      sandbox.stub(finalityWallet.ar, 'sendTxAndFinalize').resolves('finalized_txid')
      const sendTxStub = sandbox.stub(finalityWallet.ar, 'sendTx').resolves('txid')

      // Explicitly set awaitFinality: false to override default
      await finalityWallet.broadcast({ hex: 'test_hex', awaitFinality: false })

      assert.isTrue(sendTxStub.calledOnce)
    })
  })

  describe('#sendXec - awaitFinality option', () => {
    beforeEach(async () => {
      // Initialize wallet for sendXec tests
      uut.isInitialized = true
      uut.utxos = {
        utxoStore: {
          xecUtxos: [
            {
              outpoint: { txid: 'test_txid', outIdx: 0 },
              blockHeight: 100000,
              sats: '150000',
              isFinal: true
            }
          ]
        },
        refreshCache: sandbox.stub().resolves(true)
      }
    })

    it('should pass awaitFinality option to sendXecLib', async () => {
      const sendXecStub = sandbox.stub(uut.sendXecLib, 'sendXec').resolves('txid_123')

      await uut.sendXec([{ address: 'ecash:qtest', amountSat: 1000 }], { awaitFinality: true })

      // Check that the options object was passed with awaitFinality
      const callArgs = sendXecStub.getCall(0).args
      assert.equal(callArgs[3].awaitFinality, true)
    })

    it('should use avalancheOptions defaults when not specified', async () => {
      const sendXecStub = sandbox.stub(uut.sendXecLib, 'sendXec').resolves('txid_123')

      await uut.sendXec([{ address: 'ecash:qtest', amountSat: 1000 }])

      const callArgs = sendXecStub.getCall(0).args
      assert.equal(callArgs[3].awaitFinality, false) // default
      assert.equal(callArgs[3].finalityTimeout, 30000) // default
    })
  })

  describe('#sendAllXec - awaitFinality option', () => {
    beforeEach(async () => {
      uut.isInitialized = true
      uut.utxos = {
        utxoStore: {
          xecUtxos: [
            {
              outpoint: { txid: 'test_txid', outIdx: 0 },
              blockHeight: 100000,
              sats: '150000',
              isFinal: true
            }
          ]
        },
        refreshCache: sandbox.stub().resolves(true)
      }
    })

    it('should pass awaitFinality option to sendXecLib.sendAllXec', async () => {
      const sendAllStub = sandbox.stub(uut.sendXecLib, 'sendAllXec').resolves('txid_123')

      await uut.sendAllXec('ecash:qtest', { awaitFinality: true })

      const callArgs = sendAllStub.getCall(0).args
      assert.equal(callArgs[3].awaitFinality, true)
    })
  })

  describe('#sendOpReturn - awaitFinality option', () => {
    beforeEach(async () => {
      uut.isInitialized = true
      uut.utxos = {
        utxoStore: {
          xecUtxos: [
            {
              outpoint: { txid: 'test_txid', outIdx: 0 },
              blockHeight: 100000,
              sats: '150000',
              isFinal: true
            }
          ]
        },
        refreshCache: sandbox.stub().resolves(true)
      }
    })

    it('should pass awaitFinality option to opReturn.sendOpReturn', async () => {
      const opReturnStub = sandbox.stub(uut.opReturn, 'sendOpReturn').resolves('txid_123')

      await uut.sendOpReturn('test message', '6d02', [], 1.0, { awaitFinality: true })

      const callArgs = opReturnStub.getCall(0).args
      assert.equal(callArgs[6].awaitFinality, true)
    })
  })

  describe('#sendETokens - awaitFinality option', () => {
    beforeEach(async () => {
      uut.isInitialized = true
      uut.utxos = {
        utxoStore: {
          xecUtxos: [
            {
              outpoint: { txid: 'test_txid', outIdx: 0 },
              blockHeight: 100000,
              sats: '150000',
              isFinal: true,
              token: {
                tokenId: '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135',
                tokenType: { protocol: 'SLP' },
                atoms: '100'
              }
            }
          ]
        },
        refreshCache: sandbox.stub().resolves(true)
      }
    })

    it('should pass awaitFinality option to hybridTokens.sendTokens', async () => {
      const sendTokensStub = sandbox.stub(uut.hybridTokens, 'sendTokens').resolves('txid_123')

      const tokenId = '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135'
      await uut.sendETokens(
        tokenId,
        [{ address: 'ecash:qtest', value: 10 }],
        1.2,
        { awaitFinality: true }
      )

      const callArgs = sendTokensStub.getCall(0).args
      assert.equal(callArgs[5].awaitFinality, true)
    })
  })
})
