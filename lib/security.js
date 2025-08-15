/*
  Security validations for minimal XEC wallet

  Essential security features without over-engineering:
  - Dust attack protection
  - Basic suspicious pattern detection
  - Input validation
  - UTXO safety checks
*/

class SecurityValidator {
  constructor (config = {}) {
    // Simple security thresholds - XEC uses 546 satoshis (5.46 XEC) as standard dust limit
    this.dustThreshold = config.dustThreshold || 546
    this.maxTransactionSize = config.maxTransactionSize || 100000 // 100KB
    this.suspiciousPatternThreshold = config.suspiciousPatternThreshold || 10
    this.maxOutputs = config.maxOutputs || 50
  }

  /**
   * Check if UTXO is safe to spend
   * @param {Object} utxo - UTXO to validate
   * @param {Object} options - Validation options
   * @returns {boolean} - True if safe to spend
   */
  isSecureUtxo (utxo, options = {}) {
    try {
      // Basic structure validation
      if (!this.isValidUtxoStructure(utxo)) {
        return false
      }

      const satsValue = this._extractSats(utxo)

      // Dust protection
      if (satsValue < this.dustThreshold) {
        return false
      }

      // Check confirmation status
      const { includeUnconfirmed = false } = options
      if (!includeUnconfirmed && utxo.blockHeight === -1) {
        return false
      }

      return true
    } catch (err) {
      console.warn('UTXO security validation failed:', err.message)
      return false
    }
  }

  /**
   * Detect potential dust attacks in UTXO set
   * @param {Array} utxos - Array of UTXOs to analyze
   * @returns {Object} - Analysis result
   */
  analyzeDustAttack (utxos) {
    const analysis = {
      isDustAttack: false,
      suspiciousUtxos: [],
      duplicateAmounts: new Map(),
      recommendation: 'safe'
    }

    try {
      // Group by amount
      const amountGroups = new Map()

      utxos.forEach((utxo, index) => {
        const sats = this._extractSats(utxo)

        // Only consider small amounts for dust attack analysis
        if (sats < 5000) { // Less than 50 XEC
          if (!amountGroups.has(sats)) {
            amountGroups.set(sats, [])
          }
          amountGroups.get(sats).push({ utxo, index })
        }
      })

      // Check for suspicious patterns
      for (const [amount, group] of amountGroups) {
        if (group.length >= this.suspiciousPatternThreshold) {
          analysis.isDustAttack = true
          analysis.suspiciousUtxos.push(...group.map(g => g.index))
          analysis.duplicateAmounts.set(amount, group.length)
        }
      }

      // Set recommendation
      if (analysis.isDustAttack) {
        analysis.recommendation = 'exclude_suspicious'
      }

      return analysis
    } catch (err) {
      console.warn('Dust attack analysis failed:', err.message)
      return analysis
    }
  }

  /**
   * Validate transaction outputs for security
   * @param {Array} outputs - Transaction outputs
   * @returns {Object} - Validation result
   */
  validateOutputs (outputs) {
    const validation = {
      isValid: true,
      errors: [],
      totalAmount: 0
    }

    try {
      // Check output count
      if (outputs.length === 0) {
        validation.isValid = false
        validation.errors.push('No outputs specified')
        return validation
      }

      if (outputs.length > this.maxOutputs) {
        validation.isValid = false
        validation.errors.push(`Too many outputs: ${outputs.length} > ${this.maxOutputs}`)
        return validation
      }

      // Validate each output
      for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i]

        // Address validation
        if (!this.isValidAddress(output.address)) {
          validation.isValid = false
          validation.errors.push(`Invalid address at output ${i}: ${output.address}`)
        }

        // Amount validation
        const amount = this._validateAmount(output.amountSat || output.amount)
        if (amount === null) {
          validation.isValid = false
          validation.errors.push(`Invalid amount at output ${i}: ${output.amountSat || output.amount}`)
        } else {
          validation.totalAmount += amount
        }
      }

      // Check for amount overflow
      if (validation.totalAmount > Number.MAX_SAFE_INTEGER) {
        validation.isValid = false
        validation.errors.push('Total amount exceeds safe integer limits')
      }

      return validation
    } catch (err) {
      validation.isValid = false
      validation.errors.push(`Output validation failed: ${err.message}`)
      return validation
    }
  }

  /**
   * Check if address is valid XEC format
   * @param {string} address - Address to validate
   * @returns {boolean} - True if valid
   */
  isValidAddress (address) {
    try {
      if (typeof address !== 'string') {
        return false
      }

      // Must start with ecash: prefix
      if (!address.startsWith('ecash:')) {
        return false
      }

      // Try to decode with ecashaddrjs for proper validation
      const { decodeCashAddress } = require('ecashaddrjs')
      const decoded = decodeCashAddress(address)

      // Must be P2PKH (type 0) - case insensitive check
      return decoded.type === 'P2PKH' || decoded.type === 'p2pkh'
    } catch (err) {
      // Invalid address format
      return false
    }
  }

  /**
   * Validate UTXO structure
   * @param {Object} utxo - UTXO to validate
   * @returns {boolean} - True if valid structure
   */
  isValidUtxoStructure (utxo) {
    return (
      utxo &&
      utxo.outpoint &&
      typeof utxo.outpoint.txid === 'string' &&
      typeof utxo.outpoint.outIdx === 'number' &&
      (utxo.sats !== undefined || utxo.value !== undefined) &&
      typeof utxo.blockHeight === 'number'
    )
  }

  /**
   * Filter UTXOs to only safe ones
   * @param {Array} utxos - UTXOs to filter
   * @param {Object} options - Filtering options
   * @returns {Array} - Filtered safe UTXOs
   */
  filterSecureUtxos (utxos, options = {}) {
    const {
      includeUnconfirmed = false,
      excludeDustAttack = true
    } = options

    let filteredUtxos = utxos.filter(utxo => {
      // Basic security check with options
      if (!this.isSecureUtxo(utxo, { includeUnconfirmed })) {
        return false
      }

      return true
    })

    // Remove dust attack UTXOs if requested
    if (excludeDustAttack) {
      const dustAnalysis = this.analyzeDustAttack(filteredUtxos)
      if (dustAnalysis.isDustAttack) {
        filteredUtxos = filteredUtxos.filter((_, index) =>
          !dustAnalysis.suspiciousUtxos.includes(index)
        )
      }
    }

    return filteredUtxos
  }

  // Private helper methods

  _extractSats (utxo) {
    if (utxo.sats !== undefined) {
      return typeof utxo.sats === 'bigint' ? Number(utxo.sats) : parseInt(utxo.sats)
    }
    if (utxo.value !== undefined) {
      return typeof utxo.value === 'bigint' ? Number(utxo.value) : parseInt(utxo.value)
    }
    throw new Error('No sats/value found in UTXO')
  }

  _validateAmount (amount) {
    if (typeof amount === 'string') {
      amount = parseInt(amount)
    }

    if (typeof amount !== 'number' || isNaN(amount)) {
      return null
    }

    if (amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
      return null
    }

    return amount
  }
}

module.exports = SecurityValidator
