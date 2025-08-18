/*
  SLP Token Handler - Uses native ecash-lib SLP functions
  Handles Simple Ledger Protocol token operations
*/

const {
  TxBuilder,
  P2PKHSignatory,
  Script,
  fromHex,
  toHex,
  Ecc,
  slpSend,
  slpBurn,
  SLP_FUNGIBLE,
  ALL_BIP143
} = require('ecash-lib')
const { decodeCashAddress } = require('ecashaddrjs')
const KeyDerivation = require('./key-derivation')
const SecurityValidator = require('./security')

class SLPTokenHandler {
  constructor (localConfig = {}) {
    this.chronik = localConfig.chronik
    this.ar = localConfig.ar

    if (!this.chronik) {
      throw new Error('Chronik client required for SLP token operations')
    }

    if (!this.ar) {
      throw new Error('AdapterRouter required for SLP token operations')
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

  async sendTokens (tokenId, outputs, walletInfo, utxos, satsPerByte = this.defaultSatsPerByte) {
    try {
      const txHex = await this.createSendTransaction(tokenId, outputs, walletInfo, utxos, satsPerByte)
      const txid = await this.ar.sendTx(txHex)
      return txid
    } catch (err) {
      throw new Error(`SLP token send failed: ${err.message}`)
    }
  }

  async burnTokens (tokenId, amount, walletInfo, utxos, satsPerByte = this.defaultSatsPerByte) {
    try {
      const txHex = await this.createBurnTransaction(tokenId, amount, walletInfo, utxos, satsPerByte)
      const txid = await this.ar.sendTx(txHex)
      return txid
    } catch (err) {
      throw new Error(`SLP token burn failed: ${err.message}`)
    }
  }

  async createSendTransaction (tokenId, outputs, walletInfo, utxos, satsPerByte = this.defaultSatsPerByte) {
    try {
      // Validate inputs
      if (!walletInfo || !walletInfo.xecAddress) {
        throw new Error('Valid wallet info required')
      }

      if (!tokenId || typeof tokenId !== 'string') {
        throw new Error('Valid token ID required')
      }

      if (!Array.isArray(outputs) || outputs.length === 0) {
        throw new Error('Valid outputs array required')
      }

      if (outputs.length > 19) {
        throw new Error('Too many outputs - SLP limit is 19 recipients per transaction')
      }

      // Get token metadata for validation
      const tokenInfo = await this.chronik.token(tokenId)
      if (tokenInfo.tokenType.protocol !== 'SLP') {
        throw new Error('Token is not an SLP token')
      }

      // Filter UTXOs by type
      const { slpUtxos, xecUtxos } = this._categorizeUtxos(utxos, tokenId)

      if (slpUtxos.length === 0) {
        throw new Error(`No ${tokenInfo.genesisInfo.tokenTicker} tokens found in wallet`)
      }

      // Calculate required token amounts
      const totalRequired = outputs.reduce((sum, output) => {
        const atoms = this._displayToAtoms(output.value || output.amount, tokenInfo.genesisInfo.decimals)
        return sum + atoms
      }, 0n)

      // Select token UTXOs
      const tokenSelection = this._selectTokenUtxos(slpUtxos, totalRequired, tokenInfo)

      // Calculate total XEC requirement: dust outputs + fees
      const tokenChangeAmount = tokenSelection.totalSelected - totalRequired
      const dustOutputsNeeded = outputs.length + (tokenChangeAmount > 0n ? 1 : 0) // recipient + change (if needed)
      const dustRequirement = dustOutputsNeeded * this.dustLimit

      // Select XEC UTXOs for total requirement (dust + fees) - iterative approach
      const baseInputs = tokenSelection.selectedUtxos.length
      const baseOutputs = outputs.length + 1 + (tokenChangeAmount > 0n ? 1 : 0) // outputs + OP_RETURN + change (if needed)

      // Start with base fee estimate
      let estimatedFee = this._estimateTransactionFee(baseInputs, baseOutputs, satsPerByte)
      const totalXecRequired = dustRequirement + estimatedFee

      // Try XEC selection with initial estimate
      let feeSelection = this._selectXecUtxos(xecUtxos, totalXecRequired, tokenSelection.selectedUtxos)

      // If we need additional XEC inputs, recalculate fee and check if we need even more UTXOs
      if (feeSelection.selectedUtxos.length > 0) {
        const newInputs = baseInputs + feeSelection.selectedUtxos.length
        estimatedFee = this._estimateTransactionFee(newInputs, baseOutputs, satsPerByte)
        const newTotalRequired = dustRequirement + estimatedFee

        // If the new fee requirement exceeds what we selected, try again
        if (newTotalRequired > totalXecRequired) {
          feeSelection = this._selectXecUtxos(xecUtxos, newTotalRequired, tokenSelection.selectedUtxos)

          // Final fee calculation with actual selected inputs
          const finalInputs = baseInputs + feeSelection.selectedUtxos.length
          estimatedFee = this._estimateTransactionFee(finalInputs, baseOutputs, satsPerByte)
        }
      }

      // Get private key
      const privateKeyHex = this._getPrivateKey(walletInfo)
      const sk = fromHex(privateKeyHex)
      const pk = this.ecc.derivePubkey(sk)

      // Build SLP script
      const sendAmounts = outputs.map(output =>
        this._displayToAtoms(output.value || output.amount, tokenInfo.genesisInfo.decimals)
      )

      // Add change amount if needed
      if (tokenChangeAmount > 0n) {
        sendAmounts.push(tokenChangeAmount)
      }

      const slpScriptResult = slpSend(tokenId, SLP_FUNGIBLE, sendAmounts)

      // Build transaction inputs
      const inputs = [
        // Token inputs
        ...tokenSelection.selectedUtxos.map(utxo => ({
          input: {
            prevOut: utxo.outpoint,
            signData: {
              sats: BigInt(this._getUtxoValue(utxo)), // Use actual UTXO value
              outputScript: this._getOutputScript(walletInfo.xecAddress)
            }
          },
          signatory: P2PKHSignatory(sk, pk, ALL_BIP143)
        }))
      ]

      // Add additional XEC inputs if needed
      for (const utxo of feeSelection.selectedUtxos) {
        inputs.push({
          input: {
            prevOut: utxo.outpoint,
            signData: {
              sats: BigInt(this._getUtxoValue(utxo)),
              outputScript: this._getOutputScript(walletInfo.xecAddress)
            }
          },
          signatory: P2PKHSignatory(sk, pk, ALL_BIP143)
        })
      }

      // Build transaction outputs with EXPLICIT amounts
      const txOutputs = [
        // 1. SLP OP_RETURN output (always first)
        {
          sats: 0n,
          script: new Script(slpScriptResult.bytecode)
        },
        // 2. Token outputs to recipients (DUST ONLY - 546 sats each)
        ...outputs.map(output => ({
          sats: BigInt(this.dustLimit), // EXACTLY 546 sats for token
          script: this._getOutputScript(output.address)
        }))
      ]

      // 3. Token change output if needed (DUST ONLY - 546 sats)
      if (tokenChangeAmount > 0n) {
        txOutputs.push({
          sats: BigInt(this.dustLimit), // EXACTLY 546 sats for token change
          script: this._getOutputScript(walletInfo.xecAddress)
        })
      }

      // 4. XEC change output - calculate from all XEC inputs
      // Calculate total XEC input from both token UTXOs and additional XEC UTXOs
      const xecFromTokens = tokenSelection.selectedUtxos.reduce((total, utxo) => {
        return total + this._getUtxoValue(utxo)
      }, 0)

      const xecFromAdditionalInputs = feeSelection.selectedUtxos.reduce((total, utxo) => {
        return total + this._getUtxoValue(utxo)
      }, 0)

      const totalInputXec = BigInt(xecFromTokens + xecFromAdditionalInputs)
      const totalTokenOutputs = BigInt(outputs.length * this.dustLimit) +
                               (tokenChangeAmount > 0n ? BigInt(this.dustLimit) : 0n)
      const estimatedFeeInSats = BigInt(estimatedFee)
      const xecChange = totalInputXec - totalTokenOutputs - estimatedFeeInSats

      if (xecChange >= BigInt(this.dustLimit)) {
        txOutputs.push({
          sats: xecChange,
          script: this._getOutputScript(walletInfo.xecAddress)
        })
      }

      // Build and sign transaction
      const txBuilder = new TxBuilder({ inputs, outputs: txOutputs })
      const tx = txBuilder.sign({
        feePerKb: BigInt(Math.round(satsPerByte * 1000)),
        dustSats: BigInt(this.dustLimit)
      })

      return toHex(tx.ser())
    } catch (err) {
      // Provide better error messages for common issues
      if (err.message.includes('Cannot be converted to a BigInt') || err.message.includes('NaN')) {
        throw new Error('Insufficient XEC for transaction fees')
      }
      throw new Error(`SLP send transaction creation failed: ${err.message}`)
    }
  }

  async createBurnTransaction (tokenId, amount, walletInfo, utxos, satsPerByte) {
    try {
      // Get token metadata
      const tokenInfo = await this.chronik.token(tokenId)
      if (tokenInfo.tokenType.protocol !== 'SLP') {
        throw new Error('Token is not an SLP token')
      }

      // Filter UTXOs
      const { slpUtxos, xecUtxos } = this._categorizeUtxos(utxos, tokenId)

      if (slpUtxos.length === 0) {
        throw new Error(`No ${tokenInfo.genesisInfo.tokenTicker} tokens found to burn`)
      }

      // Calculate burn amount in atoms
      const burnAtoms = this._displayToAtoms(amount, tokenInfo.genesisInfo.decimals)

      // Select token UTXOs for burning
      const tokenSelection = this._selectTokenUtxos(slpUtxos, burnAtoms, tokenInfo)

      // Calculate total XEC requirement: dust outputs + fees
      const burnChangeAmount = tokenSelection.totalSelected - burnAtoms
      const dustOutputsNeeded = burnChangeAmount > 0n ? 1 : 0 // only change output (if needed)
      const dustRequirement = dustOutputsNeeded * this.dustLimit

      // Select XEC UTXOs for total requirement (dust + fees) - iterative approach
      const baseInputs = tokenSelection.selectedUtxos.length
      const baseOutputs = 1 + (burnChangeAmount > 0n ? 1 : 0) // OP_RETURN + change (if needed)

      // Start with base fee estimate
      let estimatedFee = this._estimateTransactionFee(baseInputs, baseOutputs, satsPerByte)
      const totalXecRequired = dustRequirement + estimatedFee

      // Try XEC selection with initial estimate
      let feeSelection = this._selectXecUtxos(xecUtxos, totalXecRequired, tokenSelection.selectedUtxos)

      // If we need additional XEC inputs, recalculate fee and check if we need even more UTXOs
      if (feeSelection.selectedUtxos.length > 0) {
        const newInputs = baseInputs + feeSelection.selectedUtxos.length
        estimatedFee = this._estimateTransactionFee(newInputs, baseOutputs, satsPerByte)
        const newTotalRequired = dustRequirement + estimatedFee

        // If the new fee requirement exceeds what we selected, try again
        if (newTotalRequired > totalXecRequired) {
          feeSelection = this._selectXecUtxos(xecUtxos, newTotalRequired, tokenSelection.selectedUtxos)

          // Final fee calculation with actual selected inputs
          const finalInputs = baseInputs + feeSelection.selectedUtxos.length
          estimatedFee = this._estimateTransactionFee(finalInputs, baseOutputs, satsPerByte)
        }
      }

      // Get private key
      const privateKeyHex = this._getPrivateKey(walletInfo)
      const sk = fromHex(privateKeyHex)
      const pk = this.ecc.derivePubkey(sk)

      // Build SLP script for burn operation
      let slpScriptResult
      if (burnChangeAmount > 0n) {
        // Partial burn: use SEND transaction with only change amount (burns by omission)
        slpScriptResult = slpSend(tokenId, SLP_FUNGIBLE, [burnChangeAmount])
      } else {
        // Complete burn: use BURN transaction (burns all input tokens)
        slpScriptResult = slpBurn(tokenId, SLP_FUNGIBLE, burnAtoms)
      }

      // Build inputs
      const inputs = [
        // Token inputs
        ...tokenSelection.selectedUtxos.map(utxo => ({
          input: {
            prevOut: utxo.outpoint,
            signData: {
              sats: BigInt(this._getUtxoValue(utxo)), // Use actual UTXO value
              outputScript: this._getOutputScript(walletInfo.xecAddress)
            }
          },
          signatory: P2PKHSignatory(sk, pk, ALL_BIP143)
        }))
      ]

      // Add additional XEC inputs if needed
      for (const utxo of feeSelection.selectedUtxos) {
        inputs.push({
          input: {
            prevOut: utxo.outpoint,
            signData: {
              sats: BigInt(this._getUtxoValue(utxo)),
              outputScript: this._getOutputScript(walletInfo.xecAddress)
            }
          },
          signatory: P2PKHSignatory(sk, pk, ALL_BIP143)
        })
      }

      // Build outputs
      const txOutputs = [
        // SLP burn OP_RETURN
        {
          sats: 0n,
          script: new Script(slpScriptResult.bytecode)
        }
      ]

      // Add token change if not burning all (DUST ONLY - 546 sats)
      if (burnChangeAmount > 0n) {
        txOutputs.push({
          sats: BigInt(this.dustLimit), // EXACTLY 546 sats for token change
          script: this._getOutputScript(walletInfo.xecAddress)
        })
      }

      // XEC change output - calculate from all XEC inputs
      // Calculate total XEC input from both token UTXOs and additional XEC UTXOs
      const xecFromTokens = tokenSelection.selectedUtxos.reduce((total, utxo) => {
        return total + this._getUtxoValue(utxo)
      }, 0)

      const xecFromAdditionalInputs = feeSelection.selectedUtxos.reduce((total, utxo) => {
        return total + this._getUtxoValue(utxo)
      }, 0)

      const totalInputXec = BigInt(xecFromTokens + xecFromAdditionalInputs)
      const totalTokenOutputs = burnChangeAmount > 0n ? BigInt(this.dustLimit) : 0n
      const estimatedFeeInSats = BigInt(estimatedFee)
      const xecChange = totalInputXec - totalTokenOutputs - estimatedFeeInSats

      if (xecChange >= BigInt(this.dustLimit)) {
        txOutputs.push({
          sats: xecChange,
          script: this._getOutputScript(walletInfo.xecAddress)
        })
      }

      // Build and sign transaction
      const txBuilder = new TxBuilder({ inputs, outputs: txOutputs })
      const tx = txBuilder.sign({
        feePerKb: BigInt(Math.round(satsPerByte * 1000)),
        dustSats: BigInt(this.dustLimit)
      })

      return toHex(tx.ser())
    } catch (err) {
      throw new Error(`SLP burn transaction creation failed: ${err.message}`)
    }
  }

  // Helper methods

  _categorizeUtxos (utxos, tokenId) {
    const slpUtxos = utxos.filter(utxo =>
      utxo && utxo.token &&
      utxo.token.tokenId === tokenId &&
      utxo.token.tokenType?.protocol === 'SLP'
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

    return { slpUtxos, xecUtxos, pureXecUtxos, otherTokenUtxos }
  }

  _selectTokenUtxos (slpUtxos, requiredAtoms, tokenInfo) {
    // Sort by atoms amount (largest first)
    const sortedUtxos = slpUtxos
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
      return total + this._getUtxoValue(utxo)
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
      .sort((a, b) => this._getUtxoValue(b) - this._getUtxoValue(a))

    if (sortedUtxos.length === 0) {
      throw new Error(`Insufficient XEC for transaction fees. Need ${requiredSats} sats, have ${xecFromTokenUtxos} from tokens`)
    }

    // Select multiple UTXOs if needed to meet the requirement
    const selectedUtxos = []
    let selectedXec = 0

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo)
      selectedXec += this._getUtxoValue(utxo)

      if (selectedXec >= additionalXecNeeded) {
        break
      }
    }

    if (selectedXec < additionalXecNeeded) {
      throw new Error(`Insufficient XEC for transaction fees. Need ${requiredSats} sats, have ${xecFromTokenUtxos} from tokens + ${selectedXec} from UTXOs`)
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

  _estimateTransactionFee (numInputs, numOutputs, satsPerByte) {
    const estimatedSize = (numInputs * 148) + (numOutputs * 34) + 10
    return Math.ceil(estimatedSize * satsPerByte)
  }

  _getPrivateKey (walletInfo) {
    if (walletInfo.mnemonic) {
      const keyData = this.keyDerivation.deriveFromMnemonic(walletInfo.mnemonic, walletInfo.hdPath)
      return keyData.privateKey
    } else {
      return walletInfo.privateKey
    }
  }

  _getOutputScript (address) {
    const decoded = decodeCashAddress(address)
    return Script.p2pkh(fromHex(decoded.hash))
  }

  _getUtxoValue (utxo) {
    if (!utxo) return 0

    // Try sats property first (this is the correct property name)
    if (utxo.sats !== undefined) {
      if (typeof utxo.sats === 'bigint') {
        return Number(utxo.sats)
      }
      if (typeof utxo.sats === 'string') {
        const parsed = parseInt(utxo.sats)
        if (isNaN(parsed)) {
          console.warn(`Invalid UTXO sats value: ${utxo.sats}`)
          return 0
        }
        return parsed
      }
      if (typeof utxo.sats === 'number') {
        return utxo.sats
      }
    }

    // Fallback to value property if available (though this seems to be undefined)
    if (utxo.value !== undefined) {
      if (typeof utxo.value === 'bigint') {
        return Number(utxo.value)
      }
      if (typeof utxo.value === 'string') {
        const parsed = parseInt(utxo.value)
        return isNaN(parsed) ? 0 : parsed
      }
      if (typeof utxo.value === 'number') {
        return utxo.value
      }
    }

    return 0
  }
}

module.exports = SLPTokenHandler
