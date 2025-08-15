# Hybrid Token Implementation Plan - SLP + ALP Support

## Executive Summary

This document outlines the implementation of hybrid token support for both SLP (Simple Ledger Protocol) and ALP (A Ledger Protocol) tokens in the Minimal XEC Wallet. With real test tokens available (10 FLCT SLP + 10 TGR ALP), we can build and test a comprehensive solution that handles both protocols seamlessly.

## Current Wallet State

### 🪙 Test Tokens Available
- **SLP Token**: 10 FLCT (Falcon Token) - Integer token, no decimals
- **ALP Token**: 10 TGR (Tiger Cub) - Integer token, no decimals  
- **XEC Balance**: ~51.45 XEC across 4 UTXOs

### 📊 Token Details
```
FLCT (SLP):
  Token ID: 5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135
  Protocol: SLP (SLP_TOKEN_TYPE_FUNGIBLE)
  UTXO: b5ce4eeebe1f785fdd4051a8423cd9ab9dce41c19e9a66e1b563ea92bfa96707:1

TGR (ALP):
  Token ID: 6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801
  Protocol: ALP (ALP_TOKEN_TYPE_STANDARD)  
  UTXO: 86b2ad67e90bc52c1f4e6061f0525dbdf55910e68d0562d9005f532ab537f0fb:1
```

## Architecture Design

### Token Protocol Detection Strategy

```javascript
class TokenProtocolDetector {
  static detectProtocol(utxo) {
    if (!utxo.token) return 'XEC'
    
    switch (utxo.token.tokenType?.protocol) {
      case 'SLP':
        return 'SLP'
      case 'ALP': 
        return 'ALP'
      default:
        throw new Error(`Unknown token protocol: ${utxo.token.tokenType?.protocol}`)
    }
  }
  
  static categorizeTokenUtxos(utxos) {
    return {
      xecUtxos: utxos.filter(u => !u.token),
      slpUtxos: utxos.filter(u => u.token?.tokenType?.protocol === 'SLP'),
      alpUtxos: utxos.filter(u => u.token?.tokenType?.protocol === 'ALP'),
      mixedProtocols: this._groupByTokenId(utxos)
    }
  }
}
```

### Unified Token Interface

```javascript
// Abstract token operations that work for both protocols
class TokenManager {
  constructor(config) {
    this.slpHandler = new SLPTokenHandler(config)
    this.alpHandler = new ALPTokenHandler(config)
  }
  
  async sendTokens(tokenId, outputs, walletInfo, utxos, satsPerByte) {
    const protocol = await this._detectTokenProtocol(tokenId)
    
    switch (protocol) {
      case 'SLP':
        return this.slpHandler.sendTokens(tokenId, outputs, walletInfo, utxos, satsPerByte)
      case 'ALP':
        return this.alpHandler.sendTokens(tokenId, outputs, walletInfo, utxos, satsPerByte)
      default:
        throw new Error(`Unsupported token protocol: ${protocol}`)
    }
  }
  
  async burnTokens(tokenId, amount, walletInfo, utxos, satsPerByte) {
    const protocol = await this._detectTokenProtocol(tokenId)
    // Route to appropriate handler...
  }
  
  async getTokenBalance(tokenId, address) {
    const protocol = await this._detectTokenProtocol(tokenId)
    // Route to appropriate handler...
  }
}
```

## Implementation Strategy

### Phase 1: Foundation (Week 1)
**Goal**: Establish dual-protocol infrastructure

#### 1.1 Enhanced Token UTXO Manager
- [ ] Create `lib/token-protocol-detector.js`
- [ ] Enhance UTXO categorization for SLP vs ALP
- [ ] Add protocol-specific validation
- [ ] Handle mixed-protocol wallets

#### 1.2 Protocol-Specific Handlers
- [ ] Create `lib/slp-token-handler.js` for SLP operations
- [ ] Create `lib/alp-token-handler.js` for ALP operations
- [ ] Implement common interface for both handlers
- [ ] Add protocol-specific transaction building

#### 1.3 Unified Token Manager
- [ ] Create `lib/hybrid-token-manager.js` as main coordinator
- [ ] Implement protocol detection and routing
- [ ] Add unified API for wallet integration
- [ ] Handle cross-protocol edge cases

### Phase 2: SLP Token Operations (Week 2) 
**Goal**: Implement SLP token functionality with FLCT testing

#### 2.1 SLP Transaction Building
- [ ] Implement SLP send transactions
- [ ] Add SLP burn transactions  
- [ ] Use existing SLP libraries/patterns
- [ ] Test with 10 FLCT tokens

#### 2.2 SLP Balance & Metadata
- [ ] SLP token balance calculation
- [ ] SLP token metadata retrieval
- [ ] SLP token listing functionality
- [ ] Integration with chronik SLP data

### Phase 3: ALP Token Operations (Week 3)
**Goal**: Implement ALP token functionality with TGR testing

#### 3.1 ALP Transaction Building
- [ ] Implement ALP send transactions using ecash-lib
- [ ] Add ALP burn transactions
- [ ] Use eMPP script construction
- [ ] Test with 10 TGR tokens

#### 3.2 ALP Balance & Metadata  
- [ ] ALP atom/display conversion
- [ ] ALP token metadata retrieval
- [ ] ALP token listing functionality
- [ ] Integration with chronik ALP data

### Phase 4: Integration & Testing (Week 4)
**Goal**: Complete hybrid system with comprehensive testing

#### 4.1 Wallet Integration
- [ ] Update main wallet class with hybrid support
- [ ] Unified token operations API
- [ ] Backward compatibility maintenance
- [ ] Enhanced error handling

#### 4.2 Testing & Examples
- [ ] Test both FLCT (SLP) and TGR (ALP) operations
- [ ] Create example scripts for both protocols
- [ ] Integration tests with real tokens
- [ ] Performance optimization

## Technical Implementation Details

### SLP Handler Architecture

```javascript
// lib/slp-token-handler.js
class SLPTokenHandler {
  constructor(config) {
    this.chronik = config.chronik
    this.slpjs = require('slpjs') // Use existing SLP library
  }
  
  async sendTokens(tokenId, outputs, walletInfo, allUtxos, satsPerByte) {
    // Filter SLP UTXOs for this token
    const slpUtxos = allUtxos.filter(u => 
      u.token?.tokenId === tokenId && 
      u.token?.tokenType?.protocol === 'SLP'
    )
    
    // Filter XEC UTXOs for fees
    const xecUtxos = allUtxos.filter(u => !u.token)
    
    // Use SLP.js or similar library for transaction building
    const txHex = await this._buildSLPSendTx(tokenId, outputs, slpUtxos, xecUtxos, walletInfo)
    
    // Broadcast transaction
    return await this.chronik.broadcastTx(txHex)
  }
  
  _buildSLPSendTx(tokenId, outputs, slpUtxos, xecUtxos, walletInfo) {
    // SLP transaction building logic
    // Use established SLP patterns and libraries
  }
}
```

### ALP Handler Architecture

```javascript
// lib/alp-token-handler.js  
const { alpSend, alpBurn, emppScript, TxBuilder } = require('ecash-lib')

class ALPTokenHandler {
  constructor(config) {
    this.chronik = config.chronik
    this.ecc = new Ecc()
  }
  
  async sendTokens(tokenId, outputs, walletInfo, allUtxos, satsPerByte) {
    // Filter ALP UTXOs for this token
    const alpUtxos = allUtxos.filter(u => 
      u.token?.tokenId === tokenId && 
      u.token?.tokenType?.protocol === 'ALP'
    )
    
    // Filter XEC UTXOs for fees
    const xecUtxos = allUtxos.filter(u => !u.token)
    
    // Use ecash-lib for ALP transaction building
    const txHex = await this._buildALPSendTx(tokenId, outputs, alpUtxos, xecUtxos, walletInfo)
    
    return await this.chronik.broadcastTx(txHex)
  }
  
  async _buildALPSendTx(tokenId, outputs, alpUtxos, xecUtxos, walletInfo) {
    // Convert display amounts to atoms
    const atomOutputs = outputs.map(out => ({
      ...out,
      atoms: this._displayToAtoms(out.amount, tokenInfo.decimals)
    }))
    
    // Build ALP script
    const alpScript = emppScript([
      alpSend(tokenId, 0, atomOutputs.map(o => o.atoms))
    ])
    
    // Build transaction with ecash-lib
    const txBuilder = new TxBuilder({
      inputs: [...this._buildALPInputs(alpUtxos), ...this._buildXecInputs(xecUtxos)],
      outputs: [
        { sats: 0n, script: alpScript },
        ...atomOutputs.map(o => this._buildTokenOutput(o)),
        this._buildChangeOutput(walletInfo.xecAddress)
      ]
    })
    
    const tx = txBuilder.sign({ feePerKb: 1000n, dustSats: 546n })
    return toHex(tx.ser())
  }
}
```

### Unified Token Manager

```javascript
// lib/hybrid-token-manager.js
class HybridTokenManager {
  constructor(config) {
    this.slpHandler = new SLPTokenHandler(config)
    this.alpHandler = new ALPTokenHandler(config)
    this.chronik = config.chronik
  }
  
  async listAllTokens(address) {
    const utxos = await this._getAllUtxos(address)
    const categorized = TokenProtocolDetector.categorizeTokenUtxos(utxos)
    
    const tokens = []
    
    // Process SLP tokens
    for (const utxo of categorized.slpUtxos) {
      const tokenId = utxo.token.tokenId
      if (!tokens.find(t => t.tokenId === tokenId)) {
        const tokenInfo = await this.chronik.token(tokenId)
        const balance = await this._calculateSLPBalance(tokenId, categorized.slpUtxos)
        tokens.push({
          tokenId,
          protocol: 'SLP',
          ticker: tokenInfo.genesisInfo.tokenTicker,
          name: tokenInfo.genesisInfo.tokenName,
          balance: balance.displayAmount,
          decimals: tokenInfo.genesisInfo.decimals
        })
      }
    }
    
    // Process ALP tokens  
    for (const utxo of categorized.alpUtxos) {
      const tokenId = utxo.token.tokenId
      if (!tokens.find(t => t.tokenId === tokenId)) {
        const tokenInfo = await this.chronik.token(tokenId)
        const balance = await this._calculateALPBalance(tokenId, categorized.alpUtxos)
        tokens.push({
          tokenId,
          protocol: 'ALP', 
          ticker: tokenInfo.genesisInfo.tokenTicker,
          name: tokenInfo.genesisInfo.tokenName,
          balance: balance.displayAmount,
          decimals: tokenInfo.genesisInfo.decimals,
          atoms: balance.totalAtoms
        })
      }
    }
    
    return tokens
  }
  
  async sendTokens(tokenId, outputs, walletInfo, satsPerByte) {
    const protocol = await this._detectTokenProtocol(tokenId)
    const utxos = await this._getAllUtxos(walletInfo.xecAddress)
    
    switch (protocol) {
      case 'SLP':
        return this.slpHandler.sendTokens(tokenId, outputs, walletInfo, utxos, satsPerByte)
      case 'ALP':
        return this.alpHandler.sendTokens(tokenId, outputs, walletInfo, utxos, satsPerByte)
      default:
        throw new Error(`Unsupported token protocol: ${protocol}`)
    }
  }
}
```

## Testing Strategy

### Real Token Testing

Since we have actual tokens in the wallet:

#### SLP Testing (FLCT)
- [ ] Send 2 FLCT to test address
- [ ] Burn 3 FLCT tokens  
- [ ] List FLCT in wallet
- [ ] Check FLCT balance calculation

#### ALP Testing (TGR)
- [ ] Send 2 TGR to test address
- [ ] Burn 3 TGR tokens
- [ ] List TGR in wallet  
- [ ] Check TGR balance with atoms conversion

#### Cross-Protocol Testing
- [ ] List both token types in single call
- [ ] Handle mixed UTXO sets correctly
- [ ] Error handling for unsupported protocols
- [ ] Performance with multiple protocols

### Example Scripts

#### Universal Token Operations
```javascript
// examples/tokens/list-all-tokens.js
// Shows both SLP and ALP tokens in wallet

// examples/tokens/send-any-token.js  
// Detects protocol and sends appropriately

// examples/tokens/burn-any-token.js
// Protocol-aware token burning
```

## Implementation Priority

### Week 1: Infrastructure
1. **Protocol Detection** - Critical foundation
2. **UTXO Categorization** - Handle mixed protocols  
3. **Handler Architecture** - SLP and ALP routing
4. **Basic Testing** - Verify detection works

### Week 2: SLP Implementation  
1. **SLP Send Operations** - Test with FLCT
2. **SLP Balance Calculation** - Verify accuracy
3. **SLP Metadata Integration** - Chronik integration
4. **FLCT Testing** - Real transaction tests

### Week 3: ALP Implementation
1. **ALP Send Operations** - Test with TGR
2. **ALP Atoms/Display Conversion** - Handle properly
3. **ALP eMPP Script Building** - Use ecash-lib
4. **TGR Testing** - Real transaction tests

### Week 4: Integration
1. **Unified API** - Single interface for both
2. **Cross-Protocol Testing** - Mixed scenarios
3. **Example Scripts** - Demonstrate usage
4. **Documentation** - Complete hybrid guide

## Dependencies

### SLP Support
```json
{
  "slpjs": "^0.x.x",           // SLP transaction building
  "bignumber.js": "^9.x.x"     // SLP amount handling
}
```

### ALP Support  
```json
{
  "ecash-lib": "^4.3.1"        // Native ALP support
}
```

### Shared Dependencies
```json
{
  "chronik-client": "^3.4.0",  // Both protocols via chronik
  "ecashaddrjs": "^1.7.0"      // Address handling
}
```

## Success Criteria

### Functional Requirements
- [ ] **List both FLCT and TGR tokens** - Protocol detection works
- [ ] **Send 2 FLCT (SLP) successfully** - SLP operations functional
- [ ] **Send 2 TGR (ALP) successfully** - ALP operations functional  
- [ ] **Burn tokens from both protocols** - Destruction works
- [ ] **Unified API for both token types** - Seamless experience

### Technical Requirements
- [ ] **Protocol auto-detection** - No manual protocol specification
- [ ] **Proper balance calculation** - Accurate for both protocols
- [ ] **Error handling** - Clear messages for each protocol
- [ ] **Performance** - No significant slowdown vs single protocol
- [ ] **Test coverage ≥95%** - Comprehensive validation

## Future Enhancements

### Multi-Protocol Features
- Token swapping between protocols
- Cross-protocol transaction batching
- Protocol migration tools
- Advanced analytics across protocols

### Ecosystem Integration
- Multi-wallet compatibility
- Hardware wallet support for both protocols
- DeFi integration spanning both token types
- Developer SDK for hybrid applications

This hybrid implementation provides a complete solution for both current (SLP) and future (ALP) token standards, ensuring the wallet remains compatible with the entire eCash token ecosystem while taking advantage of both protocols' unique capabilities.