# minimal-xec-wallet

A minimalist eCash (XEC) wallet npm library for web applications with full SLP and ALP token support.

[![npm version](https://badge.fury.io/js/minimal-xec-wallet.svg)](https://badge.fury.io/js/minimal-xec-wallet)
[![Test Coverage](https://img.shields.io/badge/coverage-424%20tests-green.svg)](./test/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Features

### ✅ Core Wallet Operations
- **HD Wallets**: BIP44 hierarchical deterministic key generation
- **Import/Export**: Support for mnemonic phrases, WIF, and hex private keys
- **Address Management**: XEC address generation and validation
- **Balance Queries**: Real-time XEC balance with confirmed/unconfirmed breakdown

### ✅ XEC Transactions
- **Send XEC**: Single and multi-output transactions
- **Send All**: Empty wallet functionality
- **Fee Optimization**: Intelligent UTXO selection and fee calculation
- **UTXO Consolidation**: Automatic optimization for better performance

### ✅ eToken Support (SLP + ALP)
- **Protocol Auto-Detection**: Automatic SLP/ALP protocol identification
- **Token Operations**: Send, burn, list tokens across both protocols
- **Token Metadata**: Automatic fetching of token info (name, symbol, decimals)
- **Hybrid Management**: Unified API for both SLP and ALP tokens

### ✅ Advanced Features
- **OP_RETURN**: Embed data in blockchain transactions
- **Security**: AES-256 mnemonic encryption, dust attack protection
- **Network Resilience**: Multiple Chronik endpoint failover
- **Price Queries**: Real-time XEC/USD pricing

## 🚀 Quick Start

### Installation

```bash
npm install minimal-xec-wallet
```

### Basic Usage

```javascript
const MinimalXECWallet = require('minimal-xec-wallet')

// Create new wallet
const wallet = new MinimalXECWallet()
await wallet.initialize()

// Check balance
const balance = await wallet.getXecBalance()
console.log(`Balance: ${balance} XEC`)

// Send XEC
const txid = await wallet.sendXec([
  { address: 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy', amountSats: 10000 }
])

// List all tokens (SLP + ALP)
const tokens = await wallet.listETokens()
tokens.forEach(token => {
  console.log(`${token.ticker}: ${token.balance}`)
})

// Send tokens
await wallet.sendETokens('tokenId...', [
  { address: 'ecash:qp123...', amount: 100 }
])
```

### Browser Usage

```html
<script src="https://unpkg.com/minimal-xec-wallet/dist/minimal-xec-wallet.min.js"></script>
<script>
  const wallet = new MinimalXecWallet()

  // Initialize with automatic browser compatibility
  wallet.initialize().then(() => {
    console.log('Wallet ready for all browsers!')
    // Use same API as Node.js
  })
</script>
```

**Browser Compatibility**: Automatic WebAssembly loading with JavaScript fallbacks for older browsers. See [Browser Compatibility Guide](./docs/BROWSER_COMPATIBILITY.md) for details.

## 📚 Documentation

### API Reference
- **[Complete API Documentation](./WALLET_API.md)** - All methods with examples
- **[Examples Collection](./examples/README.md)** - 25+ working examples
- **[Development Docs](./docs/README.md)** - Architecture and implementation details
- **[Browser Compatibility Guide](./docs/BROWSER_COMPATIBILITY.md)** - WebAssembly and fallback support

### Quick Links
- **[Wallet Creation Examples](./examples/wallet-creation/)** - Create, restore, import wallets
- **[Transaction Examples](./examples/transactions/)** - Send XEC, multi-output, send-all
- **[Token Examples](./examples/tokens/)** - SLP/ALP token operations
- **[Advanced Examples](./examples/advanced/)** - OP_RETURN, optimization, price queries, compatibility testing

## 🧪 Testing

### Run Tests

```bash
# All tests (424 unit + 29 integration)
npm run test:all

# Unit tests only (fast)
npm run test:unit

# Integration tests (requires network)
npm run test:integration

# Test coverage report
npm run test:coverage

# Browser compatibility test
node examples/advanced/browser-compatibility-test.js
```

### Example Testing

```bash
# Run all examples with guided testing
node examples/test-examples.js

# Test specific functionality
node examples/tokens/list-all-tokens.js
node examples/transactions/send-xec.js

# Test browser compatibility
node examples/advanced/browser-compatibility-test.js
```

## 🏗️ Architecture

### Modern Design
- **Modular Architecture**: Clean separation of concerns
- **Protocol Agnostic**: Supports both SLP and ALP token standards
- **Network Resilient**: Multiple Chronik endpoint failover
- **Security First**: Built-in protections against common attacks

### Core Components
- **HybridTokenManager**: Unified SLP/ALP token operations
- **RobustChronikRouter**: Network failover and error handling
- **ConsolidateUtxos**: UTXO optimization engine
- **KeyDerivation**: HD wallet key management

### Dependencies
- **chronik-client**: eCash blockchain indexer
- **ecash-lib**: Core eCash transaction building
- **@scure/bip39**: Secure mnemonic generation
- **crypto-js**: AES encryption for mnemonics

## 🔧 Advanced Configuration

### Custom Options

```javascript
const wallet = new MinimalXECWallet(mnemonic, {
  hdPath: "m/44'/899'/0'/0/0",        // Custom derivation path
  fee: 2.0,                          // Fee rate in sats/byte
  chronikUrls: ['https://chronik.e.cash'], // Custom endpoints
  enableDonations: false,            // Privacy mode
  password: 'secure123'              // Mnemonic encryption
})
```

### Environment Variables

```bash
# Test mode
NODE_ENV=test npm test

# Development mode
NODE_ENV=development npm start
```

## 🤝 Contributing

### Development Setup

```bash
git clone https://github.com/zh/minimal-xec-wallet
cd minimal-xec-wallet
npm install
npm run test:unit
```

### Code Quality

```bash
# Linting
npm run lint

# Build for browser
npm run build

# Generate API docs
npm run docs
```

## 📊 Project Stats

- **424 Unit Tests** - Comprehensive coverage of all features
- **29 Integration Tests** - Real network validation
- **25+ Examples** - Working code for all use cases
- **6 Token Protocols** - SLP Type 1, ALP Standard, auto-detection
- **7 Chronik Endpoints** - Robust network failover

## 🔗 Resources

### eCash Ecosystem
- **[eCash](https://e.cash)** - Official eCash website
- **[CashTab Wallet](https://cashtab.com)** - Reference web wallet
- **[Block Explorer](https://explorer.e.cash)** - Transaction lookup

### Development
- **[Chronik Indexer](https://chronik.e.cash/)** - Blockchain API
- **[ecash-lib Documentation](https://www.npmjs.com/package/ecash-lib)** - Core library
- **[SLP and ALP tokens](https://github.com/Bitcoin-ABC/bitcoin-abc/tree/master/cashtab/src/token-protocols)** - CashTab token protocols

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🤔 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/minimal-xec-wallet/issues)
- **Examples**: See `./examples` directory for working code
- **API Docs**: Run `npm run docs` for detailed API documentation
- **Community**: eCash developer channels

---

**Security Notice**: This library handles real cryptocurrency. Always test with small amounts first and keep your mnemonic phrases secure.
