# Minimal XEC Wallet - MVP Specification

## Design Philosophy
**"Secure by default, simple by design"**

A minimal but secure XEC wallet focused on essential everyday operations with built-in security protections against common attacks, without over-engineering complex analytics.

## Core Features

### 1. Wallet Management
- **Create**: Generate new wallet from mnemonic (12/24 words)
- **Import**: Restore from WIF private key or mnemonic
- **Security**: Encrypt/decrypt mnemonic with password
- **Derive**: Generate XEC addresses from HD path

### 2. Balance Operations
- **Get Balance**: Confirmed and unconfirmed XEC amounts
- **UTXO Listing**: Fetch spendable UTXOs from chronik
- **Validation**: Basic UTXO format and value validation

### 3. Transaction Operations
- **Send XEC**: Single recipient transactions
- **Multi-Send**: Multiple output transactions
- **Send All**: Sweep entire wallet balance
- **Fee Calculation**: Accurate fee estimation
- **Broadcasting**: Submit signed transactions

### 4. Essential Security Features

#### Dust Attack Protection
```javascript
// Simple but effective dust protection
const DUST_THRESHOLD = 1000  // 10 XEC minimum
const isDustUtxo = (utxo) => utxo.sats < DUST_THRESHOLD
```

#### Basic Suspicious Pattern Detection
```javascript
// Detect obvious dust attacks
const isDustAttack = (utxos) => {
  const smallAmounts = utxos.filter(u => u.sats < 5000)
  const duplicates = new Map()
  
  smallAmounts.forEach(u => {
    const count = duplicates.get(u.sats) || 0
    duplicates.set(u.sats, count + 1)
  })
  
  // 10+ identical small amounts = suspicious
  return Array.from(duplicates.values()).some(count => count >= 10)
}
```

#### Input Validation
- Address format validation (ecash: format)
- Amount validation (positive, within bounds)
- UTXO structure validation
- Transaction size limits

#### Safe UTXO Selection
- Confirmed UTXOs only (blockHeight !== -1)
- Above dust threshold
- Valid structure and format
- Simple largest-first selection

## Simplified Architecture

```
minimal-xec-wallet/
├── index.js                 # Main wallet class
├── lib/
│   ├── key-derivation.js    # HD key generation
│   ├── utxos.js            # Simple UTXO management  
│   ├── send-xec.js         # Transaction creation
│   ├── security.js         # Security validations
│   └── adapters/
│       └── router.js       # Chronik connection
└── test/
    ├── unit/               # Core functionality tests
    └── integration/        # End-to-end tests
```

## What's Removed

### Advanced Analytics (Over-Engineering)
- ❌ UtxoClassifier (age/value/privacy scoring)
- ❌ UtxoHealthMonitor (complex health assessment)  
- ❌ PrivacyScorer (0-100 privacy metrics)
- ❌ Performance metrics and analytics
- ❌ Round number detection
- ❌ Timing correlation analysis

### Complex Coin Selection (Over-Engineering)
- ❌ BranchAndBoundSelector
- ❌ KnapsackSelector  
- ❌ HybridSelector
- ❌ Multi-algorithm orchestration
- ❌ Waste minimization strategies

### Advanced Features (Future Phases)
- ❌ eToken support
- ❌ UTXO consolidation strategies
- ❌ Advanced privacy features
- ❌ Transaction optimization

## API Design

### Wallet Creation
```javascript
const wallet = new MinimalXecWallet()
await wallet.create()                    // New wallet
await wallet.import(mnemonic)            // From mnemonic  
await wallet.importWif(privateKey)       // From WIF
```

### Balance & UTXOs  
```javascript
const balance = await wallet.getBalance()
const utxos = await wallet.getUtxos()
```

### Sending XEC
```javascript
// Simple send
const txid = await wallet.sendXec(address, amount)

// Multi-send  
const txid = await wallet.sendXec([
  { address, amount },
  { address, amount }
])

// Send all
const txid = await wallet.sendAll(address)
```

## Security Guarantees

1. **Dust Attack Protection**: Automatic filtering of uneconomical UTXOs
2. **Input Validation**: All inputs validated before processing
3. **Confirmed UTXOs**: Only confirmed transactions used by default
4. **Fee Protection**: Reasonable fee calculation prevents overpayment
5. **Amount Validation**: Prevents overflow and negative amounts
6. **Basic Pattern Detection**: Identifies obvious suspicious patterns

## Success Criteria

- ✅ Core wallet operations work reliably
- ✅ Protected against common attacks
- ✅ Simple, maintainable codebase (<2000 lines)
- ✅ Comprehensive test coverage (>90%)
- ✅ Clear, documented API
- ✅ Fast execution (<1s for typical operations)

## Implementation Priority

1. **Phase 1**: Core wallet functionality
2. **Phase 2**: Security validations  
3. **Phase 3**: Test cleanup and validation
4. **Phase 4**: Documentation and examples

This specification ensures we have a production-ready, secure XEC wallet without unnecessary complexity.