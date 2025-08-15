/*
  This library contains functions specific to sending XEC using ecash-lib.
*/

const { TxBuilder, P2PKHSignatory, fromHex, toHex, Ecc, Script, ALL_BIP143, shaRmd160 } = require('ecash-lib')
const { decodeCashAddress, encodeCashAddress } = require('ecashaddrjs')
const KeyDerivation = require('./key-derivation')
const HybridSelector = require('./coin-selection/HybridSelector')

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

    // Initialize key derivation
    this.keyDerivation = new KeyDerivation()

    // Initialize ECC for ecash-lib (expensive operation, do once)
    try {
      this.ecc = new Ecc()
    } catch (err) {
      console.error('Failed to initialize Ecc:', err.message)
      throw new Error(`Ecc initialization failed: ${err.message}`)
    }

    // Transaction configuration
    this.dustLimit = localConfig.dustLimit || 546 // XEC dust limit
    this.maxRetries = localConfig.maxRetries || 3
    this.defaultSatsPerByte = localConfig.defaultSatsPerByte || 1.2

    // Advanced coin selection configuration
    this.enableAdvancedSelection = localConfig.enableAdvancedSelection !== false // Default enabled
    this.coinSelectionConfig = localConfig.coinSelectionConfig || {}

    // Initialize advanced coin selector
    if (this.enableAdvancedSelection) {
      try {
        this.hybridSelector = new HybridSelector({
          dustLimit: this.dustLimit,
          defaultFeeRate: this.defaultSatsPerByte,
          ...this.coinSelectionConfig
        })
      } catch (err) {
        console.warn('Failed to initialize advanced coin selection:', err.message)
        this.enableAdvancedSelection = false
      }
    }
  }

  // Helper method to extract value from UTXO (consistent with Bitcoin-ABC standards)
  _getUtxoValue (utxo) {
    return this._extractSatsFromUtxo(utxo)
  }

  // Consistent sats extraction following Bitcoin-ABC standards
  _extractSatsFromUtxo (utxo) {
    // Bitcoin-ABC now uses 'sats' as BigInt consistently
    if (typeof utxo.sats === 'bigint') {
      return utxo.sats
    }

    // Handle string representation of BigInt
    if (typeof utxo.sats === 'string' && utxo.sats !== '') {
      try {
        return BigInt(utxo.sats)
      } catch (err) {
        console.warn('Invalid sats string format:', utxo.sats)
      }
    }

    // Fallback to legacy 'value' property for backward compatibility
    if (typeof utxo.value === 'bigint') {
      return utxo.value
    }

    if (typeof utxo.value === 'string' && utxo.value !== '') {
      try {
        return BigInt(utxo.value)
      } catch (err) {
        console.warn('Invalid value string format:', utxo.value)
      }
    }

    // Handle numeric types (legacy support)
    if (typeof utxo.sats === 'number' && utxo.sats > 0) {
      return BigInt(Math.floor(utxo.sats))
    }

    if (typeof utxo.value === 'number' && utxo.value > 0) {
      return BigInt(Math.floor(utxo.value))
    }

    // Default to 0 if no valid value found
    console.warn('No valid sats/value found in UTXO:', utxo)
    return 0n
  }

  // Convert BigInt to Number safely for compatibility with legacy code
  _bigIntToNumber (bigIntValue) {
    if (typeof bigIntValue === 'bigint') {
      if (bigIntValue <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(bigIntValue)
      } else {
        console.warn('BigInt value exceeds safe Number range:', bigIntValue.toString())
        return Number(bigIntValue)
      }
    }
    return bigIntValue
  }

  async sendXec (outputs, walletInfo, utxos) {
    try {
      // Validate inputs
      if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
        throw new Error('Invalid outputs provided')
      }

      if (!walletInfo || !walletInfo.xecAddress) {
        throw new Error('Invalid wallet info provided')
      }

      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs available for spending')
      }

      // Create transaction
      const txHex = await this.createTransaction(outputs, walletInfo, utxos)

      // Broadcast transaction
      const txid = await this.ar.sendTx(txHex)

      return txid
    } catch (err) {
      throw new Error(`XEC send failed: ${err.message}`)
    }
  }

  async createTransaction (outputs, walletInfo, utxos, satsPerByte = this.defaultSatsPerByte) {
    try {
      // Validate inputs first
      this._validateOutputs(outputs)
      this._validateUtxos(utxos)

      // Calculate total output amount using BigInt for precision
      let totalOutputAmount = 0n
      for (const output of outputs) {
        totalOutputAmount += BigInt(output.amountSat)
      }

      // Enhanced UTXO selection with proper fee calculation
      const coinSelection = this._selectOptimalUtxos(
        outputs,
        utxos,
        satsPerByte
      )

      if (coinSelection.totalInputAmount < totalOutputAmount + coinSelection.estimatedFee) {
        throw new Error(
          `Insufficient funds. Need: ${totalOutputAmount + coinSelection.estimatedFee}, ` +
          `Available: ${coinSelection.totalInputAmount}`
        )
      }

      // Prepare cryptographic components (reuse ECC instance)
      const walletSk = fromHex(walletInfo.privateKey)
      const walletPk = this.ecc.derivePubkey(walletSk)
      const walletPkh = shaRmd160(walletPk)
      const walletP2pkh = Script.p2pkh(walletPkh)

      // Prepare inputs with consistent BigInt handling
      const inputs = []
      for (const utxo of coinSelection.selectedUtxos) {
        const outpoint = {
          txid: utxo.outpoint.txid,
          outIdx: utxo.outpoint.outIdx
        }

        inputs.push({
          input: {
            prevOut: outpoint,
            signData: {
              sats: this._extractSatsFromUtxo(utxo), // Use BigInt directly
              outputScript: walletP2pkh
            }
          },
          signatory: P2PKHSignatory(walletSk, walletPk, ALL_BIP143)
        })
      }

      // Prepare outputs with consistent BigInt handling
      const txOutputs = []

      // Add main outputs
      for (const output of outputs) {
        const { hash } = decodeCashAddress(output.address)

        txOutputs.push({
          sats: BigInt(output.amountSat),
          script: Script.p2pkh(Buffer.from(hash, 'hex'))
        })
      }

      // Add change output if needed
      if (coinSelection.change > BigInt(this.dustLimit)) {
        txOutputs.push({
          sats: coinSelection.change,
          script: walletP2pkh
        })
      }

      // Create and sign transaction using ecash-lib v4.3.1+ API
      const txBuilder = new TxBuilder({
        inputs,
        outputs: txOutputs
      })

      // Sign with proper BigInt parameters
      const tx = txBuilder.sign({
        feePerKb: BigInt(Math.round(satsPerByte * 1000)),
        dustSats: BigInt(this.dustLimit)
      })

      return toHex(tx.ser())
    } catch (err) {
      throw new Error(`Transaction creation failed: ${err.message}`)
    }
  }

  // Enhanced UTXO selection with advanced algorithms and BigInt precision
  _selectOptimalUtxos (outputs, availableUtxos, satsPerByte = this.defaultSatsPerByte, options = {}) {
    try {
      // Calculate total output amount with BigInt precision
      let totalOutputAmount = 0n
      for (const output of outputs) {
        totalOutputAmount += BigInt(output.amountSat)
      }

      // Try advanced coin selection if enabled
      if (this.enableAdvancedSelection && this.hybridSelector && options.useAdvancedSelection !== false) {
        try {
          const selectionOptions = {
            // Basic options
            includeUnconfirmed: options.includeUnconfirmed || false,
            maxTime: options.maxSelectionTime || 200,

            // Analytics integration
            utxoAnalytics: options.utxoAnalytics,

            // Selection preferences
            prioritizePrivacy: options.prioritizePrivacy || false,
            prioritizeHealth: options.prioritizeHealth !== false, // Default true
            avoidSuspicious: options.avoidSuspicious !== false, // Default true
            allowConsolidation: options.allowConsolidation || false,

            // Filter options
            minHealthScore: options.minHealthScore || 0,
            minPrivacyScore: options.minPrivacyScore || 0,
            excludeSuspicious: options.excludeSuspicious || false
          }

          const advancedResult = this.hybridSelector.selectCoins(
            availableUtxos,
            totalOutputAmount,
            satsPerByte,
            selectionOptions
          )

          if (advancedResult && advancedResult.selectedUtxos.length > 0) {
            // Convert advanced result to legacy format for compatibility
            return {
              selectedUtxos: advancedResult.selectedUtxos,
              totalInputAmount: advancedResult.totalAmount,
              estimatedFee: advancedResult.estimatedFee,
              change: advancedResult.change,
              // Additional metadata from advanced selection
              metadata: {
                algorithm: advancedResult.algorithm,
                efficiency: advancedResult.efficiency,
                privacyScore: advancedResult.privacyScore,
                healthScore: advancedResult.healthScore,
                ...advancedResult.metadata
              }
            }
          }
        } catch (advancedErr) {
          console.warn('Advanced coin selection failed, falling back to legacy:', advancedErr.message)
          // Continue to legacy selection below
        }
      }

      // Legacy coin selection (fallback or when advanced selection is disabled)
      return this._legacySelectOptimalUtxos(outputs, availableUtxos, satsPerByte, totalOutputAmount)
    } catch (err) {
      throw new Error(`UTXO selection failed: ${err.message}`)
    }
  }

  // Legacy UTXO selection method (preserved for compatibility and fallback)
  _legacySelectOptimalUtxos (outputs, availableUtxos, satsPerByte, totalOutputAmount) {
    // Sort UTXOs by size (largest first for efficient coin selection)
    const sortedUtxos = this._sortUtxosBySize(availableUtxos, 'DESCENDING')

    const selectedUtxos = []
    let totalInputAmount = 0n
    let estimatedFee = 0n

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo)
      totalInputAmount += this._extractSatsFromUtxo(utxo)

      // Calculate fee for current number of inputs/outputs
      const potentialChange = totalInputAmount - totalOutputAmount
      const numOutputs = outputs.length + (potentialChange > BigInt(this.dustLimit) ? 1 : 0)
      estimatedFee = BigInt(this._calculateFee(selectedUtxos.length, numOutputs, satsPerByte))

      const totalNeeded = totalOutputAmount + estimatedFee

      if (totalInputAmount >= totalNeeded) {
        const change = totalInputAmount - totalNeeded

        return {
          selectedUtxos,
          totalInputAmount,
          estimatedFee,
          change: change > BigInt(this.dustLimit) ? change : 0n,
          metadata: {
            algorithm: 'legacy_largest_first',
            fallback: true
          }
        }
      }
    }

    throw new Error(
      `Insufficient funds. Need: ${totalOutputAmount + estimatedFee}, ` +
      `Available: ${totalInputAmount}`
    )
  }

  // Legacy method for backward compatibility
  getNecessaryUtxosAndChange (outputs, availableUtxos, satsPerByte = this.defaultSatsPerByte, opts = {}) {
    const result = this._selectOptimalUtxos(outputs, availableUtxos, satsPerByte)

    // Convert BigInt results to Numbers for legacy compatibility
    return {
      necessaryUtxos: result.selectedUtxos,
      totalAmount: this._bigIntToNumber(result.totalInputAmount),
      estimatedFee: this._bigIntToNumber(result.estimatedFee),
      change: this._bigIntToNumber(result.change)
    }
  }

  _sortUtxosBySize (utxos, sortingOrder = 'ASCENDING') {
    const sorted = [...utxos]

    if (sortingOrder === 'ASCENDING') {
      return sorted.sort((a, b) => {
        const aValue = this._extractSatsFromUtxo(a)
        const bValue = this._extractSatsFromUtxo(b)
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      })
    } else {
      return sorted.sort((a, b) => {
        const aValue = this._extractSatsFromUtxo(a)
        const bValue = this._extractSatsFromUtxo(b)
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      })
    }
  }

  // Legacy method for backward compatibility
  sortUtxosBySize (utxos, sortingOrder = 'ASCENDING') {
    return this._sortUtxosBySize(utxos, sortingOrder)
  }

  _calculateFee (numInputs, numOutputs, satsPerByte) {
    // More accurate transaction size estimation for P2PKH transactions
    // Input: 148 bytes each (32 txid + 4 outIdx + 1 scriptSigLen + 107 scriptSig + 4 sequence)
    // Output: 34 bytes each (8 value + 1 scriptPubKeyLen + 25 scriptPubKey)
    // Transaction overhead: 4 version + 1-9 inputCount + 1-9 outputCount + 4 lockTime ≈ 10 bytes
    const estimatedSize = (numInputs * 148) + (numOutputs * 34) + 10
    return Math.ceil(estimatedSize * satsPerByte)
  }

  // Legacy method for backward compatibility
  calculateFee (numInputs, numOutputs, satsPerByte) {
    return this._calculateFee(numInputs, numOutputs, satsPerByte)
  }

  getKeyPairFromMnemonic (walletInfo) {
    try {
      if (walletInfo.mnemonic) {
        return this.keyDerivation.deriveFromMnemonic(walletInfo.mnemonic, walletInfo.hdPath)
      } else if (walletInfo.privateKey) {
        // Use WIF private key
        return this.keyDerivation.deriveFromWif(walletInfo.privateKey)
      } else {
        throw new Error('Neither mnemonic nor private key provided')
      }
    } catch (err) {
      throw new Error(`Key pair derivation failed: ${err.message}`)
    }
  }

  async sendAllXec (toAddress, walletInfo, utxos) {
    try {
      // Validate inputs
      if (!toAddress || typeof toAddress !== 'string') {
        throw new Error('Invalid recipient address')
      }

      if (!walletInfo || !walletInfo.xecAddress) {
        throw new Error('Invalid wallet info provided')
      }

      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs available for spending')
      }

      // Create send-all transaction
      const txHex = await this.createSendAllTx(toAddress, walletInfo, utxos)

      // Broadcast transaction
      const txid = await this.ar.sendTx(txHex)

      return txid
    } catch (err) {
      throw new Error(`Send all XEC failed: ${err.message}`)
    }
  }

  async createSendAllTx (toAddress, walletInfo, utxos, satsPerByte = this.defaultSatsPerByte) {
    try {
      // Validate inputs
      if (!toAddress || typeof toAddress !== 'string') {
        throw new Error('Invalid recipient address')
      }
      this._validateUtxos(utxos)

      // Calculate total available amount with BigInt precision
      let totalAmount = 0n
      for (const utxo of utxos) {
        totalAmount += this._extractSatsFromUtxo(utxo)
      }

      // Calculate fee for using all UTXOs
      const estimatedFee = BigInt(this._calculateFee(utxos.length, 1, satsPerByte))
      const sendAmount = totalAmount - estimatedFee

      if (sendAmount <= BigInt(this.dustLimit)) {
        throw new Error(
          `Amount after fee (${sendAmount}) is below dust limit (${this.dustLimit})`
        )
      }

      // Prepare cryptographic components (reuse ECC instance)
      const privateKeyBytes = fromHex(walletInfo.privateKey)
      const publicKeyBytes = this.ecc.derivePubkey(privateKeyBytes)
      const pkh = shaRmd160(publicKeyBytes)
      const outputScript = Script.p2pkh(pkh)

      // Prepare inputs for TxBuilder constructor
      const inputs = []
      for (const utxo of utxos) {
        const outpoint = {
          txid: utxo.outpoint.txid,
          outIdx: utxo.outpoint.outIdx
        }

        inputs.push({
          input: {
            prevOut: outpoint,
            signData: {
              sats: this._extractSatsFromUtxo(utxo), // Use BigInt directly
              outputScript: outputScript
            }
          },
          signatory: P2PKHSignatory(privateKeyBytes, publicKeyBytes, ALL_BIP143)
        })
      }

      // Prepare single output for all available funds
      const { hash } = decodeCashAddress(toAddress)
      const recipientPkh = Buffer.from(hash, 'hex')
      const txOutputs = [{
        sats: sendAmount, // Use BigInt directly
        script: Script.p2pkh(recipientPkh)
      }]

      // Create and sign transaction using ecash-lib v4.3.1+ API
      const txBuilder = new TxBuilder({
        inputs,
        outputs: txOutputs
      })

      // Sign with proper BigInt parameters
      const feePerKb = BigInt(Math.round(satsPerByte * 1000))
      const tx = txBuilder.sign({
        feePerKb: feePerKb,
        dustSats: BigInt(this.dustLimit)
      })

      return toHex(tx.ser())
    } catch (err) {
      throw new Error(`Send all transaction creation failed: ${err.message}`)
    }
  }

  // Helper methods

  _createP2PKHScript (hash160) {
    // Create Pay-to-Public-Key-Hash script
    // OP_DUP OP_HASH160 <hash160> OP_EQUALVERIFY OP_CHECKSIG
    const script = Buffer.alloc(25)
    script[0] = 0x76 // OP_DUP
    script[1] = 0xa9 // OP_HASH160
    script[2] = 0x14 // Push 20 bytes

    // Convert hash160 to Buffer if it's not already
    const hashBuffer = Buffer.isBuffer(hash160) ? hash160 : Buffer.from(hash160, 'hex')
    hashBuffer.copy(script, 3)

    script[23] = 0x88 // OP_EQUALVERIFY
    script[24] = 0xac // OP_CHECKSIG
    return script
  }

  _validateOutputs (outputs) {
    if (!outputs || !Array.isArray(outputs)) {
      throw new Error('Outputs must be an array')
    }

    for (const output of outputs) {
      if (!output.address || typeof output.address !== 'string') {
        throw new Error('Each output must have a valid address')
      }

      if (!output.address.startsWith('ecash:')) {
        throw new Error('Address must be in XEC format (ecash:)')
      }

      if (typeof output.amountSat !== 'number' || output.amountSat <= 0) {
        throw new Error('Each output must have a positive amountSat')
      }

      if (output.amountSat < this.dustLimit) {
        throw new Error(`Output amount (${output.amountSat}) is below dust limit (${this.dustLimit})`)
      }
    }
  }

  _validateUtxos (utxos) {
    if (!utxos || !Array.isArray(utxos) || utxos.length === 0) {
      throw new Error('Valid UTXOs are required')
    }

    for (const utxo of utxos) {
      if (!utxo.outpoint || !utxo.outpoint.txid || typeof utxo.outpoint.outIdx !== 'number') {
        throw new Error('Invalid UTXO format: outpoint with txid and outIdx required')
      }

      const satsValue = this._extractSatsFromUtxo(utxo)
      if (typeof satsValue !== 'bigint' || satsValue <= 0n) {
        throw new Error('Invalid UTXO format: positive sats value required')
      }
    }
  }

  // Advanced Coin Selection Public Interface

  /**
   * Enable or disable advanced coin selection
   * @param {boolean} enable - Whether to enable advanced selection
   */
  enableAdvancedCoinSelection (enable = true) {
    this.enableAdvancedSelection = enable

    if (enable && !this.hybridSelector) {
      try {
        this.hybridSelector = new HybridSelector({
          dustLimit: this.dustLimit,
          defaultFeeRate: this.defaultSatsPerByte,
          ...this.coinSelectionConfig
        })
      } catch (err) {
        console.warn('Failed to initialize advanced coin selection:', err.message)
        this.enableAdvancedSelection = false
      }
    }
  }

  /**
   * Update coin selection configuration
   * @param {Object} config - New configuration
   */
  updateCoinSelectionConfig (config) {
    this.coinSelectionConfig = { ...this.coinSelectionConfig, ...config }

    if (this.enableAdvancedSelection && this.hybridSelector) {
      // Reinitialize with new config
      try {
        this.hybridSelector = new HybridSelector({
          dustLimit: this.dustLimit,
          defaultFeeRate: this.defaultSatsPerByte,
          ...this.coinSelectionConfig
        })
      } catch (err) {
        console.warn('Failed to update coin selection config:', err.message)
      }
    }
  }

  /**
   * Get coin selection performance statistics
   * @returns {Object} - Performance statistics
   */
  getCoinSelectionStats () {
    if (!this.enableAdvancedSelection || !this.hybridSelector) {
      return {
        enabled: false,
        message: 'Advanced coin selection is not enabled'
      }
    }

    return {
      enabled: true,
      stats: this.hybridSelector.getStats()
    }
  }

  /**
   * Reset coin selection performance statistics
   */
  resetCoinSelectionStats () {
    if (this.enableAdvancedSelection && this.hybridSelector) {
      this.hybridSelector.resetStats()
    }
  }

  /**
   * Test coin selection with different algorithms
   * @param {Array} outputs - Transaction outputs
   * @param {Array} utxos - Available UTXOs
   * @param {number} feeRate - Fee rate
   * @param {Object} options - Selection options
   * @returns {Object} - Comparison of different algorithms
   */
  async testCoinSelectionAlgorithms (outputs, utxos, feeRate = this.defaultSatsPerByte, options = {}) {
    if (!this.enableAdvancedSelection || !this.hybridSelector) {
      throw new Error('Advanced coin selection not available')
    }

    const results = {}

    try {
      // Test legacy selection
      const legacyStart = Date.now()
      const legacyResult = this._legacySelectOptimalUtxos(
        outputs,
        utxos,
        feeRate,
        outputs.reduce((sum, out) => sum + BigInt(out.amountSat), 0n)
      )
      results.legacy = {
        ...legacyResult,
        duration: Date.now() - legacyStart
      }
    } catch (err) {
      results.legacy = { error: err.message }
    }

    try {
      // Test advanced selection
      const advancedStart = Date.now()
      const advancedResult = this.hybridSelector.selectCoins(
        utxos,
        outputs.reduce((sum, out) => sum + BigInt(out.amountSat), 0n),
        feeRate,
        options
      )
      results.advanced = {
        ...advancedResult,
        duration: Date.now() - advancedStart
      }
    } catch (err) {
      results.advanced = { error: err.message }
    }

    return results
  }

  /**
   * Check if advanced coin selection is suitable for the given scenario
   * @param {Array} outputs - Transaction outputs
   * @param {Array} utxos - Available UTXOs
   * @returns {boolean} - True if advanced selection is recommended
   */
  isAdvancedSelectionSuitable (outputs, utxos) {
    if (!this.enableAdvancedSelection || !this.hybridSelector) {
      return false
    }

    const targetAmount = outputs.reduce((sum, out) => sum + BigInt(out.amountSat), 0n)
    return this.hybridSelector.isSuitable(targetAmount, utxos)
  }
}

module.exports = SendXEC
