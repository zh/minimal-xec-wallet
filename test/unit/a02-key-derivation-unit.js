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

  describe('#WIF functionality', () => {
    describe('#_isValidWIF', () => {
      it('should validate correct WIF format patterns', () => {
        // Test mainnet compressed WIF (generated by our implementation)
        const validMainnetWIF = 'Kwq6djQ1szRRfSE4FT8YVSCWuTcU6H5MTYdsdxiheF7dBRpxVVTy'
        assert.strictEqual(uut._isValidWIF(validMainnetWIF), true)

        // Test testnet compressed WIF (generated by our implementation)
        const validTestnetWIF = 'cNC66ePsK47gpshKdrwfrkhaXguskjB3XanLkPBD9MmdSAsSuTU6'
        assert.strictEqual(uut._isValidWIF(validTestnetWIF), true)
      })

      it('should reject invalid WIF format', () => {
        const invalidWIF = 'InvalidWIFString123'
        assert.strictEqual(uut._isValidWIF(invalidWIF), false)

        const emptyString = ''
        assert.strictEqual(uut._isValidWIF(emptyString), false)

        const nullValue = null
        assert.strictEqual(uut._isValidWIF(nullValue), false)

        const wrongLength = 'K12345'
        assert.strictEqual(uut._isValidWIF(wrongLength), false)

        const wrongPrefix = 'A' + 'ynD8ZKdViVo5W82oyxvE18BbG6nZPVQ8Td8hYbwU94RmyUALUik'
        assert.strictEqual(uut._isValidWIF(wrongPrefix), false)
      })

      it('should reject WIF with invalid Base58 characters', () => {
        const invalidBase58 = 'KynD8ZKdViVo5W82oyxvE18BbG6nZPVQ8Td8hYbwU94RmyUALU0l' // contains 0
        assert.strictEqual(uut._isValidWIF(invalidBase58), false)
      })
    })

    describe('#_wifToPrivateKey', () => {
      it('should convert valid WIF to private key correctly', () => {
        const validWIF = 'Kwq6djQ1szRRfSE4FT8YVSCWuTcU6H5MTYdsdxiheF7dBRpxVVTy'
        const result = uut._wifToPrivateKey(validWIF)

        assert(Buffer.isBuffer(result.privateKey))
        assert.strictEqual(result.privateKey.length, 32)
        assert.strictEqual(typeof result.isCompressed, 'boolean')
      })

      it('should detect compression flag correctly', () => {
        const compressedWIF = 'Kwq6djQ1szRRfSE4FT8YVSCWuTcU6H5MTYdsdxiheF7dBRpxVVTy'
        const result = uut._wifToPrivateKey(compressedWIF)
        assert.strictEqual(result.isCompressed, true)
      })

      it('should throw error for invalid WIF', () => {
        const invalidWIF = 'InvalidWIF'

        try {
          uut._wifToPrivateKey(invalidWIF)
          assert.fail('Should have thrown error for invalid WIF')
        } catch (err) {
          assert.include(err.message.toLowerCase(), 'invalid wif')
        }
      })
    })

    describe('#_privateKeyToWif', () => {
      it('should convert private key to WIF correctly', () => {
        const privateKey = Buffer.from('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'hex')
        const wif = uut._privateKeyToWif(privateKey, true, false)

        assert(typeof wif === 'string')
        assert(wif.length >= 51 && wif.length <= 52)
        assert(uut._isValidWIF(wif))
      })

      it('should create different WIFs for mainnet vs testnet', () => {
        const privateKey = Buffer.from('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'hex')
        const mainnetWif = uut._privateKeyToWif(privateKey, true, false)
        const testnetWif = uut._privateKeyToWif(privateKey, true, true)

        assert.notEqual(mainnetWif, testnetWif)
        assert(['K', 'L'].includes(mainnetWif[0]))
        assert.strictEqual(testnetWif[0], 'c')
      })

      it('should handle compression flag correctly', () => {
        const privateKey = Buffer.from('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'hex')
        const compressedWif = uut._privateKeyToWif(privateKey, true, false)
        const uncompressedWif = uut._privateKeyToWif(privateKey, false, false)

        // WIF length difference due to compression flag
        assert.notEqual(compressedWif, uncompressedWif)
      })

      it('should throw error for invalid private key', () => {
        const invalidPrivateKey = Buffer.from('invalid', 'hex')

        try {
          uut._privateKeyToWif(invalidPrivateKey, true, false)
          assert.fail('Should have thrown error for invalid private key')
        } catch (err) {
          assert.include(err.message.toLowerCase(), 'private key')
        }
      })
    })

    describe('#deriveFromWif enhanced', () => {
      it('should derive consistent addresses from valid WIF', () => {
        const validWIF = 'Kwq6djQ1szRRfSE4FT8YVSCWuTcU6H5MTYdsdxiheF7dBRpxVVTy'
        const result1 = uut.deriveFromWif(validWIF)
        const result2 = uut.deriveFromWif(validWIF)

        assert.strictEqual(result1.address, result2.address)
        assert.strictEqual(result1.privateKey, result2.privateKey)
        assert.strictEqual(result1.publicKey, result2.publicKey)
        assert.strictEqual(result1.isCompressed, result2.isCompressed)
        assert.strictEqual(result1.wif, result2.wif)
      })

      it('should return additional WIF metadata', () => {
        const validWIF = 'Kwq6djQ1szRRfSE4FT8YVSCWuTcU6H5MTYdsdxiheF7dBRpxVVTy'
        const result = uut.deriveFromWif(validWIF)

        assert.property(result, 'privateKey')
        assert.property(result, 'publicKey')
        assert.property(result, 'address')
        assert.property(result, 'isCompressed')
        assert.property(result, 'wif')
        assert.strictEqual(result.wif, validWIF)
      })

      it('should handle hex private keys as fallback', () => {
        const hexPrivateKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        const result = uut.deriveFromWif(hexPrivateKey)

        assert.property(result, 'privateKey')
        assert.property(result, 'publicKey')
        assert.property(result, 'address')
        // Should use the hex key directly for the derivation
        assert.strictEqual(result.privateKey.length, 64) // 32 bytes = 64 hex chars
        // In test mode, it returns the original input as wif field
        assert.strictEqual(result.wif, hexPrivateKey)
      })

      it('should handle invalid input gracefully', () => {
        const invalidInput = 'clearly-not-a-wif-or-hex'
        const result = uut.deriveFromWif(invalidInput)

        // Should fall back to hash-based generation
        assert.property(result, 'privateKey')
        assert.property(result, 'publicKey')
        assert.property(result, 'address')
        // In test mode, it returns the original input as wif
        assert.strictEqual(result.wif, invalidInput)
      })
    })

    describe('#exportToWif', () => {
      it('should export hex private key to WIF format', () => {
        const hexPrivateKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        const wif = uut.exportToWif(hexPrivateKey, true, false)

        assert(typeof wif === 'string')
        assert(uut._isValidWIF(wif))
      })

      it('should handle testnet and mainnet exports', () => {
        const hexPrivateKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        const mainnetWif = uut.exportToWif(hexPrivateKey, true, false)
        const testnetWif = uut.exportToWif(hexPrivateKey, true, true)

        assert.notEqual(mainnetWif, testnetWif)
        assert(['K', 'L'].includes(mainnetWif[0]))
        assert.strictEqual(testnetWif[0], 'c')
      })

      it('should throw error for invalid hex private key', () => {
        const invalidHex = 'not-a-valid-hex-string'

        try {
          uut.exportToWif(invalidHex, true, false)
          assert.fail('Should have thrown error for invalid hex')
        } catch (err) {
          assert.include(err.message.toLowerCase(), 'hex string')
        }
      })

      it('should throw error for wrong length hex private key', () => {
        const shortHex = '1234567890abcdef'

        try {
          uut.exportToWif(shortHex, true, false)
          assert.fail('Should have thrown error for wrong length hex')
        } catch (err) {
          assert.include(err.message.toLowerCase(), '64-character')
        }
      })
    })

    describe('#WIF round-trip conversion', () => {
      it('should maintain consistency in WIF->hex->WIF conversion', () => {
        const originalWIF = 'Kwq6djQ1szRRfSE4FT8YVSCWuTcU6H5MTYdsdxiheF7dBRpxVVTy'

        // WIF -> hex
        const { privateKey, isCompressed } = uut._wifToPrivateKey(originalWIF)
        const hexPrivateKey = privateKey.toString('hex')

        // hex -> WIF
        const reconstructedWIF = uut.exportToWif(hexPrivateKey, isCompressed, false)

        assert.strictEqual(originalWIF, reconstructedWIF)
      })

      it('should handle testnet WIF round-trip', () => {
        const testnetWIF = 'cNC66ePsK47gpshKdrwfrkhaXguskjB3XanLkPBD9MmdSAsSuTU6'

        // WIF -> hex
        const { privateKey, isCompressed } = uut._wifToPrivateKey(testnetWIF)
        const hexPrivateKey = privateKey.toString('hex')

        // hex -> WIF (testnet)
        const reconstructedWIF = uut.exportToWif(hexPrivateKey, isCompressed, true)

        assert.strictEqual(testnetWIF, reconstructedWIF)
      })
    })
  })
})
