/*
  Base Token Handler - Shared logic for SLP and ALP token handlers
  Contains common UTXO selection, fee calculation, and broadcast methods
*/

const {
  Ecc
} = require('ecash-lib')
const KeyDerivation = require('./key-derivation')
const SecurityValidator = require('./security')
const { getUtxoValue } = require('./tx-utils')

class BaseTokenHandler {
  constructor (localConfig = {}) {
    // Subclasses must set this.protocolName before calling super()
    // or set it after. We check it here if already set.
    const protocol = this.protocolName || 'Token'

    this.chronik = localConfig.chronik
    this.ar = localConfig.ar

    if (!this.chronik) {
      throw new Error(`Chronik client required for ${protocol} token operations`)
    }

    if (!this.ar) {
      throw new Error(`AdapterRouter required for ${protocol} token operations`)
    }

    // Initialize components
    this.keyDerivation = new KeyDerivation()
    this.security = new SecurityValidator(localConfig.security)

    // Initialize ECC for ecash-lib
    try {
      this.ecc = new Ecc()
    } catch (err) {
      throw new Error(`Ecc initialization failed: ${err.message}`)
    }

    // Configuration
    this.dustLimit = localConfig.dustLimit || 546
    this.defaultSatsPerByte = localConfig.defaultSatsPerByte || 1.2
  }

  async sendTokens (tokenId, outputs, walletInfo, utxos, satsPerByte = this.defaultSatsPerByte, options = {}) {
    try {
      const txHex = await this.createSendTransaction(tokenId, outputs, walletInfo, utxos, satsPerByte)

      // Broadcast transaction (with optional Avalanche finality)
      let txid
      if (options.awaitFinality) {
        const timeout = options.finalityTimeout || 30000
        txid = await this.ar.sendTxAndFinalize(txHex, timeout)
      } else {
        txid = await this.ar.sendTx(txHex)
      }

      return txid
    } catch (err) {
      throw new Error(`${this.protocolName} token send failed: ${err.message}`)
    }
  }

  async burnTokens (tokenId, amount, walletInfo, utxos, satsPerByte = this.defaultSatsPerByte, options = {}) {
    try {
      const txHex = await this.createBurnTransaction(tokenId, amount, walletInfo, utxos, satsPerByte)

      // Broadcast transaction (with optional Avalanche finality)
      if (options.awaitFinality) {
        const timeout = options.finalityTimeout || 30000
        const txid = await this.ar.sendTxAndFinalize(txHex, timeout)
        return txid
      }

      const txid = await this.ar.sendTx(txHex)
      return txid
    } catch (err) {
      throw new Error(`${this.protocolName} token burn failed: ${err.message}`)
    }
  }

  _categorizeUtxos (utxos, tokenId) {
    const tokenUtxos = utxos.filter(utxo =>
      utxo && utxo.token &&
      utxo.token.tokenId === tokenId &&
      utxo.token.tokenType?.protocol === this.protocolName
    )

    // Pure XEC UTXOs (no token data)
    const pureXecUtxos = utxos.filter(utxo => utxo && !utxo.token)

    // Other token UTXOs (different tokens) - their XEC can be used for fees
    const otherTokenUtxos = utxos.filter(utxo =>
      utxo && utxo.token &&
      utxo.token.tokenId !== tokenId
    )

    // Only use pure XEC UTXOs for fees to avoid token burns
    const xecUtxos = pureXecUtxos

    return { tokenUtxos, xecUtxos, pureXecUtxos, otherTokenUtxos }
  }

  _selectTokenUtxos (tokenUtxos, requiredAtoms, tokenInfo) {
    // Sort by atoms amount (largest first)
    const sortedUtxos = tokenUtxos
      .slice()
      .sort((a, b) => {
        const aAtoms = BigInt(a.token.atoms)
        const bAtoms = BigInt(b.token.atoms)
        return aAtoms > bAtoms ? -1 : aAtoms < bAtoms ? 1 : 0
      })

    const selectedUtxos = []
    let totalSelected = 0n

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo)
      totalSelected += BigInt(utxo.token.atoms)

      if (totalSelected >= requiredAtoms) {
        return { selectedUtxos, totalSelected }
      }
    }

    throw new Error(
      `Insufficient ${tokenInfo.genesisInfo.tokenTicker} tokens. ` +
      `Need: ${this._atomsToDisplay(requiredAtoms, tokenInfo.genesisInfo.decimals)}, ` +
      `Available: ${this._atomsToDisplay(totalSelected, tokenInfo.genesisInfo.decimals)}`
    )
  }

  _selectXecUtxos (xecUtxos, requiredSats, tokenUtxosBeingSpent = []) {
    // Calculate total XEC available from token UTXOs being spent
    const xecFromTokenUtxos = tokenUtxosBeingSpent.reduce((total, utxo) => {
      return total + getUtxoValue(utxo)
    }, 0)

    // If token UTXOs provide enough XEC for fees, no additional XEC input needed
    if (xecFromTokenUtxos >= requiredSats) {
      return { selectedUtxos: [], xecFromTokens: xecFromTokenUtxos }
    }

    // Otherwise, need additional XEC UTXOs
    const additionalXecNeeded = requiredSats - xecFromTokenUtxos

    // Sort available XEC UTXOs by value (largest first)
    const sortedUtxos = xecUtxos
      .slice()
      .sort((a, b) => getUtxoValue(b) - getUtxoValue(a))

    if (sortedUtxos.length === 0) {
      const xecFromTokensDisplay = (xecFromTokenUtxos / 100).toFixed(2)
      const additionalXecDisplay = (additionalXecNeeded / 100).toFixed(2)
      const totalNeededDisplay = (requiredSats / 100).toFixed(2)

      throw new Error(
        'Insufficient XEC for transaction fees. ' +
        `Need ${totalNeededDisplay} XEC total for fees, ` +
        `but only have ${xecFromTokensDisplay} XEC available from token UTXOs. ` +
        `Missing ${additionalXecDisplay} XEC in pure (non-token) UTXOs. ` +
        'Send some pure XEC to this address or consolidate existing UTXOs.'
      )
    }

    // Select multiple UTXOs if needed to meet the requirement
    const selectedUtxos = []
    let selectedXec = 0

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo)
      selectedXec += getUtxoValue(utxo)

      if (selectedXec >= additionalXecNeeded) {
        break
      }
    }

    if (selectedXec < additionalXecNeeded) {
      const totalAvailable = xecFromTokenUtxos + selectedXec
      const totalAvailableDisplay = (totalAvailable / 100).toFixed(2)
      const totalNeededDisplay = (requiredSats / 100).toFixed(2)
      const shortfallDisplay = ((requiredSats - totalAvailable) / 100).toFixed(2)

      throw new Error(
        'Insufficient XEC for transaction fees. ' +
        `Need ${totalNeededDisplay} XEC total, ` +
        `but only have ${totalAvailableDisplay} XEC available. ` +
        `Short ${shortfallDisplay} XEC. ` +
        'Send more XEC to this address.'
      )
    }

    return { selectedUtxos, xecFromTokens: xecFromTokenUtxos }
  }

  _displayToAtoms (displayAmount, decimals) {
    if (decimals === 0) {
      return BigInt(Math.floor(displayAmount))
    }

    const atoms = Math.floor(displayAmount * Math.pow(10, decimals))
    return BigInt(atoms)
  }

  _atomsToDisplay (atoms, decimals) {
    if (decimals === 0) {
      return Number(atoms)
    }

    return Number(atoms) / Math.pow(10, decimals)
  }
}

module.exports = BaseTokenHandler
