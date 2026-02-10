/*
  Unit tests for lib/tx-utils.js - shared transaction utilities.

  Tests the standalone functions that replace duplicated methods across
  send-xec, op-return, consolidate-utxos, utxos, slp-token-handler,
  and alp-token-handler modules.
*/

const assert = require('chai').assert

// Unit under test
const {
  getUtxoValue,
  estimateFee,
  getPrivateKey,
  getOutputScript
} = require('../../lib/tx-utils')

describe('#tx-utils.js - Shared Transaction Utilities', () => {
  describe('#getUtxoValue', () => {
    it('should extract number sats', () => {
      const utxo = { sats: 5000 }
      assert.equal(getUtxoValue(utxo), 5000)
    })

    it('should extract string sats', () => {
      const utxo = { sats: '12345' }
      assert.equal(getUtxoValue(utxo), 12345)
    })

    it('should extract BigInt sats', () => {
      const utxo = { sats: BigInt(99000) }
      assert.equal(getUtxoValue(utxo), 99000)
    })

    it('should extract number value', () => {
      const utxo = { value: 7777 }
      assert.equal(getUtxoValue(utxo), 7777)
    })

    it('should extract string value', () => {
      const utxo = { value: '67890' }
      assert.equal(getUtxoValue(utxo), 67890)
    })

    it('should extract BigInt value', () => {
      const utxo = { value: BigInt(42000) }
      assert.equal(getUtxoValue(utxo), 42000)
    })

    it('should prioritize sats over value', () => {
      const utxo = { sats: '100', value: '999' }
      assert.equal(getUtxoValue(utxo), 100)
    })

    it('should return 0 for empty object', () => {
      assert.equal(getUtxoValue({}), 0)
    })

    it('should return 0 for null', () => {
      assert.equal(getUtxoValue(null), 0)
    })

    it('should return 0 for undefined', () => {
      assert.equal(getUtxoValue(undefined), 0)
    })

    it('should return 0 for non-numeric string sats', () => {
      const utxo = { sats: 'abc' }
      assert.equal(getUtxoValue(utxo), 0)
    })

    it('should return 0 for non-numeric string value', () => {
      const utxo = { value: 'xyz' }
      assert.equal(getUtxoValue(utxo), 0)
    })
  })

  describe('#estimateFee', () => {
    it('should calculate fee for 1 input, 1 output at 1.0 sats/byte', () => {
      // (1 * 141) + (1 * 34) + 10 = 185
      assert.equal(estimateFee(1, 1, 1.0), 185)
    })

    it('should calculate fee for 1 input, 2 outputs at 1.0 sats/byte', () => {
      // (1 * 141) + (2 * 34) + 10 = 219
      assert.equal(estimateFee(1, 2, 1.0), 219)
    })

    it('should calculate fee for 2 inputs, 2 outputs at 1.0 sats/byte', () => {
      // (2 * 141) + (2 * 34) + 10 = 360
      assert.equal(estimateFee(2, 2, 1.0), 360)
    })

    it('should round up fractional fees', () => {
      // (1 * 141) + (1 * 34) + 10 = 185 * 1.2 = 222
      assert.equal(estimateFee(1, 1, 1.2), 222)
    })

    it('should return 0 for zero fee rate', () => {
      assert.equal(estimateFee(5, 5, 0), 0)
    })

    it('should accept custom extra overhead', () => {
      // (1 * 141) + (1 * 34) + 20 = 195
      assert.equal(estimateFee(1, 1, 1.0, 20), 195)
    })

    it('should scale with input count', () => {
      const feeSmall = estimateFee(1, 2, 1.0)
      const feeLarge = estimateFee(10, 2, 1.0)
      assert.isAbove(feeLarge, feeSmall)
    })

    it('should scale with output count', () => {
      const feeSmall = estimateFee(1, 1, 1.0)
      const feeLarge = estimateFee(1, 5, 1.0)
      assert.isAbove(feeLarge, feeSmall)
    })
  })

  describe('#getPrivateKey', () => {
    it('should derive private key from mnemonic', () => {
      const walletInfo = {
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        hdPath: "m/44'/899'/0'/0/0"
      }

      const privKey = getPrivateKey(walletInfo)

      assert.isString(privKey)
      assert.isAbove(privKey.length, 0)
    })

    it('should return raw private key when no mnemonic', () => {
      const walletInfo = {
        privateKey: 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678'
      }

      const privKey = getPrivateKey(walletInfo)

      assert.equal(privKey, 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678')
    })
  })

  describe('#getOutputScript', () => {
    it('should create P2PKH output script from address', () => {
      // Use a well-known test address derived from the standard mnemonic
      const KeyDerivation = require('../../lib/key-derivation')
      const kd = new KeyDerivation()
      const keyData = kd.deriveFromMnemonic(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        "m/44'/899'/0'/0/0"
      )

      const script = getOutputScript(keyData.address)

      // In test env ecash-lib is mocked, so Script.p2pkh returns a Buffer.
      // In production it returns an ecash-lib Script object with .bytecode.
      assert.isOk(script, 'script should be truthy')
      assert.isAbove(script.length || 0, 0, 'script should have non-zero length')
    })
  })
})
