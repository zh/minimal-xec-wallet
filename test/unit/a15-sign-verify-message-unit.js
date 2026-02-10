/*
  Unit tests for signMessage, verifyMessage, and _magicHash methods.
*/

const assert = require('chai').assert
const sinon = require('sinon')

// Unit under test
const MinimalXECWallet = require('../../index')

describe('#signMessage / verifyMessage / _magicHash', () => {
  let sandbox, uut

  beforeEach(async () => {
    sandbox = sinon.createSandbox()

    uut = new MinimalXECWallet()
    await uut.walletInfoPromise
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('#signMessage', () => {
    it('should throw if wallet not initialized', () => {
      uut.walletInfo = null
      try {
        uut.signMessage('test')
        assert.fail('should have thrown')
      } catch (err) {
        assert.include(err.message, 'Wallet not initialized')
      }
    })

    it('should throw if no private key available', () => {
      uut.walletInfo = { xecAddress: 'ecash:mock123' }
      try {
        uut.signMessage('test')
        assert.fail('should have thrown')
      } catch (err) {
        assert.include(err.message, 'Wallet not initialized')
      }
    })

    it('should throw if message is empty string', () => {
      try {
        uut.signMessage('')
        assert.fail('should have thrown')
      } catch (err) {
        assert.include(err.message, 'non-empty string')
      }
    })

    it('should throw if message is null', () => {
      try {
        uut.signMessage(null)
        assert.fail('should have thrown')
      } catch (err) {
        assert.include(err.message, 'non-empty string')
      }
    })

    it('should throw if message is undefined', () => {
      try {
        uut.signMessage(undefined)
        assert.fail('should have thrown')
      } catch (err) {
        assert.include(err.message, 'non-empty string')
      }
    })

    it('should throw if message is not a string', () => {
      try {
        uut.signMessage(12345)
        assert.fail('should have thrown')
      } catch (err) {
        assert.include(err.message, 'non-empty string')
      }
    })

    it('should return a base64 string on success', () => {
      const result = uut.signMessage('Hello eCash!')

      assert.isString(result)
      // Verify it's valid base64 by decoding
      const decoded = globalThis.atob(result)
      assert.equal(decoded.length, 65, 'recoverable signature should be 65 bytes')
    })

    it('should produce consistent output for same message', () => {
      const sig1 = uut.signMessage('Hello eCash!')
      const sig2 = uut.signMessage('Hello eCash!')
      assert.equal(sig1, sig2)
    })
  })

  describe('#verifyMessage', () => {
    it('should return false if message is empty', () => {
      const result = uut.verifyMessage('', 'sig', 'ecash:addr')
      assert.isFalse(result)
    })

    it('should return false if message is null', () => {
      const result = uut.verifyMessage(null, 'sig', 'ecash:addr')
      assert.isFalse(result)
    })

    it('should return false if signature is empty', () => {
      const result = uut.verifyMessage('hello', '', 'ecash:addr')
      assert.isFalse(result)
    })

    it('should return false if signature is null', () => {
      const result = uut.verifyMessage('hello', null, 'ecash:addr')
      assert.isFalse(result)
    })

    it('should return false if address is empty', () => {
      const result = uut.verifyMessage('hello', 'c2lnbmF0dXJl', '')
      assert.isFalse(result)
    })

    it('should return false if address is null', () => {
      const result = uut.verifyMessage('hello', 'c2lnbmF0dXJl', null)
      assert.isFalse(result)
    })

    it('should return a boolean', () => {
      // Use a valid base64 string of 65 bytes as signature
      const fakeSig = globalThis.btoa(String.fromCharCode.apply(null, new Uint8Array(65).fill(0x42)))
      const result = uut.verifyMessage('hello', fakeSig, 'ecash:validaddress')
      assert.isBoolean(result)
    })
  })

  describe('#_magicHash', () => {
    it('should return a Uint8Array of 32 bytes', () => {
      const result = MinimalXECWallet._magicHash('test')
      // The mock sha256d returns Uint8Array(32).fill(0xab)
      assert.instanceOf(result, Uint8Array)
      assert.equal(result.length, 32)
    })

    it('should produce deterministic output for same input', () => {
      const hash1 = MinimalXECWallet._magicHash('hello')
      const hash2 = MinimalXECWallet._magicHash('hello')
      assert.deepEqual(hash1, hash2)
    })

    it('should be callable as a static method', () => {
      assert.isFunction(MinimalXECWallet._magicHash)
      const result = MinimalXECWallet._magicHash('test')
      assert.isOk(result)
    })
  })
})
