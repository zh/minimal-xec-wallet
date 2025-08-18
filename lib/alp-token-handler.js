/*
  ALP Token Handler - Uses native ecash-lib ALP functions
  Handles A Ledger Protocol token operations
*/

const {
  TxBuilder,
  P2PKHSignatory,
  Script,
  fromHex,
  toHex,
  Ecc,
  alpSend,
  alpBurn,
  emppScript,
  ALL_BIP143
} = require('ecash-lib')
const { decodeCashAddress } = require('ecashaddrjs')
const KeyDerivation = require('./key-derivation')
const SecurityValidator = require('./security')

class ALPTokenHandler {
  constructor (localConfig = {}) {
    this.chronik = localConfig.chronik
    this.ar = localConfig.ar

    if (!this.chronik) {
      throw new Error('Chronik client required for ALP token operations')
    }

    if (!this.ar) {
      throw new Error('AdapterRouter required for ALP token operations')
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
    this.ALP_STANDARD = 0 // Standard ALP token type
  }

  async sendTokens (tokenId, outputs, walletInfo, utxos, satsPerByte = this.defaultSatsPerByte) {
    try {
      const txHex = await this.createSendTransaction(tokenId, outputs, walletInfo, utxos, satsPerByte)
      const txid = await this.ar.sendTx(txHex)
      return txid
    } catch (err) {
      throw new Error(`ALP token send failed: ${err.message}`)
    }
  }

  async burnTokens (tokenId, amount, walletInfo, utxos, satsPerByte = this.defaultSatsPerByte) {
    try {
      const txHex = await this.createBurnTransaction(tokenId, amount, walletInfo, utxos, satsPerByte)
      const txid = await this.ar.sendTx(txHex)
      return txid
    } catch (err) {
      throw new Error(`ALP token burn failed: ${err.message}`)
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
        throw new Error('Too many outputs - ALP limit is 19 recipients per transaction')
      }

      // Get token metadata for validation
      const tokenInfo = await this.chronik.token(tokenId)
      if (tokenInfo.tokenType.protocol !== 'ALP') {
        throw new Error('Token is not an ALP token')
      }

      // Filter UTXOs by type
      const { alpUtxos, xecUtxos } = this._categorizeUtxos(utxos, tokenId)

      if (alpUtxos.length === 0) {
        throw new Error(`No ${tokenInfo.genesisInfo.tokenTicker} tokens found in wallet`)
      }

      // Calculate required token amounts in atoms
      const atomOutputs = outputs.map(output => ({
        ...output,
        atoms: this._displayToAtoms(output.amount, tokenInfo.genesisInfo.decimals)
      }))

      const totalRequiredAtoms = atomOutputs.reduce((sum, output) => sum + output.atoms, 0n)

      // Select token UTXOs
      const tokenSelection = this._selectTokenUtxos(alpUtxos, totalRequiredAtoms, tokenInfo)

      // Select XEC UTXOs for fees - pass token UTXOs to enable fee calculation from tokens
      const baseInputs = tokenSelection.selectedUtxos.length
      const baseOutputs = outputs.length + 2 // outputs + OP_RETURN + change

      // First estimate with just token inputs to see if we need additional XEC input
      let estimatedFee = this._estimateTransactionFee(baseInputs, baseOutputs, satsPerByte)
      const feeSelection = this._selectXecUtxos(xecUtxos, estimatedFee, tokenSelection.selectedUtxos)

      // If we need additional XEC input, recalculate fee with extra input
      if (feeSelection.selectedUtxos.length > 0) {
        estimatedFee = this._estimateTransactionFee(baseInputs + 1, baseOutputs, satsPerByte)
      }

      // Get private key
      const privateKeyHex = this._getPrivateKey(walletInfo)
      const sk = fromHex(privateKeyHex)
      const pk = this.ecc.derivePubkey(sk)

      // Build ALP script with eMPP
      const sendAmounts = atomOutputs.map(output => output.atoms)

      // Add change amount if needed
      const changeAtoms = tokenSelection.totalSelected - totalRequiredAtoms
      if (changeAtoms > 0n) {
        sendAmounts.push(changeAtoms)
      }

      const alpScript = emppScript([
        alpSend(tokenId, this.ALP_STANDARD, sendAmounts)
      ])

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

      // Add additional XEC input only if needed
      if (feeSelection.selectedUtxos.length > 0) {
        inputs.push({
          input: {
            prevOut: feeSelection.selectedUtxos[0].outpoint,
            signData: {
              sats: BigInt(this._getUtxoValue(feeSelection.selectedUtxos[0])),
              outputScript: this._getOutputScript(walletInfo.xecAddress)
            }
          },
          signatory: P2PKHSignatory(sk, pk, ALL_BIP143)
        })
      }

      // Build transaction outputs with EXPLICIT amounts
      const txOutputs = [
        // 1. ALP OP_RETURN output (always first)
        {
          sats: 0n,
          script: new Script(alpScript.bytecode)
        },
        // 2. Token outputs to recipients (DUST ONLY - 546 sats each)
        ...outputs.map(output => ({
          sats: BigInt(this.dustLimit), // EXACTLY 546 sats for token
          script: this._getOutputScript(output.address)
        }))
      ]

      // 3. Token change output if needed (DUST ONLY - 546 sats)
      if (changeAtoms > 0n) {
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
                               (changeAtoms > 0n ? BigInt(this.dustLimit) : 0n)
      const estimatedFeeInSats = BigInt(estimatedFee)
      const xecChange = totalInputXec - totalTokenOutputs - estimatedFeeInSats

      if (xecChange > 0n) {
        txOutputs.push({
          sats: xecChange, // ALL remaining XEC back to sender
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
      throw new Error(`ALP send transaction creation failed: ${err.message}`)
    }
  }

  async createBurnTransaction (tokenId, amount, walletInfo, utxos, satsPerByte) {
    try {
      // Get token metadata
      const tokenInfo = await this.chronik.token(tokenId)
      if (tokenInfo.tokenType.protocol !== 'ALP') {
        throw new Error('Token is not an ALP token')
      }

      // Filter UTXOs
      const { alpUtxos, xecUtxos } = this._categorizeUtxos(utxos, tokenId)

      if (alpUtxos.length === 0) {
        throw new Error(`No ${tokenInfo.genesisInfo.tokenTicker} tokens found to burn`)
      }

      // Calculate burn amount in atoms
      const burnAtoms = this._displayToAtoms(amount, tokenInfo.genesisInfo.decimals)

      // Select token UTXOs for burning
      const tokenSelection = this._selectTokenUtxos(alpUtxos, burnAtoms, tokenInfo)

      // Select XEC UTXOs for fees - pass token UTXOs to enable fee calculation from tokens
      const baseInputs = tokenSelection.selectedUtxos.length
      const baseOutputs = 2 // OP_RETURN + change

      // First estimate with just token inputs to see if we need additional XEC input
      let estimatedFee = this._estimateTransactionFee(baseInputs, baseOutputs, satsPerByte)
      const feeSelection = this._selectXecUtxos(xecUtxos, estimatedFee, tokenSelection.selectedUtxos)

      // If we need additional XEC input, recalculate fee with extra input
      if (feeSelection.selectedUtxos.length > 0) {
        estimatedFee = this._estimateTransactionFee(baseInputs + 1, baseOutputs, satsPerByte)
      }

      // Get private key
      const privateKeyHex = this._getPrivateKey(walletInfo)
      const sk = fromHex(privateKeyHex)
      const pk = this.ecc.derivePubkey(sk)

      // Build ALP burn script with eMPP
      const alpScript = emppScript([
        alpBurn(tokenId, this.ALP_STANDARD, burnAtoms)
      ])

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

      // Add additional XEC input only if needed
      if (feeSelection.selectedUtxos.length > 0) {
        inputs.push({
          input: {
            prevOut: feeSelection.selectedUtxos[0].outpoint,
            signData: {
              sats: BigInt(this._getUtxoValue(feeSelection.selectedUtxos[0])),
              outputScript: this._getOutputScript(walletInfo.xecAddress)
            }
          },
          signatory: P2PKHSignatory(sk, pk, ALL_BIP143)
        })
      }

      // Build outputs
      const txOutputs = [
        // ALP burn OP_RETURN
        {
          sats: 0n,
          script: new Script(alpScript.bytecode)
        }
      ]

      // Add token change if not burning all (DUST ONLY - 546 sats)
      const changeAtoms = tokenSelection.totalSelected - burnAtoms
      if (changeAtoms > 0n) {
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
      const totalTokenOutputs = changeAtoms > 0n ? BigInt(this.dustLimit) : 0n
      const estimatedFeeInSats = BigInt(estimatedFee)
      const xecChange = totalInputXec - totalTokenOutputs - estimatedFeeInSats

      if (xecChange > 0n) {
        txOutputs.push({
          sats: xecChange, // ALL remaining XEC back to sender
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
      throw new Error(`ALP burn transaction creation failed: ${err.message}`)
    }
  }

  // Helper methods

  _categorizeUtxos (utxos, tokenId) {
    const alpUtxos = utxos.filter(utxo =>
      utxo && utxo.token &&
      utxo.token.tokenId === tokenId &&
      utxo.token.tokenType?.protocol === 'ALP'
    )

    // Pure XEC UTXOs (no token data)
    const pureXecUtxos = utxos.filter(utxo => utxo && !utxo.token)

    // Other token UTXOs (different tokens) - their XEC can be used for fees
    const otherTokenUtxos = utxos.filter(utxo =>
      utxo && utxo.token &&
      utxo.token.tokenId !== tokenId
    )

    // Combine pure XEC and other token UTXOs for fee calculation
    const xecUtxos = [...pureXecUtxos, ...otherTokenUtxos]

    return { alpUtxos, xecUtxos, pureXecUtxos, otherTokenUtxos }
  }

  _selectTokenUtxos (alpUtxos, requiredAtoms, tokenInfo) {
    // Sort by atoms amount (largest first)
    const sortedUtxos = alpUtxos
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

    if (sortedUtxos.length === 0 || this._getUtxoValue(sortedUtxos[0]) < additionalXecNeeded) {
      throw new Error(`Insufficient XEC for transaction fees. Need ${requiredSats} sats, have ${xecFromTokenUtxos} from tokens`)
    }

    return { selectedUtxos: [sortedUtxos[0]], xecFromTokens: xecFromTokenUtxos }
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
    const estimatedSize = (numInputs * 148) + (numOutputs * 34) + 50 // +50 for eMPP script
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

module.exports = ALPTokenHandler
