# Comprehensive Token Testing Guide

This guide provides complete instructions for testing the hybrid SLP/ALP token functionality in the Minimal XEC Wallet.

## 🎯 Overview

The Minimal XEC Wallet supports both **SLP (Simple Ledger Protocol)** and **ALP (A Ledger Protocol)** tokens with automatic protocol detection. This guide covers all testing scenarios from empty wallets to full token operations, including **UTXO analytics integration** for optimized token management.

## 🚀 Quick Start

### Run Complete Test Suite
```bash
node examples/test-examples.js
```

This runs all tests including **Phase 4: Token Operations** which validates:

- ✅ Token listing (SLP + ALP)
- ✅ Token metadata retrieval  
- ✅ Protocol auto-detection
- ✅ Token send and burn operations
- ✅ Error handling and validation
- ✅ UTXO consolidation with tokens
- ✅ Infrastructure integration
- ✅ Analytics integration for token UTXOs
- ✅ Smart coin selection with token awareness

## 📋 Test Categories

### 1. Infrastructure Validation

**Comprehensive Infrastructure Test**

```bash
node examples/validation/comprehensive-infrastructure-test.js
```

Validates:

- Core wallet functionality
- UTXO consolidation system (95% test coverage)
- Hybrid token management
- Component integration
- Protocol detection capabilities
- Analytics system integration
- Health monitoring for token UTXOs
- Smart coin selection with token awareness

**Expected Output:**

```
🎯 INFRASTRUCTURE TEST RESULTS
✅ Core wallet functionality: WORKING
✅ UTXO consolidation system: WORKING  
✅ Hybrid token management: WORKING
✅ Component integration: WORKING
✅ Protocol detection: WORKING
✅ Analytics system integration: WORKING
✅ Token UTXO health monitoring: WORKING
🚀 MVP Infrastructure Status: COMPLETE AND VALIDATED
```

### 2. Token Information Tests

These work **regardless of whether your wallet holds tokens**.

**List All Tokens in Wallet**

```bash
node examples/tokens/list-all-tokens.js
```

**Get Token Information (External Token)**

```bash
# Using FLCT (SLP token) - works even if you don't hold it
node examples/tokens/get-token-info.js 5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135

# Using token ticker (if in wallet)
node examples/tokens/get-token-info.js FLCT
```

**Check Token Balance**

```bash
# For token you hold
node examples/tokens/get-token-balance.js FLCT

# For external token (shows 0 balance)
node examples/tokens/get-token-balance.js 5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135
```

### 3. Token Operation Validation

These test error handling when wallet has no tokens (expected behavior).

**Test Token Send Validation**

```bash
node examples/tokens/send-any-token.js TEST ecash:qpg562clu3350dnk3z3lenvxgyexyt7j6vnz4qg606 1
```
**Expected:** Shows "No tokens found in wallet" with helpful guidance.

**Test Token Burn Validation**

```bash
node examples/tokens/burn-tokens.js TEST 1  
```
**Expected:** Shows "No tokens found in wallet" with helpful guidance.

### 4. UTXO Management Tests

**UTXO Consolidation Test**

```bash
node examples/optimization/test-utxo-consolidation.js
```

Tests:

- UTXO distribution analysis
- Optimization savings estimation  
- Dry run consolidation analysis
- Smart cost-benefit logic

**Analytics-Enhanced Token Management**

```bash
node examples/analytics/utxo-classification-demo.js
node examples/analytics/health-monitoring-demo.js
```

Tests:

- Token UTXO classification and health assessment
- Smart coin selection with token awareness  
- Optimization recommendations for token-holding wallets
- Performance analysis with mixed XEC/token UTXOs

**Expected Results:**

```
📊 Current Wallet State:
   XEC Balance: 53.47 XEC
   Total UTXOs: 4

📈 UTXO Distribution Analysis:
   Total UTXOs: 4
   Large (> 100000 sats): 4

💰 Optimization Savings Estimate:
   Potential savings: 532 satoshis

✅ UTXO consolidation functionality working correctly
```

## 🪙 Protocol-Specific Testing

### SLP Token Testing

**Test with FLCT Token (SLP)**

```bash
# Get comprehensive info
node examples/tokens/get-token-info.js 5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135
```

**Expected Features:**

- ✅ Protocol: SLP
- ✅ Standard: Simple Ledger Protocol v1  
- ✅ IPFS URL handling
- ✅ Fixed supply detection
- ✅ Explorer links
- ✅ Token UTXO health classification
- ✅ Smart consolidation recommendations

### ALP Token Testing  

**Test with ALP Token (if available)**

```bash
# Replace with actual ALP token ID
node examples/tokens/get-token-info.js <alp_token_id>
```

**Expected Features:**

- ✅ Protocol: ALP
- ✅ Standard: A Ledger Protocol v1
- ✅ eMPP script type
- ✅ Atom-based precision
- ✅ Token UTXO analytics integration
- ✅ Health monitoring for ALP tokens

## 🧪 Advanced Testing Scenarios

### Testing with Real Tokens

If you have tokens in your wallet:

1. **List Your Tokens**
   ```bash
   node examples/tokens/list-all-tokens.js
   ```

2. **Send Tokens** (with confirmation)
   ```bash
   node examples/tokens/send-any-token.js <ticker> <recipient_address> <amount>
   ```

3. **Burn Tokens** (with confirmation)  
   ```bash
   node examples/tokens/burn-tokens.js <ticker> <amount>
   ```

4. **Re-run Infrastructure Tests**
   ```bash
   node examples/validation/comprehensive-infrastructure-test.js
   ```

### Mixed Protocol Wallets

If your wallet has both SLP and ALP tokens:

1. **Verify Protocol Detection**
   ```bash
   node examples/tokens/list-all-tokens.js
   ```
   **Expected:** Shows both SLP and ALP tokens correctly categorized.

2. **Test Operations on Both Types**
   ```bash
   # Test SLP token
   node examples/tokens/get-token-info.js <slp_token_ticker>
   
   # Test ALP token  
   node examples/tokens/get-token-info.js <alp_token_ticker>
   ```

## 🔍 Unit Testing

**Run Token-Related Unit Tests**

```bash
# UTXO consolidation (95% coverage)
npm test -- test/unit/a04-consolidate-utxos-unit.js

# Token protocol detection
npm test -- test/unit/a06-token-protocol-detector-unit.js

# SLP token handler
npm test -- test/unit/a07-slp-token-handler-unit.js  

# ALP token handler
npm test -- test/unit/a08-alp-token-handler-unit.js

# Hybrid token manager
npm test -- test/unit/a09-hybrid-token-manager-unit.js

# UTXO classification (with token support)
npm test -- test/unit/a10-utxo-classifier-unit.js

# Health monitoring (token-aware)
npm test -- test/unit/a11-utxo-health-monitor-unit.js
```

**Expected:** All tests pass with high coverage, including analytics integration.

## 🐛 Troubleshooting

### Common Issues

**1. "No tokens found in wallet"**
- ✅ **Expected behavior** for empty wallets
- Shows helpful guidance for getting tokens
- Tests validation and error handling

**2. "Token ID is required"**  
- Use full 64-character hex token ID
- Or use ticker if token is in your wallet

**3. "Network error" or "chronik" errors**
- Check internet connection
- Chronik API may be temporarily unavailable
- Try again in a few moments

**4. UTXO consolidation shows "Not enough UTXOs"**
- ✅ **Expected behavior** - need 5+ UTXOs for consolidation
- Shows smart cost-benefit analysis
- Prevents wasteful operations

### Debugging Commands

**Check Wallet State**

```bash
node examples/wallet-info/get-balance.js
node examples/wallet-info/get-utxos.js  
```

**Validate Network Connection**

```bash
node examples/advanced/get-xec-price.js
```

**Test Basic Functionality**

```bash
node examples/key-management/validate-address.js <your_address>
```

## 📊 Expected Test Results

### Empty Token Wallet (Default)

**Phase 4.1: Token Information & Discovery**
- ✅ List All Tokens: Shows "No tokens found"
- ✅ Get FLCT Token Info: Shows external token details
- ✅ Get Token Balance: Shows 0 balance with proper explanation

**Phase 4.2: Token Operation Validation**  
- ✅ Token Send Validation: Shows "No tokens found" guidance
- ✅ Token Burn Validation: Shows "No tokens found" guidance

**Phase 4.3: Infrastructure Integration**
- ✅ UTXO Consolidation: Shows optimization analysis
- ✅ Comprehensive Infrastructure: All components validated

### Token-Holding Wallet

**Additional Capabilities:**
- ✅ Real token send operations
- ✅ Real token burn operations  
- ✅ Mixed protocol handling
- ✅ UTXO consolidation with token UTXOs

## 🎯 Success Criteria

### Infrastructure Tests Must Pass:

- [x] Core wallet functionality
- [x] UTXO consolidation (95% test coverage)
- [x] Hybrid token management  
- [x] Component integration
- [x] Protocol detection
- [x] Analytics system integration
- [x] Token UTXO health monitoring
- [x] Smart coin selection with token awareness

### Token Tests Must Show:

- [x] Proper empty wallet handling
- [x] External token metadata lookup
- [x] Protocol auto-detection (SLP/ALP)
- [x] Error handling with helpful guidance
- [x] UTXO optimization integration
- [x] Token UTXO classification and health scoring
- [x] Analytics-enhanced optimization recommendations
- [x] Performance analysis for mixed XEC/token wallets

### Educational Value Must Include:

- [x] Clear explanations of SLP vs ALP
- [x] Helpful error messages with recovery steps
- [x] Links to resources and documentation  
- [x] Examples of both success and error cases
- [x] Analytics integration examples for token management
- [x] Performance optimization guidance for token wallets

## 🚀 Production Readiness

The token system is **production-ready** when:

✅ **All infrastructure tests pass**
✅ **Token examples handle empty wallets gracefully**  
✅ **External token lookups work correctly**
✅ **Error handling provides helpful guidance**
✅ **UTXO consolidation integrates properly**
✅ **Protocol detection works automatically**
✅ **Analytics system integrates with token operations**
✅ **Smart coin selection handles tokens appropriately**
✅ **Health monitoring works for token UTXOs**

## 🔗 Additional Resources

- **SLP Tokens:** https://tokens.bch.sx/
- **eCash Explorer:** https://explorer.e.cash/
- **Chronik API:** https://chronik.e.cash/
- **Analytics Examples:** `examples/analytics/`
- **Token Examples:** `examples/tokens/`
- **API Documentation:** `README.md`
- **UTXO Guide:** `docs/UTXO_OPTIMIZATION_GUIDE.md`

## 💡 Next Steps

1. **Run the complete test suite:** `node examples/test-examples.js`
2. **Test individual components** as needed
3. **Get some test tokens** from faucets for full testing
4. **Build your token-enabled application** using the examples as templates
5. **Contribute back** any improvements or additional test cases

---

**Happy Testing! 🧪✨**

The Minimal XEC Wallet now provides comprehensive SLP/ALP token support with robust testing infrastructure. All components are validated and ready for production use.