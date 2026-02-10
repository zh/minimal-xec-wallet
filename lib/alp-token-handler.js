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
  alpSend,
  alpBurn,
  emppScript,
  ALL_BIP143
} = require('ecash-lib')
const BaseTokenHandler = require('./base-token-handler')
const { getUtxoValue, estimateFee, getPrivateKey, getOutputScript } = require('./tx-utils')

class ALPTokenHandler extends BaseTokenHandler {
  constructor (localConfig = {}) {
    super(localConfig)
    this.protocolName = 'ALP'
    this.ALP_STANDARD = 0 // Standard ALP token type
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
      const { tokenUtxos, xecUtxos } = this._categorizeUtxos(utxos, tokenId)

      if (tokenUtxos.length === 0) {
        throw new Error(`No ${tokenInfo.genesisInfo.tokenTicker} tokens found in wallet`)
      }

      // Calculate required token amounts in atoms
      const atomOutputs = outputs.map(output => ({
        ...output,
        atoms: this._displayToAtoms(output.value || output.amount, tokenInfo.genesisInfo.decimals)
      }))

      const totalRequiredAtoms = atomOutputs.reduce((sum, output) => sum + output.atoms, 0n)

      // Select token UTXOs
      const tokenSelection = this._selectTokenUtxos(tokenUtxos, totalRequiredAtoms, tokenInfo)

      // Calculate total XEC requirement: dust outputs + fees
      const tokenChangeAmount = tokenSelection.totalSelected - totalRequiredAtoms
      const dustOutputsNeeded = outputs.length + (tokenChangeAmount > 0n ? 1 : 0) // recipient + change (if needed)
      const dustRequirement = dustOutputsNeeded * this.dustLimit

      // Select XEC UTXOs for total requirement (dust + fees) - iterative approach
      const baseInputs = tokenSelection.selectedUtxos.length
      const baseOutputs = outputs.length + 1 + (tokenChangeAmount > 0n ? 1 : 0) // outputs + OP_RETURN + change (if needed)

      // Start with base fee estimate (ALP uses 43 bytes extra overhead for eMPP script)
      const alpOverhead = 43
      let estimatedFee = estimateFee(baseInputs, baseOutputs, satsPerByte, alpOverhead)
      const totalXecRequired = dustRequirement + estimatedFee

      // Try XEC selection with initial estimate
      let feeSelection = this._selectXecUtxos(xecUtxos, totalXecRequired, tokenSelection.selectedUtxos)

      // If we need additional XEC inputs, recalculate fee and check if we need even more UTXOs
      if (feeSelection.selectedUtxos.length > 0) {
        const newInputs = baseInputs + feeSelection.selectedUtxos.length
        estimatedFee = estimateFee(newInputs, baseOutputs, satsPerByte, alpOverhead)
        const newTotalRequired = dustRequirement + estimatedFee

        // If the new fee requirement exceeds what we selected, try again
        if (newTotalRequired > totalXecRequired) {
          feeSelection = this._selectXecUtxos(xecUtxos, newTotalRequired, tokenSelection.selectedUtxos)

          // Final fee calculation with actual selected inputs
          const finalInputs = baseInputs + feeSelection.selectedUtxos.length
          estimatedFee = estimateFee(finalInputs, baseOutputs, satsPerByte, alpOverhead)
        }
      }

      // Get private key
      const privateKeyHex = getPrivateKey(walletInfo)
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
        // 1. ALP OP_RETURN output (always first)
        {
          sats: 0n,
          script: new Script(alpScript.bytecode)
        },
        // 2. Token outputs to recipients (DUST ONLY - 546 sats each)
        ...outputs.map(output => ({
          sats: BigInt(this.dustLimit), // EXACTLY 546 sats for token
          script: getOutputScript(output.address)
        }))
      ]

      // 3. Token change output if needed (DUST ONLY - 546 sats)
      if (changeAtoms > 0n) {
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
                               (changeAtoms > 0n ? BigInt(this.dustLimit) : 0n)
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
      const { tokenUtxos, xecUtxos } = this._categorizeUtxos(utxos, tokenId)

      if (tokenUtxos.length === 0) {
        throw new Error(`No ${tokenInfo.genesisInfo.tokenTicker} tokens found to burn`)
      }

      // Calculate burn amount in atoms
      const burnAtoms = this._displayToAtoms(amount, tokenInfo.genesisInfo.decimals)

      // Select token UTXOs for burning
      const tokenSelection = this._selectTokenUtxos(tokenUtxos, burnAtoms, tokenInfo)

      // Calculate total XEC requirement: dust outputs + fees
      const tokenChangeAmount = tokenSelection.totalSelected - burnAtoms
      const dustOutputsNeeded = tokenChangeAmount > 0n ? 1 : 0 // only change output (if needed)
      const dustRequirement = dustOutputsNeeded * this.dustLimit

      // Select XEC UTXOs for total requirement (dust + fees) - iterative approach
      const baseInputs = tokenSelection.selectedUtxos.length
      const baseOutputs = 1 + (tokenChangeAmount > 0n ? 1 : 0) // OP_RETURN + change (if needed)

      // Start with base fee estimate (ALP uses 43 bytes extra overhead for eMPP script)
      const alpOverhead = 43
      let estimatedFee = estimateFee(baseInputs, baseOutputs, satsPerByte, alpOverhead)
      const totalXecRequired = dustRequirement + estimatedFee

      // Try XEC selection with initial estimate
      let feeSelection = this._selectXecUtxos(xecUtxos, totalXecRequired, tokenSelection.selectedUtxos)

      // If we need additional XEC inputs, recalculate fee and check if we need even more UTXOs
      if (feeSelection.selectedUtxos.length > 0) {
        const newInputs = baseInputs + feeSelection.selectedUtxos.length
        estimatedFee = estimateFee(newInputs, baseOutputs, satsPerByte, alpOverhead)
        const newTotalRequired = dustRequirement + estimatedFee

        // If the new fee requirement exceeds what we selected, try again
        if (newTotalRequired > totalXecRequired) {
          feeSelection = this._selectXecUtxos(xecUtxos, newTotalRequired, tokenSelection.selectedUtxos)

          // Final fee calculation with actual selected inputs
          const finalInputs = baseInputs + feeSelection.selectedUtxos.length
          estimatedFee = estimateFee(finalInputs, baseOutputs, satsPerByte, alpOverhead)
        }
      }

      // Get private key
      const privateKeyHex = getPrivateKey(walletInfo)
      const sk = fromHex(privateKeyHex)
      const pk = this.ecc.derivePubkey(sk)

      // Build ALP script for burn operation
      let alpScript
      if (tokenChangeAmount > 0n) {
        // Partial burn: use SEND transaction with only change amount (burns by omission)
        alpScript = emppScript([
          alpSend(tokenId, this.ALP_STANDARD, [tokenChangeAmount])
        ])
      } else {
        // Complete burn: use BURN transaction (burns all input tokens)
        alpScript = emppScript([
          alpBurn(tokenId, this.ALP_STANDARD, burnAtoms)
        ])
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
      const totalTokenOutputs = changeAtoms > 0n ? BigInt(this.dustLimit) : 0n
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
      throw new Error(`ALP burn transaction creation failed: ${err.message}`)
    }
  }
}

module.exports = ALPTokenHandler
