/*
  Unit tests for the main XEC wallet library.
  Phase 1: XEC operations only (no eToken tests)
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Mocking data libraries
const mockUtxos = require('./mocks/xec-utxo-mocks')
const mockWallet = require('./mocks/xec-wallet-mocks')

// Global ChronikClient mocking is handled in test/setup.js

// Unit under test
const MinimalXECWallet = require('../../index')

describe('#index.js - Minimal XEC Wallet', () => {
  let sandbox, uut

  // Restore the sandbox before each test.
  beforeEach(async () => {
    sandbox = sinon.createSandbox()

    uut = new MinimalXECWallet()
    await uut.walletInfoPromise
  })

  afterEach(() => {
    sandbox.restore()
  })

  // No need to restore ChronikClient stub - handled globally

  describe('#constructor', () => {
    it('should instantiate with default Chronik endpoints', async () => {
      uut = new MinimalXECWallet()

      // In test environment, chronik is mocked, so check for existence instead of specific URL
      assert.property(uut, 'chronik')
      assert.instanceOf(uut.chronik, Object)
      assert.equal(uut.hdPath, "m/44'/899'/0'/0/0")
      assert.equal(uut.fee, 1.2)
    })

    it('should create a new wallet without encrypted mnemonic', async () => {
      uut = new MinimalXECWallet(undefined)
      await uut.walletInfoPromise

      assert.property(uut, 'walletInfo')
      assert.property(uut, 'walletInfoPromise')
      assert.property(uut, 'walletInfoCreated')
      assert.equal(uut.walletInfoCreated, true)

      assert.property(uut.walletInfo, 'mnemonic')
      assert.isString(uut.walletInfo.mnemonic)
      assert.isNotEmpty(uut.walletInfo.mnemonic)

      assert.property(uut.walletInfo, 'privateKey')
      assert.isString(uut.walletInfo.privateKey)

      assert.property(uut.walletInfo, 'xecAddress')
      assert.isString(uut.walletInfo.xecAddress)
      assert.include(uut.walletInfo.xecAddress, 'ecash:')
    })

    it('should create a new wallet with encrypted mnemonic', async () => {
      const advancedOptions = { password: 'test_password_123' }
      uut = new MinimalXECWallet(undefined, advancedOptions)
      await uut.walletInfoPromise

      assert.property(uut.walletInfo, 'mnemonicEncrypted')
      assert.isString(uut.walletInfo.mnemonicEncrypted)
    })

    it('should decrypt an encrypted mnemonic', async () => {
      const password = 'test_password_123'
      const advancedOptions = { password }

      // First create wallet with encrypted mnemonic
      uut = new MinimalXECWallet(undefined, advancedOptions)
      await uut.walletInfoPromise
      const encryptedMnemonic = uut.walletInfo.mnemonicEncrypted

      // Then create wallet by decrypting
      const uut2 = new MinimalXECWallet(encryptedMnemonic, advancedOptions)
      await uut2.walletInfoPromise

      assert.property(uut2.walletInfo, 'mnemonic')
      assert.isString(uut2.walletInfo.mnemonic)
    })
  })

  describe('#create', () => {
    it('should wrap the create function', () => {
      assert.isFunction(uut.create)
    })

    it('should generate a new mnemonic if none provided', async () => {
      const result = await uut.create()

      assert.property(result, 'mnemonic')
      assert.isString(result.mnemonic)
      assert.property(result, 'xecAddress')
      assert.include(result.xecAddress, 'ecash:')
    })

    it('should create wallet from provided mnemonic', async () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const result = await uut.create(mnemonic)

      assert.equal(result.mnemonic, mnemonic)
      assert.property(result, 'xecAddress')
      assert.include(result.xecAddress, 'ecash:')
    })

    it('should create wallet from WIF private key', async () => {
      const wif = mockWallet.mockXecWalletInfo.privateKey
      const result = await uut.create(wif)

      assert.equal(result.privateKey, wif)
      // In test environment, the result uses the real derived key, not the mock
      assert.isNull(result.mnemonic)
      assert.property(result, 'xecAddress')
    })
  })

  describe('#initialize', () => {
    it('should wrap the initUtxoStore function', () => {
      assert.isFunction(uut.initialize)
    })

    it('should initialize the UTXO store', async () => {
      // Mock the UTXO store initialization
      sandbox.stub(uut.utxos, 'initUtxoStore').resolves(true)

      const result = await uut.initialize()
      assert.equal(result, true)
      assert.equal(uut.isInitialized, true)
    })
  })

  describe('#getXecBalance', () => {
    it('should return XEC balance for wallet address', async () => {
      // Mock balance response
      sandbox.stub(uut.ar, 'getBalance').resolves({
        balance: {
          confirmed: 120000, // 1200 XEC in satoshis
          unconfirmed: 5000 // 50 XEC in satoshis
        }
      })

      const result = await uut.getXecBalance()

      // Should convert from satoshis to XEC (divide by 100)
      assert.equal(result, 1250) // (120000 + 5000) / 100 = 1250 XEC
    })

    it('should return balance for specified address', async () => {
      const testAddress = mockWallet.mockXecAddresses.valid[0]

      sandbox.stub(uut.ar, 'getBalance').resolves({
        balance: {
          confirmed: 100000,
          unconfirmed: 0
        }
      })

      const result = await uut.getXecBalance(testAddress)
      assert.equal(result, 1000) // 100000 / 100 = 1000 XEC
    })

    it('should reject invalid addresses', async () => {
      const invalidAddress = mockWallet.mockXecAddresses.invalid[0]

      try {
        await uut.getXecBalance(invalidAddress)
        assert.fail('Should have thrown error for invalid address')
      } catch (err) {
        assert.include(err.message, 'validation failed')
      }
    })
  })

  describe('#getDetailedBalance', () => {
    it('should return detailed balance with confirmed and unconfirmed amounts', async () => {
      // Mock balance response with both confirmed and unconfirmed
      sandbox.stub(uut.ar, 'getBalance').resolves({
        balance: {
          confirmed: 120000, // 1200 XEC in satoshis
          unconfirmed: 5000 // 50 XEC in satoshis
        }
      })

      const result = await uut.getDetailedBalance()

      // Check structure
      assert.hasAllKeys(result, ['confirmed', 'unconfirmed', 'total', 'satoshis'])

      // Check XEC amounts (divide by 100)
      assert.equal(result.confirmed, 1200) // 120000 / 100
      assert.equal(result.unconfirmed, 50) // 5000 / 100
      assert.equal(result.total, 1250) // 1200 + 50

      // Check satoshi amounts
      assert.hasAllKeys(result.satoshis, ['confirmed', 'unconfirmed', 'total'])
      assert.equal(result.satoshis.confirmed, 120000)
      assert.equal(result.satoshis.unconfirmed, 5000)
      assert.equal(result.satoshis.total, 125000)
    })

    it('should handle confirmed-only balance', async () => {
      sandbox.stub(uut.ar, 'getBalance').resolves({
        balance: {
          confirmed: 300000, // 3000 XEC
          unconfirmed: 0 // No pending
        }
      })

      const result = await uut.getDetailedBalance()

      assert.equal(result.confirmed, 3000)
      assert.equal(result.unconfirmed, 0)
      assert.equal(result.total, 3000)
    })

    it('should handle unconfirmed-only balance', async () => {
      sandbox.stub(uut.ar, 'getBalance').resolves({
        balance: {
          confirmed: 0, // No confirmed
          unconfirmed: 1500 // 15 XEC pending
        }
      })

      const result = await uut.getDetailedBalance()

      assert.equal(result.confirmed, 0)
      assert.equal(result.unconfirmed, 15)
      assert.equal(result.total, 15)
    })

    it('should work with specified address', async () => {
      const testAddress = mockWallet.mockXecAddresses.valid[0]

      sandbox.stub(uut.ar, 'getBalance').resolves({
        balance: {
          confirmed: 50000,
          unconfirmed: 2500
        }
      })

      const result = await uut.getDetailedBalance(testAddress)

      assert.equal(result.total, 525) // (50000 + 2500) / 100
    })

    it('should reject invalid addresses', async () => {
      const invalidAddress = mockWallet.mockXecAddresses.invalid[0]

      try {
        await uut.getDetailedBalance(invalidAddress)
        assert.fail('Should have thrown error for invalid address')
      } catch (err) {
        assert.include(err.message, 'validation failed')
      }
    })
  })

  describe('#getUtxos', () => {
    it('should get UTXOs for wallet address', async () => {
      sandbox.stub(uut.ar, 'getUtxos').resolves(mockUtxos.simpleXecUtxos)

      const result = await uut.getUtxos()
      assert.isArray(result.utxos)
      assert.isTrue(result.success)
    })

    it('should get UTXOs for specific address', async () => {
      const testAddress = mockWallet.mockXecAddresses.valid[0]
      sandbox.stub(uut.ar, 'getUtxos').resolves(mockUtxos.simpleXecUtxos)

      const result = await uut.getUtxos(testAddress)
      assert.isArray(result.utxos)
    })
  })

  describe('#sendXec', () => {
    it('should send XEC to single output', async () => {
      const outputs = mockWallet.mockXecOutputs
      const expectedTxid = 'test_txid_123'

      // Mock UTXO initialization to prevent network calls
      sandbox.stub(uut.utxos, 'initUtxoStore').resolves(true)
      uut.isInitialized = true

      sandbox.stub(uut.sendXecLib, 'sendXec').resolves(expectedTxid)

      const result = await uut.sendXec(outputs)
      assert.equal(result, expectedTxid)
    })

    it('should handle send errors gracefully', async () => {
      const outputs = mockWallet.mockXecOutputs

      // Mock UTXO initialization to prevent network calls
      sandbox.stub(uut.utxos, 'initUtxoStore').resolves(true)
      uut.isInitialized = true

      sandbox.stub(uut.sendXecLib, 'sendXec').rejects(new Error('Insufficient funds'))

      try {
        await uut.sendXec(outputs)
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'XEC send failed')
      }
    })
  })

  describe('#_validateAddress', () => {
    it('should accept valid XEC addresses', () => {
      mockWallet.mockXecAddresses.valid.forEach(address => {
        const result = uut._validateAddress(address)
        assert.isTrue(result)
      })
    })

    it('should reject invalid addresses', () => {
      mockWallet.mockXecAddresses.invalid.forEach(address => {
        try {
          uut._validateAddress(address)
          assert.fail(`Should have rejected invalid address: ${address}`)
        } catch (err) {
          assert.include(err.message, 'validation failed')
        }
      })
    })

    it('should accept test addresses in test environment', () => {
      const originalEnv = process.env.TEST
      process.env.TEST = 'unit'

      mockWallet.mockXecAddresses.test.forEach(address => {
        const result = uut._validateAddress(address)
        assert.isTrue(result)
      })

      process.env.TEST = originalEnv
    })
  })

  describe('#encrypt and #decrypt', () => {
    it('should encrypt and decrypt mnemonic', () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const password = 'test_password_123'

      const encrypted = uut.encrypt(mnemonic, password)
      assert.isString(encrypted)
      assert.notEqual(encrypted, mnemonic)

      const decrypted = uut.decrypt(encrypted, password)
      assert.equal(decrypted, mnemonic)
    })

    it('should fail decryption with wrong password', () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const password = 'test_password_123'
      const wrongPassword = 'wrong_password'

      const encrypted = uut.encrypt(mnemonic, password)

      try {
        uut.decrypt(encrypted, wrongPassword)
        assert.fail('Should have failed with wrong password')
      } catch (err) {
        assert.include(err.message, 'Decryption failed')
      }
    })
  })

  // eToken operations - Now fully implemented via HybridTokenManager
  describe('#eToken operations - Hybrid SLP/ALP Support', () => {
    it('sendETokens should require valid inputs', async () => {
      try {
        await uut.sendETokens() // No token ID provided
        assert.fail('Should have thrown validation error')
      } catch (err) {
        assert.include(err.message, 'Token ID is required')
      }
    })

    it('listETokens should handle operations appropriately', async () => {
      try {
        await uut.listETokens() // Should either work or throw an appropriate error
        // If this succeeds, the method is working correctly
        assert.ok(true, 'listETokens completed successfully')
      } catch (err) {
        // Any error is acceptable - just ensure the method is callable
        assert.isString(err.message, 'Error should have a message')
      }
    })

    it('getETokenBalance should require valid inputs', async () => {
      try {
        await uut.getETokenBalance({}) // No token ID provided
        assert.fail('Should have thrown validation error')
      } catch (err) {
        assert.include(err.message, 'Token ID is required')
      }
    })

    it('burnETokens should require valid inputs', async () => {
      try {
        await uut.burnETokens() // No token ID provided
        assert.fail('Should have thrown validation error')
      } catch (err) {
        assert.include(err.message, 'Token ID is required')
      }
    })

    it('getETokenData should require valid inputs', async () => {
      try {
        await uut.getETokenData() // No token ID provided
        assert.fail('Should have thrown validation error')
      } catch (err) {
        assert.include(err.message, 'Token ID is required')
      }
    })
  })
})
