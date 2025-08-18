/*
  Simplified XEC transaction creation for minimal wallet

  Core functionality only:
  - Create transactions with single/multiple outputs
  - Simple fee calculation
  - Basic UTXO selection (largest first)
  - Transaction signing and broadcasting
*/

const { TxBuilder, P2PKHSignatory, fromHex, toHex, Ecc, Script, ALL_BIP143 } = require('ecash-lib')
const { decodeCashAddress } = require('ecashaddrjs')
const KeyDerivation = require('./key-derivation')
const SecurityValidator = require('./security')

class SendXEC {
  constructor (localConfig = {}) {
    this.chronik = localConfig.chronik
    this.ar = localConfig.ar

    if (!this.chronik) {
      throw new Error('Chronik client required for XEC transactions')
    }

    if (!this.ar) {
      throw new Error('AdapterRouter required for XEC transactions')
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

    // Simple configuration - XEC dust limit is 546 satoshis (5.46 XEC)
    this.dustLimit = localConfig.dustLimit || 546
    this.maxRetries = localConfig.maxRetries || 3
    this.defaultSatsPerByte = localConfig.defaultSatsPerByte || 1.2
  }

  /**
   * Create transaction with single or multiple outputs
   * @param {Array|Object} outputs - Output(s) to send to
   * @param {Object} walletInfo - Wallet information
   * @param {Array} utxos - Available UTXOs
   * @returns {string} - Transaction hex
   */
  async createTransaction (outputs, walletInfo, utxos) {
    try {
      // Normalize outputs to array
      const normalizedOutputs = Array.isArray(outputs) ? outputs : [outputs]

      // Validate outputs
      const outputValidation = this.security.validateOutputs(normalizedOutputs)
      if (!outputValidation.isValid) {
        throw new Error(`Invalid outputs: ${outputValidation.errors.join(', ')}`)
      }

      // Select UTXOs
      const selection = this._selectUtxos(normalizedOutputs, utxos)

      // Build transaction
      const txHex = await this._buildTransaction(
        selection.selectedUtxos,
        normalizedOutputs,
        selection.change,
        walletInfo
      )

      return txHex
    } catch (err) {
      throw new Error(`Transaction creation failed: ${err.message}`)
    }
  }

  /**
   * Create send-all transaction
   * @param {string} address - Destination address
   * @param {Object} walletInfo - Wallet information
   * @param {Array} utxos - Available UTXOs
   * @returns {string} - Transaction hex
   */
  async createSendAllTx (address, walletInfo, utxos) {
    try {
      // Validate address
      if (!this.security.isValidAddress(address)) {
        throw new Error(`Invalid destination address: ${address}`)
      }

      // Filter secure UTXOs (allow unconfirmed if needed)
      let secureUtxos = this.security.filterSecureUtxos(utxos, { excludeDustAttack: false })

      // If no confirmed UTXOs available, allow unconfirmed ones
      if (secureUtxos.length === 0) {
        console.warn('No confirmed UTXOs available, including unconfirmed UTXOs')
        secureUtxos = this.security.filterSecureUtxos(utxos, { includeUnconfirmed: true, excludeDustAttack: false })
      }

      if (secureUtxos.length === 0) {
        throw new Error('No spendable UTXOs available')
      }

      // Calculate total available
      const totalSats = secureUtxos.reduce((sum, utxo) => sum + this._getUtxoValue(utxo), 0)

      // Estimate fee
      const estimatedFee = this._calculateFee(secureUtxos.length, 1) // All inputs, 1 output

      const sendAmount = totalSats - estimatedFee
      if (sendAmount <= this.dustLimit) {
        throw new Error('Amount too small after fees')
      }

      // Create output
      const outputs = [{
        address,
        amountSat: sendAmount
      }]

      // Build transaction (no change output needed)
      const txHex = await this._buildTransaction(secureUtxos, outputs, 0, walletInfo)

      return txHex
    } catch (err) {
      throw new Error(`Send-all transaction failed: ${err.message}`)
    }
  }

  /**
   * Legacy method for backward compatibility
   * @param {Array} outputs - Transaction outputs
   * @param {Array} utxos - Available UTXOs
   * @returns {Object} - UTXO selection result
   */
  getNecessaryUtxosAndChange (outputs, utxos) {
    try {
      const selection = this._selectUtxos(outputs, utxos)

      return {
        necessaryUtxos: selection.selectedUtxos,
        totalAmount: selection.totalAmount,
        change: selection.change,
        estimatedFee: selection.estimatedFee
      }
    } catch (err) {
      throw new Error(`UTXO selection failed: ${err.message}`)
    }
  }

  /**
   * Public fee calculation method
   * @param {number} inputCount - Number of inputs
   * @param {number} outputCount - Number of outputs
   * @param {number} feeRate - Fee rate in sats/byte
   * @returns {number} - Fee in satoshis
   */
  calculateFee (inputCount, outputCount, feeRate = null) {
    const rate = feeRate !== null ? feeRate : this.defaultSatsPerByte
    return this._calculateFee(inputCount, outputCount, rate)
  }

  /**
   * Sort UTXOs by size
   * @param {Array} utxos - UTXOs to sort
   * @param {string} order - 'asc' or 'desc'
   * @returns {Array} - Sorted UTXOs
   */
  sortUtxosBySize (utxos, order = 'desc') {
    return [...utxos].sort((a, b) => {
      const aValue = this._getUtxoValue(a)
      const bValue = this._getUtxoValue(b)
      return order === 'desc' ? bValue - aValue : aValue - bValue
    })
  }

  /**
   * Legacy sendAllXec method
   * @param {string} address - Destination address
   * @param {Object} walletInfo - Wallet information
   * @param {Array} utxos - Available UTXOs
   * @returns {string} - Transaction ID
   */
  async sendAllXec (address, walletInfo, utxos) {
    try {
      const txHex = await this.createSendAllTx(address, walletInfo, utxos)

      // Broadcast transaction
      const txid = await this.ar.sendTx(txHex)
      return txid
    } catch (err) {
      throw new Error(`Send all XEC failed: ${err.message}`)
    }
  }

  /**
   * Get key pair from wallet info using ecash-lib
   * @param {Object} walletInfo - Wallet information
   * @returns {Object} - Key pair object with privateKey, publicKey, and address
   */
  async getKeyPairFromMnemonic (walletInfo) {
    try {
      // Use ecash-lib based key derivation
      if (walletInfo.mnemonic) {
        return this.keyDerivation.deriveFromMnemonic(walletInfo.mnemonic, walletInfo.hdPath)
      } else if (walletInfo.privateKey) {
        return this.keyDerivation.deriveFromWif(walletInfo.privateKey)
      } else {
        throw new Error('No private key or mnemonic provided')
      }
    } catch (err) {
      throw new Error(`Key pair creation failed: ${err.message}`)
    }
  }

  /**
   * High-level sendXec method
   * @param {Array|Object} outputs - Outputs to send
   * @param {Object} walletInfo - Wallet information
   * @param {Array} utxos - Available UTXOs
   * @returns {string} - Transaction ID
   */
  async sendXec (outputs, walletInfo, utxos) {
    try {
      const txHex = await this.createTransaction(outputs, walletInfo, utxos)

      // Broadcast transaction
      const txid = await this.ar.sendTx(txHex)
      return txid
    } catch (err) {
      throw new Error(`Send XEC failed: ${err.message}`)
    }
  }

  // Private methods

  /**
   * Simple UTXO selection (largest first)
   * @param {Array} outputs - Transaction outputs
   * @param {Array} utxos - Available UTXOs
   * @returns {Object} - Selection result
   */
  _selectUtxos (outputs, utxos) {
    // Calculate target amount
    const targetAmount = outputs.reduce((sum, output) => sum + (output.amountSat || output.amount), 0)

    // Filter secure UTXOs (allow unconfirmed if needed)
    let secureUtxos = this.security.filterSecureUtxos(utxos, { excludeDustAttack: false })

    // If no confirmed UTXOs available, allow unconfirmed ones
    if (secureUtxos.length === 0) {
      console.warn('No confirmed UTXOs available, including unconfirmed UTXOs')
      secureUtxos = this.security.filterSecureUtxos(utxos, { includeUnconfirmed: true, excludeDustAttack: false })
    }

    if (secureUtxos.length === 0) {
      throw new Error('No spendable UTXOs available')
    }

    // Sort by value descending (largest first)
    const sortedUtxos = secureUtxos.sort((a, b) => {
      return this._getUtxoValue(b) - this._getUtxoValue(a)
    })

    // Greedy selection
    const selectedUtxos = []
    let totalAmount = 0

    for (const utxo of sortedUtxos) {
      const utxoValue = this._getUtxoValue(utxo)
      selectedUtxos.push(utxo)
      totalAmount += utxoValue

      // Estimate fee with current selection
      const estimatedFee = this._calculateFee(selectedUtxos.length, outputs.length)

      if (totalAmount >= targetAmount + estimatedFee) {
        // We have enough
        const finalFee = this._calculateFee(selectedUtxos.length, outputs.length)
        const change = totalAmount - targetAmount - finalFee

        return {
          selectedUtxos,
          totalAmount,
          estimatedFee: finalFee,
          change
        }
      }
    }

    throw new Error('Insufficient funds')
  }

  /**
   * Calculate transaction fee
   * @param {number} inputCount - Number of inputs
   * @param {number} outputCount - Number of outputs
   * @param {number} feeRate - Fee rate in sats/byte
   * @returns {number} - Fee in satoshis
   */
  _calculateFee (inputCount, outputCount, feeRate = null) {
    const rate = feeRate !== null ? feeRate : this.defaultSatsPerByte

    // Handle zero fee rate explicitly
    if (rate === 0) {
      return 0
    }

    const inputSize = 148 // P2PKH input size
    const outputSize = 34 // P2PKH output size
    const overhead = 10 // Version, locktime, etc.

    const txSize = (inputCount * inputSize) + (outputCount * outputSize) + overhead
    return Math.ceil(txSize * rate)
  }

  /**
   * Build and sign transaction using ecash-lib properly
   * @param {Array} selectedUtxos - UTXOs to spend
   * @param {Array} outputs - Transaction outputs
   * @param {number} changeAmount - Change amount
   * @param {Object} walletInfo - Wallet information
   * @returns {string} - Transaction hex
   */
  async _buildTransaction (selectedUtxos, outputs, changeAmount, walletInfo) {
    try {
      // Get private key (prefer mnemonic)
      let privateKeyHex
      if (walletInfo.mnemonic) {
        const keyData = this.keyDerivation.deriveFromMnemonic(walletInfo.mnemonic, walletInfo.hdPath)
        privateKeyHex = keyData.privateKey
      } else {
        privateKeyHex = walletInfo.privateKey
      }

      const sk = fromHex(privateKeyHex)
      const pk = this.ecc.derivePubkey(sk)

      // Build outputs
      const txOutputs = []

      // Add main outputs
      for (const output of outputs) {
        const decoded = decodeCashAddress(output.address)
        txOutputs.push({
          sats: BigInt(output.amountSat || output.amount),
          script: Script.p2pkh(fromHex(decoded.hash))
        })
      }

      // Add change address for automatic calculation
      const walletDecoded = decodeCashAddress(walletInfo.xecAddress)
      txOutputs.push(Script.p2pkh(fromHex(walletDecoded.hash)))

      const inputs = selectedUtxos.map(utxo => ({
        input: {
          prevOut: {
            txid: utxo.outpoint.txid,
            outIdx: utxo.outpoint.outIdx
          },
          signData: {
            sats: BigInt(this._getUtxoValue(utxo)),
            outputScript: Script.p2pkh(fromHex(walletDecoded.hash))
          }
        },
        signatory: P2PKHSignatory(sk, pk, ALL_BIP143)
      }))

      const txBuilder = new TxBuilder({ inputs, outputs: txOutputs })
      const tx = txBuilder.sign({
        feePerKb: BigInt(1200),
        dustSats: BigInt(546)
      })

      return toHex(tx.ser())
    } catch (err) {
      throw new Error(`Transaction failed: ${err.message}`)
    }
  }

  _getUtxoValue (utxo) {
    if (utxo.sats !== undefined) {
      return typeof utxo.sats === 'bigint' ? Number(utxo.sats) : parseInt(utxo.sats)
    }
    if (utxo.value !== undefined) {
      return typeof utxo.value === 'bigint' ? Number(utxo.value) : parseInt(utxo.value)
    }
    return 0
  }
}

module.exports = SendXEC
