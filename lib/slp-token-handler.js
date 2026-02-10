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
  slpSend,
  slpBurn,
  SLP_FUNGIBLE,
  ALL_BIP143
} = require('ecash-lib')
const BaseTokenHandler = require('./base-token-handler')
const { getUtxoValue, estimateFee, getPrivateKey, getOutputScript } = require('./tx-utils')

class SLPTokenHandler extends BaseTokenHandler {
  constructor (localConfig = {}) {
    // Set protocolName before super() so constructor error messages use it
    const config = Object.assign({}, localConfig)
    // Temporarily set protocolName on the instance prototype won't work before super,
    // so we handle it after super
    super(config)
    this.protocolName = 'SLP'
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
      const { tokenUtxos, xecUtxos } = this._categorizeUtxos(utxos, tokenId)

      if (tokenUtxos.length === 0) {
        throw new Error(`No ${tokenInfo.genesisInfo.tokenTicker} tokens found in wallet`)
      }

      // Calculate required token amounts
      const totalRequired = outputs.reduce((sum, output) => {
        const atoms = this._displayToAtoms(output.value || output.amount, tokenInfo.genesisInfo.decimals)
        return sum + atoms
      }, 0n)

      // Select token UTXOs
      const tokenSelection = this._selectTokenUtxos(tokenUtxos, totalRequired, tokenInfo)

      // Calculate total XEC requirement: dust outputs + fees
      const tokenChangeAmount = tokenSelection.totalSelected - totalRequired
      const dustOutputsNeeded = outputs.length + (tokenChangeAmount > 0n ? 1 : 0) // recipient + change (if needed)
      const dustRequirement = dustOutputsNeeded * this.dustLimit

      // Select XEC UTXOs for total requirement (dust + fees) - iterative approach
      const baseInputs = tokenSelection.selectedUtxos.length
      const baseOutputs = outputs.length + 1 + (tokenChangeAmount > 0n ? 1 : 0) // outputs + OP_RETURN + change (if needed)

      // Start with base fee estimate
      let estimatedFee = estimateFee(baseInputs, baseOutputs, satsPerByte)
      const totalXecRequired = dustRequirement + estimatedFee

      // Try XEC selection with initial estimate
      let feeSelection = this._selectXecUtxos(xecUtxos, totalXecRequired, tokenSelection.selectedUtxos)

      // If we need additional XEC inputs, recalculate fee and check if we need even more UTXOs
      if (feeSelection.selectedUtxos.length > 0) {
        const newInputs = baseInputs + feeSelection.selectedUtxos.length
        estimatedFee = estimateFee(newInputs, baseOutputs, satsPerByte)
        const newTotalRequired = dustRequirement + estimatedFee

        // If the new fee requirement exceeds what we selected, try again
        if (newTotalRequired > totalXecRequired) {
          feeSelection = this._selectXecUtxos(xecUtxos, newTotalRequired, tokenSelection.selectedUtxos)

          // Final fee calculation with actual selected inputs
          const finalInputs = baseInputs + feeSelection.selectedUtxos.length
          estimatedFee = estimateFee(finalInputs, baseOutputs, satsPerByte)
        }
      }

      // Get private key
      const privateKeyHex = getPrivateKey(walletInfo)
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
              sats: BigInt(getUtxoValue(utxo)), // Use actual UTXO value
              outputScript: getOutputScript(walletInfo.xecAddress)
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
              sats: BigInt(getUtxoValue(utxo)),
              outputScript: getOutputScript(walletInfo.xecAddress)
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
          script: getOutputScript(output.address)
        }))
      ]

      // 3. Token change output if needed (DUST ONLY - 546 sats)
      if (tokenChangeAmount > 0n) {
        txOutputs.push({
          sats: BigInt(this.dustLimit), // EXACTLY 546 sats for token change
          script: getOutputScript(walletInfo.xecAddress)
        })
      }

      // 4. XEC change output - calculate from all XEC inputs
      // Calculate total XEC input from both token UTXOs and additional XEC UTXOs
      const xecFromTokens = tokenSelection.selectedUtxos.reduce((total, utxo) => {
        return total + getUtxoValue(utxo)
      }, 0)

      const xecFromAdditionalInputs = feeSelection.selectedUtxos.reduce((total, utxo) => {
        return total + getUtxoValue(utxo)
      }, 0)

      const totalInputXec = BigInt(xecFromTokens + xecFromAdditionalInputs)
      const totalTokenOutputs = BigInt(outputs.length * this.dustLimit) +
                               (tokenChangeAmount > 0n ? BigInt(this.dustLimit) : 0n)
      const estimatedFeeInSats = BigInt(estimatedFee)
      const xecChange = totalInputXec - totalTokenOutputs - estimatedFeeInSats

      if (xecChange >= BigInt(this.dustLimit)) {
        txOutputs.push({
          sats: xecChange,
          script: getOutputScript(walletInfo.xecAddress)
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
      const { tokenUtxos, xecUtxos } = this._categorizeUtxos(utxos, tokenId)

      if (tokenUtxos.length === 0) {
        throw new Error(`No ${tokenInfo.genesisInfo.tokenTicker} tokens found to burn`)
      }

      // Calculate burn amount in atoms
      const burnAtoms = this._displayToAtoms(amount, tokenInfo.genesisInfo.decimals)

      // Select token UTXOs for burning
      const tokenSelection = this._selectTokenUtxos(tokenUtxos, burnAtoms, tokenInfo)

      // Calculate total XEC requirement: dust outputs + fees
      const burnChangeAmount = tokenSelection.totalSelected - burnAtoms
      const dustOutputsNeeded = burnChangeAmount > 0n ? 1 : 0 // only change output (if needed)
      const dustRequirement = dustOutputsNeeded * this.dustLimit

      // Select XEC UTXOs for total requirement (dust + fees) - iterative approach
      const baseInputs = tokenSelection.selectedUtxos.length
      const baseOutputs = 1 + (burnChangeAmount > 0n ? 1 : 0) // OP_RETURN + change (if needed)

      // Start with base fee estimate
      let estimatedFee = estimateFee(baseInputs, baseOutputs, satsPerByte)
      const totalXecRequired = dustRequirement + estimatedFee

      // Try XEC selection with initial estimate
      let feeSelection = this._selectXecUtxos(xecUtxos, totalXecRequired, tokenSelection.selectedUtxos)

      // If we need additional XEC inputs, recalculate fee and check if we need even more UTXOs
      if (feeSelection.selectedUtxos.length > 0) {
        const newInputs = baseInputs + feeSelection.selectedUtxos.length
        estimatedFee = estimateFee(newInputs, baseOutputs, satsPerByte)
        const newTotalRequired = dustRequirement + estimatedFee

        // If the new fee requirement exceeds what we selected, try again
        if (newTotalRequired > totalXecRequired) {
          feeSelection = this._selectXecUtxos(xecUtxos, newTotalRequired, tokenSelection.selectedUtxos)

          // Final fee calculation with actual selected inputs
          const finalInputs = baseInputs + feeSelection.selectedUtxos.length
          estimatedFee = estimateFee(finalInputs, baseOutputs, satsPerByte)
        }
      }

      // Get private key
      const privateKeyHex = getPrivateKey(walletInfo)
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
              sats: BigInt(getUtxoValue(utxo)), // Use actual UTXO value
              outputScript: getOutputScript(walletInfo.xecAddress)
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
              sats: BigInt(getUtxoValue(utxo)),
              outputScript: getOutputScript(walletInfo.xecAddress)
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
          script: getOutputScript(walletInfo.xecAddress)
        })
      }

      // XEC change output - calculate from all XEC inputs
      // Calculate total XEC input from both token UTXOs and additional XEC UTXOs
      const xecFromTokens = tokenSelection.selectedUtxos.reduce((total, utxo) => {
        return total + getUtxoValue(utxo)
      }, 0)

      const xecFromAdditionalInputs = feeSelection.selectedUtxos.reduce((total, utxo) => {
        return total + getUtxoValue(utxo)
      }, 0)

      const totalInputXec = BigInt(xecFromTokens + xecFromAdditionalInputs)
      const totalTokenOutputs = burnChangeAmount > 0n ? BigInt(this.dustLimit) : 0n
      const estimatedFeeInSats = BigInt(estimatedFee)
      const xecChange = totalInputXec - totalTokenOutputs - estimatedFeeInSats

      if (xecChange >= BigInt(this.dustLimit)) {
        txOutputs.push({
          sats: xecChange,
          script: getOutputScript(walletInfo.xecAddress)
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
}

module.exports = SLPTokenHandler
