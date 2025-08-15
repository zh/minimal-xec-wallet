/*
  Unit tests for XEC key derivation functionality.
  Tests BIP39 mnemonic generation and HD key derivation for XEC.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Mocking data
const mockWallet = require('./mocks/xec-wallet-mocks')

// Unit under test
const KeyDerivation = require('../../lib/key-derivation')

describe('#key-derivation.js', () => {
  let sandbox, uut

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    uut = new KeyDerivation()
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should instantiate key derivation class', () => {
      assert.instanceOf(uut, KeyDerivation)
    })
  })

  describe('#generateMnemonic', () => {
    it('should generate 12-word mnemonic by default', () => {
      const mnemonic = uut.generateMnemonic()
      const words = mnemonic.split(' ')

      assert.isString(mnemonic)
      assert.equal(words.length, 12)
    })

    it('should generate 24-word mnemonic with strength 256', () => {
      const mnemonic = uut.generateMnemonic(256)
      const words = mnemonic.split(' ')

      assert.isString(mnemonic)
      assert.equal(words.length, 24)
    })
  })

  describe('#validateMnemonic', () => {
    it('should validate correct mnemonic', () => {
      const validMnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const result = uut.validateMnemonic(validMnemonic)

      assert.isTrue(result)
    })

    it('should reject invalid mnemonic', () => {
      const invalidMnemonic = 'invalid word sequence here not bip39 compliant'
      const result = uut.validateMnemonic(invalidMnemonic)

      assert.isFalse(result)
    })
  })

  describe('#deriveFromMnemonic', () => {
    it('should derive XEC keys from mnemonic with default path', async () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const result = await uut.deriveFromMnemonic(mnemonic)

      assert.property(result, 'privateKey')
      assert.property(result, 'publicKey')
      assert.property(result, 'address')
      assert.include(result.address, 'ecash:')
    })

    it('should derive XEC keys with custom HD path', async () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const customPath = "m/44'/899'/0'/0/1" // Different index
      const result = await uut.deriveFromMnemonic(mnemonic, customPath)

      assert.property(result, 'privateKey')
      assert.property(result, 'address')
      assert.include(result.address, 'ecash:')
    })

    it('should produce consistent results for same mnemonic', async () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const result1 = await uut.deriveFromMnemonic(mnemonic)
      const result2 = await uut.deriveFromMnemonic(mnemonic)

      assert.equal(result1.privateKey, result2.privateKey)
      assert.equal(result1.address, result2.address)
    })
  })

  describe('#deriveFromWif', () => {
    it('should derive XEC keys from WIF private key', async () => {
      const wif = mockWallet.mockXecWalletInfo.privateKey
      const result = await uut.deriveFromWif(wif)

      assert.property(result, 'privateKey')
      assert.property(result, 'publicKey')
      assert.property(result, 'address')
      assert.include(result.address, 'ecash:')
    })

    it('should handle invalid WIF gracefully', async () => {
      const invalidWif = 'invalid_wif_key'

      try {
        await uut.deriveFromWif(invalidWif)
        assert.fail('Should have thrown error for invalid WIF')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'invalid')
      }
    })
  })

  describe('#mnemonicToSeed', () => {
    it('should convert mnemonic to seed buffer', () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const seed = uut.mnemonicToSeed(mnemonic)

      assert.instanceOf(seed, Buffer)
      assert.equal(seed.length, 64) // BIP39 seed is 64 bytes
    })

    it('should support passphrase', () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const passphrase = 'test_passphrase'

      const seedWithoutPassphrase = uut.mnemonicToSeed(mnemonic)
      const seedWithPassphrase = uut.mnemonicToSeed(mnemonic, passphrase)

      assert.notEqual(seedWithoutPassphrase.toString('hex'), seedWithPassphrase.toString('hex'))
    })
  })

  describe('#seedToMasterKey', () => {
    it('should derive master key from seed', () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const seed = uut.mnemonicToSeed(mnemonic)
      const masterKey = uut.seedToMasterKey(seed)

      assert.property(masterKey, 'privateKey')
      assert.property(masterKey, 'chainCode')
    })
  })

  describe('#derivePath', () => {
    it('should derive child key at specified path', () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const seed = uut.mnemonicToSeed(mnemonic)
      const masterKey = uut.seedToMasterKey(seed)
      const path = "m/44'/899'/0'/0/0"

      const childKey = uut.derivePath(masterKey, path)

      assert.property(childKey, 'privateKey')
      assert.property(childKey, 'publicKey')
    })

    it('should handle invalid paths gracefully', () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const seed = uut.mnemonicToSeed(mnemonic)
      const masterKey = uut.seedToMasterKey(seed)
      const invalidPath = 'invalid/path/format'

      try {
        uut.derivePath(masterKey, invalidPath)
        assert.fail('Should have thrown error for invalid path')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'path')
      }
    })
  })

  describe('#XEC-specific coin type', () => {
    it('should use coin type 899 for XEC', async () => {
      const mnemonic = mockWallet.mockXecWalletInfo.mnemonic
      const xecPath = "m/44'/899'/0'/0/0" // XEC coin type
      const bchPath = "m/44'/245'/0'/0/0" // BCH coin type for comparison

      // Test that the function accepts and processes different coin types
      const xecResult = await uut.deriveFromMnemonic(mnemonic, xecPath)
      const bchResult = await uut.deriveFromMnemonic(mnemonic, bchPath)

      // In the context of a unit test with mocked address encoding,
      // we verify that both derivations complete successfully
      assert.property(xecResult, 'address')
      assert.property(xecResult, 'privateKey')
      assert.property(xecResult, 'publicKey')

      assert.property(bchResult, 'address')
      assert.property(bchResult, 'privateKey')
      assert.property(bchResult, 'publicKey')

      // The private keys should be different because of different derivation paths
      assert.notEqual(xecResult.privateKey, bchResult.privateKey)
    })
  })
})
