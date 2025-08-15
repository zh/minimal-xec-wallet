/*
  Token Protocol Detection for hybrid SLP + ALP support.
  Categorizes UTXOs by protocol and provides detection utilities.
*/

class TokenProtocolDetector {
  /**
   * Detect the protocol of a token from a UTXO
   * @param {Object} utxo - UTXO object from chronik
   * @returns {string} - 'XEC', 'SLP', or 'ALP'
   */
  static detectProtocol (utxo) {
    if (!utxo || !utxo.token) {
      return 'XEC'
    }

    const protocol = utxo.token.tokenType?.protocol
    switch (protocol) {
      case 'SLP':
        return 'SLP'
      case 'ALP':
        return 'ALP'
      default:
        throw new Error(`Unknown token protocol: ${protocol}`)
    }
  }

  /**
   * Detect token protocol from token metadata
   * @param {Object} tokenInfo - Token info from chronik.token()
   * @returns {string} - 'SLP' or 'ALP'
   */
  static detectProtocolFromMetadata (tokenInfo) {
    if (!tokenInfo || !tokenInfo.tokenType) {
      throw new Error('Invalid token metadata')
    }

    const protocol = tokenInfo.tokenType.protocol
    switch (protocol) {
      case 'SLP':
        return 'SLP'
      case 'ALP':
        return 'ALP'
      default:
        throw new Error(`Unknown token protocol: ${protocol}`)
    }
  }

  /**
   * Categorize UTXOs by protocol type
   * @param {Array} utxos - Array of UTXO objects
   * @returns {Object} - Categorized UTXOs by protocol
   */
  static categorizeUtxos (utxos) {
    const result = {
      xecUtxos: [],
      slpUtxos: [],
      alpUtxos: [],
      tokenUtxosByProtocol: new Map(), // protocol -> UTXOs[]
      tokenUtxosById: new Map(), // tokenId -> UTXOs[]
      protocolSummary: {
        xec: { count: 0, totalSats: 0 },
        slp: { count: 0, tokenTypes: new Set() },
        alp: { count: 0, tokenTypes: new Set() }
      }
    }

    for (const utxo of utxos) {
      if (!utxo) continue
      try {
        const protocol = this.detectProtocol(utxo)

        switch (protocol) {
          case 'XEC':
            result.xecUtxos.push(utxo)
            this._addToProtocolMap(result.tokenUtxosByProtocol, 'XEC', utxo)
            result.protocolSummary.xec.count++
            result.protocolSummary.xec.totalSats += this._extractSats(utxo)
            break

          case 'SLP':
            result.slpUtxos.push(utxo)
            this._addToProtocolMap(result.tokenUtxosByProtocol, 'SLP', utxo)
            this._addToTokenMap(result.tokenUtxosById, utxo.token.tokenId, utxo)
            result.protocolSummary.slp.count++
            result.protocolSummary.slp.tokenTypes.add(utxo.token.tokenId)
            break

          case 'ALP':
            result.alpUtxos.push(utxo)
            this._addToProtocolMap(result.tokenUtxosByProtocol, 'ALP', utxo)
            this._addToTokenMap(result.tokenUtxosById, utxo.token.tokenId, utxo)
            result.protocolSummary.alp.count++
            result.protocolSummary.alp.tokenTypes.add(utxo.token.tokenId)
            break
        }
      } catch (err) {
        console.warn(`Skipping invalid UTXO: ${err.message}`, utxo)
      }
    }

    return result
  }

  /**
   * Filter UTXOs for a specific token ID
   * @param {Array} utxos - Array of UTXO objects
   * @param {string} tokenId - Token ID to filter for
   * @returns {Object} - XEC and token UTXOs for the specific token
   */
  static filterUtxosForToken (utxos, tokenId) {
    const categorized = this.categorizeUtxos(utxos)
    const tokenUtxos = categorized.tokenUtxosById.get(tokenId) || []

    // Get other UTXOs (not matching the requested tokenId) - includes other tokens AND XEC UTXOs
    const otherUtxos = [...categorized.xecUtxos]
    for (const [id, utxoList] of categorized.tokenUtxosById.entries()) {
      if (id !== tokenId) {
        otherUtxos.push(...utxoList)
      }
    }

    if (tokenUtxos.length === 0) {
      return {
        xecUtxos: categorized.xecUtxos,
        tokenUtxos: [],
        otherUtxos,
        protocol: null,
        tokenSummary: { totalAtoms: 0n, utxoCount: 0 }
      }
    }

    // Detect protocol from first token UTXO
    const protocol = this.detectProtocol(tokenUtxos[0])

    // Calculate token summary
    const tokenSummary = this._calculateTokenSummary(tokenUtxos, protocol)

    return {
      xecUtxos: categorized.xecUtxos,
      tokenUtxos,
      otherUtxos,
      protocol,
      tokenSummary
    }
  }

  /**
   * Get all unique token IDs in wallet with their protocols
   * @param {Array} utxos - Array of UTXO objects
   * @returns {Array} - Array of {tokenId, protocol} objects
   */
  static getTokenInventory (utxos) {
    const tokenMap = new Map()

    for (const utxo of utxos) {
      if (utxo && utxo.token && utxo.token.tokenId) {
        const tokenId = utxo.token.tokenId
        if (!tokenMap.has(tokenId)) {
          try {
            const protocol = this.detectProtocol(utxo)
            tokenMap.set(tokenId, {
              tokenId,
              protocol,
              utxoCount: 1,
              totalAtoms: BigInt(utxo.token.atoms || 0),
              firstSeen: utxo.blockHeight || -1
            })
          } catch (err) {
            console.warn(`Invalid token UTXO: ${err.message}`)
          }
        } else {
          const entry = tokenMap.get(tokenId)
          entry.utxoCount++
          entry.totalAtoms += BigInt(utxo.token.atoms || 0)
        }
      }
    }

    return Array.from(tokenMap.values())
  }

  /**
   * Validate token protocol compatibility
   * @param {string} expectedProtocol - Expected protocol (SLP or ALP)
   * @param {Object} utxo - UTXO to validate
   * @returns {boolean} - True if compatible
   */
  static validateProtocolCompatibility (expectedProtocol, utxo) {
    try {
      const actualProtocol = this.detectProtocol(utxo)
      return actualProtocol === expectedProtocol
    } catch (err) {
      return false
    }
  }

  // Private helper methods

  static _addToProtocolMap (protocolMap, protocol, utxo) {
    if (!protocolMap.has(protocol)) {
      protocolMap.set(protocol, [])
    }
    protocolMap.get(protocol).push(utxo)
  }

  static _addToTokenMap (tokenMap, tokenId, utxo) {
    if (!tokenMap.has(tokenId)) {
      tokenMap.set(tokenId, [])
    }
    tokenMap.get(tokenId).push(utxo)
  }

  static _extractSats (utxo) {
    if (!utxo || typeof utxo !== 'object') {
      return 0
    }

    if (utxo.sats !== undefined) {
      if (typeof utxo.sats === 'bigint') {
        return Number(utxo.sats)
      }
      if (typeof utxo.sats === 'number') {
        return utxo.sats
      }
      const parsed = parseInt(utxo.sats)
      return isNaN(parsed) ? 0 : parsed
    }

    return 0
  }

  static _calculateTokenSummary (tokenUtxos, protocol) {
    let totalAtoms = 0n
    const utxoCount = tokenUtxos.length

    for (const utxo of tokenUtxos) {
      if (utxo.token && utxo.token.atoms) {
        totalAtoms += BigInt(utxo.token.atoms)
      }
    }

    return {
      totalAtoms,
      utxoCount,
      protocol
    }
  }

  /**
   * Check if wallet contains any tokens
   * @param {Array} utxos - Array of UTXO objects
   * @returns {boolean} - True if any tokens found
   */
  static hasTokens (utxos) {
    return utxos.some(utxo => utxo && utxo.token && utxo.token.tokenId)
  }

  /**
   * Check if wallet contains specific protocol tokens
   * @param {Array} utxos - Array of UTXO objects
   * @param {string} protocol - Protocol to check for ('SLP' or 'ALP')
   * @returns {boolean} - True if protocol tokens found
   */
  static hasProtocolTokens (utxos, protocol) {
    return utxos.some(utxo => {
      if (!utxo) return false
      try {
        return this.detectProtocol(utxo) === protocol
      } catch (err) {
        return false
      }
    })
  }

  /**
   * Get protocol statistics for wallet
   * @param {Array} utxos - Array of UTXO objects
   * @returns {Object} - Protocol statistics
   */
  static getProtocolStats (utxos) {
    const categorized = this.categorizeUtxos(utxos)

    // Build protocols array from active protocols
    const protocols = []
    if (categorized.protocolSummary.slp.count > 0) protocols.push('SLP')
    if (categorized.protocolSummary.alp.count > 0) protocols.push('ALP')

    // Calculate total XEC sats from ALL UTXOs (including dust from token UTXOs)
    const totalXecSats = utxos.reduce((sum, utxo) => sum + this._extractSats(utxo), 0)

    return {
      totalUtxos: utxos.length,
      xecUtxos: categorized.protocolSummary.xec.count,
      slpTokens: categorized.protocolSummary.slp.tokenTypes.size,
      slpUtxos: categorized.protocolSummary.slp.count,
      alpTokens: categorized.protocolSummary.alp.tokenTypes.size,
      alpUtxos: categorized.protocolSummary.alp.count,
      totalXecSats,
      hasTokens: this.hasTokens(utxos),
      protocols,
      hasMultipleProtocols: protocols.length > 1
    }
  }
}

module.exports = TokenProtocolDetector
