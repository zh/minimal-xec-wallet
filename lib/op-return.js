/*
  This library handles OP_RETURN operations for XEC transactions.
  Uses same patterns as send-xec.js for consistency.
*/

const { TxBuilder, P2PKHSignatory, fromHex, toHex, Ecc, Script, ALL_BIP143 } = require('ecash-lib')
const { decodeCashAddress } = require('ecashaddrjs')
const KeyDerivation = require('./key-derivation')
const SecurityValidator = require('./security')

class OpReturn {
  constructor (localConfig = {}) {
    this.chronik = localConfig.chronik
    this.ar = localConfig.ar

    if (!this.chronik) {
      throw new Error('Chronik client required for OP_RETURN transactions')
    }

    if (!this.ar) {
      throw new Error('AdapterRouter required for OP_RETURN transactions')
    }

    // Initialize components (same as send-xec.js)
    this.keyDerivation = new KeyDerivation()
    this.security = new SecurityValidator(localConfig.security)

    // Initialize ECC for ecash-lib
    try {
      this.ecc = new Ecc()
    } catch (err) {
      throw new Error(`Ecc initialization failed: ${err.message}`)
    }

    // Configuration - XEC uses 546 satoshis (5.46 XEC) as standard dust limit
    this.dustLimit = localConfig.dustLimit || 546
    this.maxOpReturnSize = localConfig.maxOpReturnSize || 223 // Max OP_RETURN size in bytes
    this.defaultSatsPerByte = localConfig.defaultSatsPerByte || 1.2
  }

  async sendOpReturn (walletInfo, xecUtxos, msg, prefix = '6d02', xecOutput = [], satsPerByte = this.defaultSatsPerByte) {
    try {
      // Create OP_RETURN transaction
      const txHex = await this.createOpReturnTx(walletInfo, xecUtxos, msg, prefix, xecOutput, satsPerByte)

      // Broadcast transaction
      const txid = await this.ar.sendTx(txHex)

      return txid
    } catch (err) {
      throw new Error(`OP_RETURN send failed: ${err.message}`)
    }
  }

  async createOpReturnTx (walletInfo, xecUtxos, msg, prefix = '6d02', xecOutput = [], satsPerByte = this.defaultSatsPerByte) {
    try {
      // Validate inputs
      if (!walletInfo || !walletInfo.xecAddress) {
        throw new Error('Valid wallet info required')
      }

      if (!xecUtxos || xecUtxos.length === 0) {
        throw new Error('UTXOs required for OP_RETURN transaction')
      }

      // Build OP_RETURN script
      const opReturnScript = this.buildOpReturnScript(msg, prefix)

      // Calculate total output amount (excluding OP_RETURN which is always 0)
      let totalOutputAmount = 0
      for (const output of xecOutput) {
        if (!output.address || typeof output.amountSat !== 'number') {
          throw new Error('Invalid XEC output format')
        }
        totalOutputAmount += output.amountSat
      }

      // Select UTXOs using the same logic as send-xec.js
      const coinSelection = this._selectUtxosForOpReturn(
        totalOutputAmount,
        xecUtxos,
        satsPerByte,
        xecOutput.length + 1 // +1 for OP_RETURN output
      )

      // Get private key (prefer mnemonic - same as send-xec.js)
      let privateKeyHex
      if (walletInfo.mnemonic) {
        const keyData = this.keyDerivation.deriveFromMnemonic(walletInfo.mnemonic, walletInfo.hdPath)
        privateKeyHex = keyData.privateKey
      } else {
        privateKeyHex = walletInfo.privateKey
      }

      const sk = fromHex(privateKeyHex)
      const pk = this.ecc.derivePubkey(sk)

      // Build outputs array (same pattern as send-xec.js)
      const txOutputs = []

      // Add OP_RETURN output first (0 value)
      txOutputs.push({
        sats: BigInt(0),
        script: new Script(opReturnScript)
      })

      // Add XEC outputs
      for (const output of xecOutput) {
        const decoded = decodeCashAddress(output.address)
        txOutputs.push({
          sats: BigInt(output.amountSat),
          script: Script.p2pkh(fromHex(decoded.hash))
        })
      }

      // Add change address for automatic calculation (same as send-xec.js)
      const walletDecoded = decodeCashAddress(walletInfo.xecAddress)
      txOutputs.push(Script.p2pkh(fromHex(walletDecoded.hash)))

      // Build inputs (same pattern as send-xec.js)
      const inputs = coinSelection.necessaryUtxos.map(utxo => ({
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

      // Build and sign transaction (same as send-xec.js)
      const txBuilder = new TxBuilder({ inputs, outputs: txOutputs })
      const tx = txBuilder.sign({
        feePerKb: BigInt(Math.round(satsPerByte * 1000)),
        dustSats: BigInt(this.dustLimit)
      })

      return toHex(tx.ser())
    } catch (err) {
      throw new Error(`OP_RETURN transaction creation failed: ${err.message}`)
    }
  }

  buildOpReturnScript (msg, prefix = '6d02') {
    try {
      // Convert message to buffer
      const msgBuffer = Buffer.isBuffer(msg) ? msg : Buffer.from(msg, 'utf8')

      // Convert prefix from hex if it's a string
      const prefixBuffer = typeof prefix === 'string' ? Buffer.from(prefix, 'hex') : prefix

      // Calculate total size
      const totalSize = prefixBuffer.length + msgBuffer.length

      if (totalSize > this.maxOpReturnSize) {
        throw new Error(`OP_RETURN data too large: ${totalSize} bytes (max: ${this.maxOpReturnSize})`)
      }

      // Build OP_RETURN script
      // Format: OP_RETURN <prefix> <message>
      const script = Buffer.alloc(2 + prefixBuffer.length + msgBuffer.length)
      let offset = 0

      // OP_RETURN opcode
      script[offset++] = 0x6a

      // Push data opcode based on total size
      if (totalSize <= 75) {
        script[offset++] = totalSize
      } else if (totalSize <= 255) {
        script[offset++] = 0x4c // OP_PUSHDATA1
        script[offset++] = totalSize
      } else {
        throw new Error('OP_RETURN data too large for standard push operations')
      }

      // Add prefix
      prefixBuffer.copy(script, offset)
      offset += prefixBuffer.length

      // Add message
      msgBuffer.copy(script, offset)

      return script
    } catch (err) {
      throw new Error(`OP_RETURN script creation failed: ${err.message}`)
    }
  }

  // Helper methods

  _selectUtxosForOpReturn (totalOutputAmount, availableUtxos, satsPerByte, numOutputs) {
    try {
      // Filter secure UTXOs (same as send-xec.js)
      let secureUtxos = this.security.filterSecureUtxos(availableUtxos, { excludeDustAttack: false })

      // If no confirmed UTXOs available, allow unconfirmed ones
      if (secureUtxos.length === 0) {
        console.warn('No confirmed UTXOs available, including unconfirmed UTXOs')
        secureUtxos = this.security.filterSecureUtxos(availableUtxos, { includeUnconfirmed: true, excludeDustAttack: false })
      }

      if (secureUtxos.length === 0) {
        throw new Error('No spendable UTXOs available')
      }

      // Sort UTXOs by size (largest first) - using proper value extraction
      const sortedUtxos = secureUtxos.sort((a, b) => {
        return this._getUtxoValue(b) - this._getUtxoValue(a)
      })

      const selectedUtxos = []
      let totalInputAmount = 0
      let estimatedFee = 0

      for (const utxo of sortedUtxos) {
        const utxoValue = this._getUtxoValue(utxo)
        selectedUtxos.push(utxo)
        totalInputAmount += utxoValue

        // Calculate fee including potential change output
        const numInputs = selectedUtxos.length
        const hasChange = (totalInputAmount - totalOutputAmount) > this.dustLimit
        const totalOutputs = numOutputs + (hasChange ? 1 : 0) // +1 for change if needed

        estimatedFee = this._calculateFee(numInputs, totalOutputs, satsPerByte)
        const totalNeeded = totalOutputAmount + estimatedFee

        if (totalInputAmount >= totalNeeded) {
          const change = totalInputAmount - totalNeeded

          return {
            necessaryUtxos: selectedUtxos,
            totalAmount: totalInputAmount,
            estimatedFee,
            change: change > this.dustLimit ? change : 0
          }
        }
      }

      throw new Error(`Insufficient funds for OP_RETURN transaction. Need: ${totalOutputAmount + estimatedFee}, Available: ${totalInputAmount}`)
    } catch (err) {
      throw new Error(`UTXO selection for OP_RETURN failed: ${err.message}`)
    }
  }

  _calculateFee (numInputs, numOutputs, satsPerByte) {
    // Estimate transaction size in bytes
    const estimatedSize = (numInputs * 148) + (numOutputs * 34) + 10
    return Math.ceil(estimatedSize * satsPerByte)
  }

  _createP2PKHScript (hash160) {
    // Create Pay-to-Public-Key-Hash script
    const script = Buffer.alloc(25)
    script[0] = 0x76 // OP_DUP
    script[1] = 0xa9 // OP_HASH160
    script[2] = 0x14 // Push 20 bytes
    hash160.copy(script, 3)
    script[23] = 0x88 // OP_EQUALVERIFY
    script[24] = 0xac // OP_CHECKSIG
    return script
  }

  _validateMessage (msg) {
    if (msg === null || msg === undefined) {
      return Buffer.alloc(0) // Empty message
    }

    if (Buffer.isBuffer(msg)) {
      return msg
    }

    if (typeof msg === 'string') {
      return Buffer.from(msg, 'utf8')
    }

    throw new Error('Message must be a string or Buffer')
  }

  _validatePrefix (prefix) {
    if (!prefix) {
      return Buffer.from('6d02', 'hex') // Default memo.cash prefix
    }

    if (Buffer.isBuffer(prefix)) {
      return prefix
    }

    if (typeof prefix === 'string') {
      // Assume hex string
      return Buffer.from(prefix, 'hex')
    }

    throw new Error('Prefix must be a hex string or Buffer')
  }

  // Same UTXO value extraction as send-xec.js
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

module.exports = OpReturn
