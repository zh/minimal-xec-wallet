/*
  Shared transaction utilities used across multiple modules.
  Eliminates duplication of UTXO value extraction and fee estimation.
*/

const { Script, fromHex } = require('ecash-lib')
const { decodeCashAddress } = require('ecashaddrjs')
const KeyDerivation = require('./key-derivation')

const keyDerivation = new KeyDerivation()

/**
 * Extract UTXO value in satoshis, handling BigInt/string/number formats.
 * @param {Object} utxo - UTXO object
 * @returns {number} - Value in satoshis
 */
function getUtxoValue (utxo) {
  if (!utxo) return 0

  if (utxo.sats !== undefined) {
    if (typeof utxo.sats === 'bigint') return Number(utxo.sats)
    if (typeof utxo.sats === 'string') {
      const parsed = parseInt(utxo.sats)
      return isNaN(parsed) ? 0 : parsed
    }
    if (typeof utxo.sats === 'number') return utxo.sats
  }

  if (utxo.value !== undefined) {
    if (typeof utxo.value === 'bigint') return Number(utxo.value)
    if (typeof utxo.value === 'string') {
      const parsed = parseInt(utxo.value)
      return isNaN(parsed) ? 0 : parsed
    }
    if (typeof utxo.value === 'number') return utxo.value
  }

  return 0
}

/**
 * Estimate transaction fee based on Schnorr P2PKH inputs (141 bytes/input).
 * @param {number} numInputs - Number of transaction inputs
 * @param {number} numOutputs - Number of transaction outputs
 * @param {number} satsPerByte - Fee rate in satoshis per byte
 * @param {number} extraOverhead - Extra overhead bytes (default 10)
 * @returns {number} - Estimated fee in satoshis
 */
function estimateFee (numInputs, numOutputs, satsPerByte, extraOverhead = 10) {
  const estimatedSize = (numInputs * 141) + (numOutputs * 34) + extraOverhead
  return Math.ceil(estimatedSize * satsPerByte)
}

/**
 * Get private key hex from wallet info (mnemonic or raw).
 * @param {Object} walletInfo - Wallet info object
 * @returns {string} - Private key hex string
 */
function getPrivateKey (walletInfo) {
  if (walletInfo.mnemonic) {
    const keyData = keyDerivation.deriveFromMnemonic(walletInfo.mnemonic, walletInfo.hdPath)
    return keyData.privateKey
  }
  return walletInfo.privateKey
}

/**
 * Get P2PKH output script from an eCash address.
 * @param {string} address - eCash address (ecash:...)
 * @returns {Script} - P2PKH output script
 */
function getOutputScript (address) {
  const decoded = decodeCashAddress(address)
  return Script.p2pkh(fromHex(decoded.hash))
}

module.exports = { getUtxoValue, estimateFee, getPrivateKey, getOutputScript }
