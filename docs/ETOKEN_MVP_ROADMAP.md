# eToken Implementation Roadmap - MVP Development Plan

## Executive Summary

This roadmap provides a detailed, step-by-step implementation plan for adding eToken (ALP protocol) support to the Minimal XEC Wallet. The plan follows MVP principles to deliver core functionality efficiently while maintaining the proven patterns and quality standards established by the existing XEC operations.

## MVP Scope Definition

### ✅ Core Features (Must Have)
1. **Send Tokens** - Transfer tokens to single/multiple recipients
2. **Token Balance** - Display current holdings with proper decimals
3. **Token Metadata** - Fetch ticker, name, decimals from chronik
4. **Burn Tokens** - Destroy specific amounts or all of type
5. **List Tokens** - Show all tokens held by wallet

### 🔄 Advanced Features (Future Iterations)
- Token genesis (create new tokens)
- Token minting (requires mint baton)
- NFT support (different protocol)
- Multi-signature token operations

### ❌ Explicitly Out of Scope
- SLP v1 compatibility
- DeFi integration features
- Advanced trading/swapping
- Cross-chain operations

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Establish core infrastructure for token operations
**Completion Criteria**: Can identify and categorize token UTXOs

#### Task List

**1.1 Enhanced ecash-lib Mocking (Priority: High)**
- [ ] Update `test/setup.js` with ALP-specific mocks
- [ ] Add `alpSend`, `alpBurn`, `alpGenesis` function mocks
- [ ] Add `emppScript` and `parseAlp` function mocks
- [ ] Test mock functionality with basic unit tests
- **Files**: `test/setup.js`
- **Time**: 4 hours

**1.2 Token UTXO Management Core (Priority: High)**
- [ ] Create `lib/token-utxo-manager.js` class
- [ ] Implement `categorizeUtxos()` method
- [ ] Implement UTXO validation and filtering
- [ ] Add error handling for malformed token data
- **Files**: `lib/token-utxo-manager.js`
- **Time**: 8 hours

**1.3 Token Balance Calculator (Priority: High)**
- [ ] Create `lib/token-balance-calculator.js` class
- [ ] Implement `atomsToDisplayUnits()` conversion
- [ ] Implement `displayUnitsToAtoms()` conversion
- [ ] Add precision handling for 0-8 decimal places
- [ ] Handle floating point precision issues
- **Files**: `lib/token-balance-calculator.js`
- **Time**: 6 hours

**1.4 Enhanced Adapter Router (Priority: Medium)**
- [ ] Add token metadata caching to `lib/adapters/router.js`
- [ ] Implement `getTokenInfo(tokenId)` method
- [ ] Add batch token metadata fetching
- [ ] Implement token UTXO filtering helpers
- **Files**: `lib/adapters/router.js`
- **Time**: 4 hours

**1.5 Enhanced UTXO Store (Priority: Medium)**
- [ ] Extend `lib/utxos.js` with token support
- [ ] Add token UTXO categorization to `initUtxoStore()`
- [ ] Implement token metadata caching
- [ ] Add `getTokenUtxos()` and `getXecUtxos()` methods
- **Files**: `lib/utxos.js`
- **Time**: 6 hours

**1.6 Phase 1 Unit Tests (Priority: High)**
- [ ] Create `test/unit/mocks/etoken-utxo-mocks.js`
- [ ] Create `test/unit/mocks/etoken-chronik-mocks.js`
- [ ] Create `test/unit/a07-token-utxo-manager-unit.js`
- [ ] Create `test/unit/a08-token-balance-unit.js`
- [ ] Achieve ≥95% test coverage for Phase 1 components
- **Files**: `test/unit/a07-*.js`, `test/unit/a08-*.js`, `test/unit/mocks/etoken-*.js`
- **Time**: 12 hours

**Phase 1 Success Criteria**:
- [ ] Can categorize mixed XEC/token UTXOs correctly
- [ ] Can calculate token balances with proper decimal handling
- [ ] Can fetch and cache token metadata from chronik
- [ ] All unit tests pass with ≥95% coverage
- [ ] Integration with existing UTXO store works seamlessly

### Phase 2: Token Send Operations (Week 2)
**Goal**: Implement core token transfer functionality
**Completion Criteria**: Can send tokens to recipients and broadcast successfully

#### Task List

**2.1 Token UTXO Selection (Priority: High)**
- [ ] Create `lib/token-utxo-selector.js` class
- [ ] Implement `selectForTokenSend()` method
- [ ] Add multiple selection strategies (optimal, largest-first, etc.)
- [ ] Implement change calculation for tokens
- [ ] Add insufficient balance detection
- **Files**: `lib/token-utxo-selector.js`
- **Time**: 8 hours

**2.2 XEC Fee UTXO Selection (Priority: High)**
- [ ] Create `lib/fee-utxo-selector.js` class
- [ ] Implement `selectForFees()` method
- [ ] Add fee estimation for token transactions
- [ ] Handle insufficient XEC for fees scenarios
- **Files**: `lib/fee-utxo-selector.js`
- **Time**: 6 hours

**2.3 Token Transaction Builder (Priority: High)**
- [ ] Enhance `lib/tokens.js` with transaction building
- [ ] Implement `sendETokens()` method
- [ ] Implement `createTransaction()` method
- [ ] Add ALP script construction using ecash-lib
- [ ] Add multi-output support (up to 19 outputs)
- [ ] Implement proper error handling and validation
- **Files**: `lib/tokens.js`
- **Time**: 12 hours

**2.4 Integration with Main Wallet Class (Priority: High)**
- [ ] Update `index.js` `sendETokens()` method implementation
- [ ] Remove "Phase 2" error throws
- [ ] Add proper parameter validation
- [ ] Ensure backward compatibility
- **Files**: `index.js`
- **Time**: 4 hours

**2.5 Token Send Unit Tests (Priority: High)**
- [ ] Create `test/unit/a09-token-send-unit.js`
- [ ] Test UTXO selection algorithms
- [ ] Test transaction building with various scenarios
- [ ] Test error conditions (insufficient funds, etc.)
- [ ] Test multi-recipient sends
- **Files**: `test/unit/a09-token-send-unit.js`
- **Time**: 10 hours

**2.6 Token Send Integration Tests (Priority: Medium)**
- [ ] Create `test/integration/etoken-send-integration.test.js`
- [ ] Test end-to-end send workflows
- [ ] Test network error handling
- [ ] Test transaction broadcast validation
- **Files**: `test/integration/etoken-send-integration.test.js`
- **Time**: 8 hours

**2.7 Send Token Example Script (Priority: Medium)**
- [ ] Create `examples/tokens/send-tokens.js`
- [ ] Add comprehensive usage examples
- [ ] Add error handling and user feedback
- [ ] Follow existing example script patterns
- **Files**: `examples/tokens/send-tokens.js`
- **Time**: 6 hours

**Phase 2 Success Criteria**:
- [ ] Can send tokens to single recipient
- [ ] Can send tokens to multiple recipients (up to 19)
- [ ] Proper change handling for both XEC and tokens
- [ ] Clear error messages for common failure scenarios
- [ ] Example script demonstrates usage patterns
- [ ] All tests pass with ≥95% coverage

### Phase 3: Token Burn Operations (Week 3)
**Goal**: Implement token destruction functionality
**Completion Criteria**: Can burn specific amounts or all tokens of a type

#### Task List

**3.1 Token Burn Transaction Builder (Priority: High)**
- [ ] Add `burnETokens()` method to `lib/tokens.js`
- [ ] Add `burnAllETokens()` method to `lib/tokens.js`
- [ ] Implement `createBurnTransaction()` method
- [ ] Add ALP burn script construction
- [ ] Handle partial burns with change calculation
- **Files**: `lib/tokens.js`
- **Time**: 8 hours

**3.2 Integration with Main Wallet Class (Priority: High)**
- [ ] Update `index.js` `burnETokens()` method implementation
- [ ] Update `index.js` `burnAllETokens()` method implementation
- [ ] Remove "Phase 2" error throws
- [ ] Add input validation for burn amounts
- **Files**: `index.js`
- **Time**: 3 hours

**3.3 Token Burn Unit Tests (Priority: High)**
- [ ] Add burn tests to `test/unit/a06-tokens-unit.js`
- [ ] Test partial token burns
- [ ] Test complete token burns
- [ ] Test error conditions (insufficient tokens, etc.)
- [ ] Test change handling for partial burns
- **Files**: `test/unit/a06-tokens-unit.js`
- **Time**: 6 hours

**3.4 Token Burn Integration Tests (Priority: Medium)**
- [ ] Create `test/integration/etoken-burn-integration.test.js`
- [ ] Test end-to-end burn workflows
- [ ] Test burn amount validation
- [ ] Test network error handling during burns
- **Files**: `test/integration/etoken-burn-integration.test.js`
- **Time**: 6 hours

**3.5 Burn Token Example Script (Priority: Medium)**
- [ ] Create `examples/tokens/burn-tokens.js`
- [ ] Add selective burn functionality
- [ ] Add burn-all functionality
- [ ] Add confirmation prompts for destructive operations
- **Files**: `examples/tokens/burn-tokens.js`
- **Time**: 5 hours

**Phase 3 Success Criteria**:
- [ ] Can burn specific token amounts
- [ ] Can burn all tokens of a specific type
- [ ] Proper validation prevents burning more than available
- [ ] Change handling works correctly for partial burns
- [ ] Example script with safety confirmations
- [ ] All tests pass with ≥95% coverage

### Phase 4: Token Information & Listing (Week 4)
**Goal**: Complete token wallet functionality with listing and metadata
**Completion Criteria**: Full token wallet functionality with comprehensive examples

#### Task List

**4.1 Token Listing Implementation (Priority: High)**
- [ ] Implement `listETokensFromAddress()` in `lib/tokens.js`
- [ ] Implement `listETokensFromUtxos()` in `lib/tokens.js`
- [ ] Add token summary generation
- [ ] Handle multiple token types correctly
- **Files**: `lib/tokens.js`
- **Time**: 6 hours

**4.2 Token Balance Implementation (Priority: High)**
- [ ] Implement `getETokenBalance()` in `lib/tokens.js`
- [ ] Add support for specific token ID queries
- [ ] Integrate with token metadata caching
- [ ] Handle edge cases (zero balance, non-existent tokens)
- **Files**: `lib/tokens.js`
- **Time**: 4 hours

**4.3 Token Data Implementation (Priority: Medium)**
- [ ] Implement `getETokenData()` in `lib/adapters/router.js`
- [ ] Add comprehensive token metadata retrieval
- [ ] Add token transaction history support
- [ ] Implement metadata caching strategies
- **Files**: `lib/adapters/router.js`
- **Time**: 6 hours

**4.4 Integration with Main Wallet Class (Priority: High)**
- [ ] Update `index.js` `listETokens()` method implementation
- [ ] Update `index.js` `getETokenBalance()` method implementation
- [ ] Update `index.js` `getETokenData()` method implementation
- [ ] Remove all remaining "Phase 2" error throws
- **Files**: `index.js`
- **Time**: 3 hours

**4.5 Token Information Unit Tests (Priority: High)**
- [ ] Complete `test/unit/a06-tokens-unit.js` with listing tests
- [ ] Add balance calculation tests for various scenarios
- [ ] Add metadata retrieval tests
- [ ] Test error handling for edge cases
- **Files**: `test/unit/a06-tokens-unit.js`
- **Time**: 8 hours

**4.6 Token Information Integration Tests (Priority: Medium)**
- [ ] Create `test/integration/etoken-balance-integration.test.js`
- [ ] Test token listing workflows
- [ ] Test balance calculation integration
- [ ] Test metadata caching behavior
- **Files**: `test/integration/etoken-balance-integration.test.js`
- **Time**: 6 hours

**4.7 Complete Example Scripts (Priority: Medium)**
- [ ] Create `examples/tokens/list-tokens.js`
- [ ] Create `examples/tokens/token-info.js`
- [ ] Update existing examples with better error handling
- [ ] Add comprehensive README for token examples
- **Files**: `examples/tokens/list-tokens.js`, `examples/tokens/token-info.js`
- **Time**: 6 hours

**4.8 Enhanced Test Examples Integration (Priority: Low)**
- [ ] Add token operations to `examples/test-examples.js`
- [ ] Add token testing workflows
- [ ] Add funding instructions for token testing
- [ ] Ensure auto-confirmation works with token operations
- **Files**: `examples/test-examples.js`
- **Time**: 4 hours

**Phase 4 Success Criteria**:
- [ ] Can list all tokens held by wallet
- [ ] Can get balance for specific tokens
- [ ] Can retrieve comprehensive token metadata
- [ ] All example scripts work and demonstrate key features
- [ ] Test suite achieves ≥95% coverage across all token operations
- [ ] Integration with existing test framework

## Development Guidelines

### Code Quality Standards

**1. Follow Existing Patterns**
- Mirror the structure and style of `lib/send-xec.js`
- Use same error handling patterns as XEC operations
- Follow same naming conventions and parameter structures
- Maintain backward compatibility with existing APIs

**2. Security First**
- Validate all user inputs thoroughly
- Never expose private keys in error messages
- Use secure UTXO selection to prevent wallet analysis
- Implement proper transaction validation before broadcast

**3. Testing Requirements**
- Write tests before implementation (TDD approach)
- Achieve ≥95% test coverage for all new code
- Include comprehensive error scenario testing
- Verify all edge cases and boundary conditions

**4. Documentation Standards**
- JSDoc comments for all public methods
- Clear parameter descriptions and return value documentation
- Usage examples in code comments
- Update main README with token examples

### Implementation Best Practices

**1. Incremental Development**
- Complete one phase before starting the next
- Test each component thoroughly before integration
- Maintain working state after each major change
- Use feature branches for major changes

**2. Error Handling Strategy**
```javascript
// Consistent error pattern across all token operations
try {
  // Token operation logic
  return result
} catch (err) {
  // Sanitize error message (remove sensitive data)
  const sanitizedError = this._sanitizeError(err, 'Token operation context')
  throw sanitizedError
}
```

**3. Configuration Management**
```javascript
// Use existing configuration patterns
const defaultConfig = {
  dustLimit: 546,           // XEC dust limit in satoshis
  maxOpReturnSize: 223,     // Max OP_RETURN size in bytes  
  defaultSatsPerByte: 1.2,  // Default fee rate
  maxTokenOutputs: 19       // Mempool limit for token outputs
}
```

## Risk Mitigation Strategies

### Technical Risks

**1. ecash-lib API Compatibility**
- **Risk**: ALP functions may change in future ecash-lib versions
- **Mitigation**: Pin to specific ecash-lib version, comprehensive API tests
- **Monitor**: ecash-lib release notes and API changes

**2. Chronik API Reliability**
- **Risk**: chronik endpoints may be unavailable or return inconsistent data
- **Mitigation**: Implement retry logic, fallback endpoints, data validation
- **Monitor**: Chronik service status and response times

**3. ALP Protocol Updates**
- **Risk**: Bitcoin-ABC may update ALP protocol specifications
- **Mitigation**: Monitor Bitcoin-ABC releases, test against protocol changes
- **Monitor**: Bitcoin-ABC release notes and protocol documentation

### Implementation Risks

**1. Complexity Creep**
- **Risk**: Adding features beyond MVP scope increases development time
- **Mitigation**: Strict adherence to MVP scope, defer advanced features
- **Monitor**: Feature requests and scope changes during development

**2. Performance Issues**
- **Risk**: Token operations may be slower than XEC operations
- **Mitigation**: Profile performance, optimize UTXO selection algorithms
- **Monitor**: Transaction building times and memory usage

**3. Testing Gaps**
- **Risk**: Insufficient test coverage may lead to bugs in production
- **Mitigation**: Require ≥95% coverage, comprehensive integration tests
- **Monitor**: Test coverage reports and bug reports from users

### User Experience Risks

**1. Confusing Error Messages**
- **Risk**: Users may not understand token-specific error conditions
- **Mitigation**: Clear, actionable error messages with recovery suggestions
- **Monitor**: User feedback and support requests

**2. Transaction Failures**
- **Risk**: Token transactions may fail due to insufficient balance or fees
- **Mitigation**: Comprehensive pre-flight validation, clear error messages
- **Monitor**: Transaction failure rates and user reports

**3. Data Loss**
- **Risk**: Bugs in token operations could lead to lost tokens
- **Mitigation**: Extensive testing, dry-run capabilities, transaction validation
- **Monitor**: User reports of lost tokens or failed transactions

## Success Metrics

### Functional Requirements
- [ ] **Send 100 TEST tokens to recipient** - Core send functionality works
- [ ] **Burn 50 TEST tokens** - Token destruction works correctly
- [ ] **Display token balance with correct decimals** - Balance calculation accurate
- [ ] **Handle multiple token types in wallet** - Multi-token support functional
- [ ] **Proper error messages for common failures** - User experience optimized

### Non-Functional Requirements
- [ ] **Test Coverage ≥95%** - Quality standards maintained
- [ ] **Token operations complete within 5 seconds** - Performance acceptable
- [ ] **All integration tests pass on clean testnet** - Reliability verified
- [ ] **Examples work for developers** - Usability demonstrated
- [ ] **No private key exposure** - Security standards maintained

### Documentation Requirements
- [ ] **API Documentation** - JSDoc for all public methods complete
- [ ] **Usage Examples** - Working code for each major operation
- [ ] **Error Handling Guide** - Documented error codes and recovery
- [ ] **Migration Guide** - Clear upgrade path from XEC-only to token support

## Post-MVP Enhancements

### Iteration 2: Advanced Features
- Token genesis (create new tokens)
- Token minting with mint batons
- Batch operations (multiple token types in one transaction)
- Enhanced token history and analytics

### Iteration 3: Ecosystem Integration
- NFT support (different ALP token type)
- DeFi protocol integration
- Cross-wallet compatibility
- Hardware wallet support

### Iteration 4: Developer Tools
- Token development SDK
- Smart contract integration
- Advanced scripting capabilities
- Multi-signature token operations

## Conclusion

This roadmap provides a structured, risk-aware approach to implementing eToken support in the Minimal XEC Wallet. By following MVP principles and leveraging the proven patterns from the existing XEC operations, we can deliver a robust token wallet that meets user needs while maintaining the high quality standards of the project.

The phased approach allows for incremental progress with clear success criteria at each stage, reducing risk and ensuring that each component is thoroughly tested before moving to the next phase. The comprehensive test suite design ensures that token operations will be as reliable and well-tested as the existing XEC functionality.

Following this roadmap will result in a production-ready eToken wallet that provides users with essential token operations while laying the foundation for future enhancements and advanced features.