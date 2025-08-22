# UTXO Analytics Examples

This directory contains comprehensive examples demonstrating the advanced UTXO analytics features added to the minimal-xec-wallet library. These features provide powerful tools for wallet optimization, security analysis, and privacy enhancement.

## Overview

The UTXO analytics system includes:

- **UTXO Classification**: Analyze UTXOs by age, value, and privacy characteristics
- **Health Monitoring**: Monitor wallet health and detect potential issues
- **Smart Coin Selection**: Intelligent UTXO selection with multiple strategies
- **Dust Attack Detection**: Identify and mitigate privacy threats
- **Wallet Optimization**: Comprehensive optimization recommendations

## Examples

### 1. UTXO Classification Demo (`utxo-classification-demo.js`)

Demonstrates how to classify UTXOs and analyze their characteristics.

```bash
node utxo-classification-demo.js
```

**Features shown:**
- Enabling analytics in wallet configuration
- Classifying UTXOs by age (fresh, recent, mature, aged, ancient)
- Categorizing by value (dust, micro, small, medium, large, whale)  
- Privacy scoring (0-100 based on fingerprinting risks)
- Health assessment and metadata extraction
- Filtering UTXOs by classification criteria

### 2. Health Monitoring Demo (`health-monitoring-demo.js`)

Shows comprehensive health monitoring and issue detection.

```bash
node health-monitoring-demo.js
```

**Features shown:**
- Wallet health assessment
- Individual UTXO health scoring
- Alert generation for critical issues
- System-wide recommendations
- Performance impact analysis
- Economic viability calculations

### 3. Advanced Coin Selection Demo (`advanced-coin-selection-demo.js`)

Demonstrates intelligent UTXO selection strategies.

```bash
node advanced-coin-selection-demo.js
```

**Features shown:**
- Efficient strategy (minimize fees)
- Privacy strategy (maximize anonymity)
- Balanced strategy (optimal trade-offs)
- Conservative strategy (prefer confirmed UTXOs)
- Classification-based filtering
- Performance comparisons

### 4. Dust Attack Detection Demo (`dust-attack-detection-demo.js`)

Comprehensive dust attack detection and analysis.

```bash
node dust-attack-detection-demo.js
```

**Features shown:**
- Dust attack pattern recognition
- Suspicious UTXO identification
- Confidence scoring
- Risk level assessment
- Defense strategies
- Multiple attack scenarios

### 5. Wallet Optimization Demo (`wallet-optimization-demo.js`)

Complete wallet optimization analysis and recommendations.

```bash
node wallet-optimization-demo.js
```

**Features shown:**
- Comprehensive wallet analysis
- Consolidation opportunity identification
- Privacy optimization suggestions
- Cost-benefit analysis
- Actionable optimization plans
- Long-term strategy recommendations

## Configuration

To enable analytics in your wallet, use the following configuration:

```javascript
const walletOptions = {
  utxoAnalytics: {
    enabled: true,
    debug: false, // Set to true for detailed logging
    classificationConfig: {
      ageThresholds: {
        fresh: 6,     // ~1 hour (in blocks)
        recent: 144,  // ~1 day
        mature: 1008, // ~1 week  
        aged: 4032    // ~1 month
      },
      valueThresholds: {
        dust: 1000,     // 10 XEC
        micro: 5000,    // 50 XEC
        small: 50000,   // 500 XEC
        medium: 500000, // 5000 XEC
        large: 5000000  // 50000 XEC
      }
    },
    healthMonitorConfig: {
      dustLimit: 546,
      economicalThreshold: 2.0,
      alertThresholds: {
        highDustRatio: 0.7,
        lowLiquidity: 0.3,
        highConsolidationNeed: 0.5
      },
      suspiciousPatterns: {
        dustAttackSize: 10,
        rapidDeposits: 5,
        timeWindow: 3600000 // 1 hour in milliseconds
      }
    }
  }
}

const wallet = new MinimalXECWallet(mnemonic, walletOptions)
```

## Key Methods

### Classification Methods

```javascript
// Check if analytics are enabled
const hasAnalytics = wallet.utxos.hasAnalytics()

// Get UTXO classifications
const classifications = wallet.utxos.getUtxoClassifications()

// Get classification statistics
const stats = wallet.utxos.getClassificationStats()

// Filter UTXOs by classification
const filteredUtxos = wallet.utxos.getSpendableXecUtxos({
  useClassifications: true,
  classificationFilter: {
    minHealthScore: 70,
    minPrivacyScore: 60,
    allowedAges: ['mature', 'aged', 'ancient']
  }
})
```

### Health Monitoring Methods

```javascript
// Get comprehensive health report
const healthReport = wallet.utxos.getWalletHealthReport()

// Get optimization recommendations
const recommendations = wallet.utxos.getOptimizationRecommendations()

// Detect security threats
const threats = wallet.utxos.detectSecurityThreats(walletAddress)
```

### Smart Coin Selection

```javascript
// Select UTXOs with different strategies
const efficientSelection = wallet.utxos.selectOptimalUtxos(targetAmount, {
  strategy: 'efficient',
  feeRate: 1.0
})

const privacySelection = wallet.utxos.selectOptimalUtxos(targetAmount, {
  strategy: 'privacy',
  feeRate: 1.0
})

const balancedSelection = wallet.utxos.selectOptimalUtxos(targetAmount, {
  strategy: 'balanced',
  feeRate: 1.0
})
```

## Classification Categories

### Age Classifications
- **Fresh**: ≤ 6 blocks (~1 hour)
- **Recent**: ≤ 144 blocks (~1 day)
- **Mature**: ≤ 1008 blocks (~1 week)
- **Aged**: ≤ 4032 blocks (~1 month)
- **Ancient**: > 4032 blocks
- **Unconfirmed**: blockHeight = -1

### Value Classifications
- **Dust**: < 1,000 satoshis (< 10 XEC)
- **Micro**: < 5,000 satoshis (< 50 XEC)
- **Small**: < 50,000 satoshis (< 500 XEC)
- **Medium**: < 500,000 satoshis (< 5,000 XEC)
- **Large**: < 5,000,000 satoshis (< 50,000 XEC)
- **Whale**: ≥ 5,000,000 satoshis (≥ 50,000 XEC)

### Health Classifications
- **Healthy**: Economical to spend, good privacy
- **At-Risk**: Marginally economical
- **Dust**: Too small to spend economically
- **Suspicious**: Potential dust attack indicators
- **Unconfirmed**: Not yet confirmed
- **Stuck**: Unconfirmed for too long

## Selection Strategies

### Efficient Strategy
- Minimizes transaction fees
- Prefers larger, economical UTXOs
- Optimizes for cost-effectiveness

### Privacy Strategy  
- Maximizes transaction privacy
- Avoids fingerprinting patterns
- Prefers aged, non-round amounts

### Balanced Strategy
- Balances efficiency and privacy
- Considers health scores
- Good for general use

### Conservative Strategy
- Prefers confirmed UTXOs
- Prioritizes reliability
- Best for important transactions

## Security Features

### Dust Attack Detection
- Pattern recognition for suspicious micro-UTXOs
- Confidence scoring for threat assessment
- Automatic quarantine recommendations

### Privacy Analysis
- Round number detection
- Fingerprinting risk assessment
- Privacy score calculation

### Health Monitoring
- Economic viability analysis
- Alert generation for issues
- Optimization recommendations

## Performance Considerations

- Analytics are completely optional (disabled by default)
- Minimal impact on existing wallet operations
- Efficient caching and incremental updates
- Graceful degradation when analytics unavailable

## Testing

All examples include both real wallet scenarios and mock data demonstrations. The mock data examples will run even when the wallet has no UTXOs, making them perfect for testing and learning.

## Integration

These analytics features are designed to enhance existing wallet functionality without breaking changes. All existing wallet operations continue to work exactly as before when analytics are disabled.

For more information, see the main wallet documentation and unit tests in the `test/` directory.