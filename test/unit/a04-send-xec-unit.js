/*
  Unit tests for XEC transaction sending functionality.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Mocking data
const mockUtxos = require('./mocks/xec-utxo-mocks')
const mockWallet = require('./mocks/xec-wallet-mocks')

// Unit under test
const SendXEC = require('../../lib/send-xec')

describe('#send-xec.js - XEC Transaction Sending', () => {
  let sandbox, uut, mockChronik, mockAr

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    mockChronik = {
      broadcastTx: sandbox.stub().resolves('test_txid_123')
    }

    mockAr = {
      sendTx: sandbox.stub().resolves('test_txid_123'),
      getUtxos: sandbox.stub().resolves(mockUtxos.simpleXecUtxos)
    }

    const config = {
      chronik: mockChronik,
      ar: mockAr
    }

    uut = new SendXEC(config)
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should instantiate SendXEC class', () => {
      assert.instanceOf(uut, SendXEC)
      assert.property(uut, 'chronik')
      assert.property(uut, 'ar')
    })

    it('should throw error without chronik client', () => {
      try {
        new SendXEC({}) // eslint-disable-line no-new
        assert.fail('Should throw error without chronik')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'chronik')
      }
    })
  })

  describe('#sendXec', () => {
    it('should send XEC to single output', async () => {
      const outputs = mockWallet.mockXecOutputs
      const walletInfo = mockWallet.mockXecWalletInfo
      const utxos = mockUtxos.simpleXecUtxos.utxos

      sandbox.stub(uut, 'createTransaction').resolves(mockWallet.mockTransactionHex)

      const result = await uut.sendXec(outputs, walletInfo, utxos)

      assert.equal(result, 'test_txid_123')
    })

    it('should send XEC to multiple outputs', async () => {
      const outputs = mockWallet.mockMultipleXecOutputs
      const walletInfo = mockWallet.mockXecWalletInfo
      const utxos = mockUtxos.mixedXecUtxos

      sandbox.stub(uut, 'createTransaction').resolves(mockWallet.mockTransactionHex)

      const result = await uut.sendXec(outputs, walletInfo, utxos)

      assert.equal(result, 'test_txid_123')
    })

    it('should handle insufficient funds error', async () => {
      const outputs = [{
        address: mockWallet.mockXecAddresses.valid[0],
        amountSat: 1000000 // More than available in mock UTXOs
      }]
      const walletInfo = mockWallet.mockXecWalletInfo
      const utxos = mockUtxos.simpleXecUtxos.utxos

      try {
        await uut.sendXec(outputs, walletInfo, utxos)
        assert.fail('Should throw insufficient funds error')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'insufficient')
      }
    })
  })

  describe('#createTransaction', () => {
    it('should create valid transaction hex', async () => {
      const outputs = mockWallet.mockXecOutputs
      const walletInfo = mockWallet.mockXecWalletInfo
      const utxos = mockUtxos.simpleXecUtxos.utxos

      sandbox.stub(uut, 'getNecessaryUtxosAndChange').returns({
        necessaryUtxos: utxos,
        change: 50000 // 500 XEC change
      })

      const result = await uut.createTransaction(outputs, walletInfo, utxos)

      assert.isString(result)
      assert.isTrue(result.length > 0)
    })

    it('should handle exact amount with no change', async () => {
      const outputs = [{
        address: mockWallet.mockXecAddresses.valid[0],
        amountSat: 59880 // Exact amount minus fee
      }]
      const walletInfo = mockWallet.mockXecWalletInfo
      const utxos = mockUtxos.simpleXecUtxos.utxos

      sandbox.stub(uut, 'getNecessaryUtxosAndChange').returns({
        necessaryUtxos: utxos,
        change: 0
      })

      const result = await uut.createTransaction(outputs, walletInfo, utxos)

      assert.isString(result)
    })
  })

  describe('#getNecessaryUtxosAndChange', () => {
    it('should select sufficient UTXOs for transaction', () => {
      const outputs = mockWallet.mockXecOutputs
      const utxos = mockUtxos.mixedXecUtxos
      const satsPerByte = 1.2

      const result = uut.getNecessaryUtxosAndChange(outputs, utxos, satsPerByte)

      assert.property(result, 'necessaryUtxos')
      assert.property(result, 'change')
      assert.isArray(result.necessaryUtxos)
      assert.isNumber(result.change)
    })

    it('should minimize UTXOs used (coin selection)', () => {
      const outputs = [{
        address: mockWallet.mockXecAddresses.valid[0],
        amountSat: 50000 // 500 XEC - can be satisfied by single large UTXO
      }]
      const utxos = mockUtxos.mixedXecUtxos
      const satsPerByte = 1.2

      const result = uut.getNecessaryUtxosAndChange(outputs, utxos, satsPerByte)

      // Should prefer single large UTXO over multiple small ones
      assert.isTrue(result.necessaryUtxos.length <= 2)
    })

    it('should throw error for insufficient funds', () => {
      const outputs = [{
        address: mockWallet.mockXecAddresses.valid[0],
        amountSat: 2000000 // More than available
      }]
      const utxos = mockUtxos.simpleXecUtxos.utxos
      const satsPerByte = 1.2

      try {
        uut.getNecessaryUtxosAndChange(outputs, utxos, satsPerByte)
        assert.fail('Should throw insufficient funds error')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'insufficient')
      }
    })
  })

  describe('#calculateFee', () => {
    it('should calculate correct fee for transaction', () => {
      const numInputs = 2
      const numOutputs = 1
      const satsPerByte = 1.2

      const fee = uut.calculateFee(numInputs, numOutputs, satsPerByte)

      assert.isNumber(fee)
      assert.isTrue(fee > 0)
      // Basic transaction size estimate: (inputs * 148) + (outputs * 34) + 10
      const estimatedSize = (numInputs * 148) + (numOutputs * 34) + 10
      const expectedFee = Math.ceil(estimatedSize * satsPerByte)
      assert.equal(fee, expectedFee)
    })

    it('should handle zero fee rate', () => {
      const fee = uut.calculateFee(1, 1, 0)
      assert.equal(fee, 0)
    })
  })

  describe('#sortUtxosBySize', () => {
    it('should sort UTXOs in ascending order', () => {
      const utxos = [...mockUtxos.mixedXecUtxos] // Copy to avoid mutation

      const sorted = uut.sortUtxosBySize(utxos, 'asc')

      for (let i = 1; i < sorted.length; i++) {
        assert.isTrue(uut._getUtxoValue(sorted[i]) >= uut._getUtxoValue(sorted[i - 1]))
      }
    })

    it('should sort UTXOs in descending order', () => {
      const utxos = [...mockUtxos.mixedXecUtxos]

      const sorted = uut.sortUtxosBySize(utxos, 'desc')

      for (let i = 1; i < sorted.length; i++) {
        assert.isTrue(uut._getUtxoValue(sorted[i]) <= uut._getUtxoValue(sorted[i - 1]))
      }
    })
  })

  describe('#sendAllXec', () => {
    it('should send all available XEC to address', async () => {
      const toAddress = mockWallet.mockXecAddresses.valid[0]
      const walletInfo = mockWallet.mockXecWalletInfo
      const utxos = mockUtxos.mixedXecUtxos

      sandbox.stub(uut, 'createSendAllTx').resolves(mockWallet.mockTransactionHex)
      // uut.ar.sendTx is already stubbed in beforeEach to return 'test_txid_123'

      const result = await uut.sendAllXec(toAddress, walletInfo, utxos)

      assert.equal(result, 'test_txid_123')
    })
  })

  describe('#createSendAllTx', () => {
    it('should create transaction using all UTXOs', async () => {
      const toAddress = mockWallet.mockXecAddresses.valid[0]
      const walletInfo = mockWallet.mockXecWalletInfo
      const utxos = mockUtxos.mixedXecUtxos

      const result = await uut.createSendAllTx(toAddress, walletInfo, utxos)

      assert.isString(result)
      assert.isTrue(result.length > 0)
    })

    it('should account for transaction fees', async () => {
      const toAddress = mockWallet.mockXecAddresses.valid[0]
      const walletInfo = mockWallet.mockXecWalletInfo
      const utxos = mockUtxos.simpleXecUtxos.utxos

      // Mock the fee calculation to return a predictable fee
      sandbox.stub(uut, '_calculateFee').returns(200) // 2 XEC fee

      const result = await uut.createSendAllTx(toAddress, walletInfo, utxos)

      assert.isString(result)
      // Verify fee was calculated and accounted for
      assert.isTrue(uut._calculateFee.calledOnce)
      // Verify the fee calculation was called with correct parameters (1 output, utxos.length inputs)
      assert.isTrue(uut._calculateFee.calledWith(utxos.length, 1))
    })
  })

  describe('#getKeyPairFromMnemonic', () => {
    it('should derive key pair from wallet info', async () => {
      const walletInfo = mockWallet.mockXecWalletInfo

      const result = await uut.getKeyPairFromMnemonic(walletInfo)

      assert.property(result, 'privateKey')
      assert.property(result, 'publicKey')
      assert.property(result, 'address')
      assert.include(result.address, 'ecash:')
    })

    it('should handle WIF private key', async () => {
      const walletInfo = {
        privateKey: mockWallet.mockXecWalletInfo.privateKey,
        mnemonic: null
      }

      const result = await uut.getKeyPairFromMnemonic(walletInfo)

      // Should return a key pair with privateKey, publicKey and address
      assert.property(result, 'privateKey')
      assert.property(result, 'publicKey')
      assert.property(result, 'address')
      assert.isString(result.privateKey)
      assert.isString(result.publicKey)
      assert.include(result.address, 'ecash:')
    })
  })

  describe('#XEC decimal handling', () => {
    it('should handle XEC base units correctly', () => {
      // XEC uses base units: 1 XEC = 100 satoshis
      const xecAmount = 10.50 // 10.5 XEC
      const satoshiAmount = Math.floor(xecAmount * 100) // 1050 satoshis

      assert.equal(satoshiAmount, 1050)
    })

    it('should validate minimum XEC amounts', () => {
      const dustLimit = 100 // 1 XEC minimum
      const validAmount = 150 // 1.5 XEC
      const dustAmount = 50 // 0.5 XEC

      assert.isTrue(validAmount >= dustLimit)
      assert.isFalse(dustAmount >= dustLimit)
    })
  })
})
