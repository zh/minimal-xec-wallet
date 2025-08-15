/*
  Hybrid Token Manager - Coordinates SLP and ALP token operations
  Provides unified interface for both protocols
*/

const TokenProtocolDetector = require('./token-protocol-detector')
const SLPTokenHandler = require('./slp-token-handler')
const ALPTokenHandler = require('./alp-token-handler')

class HybridTokenManager {
  constructor (localConfig = {}) {
    this.chronik = localConfig.chronik
    this.ar = localConfig.ar

    if (!this.chronik) {
      throw new Error('Chronik client required for token operations')
    }

    if (!this.ar) {
      throw new Error('AdapterRouter required for token operations')
    }

    // Initialize protocol handlers
    this.slpHandler = new SLPTokenHandler(localConfig)
    this.alpHandler = new ALPTokenHandler(localConfig)

    // Cache for token metadata
    this.tokenMetadataCache = new Map()
  }

  async sendTokens (tokenId, outputs, walletInfo, utxos, satsPerByte = 1.2) {
    try {
      // Detect protocol for this token
      const protocol = await this._detectTokenProtocol(tokenId, utxos)

      // Route to appropriate handler
      switch (protocol) {
        case 'SLP':
          return await this.slpHandler.sendTokens(tokenId, outputs, walletInfo, utxos, satsPerByte)
        case 'ALP':
          return await this.alpHandler.sendTokens(tokenId, outputs, walletInfo, utxos, satsPerByte)
        default:
          throw new Error(`Unsupported token protocol: ${protocol}`)
      }
    } catch (err) {
      throw new Error(`Token send failed: ${err.message}`)
    }
  }

  async burnTokens (tokenId, amount, walletInfo, utxos, satsPerByte = 1.2) {
    try {
      // Detect protocol for this token
      const protocol = await this._detectTokenProtocol(tokenId, utxos)

      // Route to appropriate handler
      switch (protocol) {
        case 'SLP':
          return await this.slpHandler.burnTokens(tokenId, amount, walletInfo, utxos, satsPerByte)
        case 'ALP':
          return await this.alpHandler.burnTokens(tokenId, amount, walletInfo, utxos, satsPerByte)
        default:
          throw new Error(`Unsupported token protocol: ${protocol}`)
      }
    } catch (err) {
      throw new Error(`Token burn failed: ${err.message}`)
    }
  }

  async burnAllTokens (tokenId, walletInfo, utxos) {
    try {
      // Get token metadata and calculate total balance
      const tokenInfo = await this._getTokenInfo(tokenId)
      const filtered = TokenProtocolDetector.filterUtxosForToken(utxos, tokenId)

      if (filtered.tokenUtxos.length === 0) {
        throw new Error(`No ${tokenInfo.genesisInfo.tokenTicker} tokens found to burn`)
      }

      // Calculate total balance in display units
      const totalAtoms = filtered.tokenSummary.totalAtoms
      const displayAmount = this._atomsToDisplay(totalAtoms, tokenInfo.genesisInfo.decimals)

      // Burn all tokens
      return await this.burnTokens(tokenId, displayAmount, walletInfo, utxos)
    } catch (err) {
      throw new Error(`Burn all tokens failed: ${err.message}`)
    }
  }

  async listTokensFromAddress (address) {
    try {
      // Get UTXOs for the address using the adapter router
      const utxoData = await this.ar.getUtxos(address)
      const utxos = utxoData.utxos || []

      // Use the existing listTokensFromUtxos method
      return await this.listTokensFromUtxos(utxos)
    } catch (err) {
      throw new Error(`List tokens failed: ${err.message}`)
    }
  }

  async listTokensFromUtxos (utxos) {
    try {
      const inventory = TokenProtocolDetector.getTokenInventory(utxos)
      const tokens = []

      for (const tokenEntry of inventory) {
        try {
          const tokenInfo = await this._getTokenInfo(tokenEntry.tokenId)
          const filtered = TokenProtocolDetector.filterUtxosForToken(utxos, tokenEntry.tokenId)

          // Calculate balance based on protocol
          const displayBalance = this._atomsToDisplay(
            filtered.tokenSummary.totalAtoms,
            tokenInfo.genesisInfo.decimals
          )

          tokens.push({
            tokenId: tokenEntry.tokenId,
            protocol: tokenEntry.protocol,
            ticker: tokenInfo.genesisInfo.tokenTicker,
            name: tokenInfo.genesisInfo.tokenName,
            decimals: tokenInfo.genesisInfo.decimals,
            url: tokenInfo.genesisInfo.url,
            balance: {
              display: displayBalance,
              atoms: filtered.tokenSummary.totalAtoms
            },
            utxoCount: filtered.tokenSummary.utxoCount,
            utxos: filtered.tokenUtxos
          })
        } catch (err) {
          console.warn(`Failed to process token ${tokenEntry.tokenId}: ${err.message}`)
        }
      }

      return tokens
    } catch (err) {
      throw new Error(`List tokens from UTXOs failed: ${err.message}`)
    }
  }

  async getTokenBalance (tokenId, utxos) {
    try {
      const filtered = TokenProtocolDetector.filterUtxosForToken(utxos, tokenId)

      if (filtered.tokenUtxos.length === 0) {
        // Try to get token info, but handle case where token doesn't exist
        try {
          const tokenInfo = await this._getTokenInfo(tokenId)
          return {
            tokenId,
            protocol: tokenInfo.tokenType.protocol,
            ticker: tokenInfo.genesisInfo.tokenTicker,
            name: tokenInfo.genesisInfo.tokenName,
            decimals: tokenInfo.genesisInfo.decimals,
            balance: {
              display: 0,
              atoms: 0n
            },
            utxoCount: 0
          }
        } catch (err) {
          // Token doesn't exist, return minimal info
          return {
            tokenId,
            protocol: 'UNKNOWN',
            ticker: 'UNKNOWN',
            name: 'Unknown Token',
            decimals: 0,
            balance: {
              display: 0,
              atoms: 0n
            },
            utxoCount: 0
          }
        }
      }

      const tokenInfo = await this._getTokenInfo(tokenId)

      const displayBalance = this._atomsToDisplay(
        filtered.tokenSummary.totalAtoms,
        tokenInfo.genesisInfo.decimals
      )

      return {
        tokenId,
        protocol: filtered.protocol,
        ticker: tokenInfo.genesisInfo.tokenTicker,
        name: tokenInfo.genesisInfo.tokenName,
        decimals: tokenInfo.genesisInfo.decimals,
        balance: {
          display: displayBalance,
          atoms: filtered.tokenSummary.totalAtoms
        },
        utxoCount: filtered.tokenSummary.utxoCount
      }
    } catch (err) {
      throw new Error(`Get token balance failed: ${err.message}`)
    }
  }

  async getTokenData (tokenId, withTxHistory = false, sortOrder = 'DESCENDING') {
    try {
      // Get basic token metadata
      const tokenInfo = await this._getTokenInfo(tokenId)

      const result = {
        tokenId,
        protocol: tokenInfo.tokenType.protocol,
        type: tokenInfo.tokenType.type,
        ticker: tokenInfo.genesisInfo.tokenTicker,
        name: tokenInfo.genesisInfo.tokenName,
        decimals: tokenInfo.genesisInfo.decimals,
        url: tokenInfo.genesisInfo.url,
        data: tokenInfo.genesisInfo.data,
        authPubkey: tokenInfo.genesisInfo.authPubkey,
        timeFirstSeen: tokenInfo.timeFirstSeen
      }

      // Add transaction history if requested
      if (withTxHistory) {
        // This would require additional chronik calls
        // For now, just note that it's not implemented
        result.txHistory = 'Transaction history not implemented yet'
      }

      return result
    } catch (err) {
      throw new Error(`Get token data failed: ${err.message}`)
    }
  }

  // Utility methods

  getProtocolStats (utxos) {
    return TokenProtocolDetector.getProtocolStats(utxos)
  }

  hasTokens (utxos) {
    return TokenProtocolDetector.hasTokens(utxos)
  }

  hasProtocolTokens (utxos, protocol) {
    return TokenProtocolDetector.hasProtocolTokens(utxos, protocol)
  }

  categorizeUtxos (utxos) {
    return TokenProtocolDetector.categorizeUtxos(utxos)
  }

  // Private helper methods

  async _detectTokenProtocol (tokenId, utxos) {
    // First try to detect from UTXOs
    const tokenUtxo = utxos.find(utxo =>
      utxo.token && utxo.token.tokenId === tokenId
    )

    if (tokenUtxo) {
      return TokenProtocolDetector.detectProtocol(tokenUtxo)
    }

    // Fallback to metadata lookup
    try {
      const tokenInfo = await this._getTokenInfo(tokenId)
      return TokenProtocolDetector.detectProtocolFromMetadata(tokenInfo)
    } catch (err) {
      throw new Error(`Cannot determine protocol for token ${tokenId}: ${err.message}`)
    }
  }

  async _getTokenInfo (tokenId) {
    // Check cache first
    if (this.tokenMetadataCache.has(tokenId)) {
      return this.tokenMetadataCache.get(tokenId)
    }

    // Fetch from chronik
    try {
      const tokenInfo = await this.chronik.token(tokenId)
      this.tokenMetadataCache.set(tokenId, tokenInfo)
      return tokenInfo
    } catch (err) {
      throw new Error(`Failed to fetch token metadata: ${err.message}`)
    }
  }

  _atomsToDisplay (atoms, decimals) {
    if (decimals === 0) {
      return Number(atoms)
    }

    return Number(atoms) / Math.pow(10, decimals)
  }

  _displayToAtoms (displayAmount, decimals) {
    if (decimals === 0) {
      return BigInt(Math.floor(displayAmount))
    }

    const atoms = Math.floor(displayAmount * Math.pow(10, decimals))
    return BigInt(atoms)
  }

  // Clear metadata cache
  clearCache () {
    this.tokenMetadataCache.clear()
  }

  // Get cache statistics
  getCacheStats () {
    return {
      cachedTokens: this.tokenMetadataCache.size,
      tokenIds: Array.from(this.tokenMetadataCache.keys())
    }
  }
}

module.exports = HybridTokenManager
