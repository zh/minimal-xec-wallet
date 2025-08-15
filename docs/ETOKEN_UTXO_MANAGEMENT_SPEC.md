# eToken UTXO Management & Selection Logic Specification

## Overview

This specification defines the UTXO management and selection algorithms for eToken operations in the Minimal XEC Wallet. The design follows proven patterns from the existing XEC operations while addressing the unique requirements of ALP token transactions.

## Core Concepts

### UTXO Types in Token-Enabled Wallets

1. **XEC UTXOs**: Standard eCash UTXOs containing only XEC value
2. **Token UTXOs**: UTXOs containing both XEC (dust) and token data
3. **Mixed Transactions**: Transactions that consume both types for fees and token transfers

### ALP Token UTXO Structure
```javascript
// Standard Chronik UTXO with token data
{
  outpoint: { txid: "abc123...", outIdx: 0 },
  sats: 546,  // Always dust amount for token UTXOs
  token: {
    tokenId: "def456...",           // 32-byte token identifier
    tokenType: {                   // ALP protocol identifier  
      protocol: "ALP",
      type: "ALP_TOKEN_TYPE_STANDARD", 
      number: 0
    },
    atoms: "1000000",              // Token amount in base units (string)
    isMintBaton: false             // Whether this UTXO is a mint baton
  }
}
```

## UTXO Categorization Algorithm

### Primary Categorization Method

```javascript
class TokenUtxoManager {
  /**
   * Categorize UTXOs into XEC and token groups
   * @param {Array} utxos - Raw UTXOs from chronik
   * @param {string} targetTokenId - Optional filter for specific token
   * @returns {Object} Categorized UTXO groups
   */
  categorizeUtxos(utxos, targetTokenId = null) {
    const result = {
      xecUtxos: [],
      tokenUtxos: new Map(), // tokenId -> UTXOs[]
      invalidUtxos: [],      // UTXOs with parsing errors
      totalXecValue: 0,      // Total XEC available for fees
      tokenSummary: new Map() // tokenId -> { totalAtoms, utxoCount }
    }
    
    for (const utxo of utxos) {
      try {
        if (this._isTokenUtxo(utxo)) {
          this._processTokenUtxo(utxo, result)
        } else {
          this._processXecUtxo(utxo, result)
        }
      } catch (err) {
        console.warn(`Invalid UTXO skipped: ${err.message}`, utxo)
        result.invalidUtxos.push({ utxo, error: err.message })
      }
    }
    
    // Filter for specific token if requested
    if (targetTokenId) {
      return this._filterForToken(result, targetTokenId)
    }
    
    return result
  }
  
  _isTokenUtxo(utxo) {
    return utxo.token && 
           utxo.token.tokenType && 
           utxo.token.tokenType.protocol === 'ALP' &&
           !utxo.token.isMintBaton // Exclude mint batons from spending
  }
  
  _processTokenUtxo(utxo, result) {
    const tokenId = utxo.token.tokenId
    
    // Validate token data
    if (!tokenId || !utxo.token.atoms) {
      throw new Error('Invalid token UTXO: missing tokenId or atoms')
    }
    
    // Initialize token group if needed
    if (!result.tokenUtxos.has(tokenId)) {
      result.tokenUtxos.set(tokenId, [])
      result.tokenSummary.set(tokenId, { totalAtoms: 0n, utxoCount: 0 })
    }
    
    // Add to token group
    result.tokenUtxos.get(tokenId).push(utxo)
    
    // Update summary
    const summary = result.tokenSummary.get(tokenId)
    summary.totalAtoms += BigInt(utxo.token.atoms)
    summary.utxoCount++
  }
  
  _processXecUtxo(utxo, result) {
    // Validate XEC UTXO
    if (!utxo.sats || utxo.sats <= 0) {
      throw new Error('Invalid XEC UTXO: missing or zero sats value')
    }
    
    result.xecUtxos.push(utxo)
    result.totalXecValue += typeof utxo.sats === 'bigint' 
      ? Number(utxo.sats) 
      : utxo.sats
  }
  
  _filterForToken(result, targetTokenId) {
    return {
      xecUtxos: result.xecUtxos,
      tokenUtxos: result.tokenUtxos.get(targetTokenId) || [],
      totalXecValue: result.totalXecValue,
      targetTokenSummary: result.tokenSummary.get(targetTokenId) || 
        { totalAtoms: 0n, utxoCount: 0 }
    }
  }
}
```

## Token Balance Calculation

### Atoms to Display Units Conversion

```javascript
class TokenBalanceCalculator {
  /**
   * Convert token atoms to display units with proper decimal handling
   * @param {bigint|string|number} atoms - Token amount in base units
   * @param {number} decimals - Token decimal places (0-8)
   * @returns {number} Display amount with proper precision
   */
  atomsToDisplayUnits(atoms, decimals) {
    // Validate inputs
    if (decimals < 0 || decimals > 8) {
      throw new Error('Invalid decimal places: must be 0-8')
    }
    
    const atomsBigInt = typeof atoms === 'bigint' ? atoms : BigInt(atoms)
    
    if (atomsBigInt < 0n) {
      throw new Error('Invalid atoms: cannot be negative')
    }
    
    // Handle zero decimals (integer tokens)
    if (decimals === 0) {
      return Number(atomsBigInt)
    }
    
    // Convert with decimal precision
    const divisor = BigInt(Math.pow(10, decimals))
    const wholePart = atomsBigInt / divisor
    const fractionalPart = atomsBigInt % divisor
    
    // Combine parts with proper precision
    const result = Number(wholePart) + (Number(fractionalPart) / Math.pow(10, decimals))
    
    // Round to avoid floating point precision issues
    return Math.round(result * Math.pow(10, decimals)) / Math.pow(10, decimals)
  }
  
  /**
   * Convert display units to atoms for transaction building
   * @param {number} displayAmount - Amount in display units  
   * @param {number} decimals - Token decimal places
   * @returns {bigint} Atoms for transaction
   */
  displayUnitsToAtoms(displayAmount, decimals) {
    if (displayAmount < 0) {
      throw new Error('Invalid amount: cannot be negative')
    }
    
    if (decimals === 0) {
      // Integer tokens - validate no decimal places
      if (!Number.isInteger(displayAmount)) {
        throw new Error('Invalid amount: token does not support decimal places')
      }
      return BigInt(displayAmount)
    }
    
    // Multiply by 10^decimals and round to avoid floating point issues
    const atoms = Math.round(displayAmount * Math.pow(10, decimals))
    return BigInt(atoms)
  }
  
  /**
   * Calculate total token balance for an address
   * @param {Array} tokenUtxos - UTXOs for specific token
   * @param {Object} tokenInfo - Token metadata with decimals
   * @returns {Object} Balance information
   */
  calculateTokenBalance(tokenUtxos, tokenInfo) {
    let totalAtoms = 0n
    let confirmedAtoms = 0n
    let unconfirmedAtoms = 0n
    
    for (const utxo of tokenUtxos) {
      const atoms = BigInt(utxo.token.atoms)
      totalAtoms += atoms
      
      // Note: chronik doesn't provide block height for UTXOs in current API
      // For now, treat all as confirmed. Future enhancement: check confirmations
      confirmedAtoms += atoms
    }
    
    return {
      tokenId: tokenInfo.tokenId,
      ticker: tokenInfo.genesisInfo.tokenTicker,
      name: tokenInfo.genesisInfo.tokenName,
      decimals: tokenInfo.genesisInfo.decimals,
      atoms: {
        total: totalAtoms,
        confirmed: confirmedAtoms,
        unconfirmed: unconfirmedAtoms
      },
      balance: {
        total: this.atomsToDisplayUnits(totalAtoms, tokenInfo.genesisInfo.decimals),
        confirmed: this.atomsToDisplayUnits(confirmedAtoms, tokenInfo.genesisInfo.decimals),
        unconfirmed: this.atomsToDisplayUnits(unconfirmedAtoms, tokenInfo.genesisInfo.decimals)
      },
      utxoCount: tokenUtxos.length
    }
  }
}
```

## UTXO Selection Algorithms

### Token Send UTXO Selection

```javascript
class TokenUtxoSelector {
  /**
   * Select optimal UTXOs for token send transaction
   * @param {Array} tokenUtxos - Available token UTXOs
   * @param {Array} outputs - Desired outputs with atoms amounts
   * @param {Object} options - Selection preferences
   * @returns {Object} Selection result with UTXOs and change
   */
  selectForTokenSend(tokenUtxos, outputs, options = {}) {
    // Calculate total atoms needed
    const totalAtomsNeeded = outputs.reduce(
      (sum, output) => sum + BigInt(output.atoms), 0n
    )
    
    if (totalAtomsNeeded <= 0n) {
      throw new Error('Invalid send amount: must be positive')
    }
    
    // Validate UTXO availability
    const totalAvailable = tokenUtxos.reduce(
      (sum, utxo) => sum + BigInt(utxo.token.atoms), 0n
    )
    
    if (totalAvailable < totalAtomsNeeded) {
      throw new Error(
        `Insufficient token balance. Need: ${totalAtomsNeeded}, Available: ${totalAvailable}`
      )
    }
    
    // Apply selection strategy
    const strategy = options.strategy || 'optimal'
    
    switch (strategy) {
      case 'largest_first':
        return this._selectLargestFirst(tokenUtxos, totalAtomsNeeded)
      case 'smallest_first':
        return this._selectSmallestFirst(tokenUtxos, totalAtomsNeeded)
      case 'consolidating':
        return this._selectConsolidating(tokenUtxos, totalAtomsNeeded)
      default:
        return this._selectOptimal(tokenUtxos, totalAtomsNeeded)
    }
  }
  
  _selectOptimal(tokenUtxos, totalNeeded) {
    // Sort UTXOs by value (largest first for efficiency)
    const sortedUtxos = tokenUtxos
      .slice()
      .sort((a, b) => {
        const aAtoms = BigInt(a.token.atoms)
        const bAtoms = BigInt(b.token.atoms)
        return aAtoms > bAtoms ? -1 : aAtoms < bAtoms ? 1 : 0
      })
    
    const selectedUtxos = []
    let totalSelected = 0n
    
    // Greedy selection starting with largest UTXOs
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo)
      totalSelected += BigInt(utxo.token.atoms)
      
      if (totalSelected >= totalNeeded) {
        break
      }
    }
    
    const change = totalSelected - totalNeeded
    
    return {
      selectedUtxos,
      totalSelected,
      change,
      inputCount: selectedUtxos.length
    }
  }
  
  _selectLargestFirst(tokenUtxos, totalNeeded) {
    // Start with largest UTXO and work down
    const sorted = tokenUtxos
      .slice()
      .sort((a, b) => BigInt(b.token.atoms) - BigInt(a.token.atoms))
    
    return this._greedySelect(sorted, totalNeeded)
  }
  
  _selectSmallestFirst(tokenUtxos, totalNeeded) {
    // Start with smallest UTXOs (good for reducing UTXO count)
    const sorted = tokenUtxos
      .slice()
      .sort((a, b) => BigInt(a.token.atoms) - BigInt(b.token.atoms))
    
    return this._greedySelect(sorted, totalNeeded)
  }
  
  _selectConsolidating(tokenUtxos, totalNeeded) {
    // Select all UTXOs to consolidate (when practical)
    const totalAvailable = tokenUtxos.reduce(
      (sum, utxo) => sum + BigInt(utxo.token.atoms), 0n
    )
    
    // Only consolidate if we have many small UTXOs
    if (tokenUtxos.length >= 10 && totalAvailable < totalNeeded * 3n) {
      return {
        selectedUtxos: tokenUtxos,
        totalSelected: totalAvailable,
        change: totalAvailable - totalNeeded,
        inputCount: tokenUtxos.length
      }
    }
    
    // Otherwise use optimal selection
    return this._selectOptimal(tokenUtxos, totalNeeded)
  }
  
  _greedySelect(sortedUtxos, totalNeeded) {
    const selectedUtxos = []
    let totalSelected = 0n
    
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo)
      totalSelected += BigInt(utxo.token.atoms)
      
      if (totalSelected >= totalNeeded) {
        break
      }
    }
    
    return {
      selectedUtxos,
      totalSelected,
      change: totalSelected - totalNeeded,
      inputCount: selectedUtxos.length
    }
  }
}
```

### XEC Fee UTXO Selection

```javascript
class FeeUtxoSelector {
  /**
   * Select XEC UTXOs for transaction fees
   * @param {Array} xecUtxos - Available XEC UTXOs
   * @param {number} estimatedFee - Required fee in satoshis
   * @param {Object} options - Selection options
   * @returns {Object} Selected UTXOs for fees
   */
  selectForFees(xecUtxos, estimatedFee, options = {}) {
    if (estimatedFee <= 0) {
      throw new Error('Invalid fee: must be positive')
    }
    
    // Filter UTXOs above dust limit (avoid spending dust for fees)
    const dustLimit = options.dustLimit || 546
    const usableUtxos = xecUtxos.filter(utxo => {
      const sats = typeof utxo.sats === 'bigint' ? Number(utxo.sats) : utxo.sats
      return sats > dustLimit
    })
    
    if (usableUtxos.length === 0) {
      throw new Error('No usable XEC UTXOs available for fees')
    }
    
    // Calculate total available
    const totalAvailable = usableUtxos.reduce((sum, utxo) => {
      const sats = typeof utxo.sats === 'bigint' ? Number(utxo.sats) : utxo.sats
      return sum + sats
    }, 0)
    
    if (totalAvailable < estimatedFee) {
      throw new Error(
        `Insufficient XEC for fees. Need: ${estimatedFee} sats, Available: ${totalAvailable} sats`
      )
    }
    
    // Use similar strategy as XEC operations
    return this._selectMinimalForFee(usableUtxos, estimatedFee)
  }
  
  _selectMinimalForFee(xecUtxos, requiredFee) {
    // Sort by value (largest first for minimal inputs)
    const sorted = xecUtxos
      .slice()
      .sort((a, b) => {
        const aSats = typeof a.sats === 'bigint' ? Number(a.sats) : a.sats
        const bSats = typeof b.sats === 'bigint' ? Number(b.sats) : b.sats
        return bSats - aSats
      })
    
    const selectedUtxos = []
    let totalSelected = 0
    
    for (const utxo of sorted) {
      selectedUtxos.push(utxo)
      const sats = typeof utxo.sats === 'bigint' ? Number(utxo.sats) : utxo.sats
      totalSelected += sats
      
      if (totalSelected >= requiredFee) {
        break
      }
    }
    
    return {
      selectedUtxos,
      totalSelected,
      feeOverpayment: totalSelected - requiredFee,
      inputCount: selectedUtxos.length
    }
  }
}
```

## Fee Estimation for Token Transactions

### Transaction Size Calculation

```javascript
class TokenFeeEstimator {
  /**
   * Estimate fee for token transaction
   * @param {number} tokenInputCount - Number of token UTXOs to spend
   * @param {number} xecInputCount - Number of XEC UTXOs for fees
   * @param {number} outputCount - Number of outputs (including OP_RETURN)
   * @param {number} satsPerByte - Fee rate
   * @returns {number} Estimated fee in satoshis
   */
  estimateTokenTxFee(tokenInputCount, xecInputCount, outputCount, satsPerByte = 1.2) {
    // ALP transaction components:
    // - Standard inputs (148 bytes each)
    // - OP_RETURN output (~50-200 bytes depending on data)
    // - P2PKH outputs (34 bytes each)
    // - Transaction overhead (10 bytes)
    
    const inputSize = (tokenInputCount + xecInputCount) * 148
    const opReturnSize = this._estimateOpReturnSize(outputCount - 1) // -1 for OP_RETURN itself
    const outputSize = (outputCount - 1) * 34 // Regular outputs (excluding OP_RETURN)
    const overheadSize = 10
    
    const totalSize = inputSize + opReturnSize + outputSize + overheadSize
    
    return Math.ceil(totalSize * satsPerByte)
  }
  
  _estimateOpReturnSize(tokenOutputCount) {
    // ALP OP_RETURN structure:
    // - OP_RETURN (1 byte)
    // - Push data length (1-3 bytes)
    // - LOKAD ID "SLP2" (4 bytes)  
    // - Token type (1 byte)
    // - Token ID (32 bytes)
    // - Output amounts (8 bytes each)
    
    const baseSize = 1 + 2 + 4 + 1 + 32 // OP_RETURN + length + LOKAD + type + tokenId
    const amountsSize = tokenOutputCount * 8 // 8 bytes per amount (48-bit + padding)
    
    return baseSize + amountsSize
  }
  
  /**
   * Calculate optimal fee with buffer for network conditions
   * @param {Object} txParams - Transaction parameters
   * @param {Object} options - Fee calculation options
   * @returns {number} Recommended fee in satoshis
   */
  calculateOptimalFee(txParams, options = {}) {
    const baseFee = this.estimateTokenTxFee(
      txParams.tokenInputCount,
      txParams.xecInputCount, 
      txParams.outputCount,
      txParams.satsPerByte
    )
    
    // Add buffer for network congestion
    const feeBuffer = options.feeBuffer || 1.1 // 10% buffer
    const bufferedFee = Math.ceil(baseFee * feeBuffer)
    
    // Ensure minimum fee (1 sat/byte minimum)
    const minFee = (txParams.tokenInputCount + txParams.xecInputCount) * 148 + 
                   txParams.outputCount * 34 + 10
    
    return Math.max(bufferedFee, minFee)
  }
}
```

## Change Handling Strategy

### Token and XEC Change Management

```javascript
class ChangeManager {
  /**
   * Calculate change outputs for token transaction
   * @param {Object} selectionResult - UTXO selection results
   * @param {string} changeAddress - Address for change outputs
   * @param {Object} tokenInfo - Token metadata
   * @returns {Array} Change outputs to add to transaction
   */
  calculateTokenChange(selectionResult, changeAddress, tokenInfo) {
    const changeOutputs = []
    
    // Handle token change
    if (selectionResult.tokenChange > 0n) {
      changeOutputs.push({
        address: changeAddress,
        atoms: selectionResult.tokenChange,
        amount: this._atomsToDisplay(selectionResult.tokenChange, tokenInfo.decimals),
        tokenId: tokenInfo.tokenId
      })
    }
    
    // Handle XEC change (automatic via ecash-lib TxBuilder)
    // No explicit XEC change output needed - handled by TxBuilder.sign()
    
    return changeOutputs
  }
  
  /**
   * Validate change amounts meet dust requirements
   * @param {Array} changeOutputs - Proposed change outputs
   * @param {number} dustLimit - Minimum output value
   * @returns {Array} Validated change outputs
   */
  validateChangeOutputs(changeOutputs, dustLimit = 546) {
    return changeOutputs.filter(output => {
      // Token outputs always require dust amount in XEC
      // The token amount itself can be any positive value
      return output.atoms > 0n
    })
  }
  
  _atomsToDisplay(atoms, decimals) {
    if (decimals === 0) return Number(atoms)
    return Number(atoms) / Math.pow(10, decimals)
  }
}
```

## Integration with Existing UTXO Store

### Enhanced UTXO Management

```javascript
// Enhancement to existing lib/utxos.js
class EnhancedUtxos extends Utxos {
  async initUtxoStore(addr, forceRefresh = false) {
    // Call parent method for base functionality
    await super.initUtxoStore(addr, forceRefresh)
    
    // Add token-specific processing
    await this._processTokenUtxos()
  }
  
  async _processTokenUtxos() {
    if (!this.utxoStore || !this.utxoStore.xecUtxos) {
      return
    }
    
    // Categorize UTXOs using new token manager
    const tokenManager = new TokenUtxoManager()
    const categorized = tokenManager.categorizeUtxos(this.utxoStore.xecUtxos)
    
    // Update store with categorized data
    this.utxoStore.tokenUtxos = categorized.tokenUtxos
    this.utxoStore.pureXecUtxos = categorized.xecUtxos
    this.utxoStore.tokenSummary = categorized.tokenSummary
    
    // Cache token metadata
    await this._cacheTokenMetadata(Array.from(categorized.tokenUtxos.keys()))
  }
  
  async _cacheTokenMetadata(tokenIds) {
    if (!this.tokenMetadataCache) {
      this.tokenMetadataCache = new Map()
    }
    
    for (const tokenId of tokenIds) {
      if (!this.tokenMetadataCache.has(tokenId)) {
        try {
          const tokenInfo = await this.ar.chronik.token(tokenId)
          this.tokenMetadataCache.set(tokenId, tokenInfo)
        } catch (err) {
          console.warn(`Failed to fetch metadata for token ${tokenId}:`, err.message)
        }
      }
    }
  }
  
  getTokenUtxos(tokenId = null) {
    if (!this.utxoStore || !this.utxoStore.tokenUtxos) {
      return tokenId ? [] : new Map()
    }
    
    return tokenId 
      ? this.utxoStore.tokenUtxos.get(tokenId) || []
      : this.utxoStore.tokenUtxos
  }
  
  getXecUtxos() {
    return this.utxoStore?.pureXecUtxos || []
  }
  
  getTokenMetadata(tokenId) {
    return this.tokenMetadataCache?.get(tokenId) || null
  }
}
```

## Error Handling & Edge Cases

### Common Error Scenarios

```javascript
const TOKEN_UTXO_ERRORS = {
  INSUFFICIENT_TOKEN_BALANCE: {
    code: 'INSUFFICIENT_TOKEN_BALANCE',
    message: 'Not enough tokens available for this transaction',
    recovery: 'Check token balance and reduce send amount'
  },
  
  INSUFFICIENT_XEC_FOR_FEES: {
    code: 'INSUFFICIENT_XEC_FOR_FEES', 
    message: 'Not enough XEC available to pay transaction fees',
    recovery: 'Add XEC to wallet or reduce transaction complexity'
  },
  
  TOO_MANY_TOKEN_INPUTS: {
    code: 'TOO_MANY_TOKEN_INPUTS',
    message: 'Transaction requires too many inputs (mempool limit exceeded)',
    recovery: 'Consolidate token UTXOs first or reduce send amount'
  },
  
  INVALID_TOKEN_UTXO: {
    code: 'INVALID_TOKEN_UTXO',
    message: 'Token UTXO contains invalid or corrupted data',
    recovery: 'Refresh UTXO cache and try again'
  },
  
  TOKEN_PRECISION_ERROR: {
    code: 'TOKEN_PRECISION_ERROR',
    message: 'Send amount exceeds token decimal precision',
    recovery: 'Adjust amount to match token decimal places'
  }
}
```

## Performance Considerations

### Optimization Strategies

1. **UTXO Caching**: Cache token metadata to avoid repeated chronik calls
2. **Lazy Loading**: Only fetch token info when needed for transactions  
3. **Efficient Sorting**: Use stable sort algorithms for UTXO selection
4. **Memory Management**: Limit UTXO cache size, implement LRU eviction
5. **Batch Operations**: Group multiple token operations when possible

### Memory Usage Guidelines

- Target: <10MB additional memory for token operations
- Cache: Maximum 100 token metadata entries
- UTXOs: Process in batches of 1000 for large wallets
- Selection: Use streaming algorithms for very large UTXO sets

## Testing Strategy

### Unit Test Coverage

1. **UTXO Categorization** (95% coverage target)
   - Valid ALP token UTXOs
   - Mixed UTXO sets
   - Invalid/corrupted token data
   - Edge cases (empty sets, single UTXO)

2. **Balance Calculation** (95% coverage target)
   - Various decimal places (0-8)
   - Large token amounts
   - Precision edge cases
   - Atoms/display conversion accuracy

3. **UTXO Selection** (90% coverage target)
   - Different selection strategies
   - Insufficient balance scenarios
   - Optimal vs suboptimal selections
   - Fee calculation accuracy

### Integration Test Scenarios

1. **End-to-End Token Sending**
   - Send to single recipient
   - Send to multiple recipients  
   - Handle change correctly
   - Fee estimation accuracy

2. **Edge Case Handling**
   - Very small token amounts
   - Very large token amounts
   - Maximum output count (19 outputs)
   - Minimum fee transactions

3. **Error Recovery**
   - Network failures during metadata fetch
   - Invalid UTXO data from chronik
   - Insufficient funds scenarios
   - Malformed transaction recovery

This comprehensive specification provides the foundation for implementing robust and efficient eToken UTXO management that integrates seamlessly with the existing XEC wallet architecture.