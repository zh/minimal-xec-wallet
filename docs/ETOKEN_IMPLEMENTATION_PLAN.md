# eToken Implementation Plan for Minimal XEC Wallet

## Executive Summary

This document outlines the implementation plan for eToken (ALP protocol) support in the Minimal XEC Wallet following MVP principles. The implementation will leverage ecash-lib v4.3.1+ native ALP support and mirror the proven patterns established in the XEC operations.

## Research Foundation

### ALP Protocol Core Concepts
- **Protocol**: A Ledger Protocol (ALP) - eCash's native token standard
- **LOKAD ID**: "SLP2" (`[0x53, 0x4c, 0x50, 0x32]`)
- **Script Format**: eMPP (extendable Multi-Push Protocol) in OP_RETURN
- **Token Amounts**: 48-bit unsigned integers ("atoms" - base units)
- **Dust Requirement**: 546 satoshis per token output

### Transaction Types (MVP Scope)
1. **SEND** - Transfer tokens between addresses (Priority 1)
2. **BURN** - Destroy tokens (Priority 2)  
3. **GENESIS** - Create new tokens (Priority 3 - Optional)

## Architecture Design

### File Structure
```
lib/
├── tokens.js              # Main eToken operations (enhance existing)
├── adapters/
│   └── router.js          # Add token-specific methods (enhance existing)
├── send-xec.js            # Reference implementation for patterns
└── op-return.js           # Reference implementation for script building
```

### Class Integration
```javascript
// Enhanced MinimalXECWallet class methods:
- sendETokens(output, satsPerByte, opts)      // Send tokens to recipients
- burnETokens(qty, tokenId, satsPerByte)      // Burn specific amount
- listETokens(xecAddress)                     // List held tokens
- getETokenBalance(inObj)                     // Get token balance
- getETokenData(tokenId)                      // Get token metadata
- burnAllETokens(tokenId)                     // Burn all tokens of type
```

## Implementation Strategy

### Phase 1: Core Token Infrastructure (Week 1)
**Goal**: Establish token UTXO management and basic transaction building

**Key Components**:
1. **Enhanced Tokens Class** (`lib/tokens.js`)
   - Token UTXO filtering and selection
   - Balance calculation with atoms/decimals
   - Token metadata caching

2. **Enhanced AdapterRouter** (`lib/adapters/router.js`)
   - chronik.token() integration for metadata
   - Enhanced UTXO fetching with token data
   - Token validation methods

**Success Criteria**:
- Can identify token UTXOs from wallet UTXOs
- Can calculate token balances correctly
- Can fetch token metadata from chronik

### Phase 2: Token Send Operations (Week 2)
**Goal**: Implement core token transfer functionality

**Key Components**:
1. **ALP Send Transaction Builder**
   - Input: Token outputs with amounts in display units
   - Process: Convert to atoms, select UTXOs, build ALP script
   - Output: Signed transaction hex ready for broadcast

2. **UTXO Selection Logic**
   - Separate token UTXOs by tokenId
   - Calculate total available atoms
   - Select sufficient UTXOs for transfer + fees

**Success Criteria**:
- Can send tokens to single recipient
- Can send tokens to multiple recipients (up to 19 outputs per mempool rules)
- Proper change handling for both XEC and tokens

### Phase 3: Token Burn Operations (Week 3)
**Goal**: Implement token destruction functionality

**Key Components**:
1. **ALP Burn Transaction Builder**
   - Selective burn (specific amount)
   - Complete burn (all tokens of type)

**Success Criteria**:
- Can burn specific token amounts
- Can burn all tokens of a specific type
- Proper fee handling and remaining balance management

### Phase 4: Testing & Examples (Week 4)
**Goal**: Comprehensive test coverage and usage examples

**Key Components**:
1. **Test Suite** (matching XEC test quality)
2. **Example Scripts** (matching XEC example patterns)
3. **Documentation Updates**

## Technical Specifications

### Token Transaction Building Pattern

```javascript
// Based on send-xec.js proven patterns
class TokenTxBuilder {
  async buildSendTx(tokenId, outputs, walletInfo, utxos, satsPerByte) {
    // 1. Separate UTXOs by type
    const { tokenUtxos, xecUtxos } = this._categorizeUtxos(utxos, tokenId)
    
    // 2. Convert display amounts to atoms
    const atomOutputs = outputs.map(out => ({
      ...out,
      atoms: this._convertToAtoms(out.amount, tokenInfo.decimals)
    }))
    
    // 3. Select token UTXOs
    const selectedTokenUtxos = this._selectTokenUtxos(tokenUtxos, atomOutputs)
    
    // 4. Select XEC UTXOs for fees
    const selectedXecUtxos = this._selectXecUtxos(xecUtxos, estimatedFee)
    
    // 5. Build ALP script using ecash-lib
    const alpScript = emppScript([
      alpSend(tokenId, ALP_STANDARD, atomOutputs.map(o => o.atoms))
    ])
    
    // 6. Build transaction (same pattern as send-xec.js)
    const txBuilder = new TxBuilder({
      inputs: [...this._buildTokenInputs(selectedTokenUtxos), 
               ...this._buildXecInputs(selectedXecUtxos)],
      outputs: [
        { sats: 0n, script: alpScript },                    // ALP OP_RETURN
        ...atomOutputs.map(o => this._buildTokenOutput(o)), // Token outputs
        this._buildChangeOutput(walletInfo.xecAddress)      // Auto change
      ]
    })
    
    return txBuilder.sign({ feePerKb: 1000n, dustSats: 546n })
  }
}
```

### UTXO Management Strategy

```javascript
// Enhanced UTXO categorization
class TokenUtxoManager {
  categorizeUtxos(utxos, targetTokenId = null) {
    const categorized = {
      xecUtxos: [],
      tokenUtxos: new Map() // tokenId -> UTXOs[]
    }
    
    for (const utxo of utxos) {
      if (!utxo.token) {
        categorized.xecUtxos.push(utxo)
      } else if (utxo.token.tokenType.protocol === 'ALP') {
        const tokenId = utxo.token.tokenId
        if (!categorized.tokenUtxos.has(tokenId)) {
          categorized.tokenUtxos.set(tokenId, [])
        }
        categorized.tokenUtxos.get(tokenId).push(utxo)
      }
    }
    
    return targetTokenId 
      ? { 
          xecUtxos: categorized.xecUtxos,
          tokenUtxos: categorized.tokenUtxos.get(targetTokenId) || []
        }
      : categorized
  }
  
  calculateTokenBalance(utxos, tokenId, decimals) {
    const tokenUtxos = utxos.filter(u => 
      u.token?.tokenId === tokenId && 
      u.token?.tokenType?.protocol === 'ALP'
    )
    
    const totalAtoms = tokenUtxos.reduce(
      (sum, utxo) => sum + BigInt(utxo.token.atoms), 0n
    )
    
    // Convert atoms to display units
    return Number(totalAtoms) / Math.pow(10, decimals)
  }
}
```

### Error Handling Pattern

```javascript
// Mirror send-xec.js error handling patterns
class TokenError extends Error {
  constructor(message, code, context = {}) {
    super(message)
    this.code = code
    this.context = context
    this.name = 'TokenError'
  }
}

// Common error codes
const TOKEN_ERRORS = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_TOKEN_BALANCE',
  INVALID_TOKEN_ID: 'INVALID_TOKEN_ID', 
  INVALID_AMOUNT: 'INVALID_TOKEN_AMOUNT',
  TOO_MANY_OUTPUTS: 'TOO_MANY_TOKEN_OUTPUTS',
  NETWORK_ERROR: 'TOKEN_NETWORK_ERROR'
}
```

### Dependencies Requirements

```javascript
// Required ecash-lib functions for ALP support
const {
  alpSend, alpBurn, alpGenesis,     // ALP transaction builders
  emppScript, parseAlp,             // eMPP script handling  
  TxBuilder, P2PKHSignatory,        // Transaction building
  fromHex, toHex, ALL_BIP143        // Utilities
} = require('ecash-lib')

// Token metadata from chronik
const tokenInfo = await chronik.token(tokenId)
```

## Test Suite Design

### Test Categories (Mirror XEC Test Structure)

1. **Unit Tests** (`test/unit/tokens/`)
   ```
   ├── token-utxo-management.test.js    # UTXO categorization & selection
   ├── token-balance-calculation.test.js # Balance/atoms conversion  
   ├── token-transaction-building.test.js # ALP script construction
   └── token-validation.test.js          # Input validation & errors
   ```

2. **Integration Tests** (`test/integration/tokens/`)
   ```
   ├── send-tokens.test.js              # End-to-end token sending
   ├── burn-tokens.test.js              # Token burning operations
   └── token-metadata.test.js           # chronik integration
   ```

3. **Example Scripts** (`examples/tokens/`)
   ```
   ├── create-token.js                  # Genesis example (optional)
   ├── send-tokens.js                   # Send tokens to recipient
   ├── burn-tokens.js                   # Burn specific amount
   ├── list-tokens.js                   # Show wallet token holdings
   └── token-info.js                    # Display token metadata
   ```

### Test Data Strategy
- Use testnet token IDs from real ALP tokens
- Mock chronik responses for unit tests
- Integration tests against live testnet (funding required)
- Example wallet with pre-funded test tokens

## MVP Feature Set

### Core Features (Must Have)
✅ **Send Tokens** - Transfer to single/multiple recipients  
✅ **Token Balance** - Display current holdings with proper decimals  
✅ **Token Metadata** - Fetch ticker, name, decimals from chronik  
✅ **Burn Tokens** - Destroy specific amounts or all of type  
✅ **List Tokens** - Show all tokens held by wallet  

### Advanced Features (Nice to Have)
🔄 **Genesis Tokens** - Create new token types (low priority)  
🔄 **Mint Tokens** - Create additional supply (requires mint baton)  
🔄 **Token History** - Transaction history filtered by token  
🔄 **Batch Operations** - Send multiple token types in one tx  

### Explicitly Out of Scope
❌ **NFT Support** - Different protocol, separate implementation  
❌ **DeFi Integration** - Advanced trading/swapping features  
❌ **Multi-signature** - Complex signing scenarios  
❌ **Token Standards** - Only ALP, no SLP v1 compatibility  

## Implementation Timeline

### Week 1: Foundation
- [ ] Enhance `lib/tokens.js` with UTXO management
- [ ] Add chronik token methods to `lib/adapters/router.js`
- [ ] Unit tests for token UTXO handling
- [ ] Basic token balance calculation

### Week 2: Send Operations  
- [ ] Implement `sendETokens()` method
- [ ] ALP send transaction building
- [ ] Integration tests for token sending
- [ ] Example: `examples/tokens/send-tokens.js`

### Week 3: Burn Operations
- [ ] Implement `burnETokens()` and `burnAllETokens()`
- [ ] ALP burn transaction building  
- [ ] Integration tests for token burning
- [ ] Example: `examples/tokens/burn-tokens.js`

### Week 4: Polish & Documentation
- [ ] Complete test suite (match XEC coverage)
- [ ] All example scripts with proper error handling
- [ ] Update main README with token examples
- [ ] Performance optimization and edge case handling

## Success Criteria

### Functional Requirements
1. **Send 100 TEST tokens to recipient** ✅
2. **Burn 50 TEST tokens** ✅  
3. **Display token balance with correct decimals** ✅
4. **Handle multiple token types in wallet** ✅
5. **Proper error messages for insufficient balance** ✅

### Non-Functional Requirements  
1. **Test Coverage**: ≥95% for token operations (match XEC quality)
2. **Performance**: Token operations complete within 5 seconds
3. **Reliability**: All integration tests pass on clean testnet
4. **Usability**: Examples work for developers without blockchain knowledge
5. **Security**: No private key exposure, proper input validation

### Documentation Requirements
1. **API Documentation**: JSDoc for all public methods  
2. **Usage Examples**: Working code for each major operation
3. **Error Handling**: Documented error codes and recovery strategies
4. **Migration Guide**: How to upgrade from XEC-only to token support

## Risk Mitigation

### Technical Risks
1. **ecash-lib API Changes**: Pin to specific version, test compatibility
2. **chronik Availability**: Implement retry logic, fallback endpoints  
3. **ALP Protocol Updates**: Monitor Bitcoin-ABC releases, test compatibility

### Implementation Risks  
1. **Complexity Creep**: Stick to MVP scope, defer advanced features
2. **Testing Gaps**: Require comprehensive test coverage before merge
3. **Performance Issues**: Profile token operations, optimize UTXO selection

### User Experience Risks
1. **Confusing Errors**: Provide clear, actionable error messages  
2. **Lost Tokens**: Extensive validation before transaction broadcast
3. **Poor Documentation**: Include working examples for all operations

## Conclusion

This implementation plan provides a structured approach to adding eToken support while maintaining the proven patterns and quality established in the XEC operations. The MVP focus ensures we deliver core functionality efficiently while leaving room for future enhancements.

The modular design allows for incremental development and testing, reducing risk while ensuring each component integrates seamlessly with the existing codebase.