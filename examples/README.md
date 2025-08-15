# Minimal XEC Wallet - Examples

This directory contains comprehensive examples demonstrating how to use the minimal-xec-wallet library for eCash (XEC) blockchain operations.

## 📁 Directory Structure

```
examples/
├── wallet-creation/          # Create, restore, import wallets
├── wallet-info/             # Check balance, UTXOs, transactions  
├── transactions/            # Send XEC, multi-output, send-all
├── advanced/                # OP_RETURN, optimization, price checking
├── key-management/          # Address derivation, validation
├── utils/                   # Helper utilities (QR codes, wallet helper)
├── test-examples.js         # End-to-end testing script
└── README.md               # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Your First Wallet

```bash
cd examples
node wallet-creation/create-new-wallet.js
```

This creates a `wallet.json` file that all other examples will use.

### 3. Fund Your Wallet

Your wallet needs XEC for transaction examples:

```bash
# Show your address with QR code for easy funding
node utils/show-qr.js $(node -e "console.log(require('./wallet.json').xecAddress)")
```

Send XEC to the displayed address using:
- [CashTab Wallet](https://cashtab.com)
- Cryptocurrency exchanges (Binance, KuCoin, Gate.io)
- Another XEC wallet

### 4. Check Balance

```bash
node wallet-info/get-balance.js
```

### 5. Run All Examples

```bash
# Automated test suite with funding break
node test-examples.js
```

## 📚 Example Categories

### 🔑 Wallet Creation (`wallet-creation/`)

| Example | Description | Requirements |
|---------|-------------|--------------|
| `create-new-wallet.js` | Generate new wallet with random mnemonic | None |
| `restore-from-mnemonic.js` | Restore wallet from 12-word phrase | Mnemonic phrase |
| `import-from-wif.js` | Import wallet from private key | WIF or hex private key |

**Usage:**
```bash
# Create new wallet
node wallet-creation/create-new-wallet.js

# Restore from mnemonic (interactive or command line)
node wallet-creation/restore-from-mnemonic.js
node wallet-creation/restore-from-mnemonic.js word1 word2 ... word12

# Import from private key
node wallet-creation/import-from-wif.js L1234...abcd
node wallet-creation/import-from-wif.js 1234567890abcdef...
```

### 💰 Wallet Information (`wallet-info/`)

| Example | Description | Requirements |
|---------|-------------|--------------|
| `get-balance.js` | Display XEC balance and USD value | Wallet |
| `get-utxos.js` | List all UTXOs with analysis | Wallet |
| `get-transactions.js` | Show transaction history | Wallet |

**Usage:**
```bash
node wallet-info/get-balance.js
node wallet-info/get-utxos.js
node wallet-info/get-transactions.js
```

### 💸 Transactions (`transactions/`)

| Example | Description | Requirements |
|---------|-------------|--------------|
| `send-xec.js` | Send XEC to single recipient | Funded wallet |
| `send-to-multiple.js` | Send XEC to multiple recipients | Funded wallet |
| `send-all-xec.js` | Send all XEC (empty wallet) | Funded wallet |

**Usage:**
```bash
# Send 100 XEC to an address
node transactions/send-xec.js ecash:qp1234...abc 100

# Send to multiple recipients
node transactions/send-to-multiple.js ecash:qp123...abc 50 ecash:qr456...def 30

# Send all XEC (empty wallet)
node transactions/send-all-xec.js ecash:qp1234...abc
```

### ⚡ Advanced Features (`advanced/`)

| Example | Description | Requirements |
|---------|-------------|--------------|
| `send-op-return.js` | Embed data in blockchain | Funded wallet |
| `optimize-utxos.js` | Consolidate UTXOs for efficiency | Multiple UTXOs |
| `get-xec-price.js` | Get current XEC/USD price | Internet connection |

**Usage:**
```bash
# Embed message in blockchain
node advanced/send-op-return.js "Hello XEC blockchain!"

# UTXO optimization (preview)
node advanced/optimize-utxos.js --dry-run
node advanced/optimize-utxos.js

# Get current XEC price
node advanced/get-xec-price.js
```

### 🔐 Key Management (`key-management/`)

| Example | Description | Requirements |
|---------|-------------|--------------|
| `derive-addresses.js` | Generate multiple addresses | HD wallet (mnemonic) |
| `validate-address.js` | Validate XEC address format | None |

**Usage:**
```bash
# Generate 10 addresses from mnemonic
node key-management/derive-addresses.js 10

# Validate address format
node key-management/validate-address.js ecash:qp1234...abc
```

### 🛠️ Utilities (`utils/`)

| Utility | Description | Requirements |
|---------|-------------|--------------|
| `wallet-helper.js` | Wallet persistence library | Used by all examples |
| `show-qr.js` | Display QR code for address | Valid XEC address |

**Usage:**
```bash
# Show QR code for easy mobile scanning
node utils/show-qr.js ecash:qp1234567890abcdef1234567890abcdef1234567890
```

## 🧪 Testing Examples

### Automated Testing

The `test-examples.js` script runs all examples in sequence with proper funding workflow:

```bash
node test-examples.js
```

**Test Flow:**
1. **Phase 1: Wallet Creation** - Creates and validates wallet
2. **Funding Break** - Shows QR code, waits for funding
3. **Phase 2: Utilities** - Tests non-transaction features  
4. **Phase 3: Transactions** - Tests real XEC transactions (with confirmation)

### Manual Testing

Test individual examples:

```bash
# Test wallet creation
node wallet-creation/create-new-wallet.js

# Test balance checking
node wallet-info/get-balance.js

# Test transactions (requires funding)
node transactions/send-xec.js ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy 1
```

## 💡 Best Practices

### Security

- **Never commit wallet.json** - Contains private keys
- **Keep mnemonic phrases secure** - Anyone with your mnemonic can access funds
- **Test with small amounts first** - Verify addresses before large transactions
- **Backup your wallet** - Save mnemonic phrase safely

### Development Workflow

1. **Start with wallet creation examples**
2. **Fund wallet for transaction testing**
3. **Use dry-run modes when available**
4. **Validate addresses before sending**
5. **Monitor transactions with block explorer**

### Error Handling

- **Insufficient funds** - Check balance, fund wallet
- **Invalid addresses** - Use address validation utility
- **Network errors** - Check internet connection, try again
- **Transaction failures** - Check fees, UTXOs, network status

## 🔗 Useful Resources

### XEC Network
- **Block Explorer**: https://explorer.e.cash
- **CashTab Wallet**: https://cashtab.com
- **eCash.org**: https://e.cash

### Exchanges (to buy XEC)
- **Binance**: XEC/USDT, XEC/BTC
- **KuCoin**: XEC/USDT
- **Gate.io**: XEC/USDT

### Development
- **Library Source**: https://github.com/your-repo/minimal-xec-wallet
- **API Documentation**: ../docs/
- **Test Coverage**: Run `npm test`

## 🐛 Troubleshooting

### Common Issues

**1. "No wallet.json file found"**
```bash
# Solution: Create a wallet first
node wallet-creation/create-new-wallet.js
```

**2. "Insufficient funds"**
```bash
# Solution: Fund your wallet
node utils/show-qr.js $(node -e "console.log(require('./wallet.json').xecAddress)")
# Then send XEC to the displayed address
```

**3. "Invalid address format"**
```bash
# Solution: Validate the address
node key-management/validate-address.js YOUR_ADDRESS
```

**4. "Network connection error"**
- Check internet connection
- Try again in a few moments
- Chronik indexer might be temporarily unavailable

**5. "Transaction failed"**
- Check wallet balance
- Verify recipient address
- Ensure sufficient fee coverage

### Getting Help

1. **Check error messages** - They usually explain the issue
2. **Validate inputs** - Use validation utilities
3. **Test with small amounts** - Before large transactions
4. **Check network status** - Via block explorer
5. **Review documentation** - This README and source code

## 📝 Example Output

### Successful Wallet Creation
```
🚀 Creating new XEC wallet...

✅ New wallet created successfully!

📋 New Wallet Details:
══════════════════════════════════════════════════════
Mnemonic: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
XEC Address: ecash:qrdczda80g7red03zqd02uuxjhfqxrthdywrq8cx3a
HD Path: m/44'/899'/0'/0/0
══════════════════════════════════════════════════════

✅ Wallet saved to: /path/to/examples/wallet.json
📍 XEC Address: ecash:qrdczda80g7red03zqd02uuxjhfqxrthdywrq8cx3a
```

### Successful Transaction
```
💸 Sending XEC transaction...

📋 Transaction Details:
════════════════════════════════════════════════════════════
From: ecash:qrdczda80g7red03zqd02uuxjhfqxrthdywrq8cx3a
To: ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy
Amount: 100 XEC
Current Balance: 1,000 XEC
════════════════════════════════════════════════════════════

✅ Transaction sent successfully!
════════════════════════════════════════════════════════════
Transaction ID: abc123def456...
Amount Sent: 100 XEC
Fee Paid: 0.01 XEC
New Balance: 899.99 XEC
════════════════════════════════════════════════════════════
```

## 🎯 Next Steps

After running the examples:

1. **Explore the source code** - Learn how each feature works
2. **Build your own application** - Use these examples as templates  
3. **Implement eTokens** - Phase 2 features (coming soon)
4. **Contribute improvements** - Submit PRs for enhancements
5. **Join the community** - eCash developer channels

---

**⚠️ Important**: These examples use real XEC on the mainnet. Always test with small amounts first!

**🔐 Security Reminder**: Keep your mnemonic phrase secure. Anyone with access to it can control your funds.