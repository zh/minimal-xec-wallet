# Hybrid Token Testing Strategy

## Component Analysis

### Core Components Built:
1. **TokenProtocolDetector** - Protocol detection and UTXO categorization
2. **SLPTokenHandler** - SLP transaction building and validation  
3. **ALPTokenHandler** - ALP transaction building and validation
4. **HybridTokenManager** - Unified interface with protocol routing

### Critical Functionality:
- Protocol auto-detection from UTXO structures
- Token balance calculation with decimal handling
- Transaction building with explicit output control
- UTXO selection and fee estimation
- Script generation (SLP vs ALP/eMPP)
- Error handling and validation

## Testing Levels

### Level 1: Unit Tests (Isolated Components)
Test individual functions with mocked dependencies

#### TokenProtocolDetector Tests:
- [ ] `detectProtocol()` with various UTXO types
- [ ] `filterUtxosForToken()` with mixed token UTXOs  
- [ ] `getTokenInventory()` aggregation logic
- [ ] `categorizeUtxos()` with edge cases
- [ ] Error handling for malformed UTXOs
- [ ] Performance with large UTXO sets

#### SLPTokenHandler Tests:
- [ ] `createSendTransaction()` output structure
- [ ] `_selectTokenUtxos()` selection logic
- [ ] `_selectXecUtxos()` fee calculation
- [ ] Script generation with `slpSend()`
- [ ] Amount conversion (display ↔ atoms)
- [ ] Transaction signing with proper signData
- [ ] Error scenarios (insufficient funds, invalid inputs)

#### ALPTokenHandler Tests:
- [ ] `createSendTransaction()` with eMPP scripts
- [ ] `emppScript()` and `alpSend()` usage
- [ ] ALP-specific validation rules
- [ ] Same edge cases as SLP but for ALP protocol

#### HybridTokenManager Tests:
- [ ] Protocol routing logic
- [ ] `listTokensFromUtxos()` aggregation
- [ ] `sendTokens()` delegation to correct handler
- [ ] Error propagation and handling
- [ ] Cache management

### Level 2: Integration Tests (Component Interaction)
Test components working together with realistic data

#### End-to-End Token Operations:
- [ ] Complete SLP token send flow
- [ ] Complete ALP token send flow  
- [ ] Token burning for both protocols
- [ ] Multi-recipient transactions
- [ ] Change calculation accuracy

#### Real UTXO Processing:
- [ ] Mixed SLP/ALP wallet scenarios
- [ ] Complex UTXO selection edge cases
- [ ] Fee estimation accuracy
- [ ] Transaction size optimization

#### Error Recovery:
- [ ] Network failure handling
- [ ] Invalid token metadata recovery
- [ ] Insufficient balance scenarios
- [ ] Malformed address handling

### Level 3: System Tests (End-to-End with Mocked Network)
Test complete workflows with realistic blockchain data

#### Transaction Construction:
- [ ] Valid SLP transaction structures
- [ ] Valid ALP transaction structures  
- [ ] Proper dust limit handling
- [ ] XEC change distribution
- [ ] Fee calculation accuracy

## Test Data Strategy

### Fixtures Needed:
1. **Real UTXO Data**: From our actual testing (FLCT/TGR tokens)
2. **Token Metadata**: Real chronik responses for both protocols  
3. **Transaction Examples**: Valid SLP/ALP transactions
4. **Error Responses**: Network and validation errors

### Mock Strategy:
- **Chronik Client**: Mock all network calls for deterministic testing
- **Crypto Functions**: Use real ecash-lib but mock randomness where needed
- **Time Functions**: Mock for consistent timestamps

## Critical Edge Cases to Test

### Protocol Detection:
- [ ] UTXOs with missing token data
- [ ] UTXOs with malformed token structures  
- [ ] Mixed SLP/ALP UTXOs in same wallet
- [ ] Unknown token types/protocols

### Amount Handling:
- [ ] Zero decimal tokens (FLCT, TGR)
- [ ] High decimal tokens (if available)
- [ ] Maximum token amounts
- [ ] Dust limit edge cases

### Transaction Construction:
- [ ] Single recipient vs multiple recipients
- [ ] All tokens sent (no change)
- [ ] Minimal amount sends
- [ ] Maximum UTXO consolidation

### Error Scenarios:
- [ ] Insufficient token balance
- [ ] Insufficient XEC for fees
- [ ] Invalid recipient addresses
- [ ] Network timeouts/failures
- [ ] Invalid token IDs
- [ ] Malformed UTXO responses

### Security Concerns:
- [ ] Address validation (no malicious addresses)
- [ ] Amount overflow protection
- [ ] Script injection prevention
- [ ] Fee calculation attacks

## Test Structure

```
tests/
├── unit/
│   ├── token-protocol-detector.test.js
│   ├── slp-token-handler.test.js
│   ├── alp-token-handler.test.js
│   └── hybrid-token-manager.test.js
├── integration/
│   ├── token-operations.test.js
│   ├── utxo-processing.test.js
│   └── error-scenarios.test.js
├── fixtures/
│   ├── utxos.js          # Real UTXO data from testing
│   ├── token-metadata.js # Real chronik responses
│   ├── transactions.js   # Example transaction structures
│   └── addresses.js      # Test addresses and scripts
├── helpers/
│   ├── mock-chronik.js   # Chronik client mocking
│   ├── test-utils.js     # Common test utilities
│   └── assertions.js     # Custom assertions for blockchain data
└── performance/
    ├── utxo-scaling.test.js    # Large UTXO set handling
    └── transaction-size.test.js # Transaction optimization
```

## Success Criteria

### Coverage Targets:
- **Unit Tests**: >95% code coverage
- **Integration Tests**: All critical user paths covered
- **Error Tests**: All error conditions have tests

### Performance Targets:
- Handle 1000+ UTXOs without timeout
- Transaction building < 100ms
- Memory usage stays reasonable

### Quality Targets:
- All tests are deterministic (no flaky tests)
- Clear error messages for failures
- Tests serve as documentation for expected behavior

## Implementation Priority

### Phase 1: Foundation (Unit Tests)
1. TokenProtocolDetector (most critical for correctness)
2. Transaction output structure validation
3. Amount calculation accuracy

### Phase 2: Core Operations (Integration Tests)
1. Complete send flows for both protocols
2. Error handling and recovery
3. UTXO selection optimization

### Phase 3: Edge Cases & Performance
1. Stress testing with large data sets
2. Security edge case validation
3. Performance optimization verification

This comprehensive testing strategy will ensure the hybrid token implementation is robust, secure, and maintainable.