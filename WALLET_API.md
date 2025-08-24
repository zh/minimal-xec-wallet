# Minimal XEC Wallet - API Reference

Complete reference guide for all `@minimal-xec-wallet` library methods, organized by functionality category.

## Table of Contents

- [Wallet Creation & Management](#wallet-creation--management)
- [Key Management](#key-management)
- [Balance & UTXO Operations](#balance--utxo-operations)
- [XEC Transactions](#xec-transactions)
- [eToken Operations](#etoken-operations)
- [UTXO Analytics & Optimization](#utxo-analytics--optimization)
- [Advanced Features](#advanced-features)
- [Utility Methods](#utility-methods)
- [Network & Validation](#network--validation)

---

## Wallet Creation & Management

### constructor(hdPrivateKeyOrMnemonic, advancedOptions)

Creates a new wallet instance from mnemonic, WIF private key, or generates a new one.

**Parameters:**
- `hdPrivateKeyOrMnemonic` (string, optional) - 12-word mnemonic, WIF private key, or hex private key. If omitted, generates new random mnemonic
- `advancedOptions` (object, optional) - Configuration options

**Advanced Options:**

- `hdPath` (string) - HD derivation path (default: "m/44'/899'/0'/0/0")
- `chronikUrls` (array) - Array of Chronik endpoints for API calls
- `fee` (number) - Transaction fee rate in sats/byte (default: 1.2)
- `password` (string) - Password for encrypting/decrypting mnemonic
- `enableDonations` (boolean) - Enable donation outputs (default: false)
- `utxoAnalytics` (object) - Enable advanced UTXO analytics and optimization

**UTXO Analytics Configuration:**

- `utxoAnalytics.enabled` (boolean) - Enable analytics features (default: false)
- `utxoAnalytics.debug` (boolean) - Enable debug logging (default: false)
- `utxoAnalytics.classificationConfig` (object) - Classification thresholds
- `utxoAnalytics.healthMonitorConfig` (object) - Health monitoring settings

**Example:**

```javascript
// Generate new wallet
const wallet = new MinimalXECWallet()

// Restore from mnemonic
const wallet = new MinimalXECWallet('abandon abandon abandon...')

// Import from WIF
const wallet = new MinimalXECWallet('L1234567890abcdef...')

// With options including analytics
const wallet = new MinimalXECWallet(mnemonic, { 
  fee: 2.0, 
  enableDonations: false,
  utxoAnalytics: {
    enabled: true,
    debug: false,
    classificationConfig: {
      ageThresholds: {
        fresh: 6,     // ~1 hour
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
    }
  }
})
```

### async create(mnemonicOrWif)

Internal method that creates wallet info from input. Returns wallet details object.

**Parameters:**
- `mnemonicOrWif` (string, optional) - Same as constructor parameter

**Returns:** `Object` containing wallet information:
- `mnemonic` - 12-word recovery phrase
- `privateKey` - Private key in hex format
- `publicKey` - Public key
- `xecAddress` - eCash address (ecash: format)
- `hdPath` - HD derivation path

### async initialize()

Initializes the wallet by loading UTXOs and token data. Must be called before transactions.

**Returns:** `boolean` - True when initialization is complete

**Example:**

```javascript
const wallet = new MinimalXECWallet()
await wallet.initialize()
```

### encrypt(mnemonic, password)

Encrypts a mnemonic phrase using AES-256-CBC with PBKDF2 key derivation.

**Parameters:**
- `mnemonic` (string) - 12-word mnemonic to encrypt
- `password` (string) - Password for encryption (minimum 8 characters)

**Returns:** `string` - Encrypted mnemonic as JSON string

**Example:**

```javascript
const encrypted = wallet.encrypt(mnemonic, 'securePassword123')
```

### decrypt(mnemonicEncrypted, password)

Decrypts an encrypted mnemonic phrase. Supports both new and legacy formats.

**Parameters:**
- `mnemonicEncrypted` (string) - Encrypted mnemonic JSON string
- `password` (string) - Password for decryption

**Returns:** `string` - Decrypted mnemonic phrase

**Example:**

```javascript
const mnemonic = wallet.decrypt(encryptedData, 'securePassword123')
```

---

## Key Management

### async getKeyPair(hdIndex)

Generates a key pair for a specific HD wallet index using the same derivation path pattern as the main wallet.

**Parameters:**
- `hdIndex` (number, optional) - HD index for key derivation (default: 0)

**Returns:** `Object` containing:
- `hdIndex` - The HD index used
- `wif` - Private key in hex format (not WIF)
- `publicKey` - Public key in hex format
- `xecAddress` - eCash address for this key pair

**Behavior:**
- Uses the wallet's configured hdPath pattern, respecting the coin type (899 for standard eCash, 1899 for CashTab)
- For a wallet with hdPath `m/44'/899'/0'/0/0`, calling `getKeyPair(1)` generates keys for `m/44'/899'/0'/0/1`
- For a wallet with hdPath `m/44'/1899'/0'/0/0`, calling `getKeyPair(1)` generates keys for `m/44'/1899'/0'/0/1`

**Examples:**

```javascript
// Standard eCash wallet (coin type 899)
const standardWallet = new MinimalXecWallet(mnemonic, { hdPath: "m/44'/899'/0'/0/0" })
const keyPair1 = await standardWallet.getKeyPair(1)
console.log(keyPair1.xecAddress) // Address derived from m/44'/899'/0'/0/1

// CashTab wallet (coin type 1899)
const cashtabWallet = new MinimalXecWallet(mnemonic, { hdPath: "m/44'/1899'/0'/0/0" })
const keyPair1 = await cashtabWallet.getKeyPair(1)
console.log(keyPair1.xecAddress) // Address derived from m/44'/1899'/0'/0/1 (different from above)
```

### exportPrivateKeyAsWIF(compressed, testnet)

Exports the wallet's private key in WIF (Wallet Import Format).

**Parameters:**
- `compressed` (boolean, optional) - Use compressed format (default: true)
- `testnet` (boolean, optional) - Export for testnet (default: false)

**Returns:** `string` - Private key in WIF format

**Example:**

```javascript
// Export compressed mainnet WIF
const wif = wallet.exportPrivateKeyAsWIF()

// Export uncompressed testnet WIF
const wif = wallet.exportPrivateKeyAsWIF(false, true)
```

### validateWIF(wif)

Validates if a string is a valid WIF private key format.

**Parameters:**
- `wif` (string) - WIF string to validate

**Returns:** `boolean` - True if valid WIF format

**Example:**

```javascript
const isValid = wallet.validateWIF('L1234567890abcdef...')
```

---

## Balance & UTXO Operations

### async getXecBalance(inObj)

Gets the total XEC balance for an address or the wallet's address.

**Parameters:**
- `inObj` (string|object, optional) - XEC address string or object with `xecAddress` property

**Returns:** `number` - Balance in XEC (confirmed + unconfirmed)

**Example:**

```javascript
// Get wallet balance
const balance = await wallet.getXecBalance()

// Get balance for specific address
const balance = await wallet.getXecBalance('ecash:qp123...')
const balance = await wallet.getXecBalance({ xecAddress: 'ecash:qp123...' })
```

### async getDetailedBalance(inObj)

Gets detailed balance information including confirmed and unconfirmed amounts.

**Parameters:**
- `inObj` (string|object, optional) - XEC address string or object with `xecAddress` property

**Returns:** `Object` containing:
- `confirmed` - Confirmed balance in XEC
- `unconfirmed` - Unconfirmed balance in XEC
- `total` - Total balance in XEC
- `satoshis` - Balance amounts in satoshis

**Example:**

```javascript
const balance = await wallet.getDetailedBalance()
console.log(`Confirmed: ${balance.confirmed} XEC`)
console.log(`Unconfirmed: ${balance.unconfirmed} XEC`)
console.log(`Total: ${balance.total} XEC`)
```

### async getUtxos(xecAddress)

Gets all UTXOs (Unspent Transaction Outputs) for an address.

**Parameters:**
- `xecAddress` (string, optional) - XEC address (uses wallet address if omitted)

**Returns:** `Array` - Array of UTXO objects with transaction data

**Example:**

```javascript
const utxos = await wallet.getUtxos()
console.log(`Found ${utxos.length} UTXOs`)
```

### async optimize(dryRun)

Optimizes wallet performance by consolidating small UTXOs into larger ones.

**Parameters:**
- `dryRun` (boolean, optional) - Preview optimization without executing (default: false)

**Returns:** `Object` - Optimization results and transaction details

**Example:**

```javascript
// Preview optimization
const preview = await wallet.optimize(true)

// Execute optimization
const result = await wallet.optimize()
```

---

## XEC Transactions

### async sendXec(outputs)

Sends XEC to one or multiple recipients.

**Parameters:**
- `outputs` (array) - Array of output objects with `address` and `amountSats` properties

**Returns:** `string` - Transaction ID (TXID)

**Example:**

```javascript
// Send to single recipient
const txid = await wallet.sendXec([
  { address: 'ecash:qp123...', amountSats: 10000 } // 100 XEC
])

// Send to multiple recipients
const txid = await wallet.sendXec([
  { address: 'ecash:qp123...', amountSats: 5000 },  // 50 XEC
  { address: 'ecash:qr456...', amountSats: 3000 }   // 30 XEC
])
```

### async sendAllXec(toAddress)

Sends all available XEC to a single address (empties the wallet).

**Parameters:**
- `toAddress` (string) - Recipient XEC address

**Returns:** `string` - Transaction ID (TXID)

**Example:**

```javascript
const txid = await wallet.sendAllXec('ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy')
```

### async sendOpReturn(msg, prefix, xecOutput, satsPerByte)

Sends an OP_RETURN transaction to embed data in the blockchain.

**Parameters:**
- `msg` (string, optional) - Message to embed (default: '')
- `prefix` (string, optional) - Hex prefix for the message (default: '6d02')
- `xecOutput` (array, optional) - Additional XEC outputs (default: [])
- `satsPerByte` (number, optional) - Fee rate (default: 1.0)

**Returns:** `string` - Transaction ID (TXID)

**Example:**

```javascript
// Simple message
const txid = await wallet.sendOpReturn('Hello XEC blockchain!')

// With custom prefix and outputs
const txid = await wallet.sendOpReturn(
  'Custom message',
  '6d03',
  [{ address: 'ecash:qp123...', amountSats: 1000 }],
  2.0
)
```

---

## UTXO Analytics & Optimization

The wallet includes advanced UTXO analytics for optimization, health monitoring, and smart coin selection.

### Enabling Analytics

Analytics must be enabled during wallet construction:

```javascript
const wallet = new MinimalXECWallet(mnemonic, {
  utxoAnalytics: {
    enabled: true,
    debug: false // Set to true for detailed logging
  }
})
```

### async getWalletHealthReport()

Generates a comprehensive health report for all wallet UTXOs.

**Returns:** `Object` containing:
- `summary` - Overall health statistics
- `assessments` - Individual UTXO health assessments  
- `alerts` - Critical issues requiring attention
- `recommendations` - Optimization suggestions

**Example:**

```javascript
// Get wallet health report
const healthReport = await wallet.utxos.getWalletHealthReport()
console.log(`Health: ${healthReport.summary.healthPercentage}%`)
console.log(`Spendable: ${healthReport.summary.spendablePercentage}%`)

// Check for alerts
healthReport.alerts.forEach(alert => {
  console.log(`Alert: ${alert.message}`)
})
```

### async getUtxoClassifications()

Returns detailed classifications for all UTXOs.

**Returns:** `Map` of UTXO ID to classification objects containing:
- `age` - Age category (fresh, recent, mature, aged, ancient)
- `value` - Value category (dust, micro, small, medium, large, whale)
- `health` - Health status (healthy, at-risk, dust, suspicious)
- `privacy` - Privacy score (0-100)
- `healthScore` - Overall health score (0-100)

**Example:**

```javascript
const classifications = await wallet.utxos.getUtxoClassifications()
for (const [utxoId, classification] of classifications) {
  console.log(`${utxoId}: ${classification.age}/${classification.value} (${classification.healthScore}/100)`)
}
```

### async getOptimizationRecommendations()

Generates actionable optimization recommendations.

**Returns:** `Object` containing:
- `recommendations` - Array of optimization actions
- `consolidation` - Consolidation analysis
- `analysis` - Wallet fragmentation and efficiency scores

**Example:**

```javascript
const recommendations = await wallet.utxos.getOptimizationRecommendations()
recommendations.recommendations.forEach(rec => {
  console.log(`${rec.priority}: ${rec.message}`)
})
```

### async detectSecurityThreats(address)

Detects potential dust attacks and security threats.

**Parameters:**
- `address` (string) - Address to analyze (optional, uses wallet address)

**Returns:** `Object` containing:
- `severity` - Threat level (none, medium, high, critical)
- `indicators` - Array of threat indicators
- `recommendations` - Defense strategies

**Example:**

```javascript
const threats = await wallet.utxos.detectSecurityThreats()
if (threats.severity !== 'none') {
  console.log(`Security threat detected: ${threats.severity}`)
  threats.recommendations.forEach(rec => console.log(`- ${rec}`))
}
```

### Smart Coin Selection

Advanced UTXO selection with multiple strategies:

```javascript
// Get UTXOs filtered by classification
const utxos = wallet.utxos.getSpendableXecUtxos({
  useClassifications: true,
  classificationFilter: {
    minHealthScore: 70,
    minPrivacyScore: 60,
    allowedAges: ['mature', 'aged', 'ancient'],
    includeTokens: false
  }
})

// Select optimal UTXOs for transaction
const selection = wallet.utxos.selectOptimalUtxos(targetAmount, {
  strategy: 'privacy', // 'efficient', 'privacy', 'balanced', 'conservative'
  feeRate: 1.0
})
```

**Selection Strategies:**

- **efficient** - Minimizes transaction fees
- **privacy** - Maximizes transaction privacy  
- **balanced** - Balances efficiency and privacy
- **conservative** - Prefers confirmed UTXOs

### Classification Categories

**Age Classifications:**

- **fresh** - ≤ 6 blocks (~1 hour)
- **recent** - ≤ 144 blocks (~1 day)
- **mature** - ≤ 1008 blocks (~1 week)
- **aged** - ≤ 4032 blocks (~1 month)
- **ancient** - > 4032 blocks
- **unconfirmed** - blockHeight = -1

**Value Classifications:**

- **dust** - < 1,000 satoshis (< 10 XEC)
- **micro** - < 5,000 satoshis (< 50 XEC)
- **small** - < 50,000 satoshis (< 500 XEC)
- **medium** - < 500,000 satoshis (< 5,000 XEC)
- **large** - < 5,000,000 satoshis (< 50,000 XEC)
- **whale** - ≥ 5,000,000 satoshis (≥ 50,000 XEC)

**Health Classifications:**

- **healthy** - Economical to spend, good privacy
- **at-risk** - Marginally economical
- **dust** - Too small to spend economically
- **suspicious** - Potential dust attack indicators
- **unconfirmed** - Not yet confirmed
- **stuck** - Unconfirmed for too long

---

## eToken Operations

The wallet provides full support for both SLP (Simple Ledger Protocol) and ALP (A Ledger Protocol) tokens with automatic protocol detection.

### async listETokens(xecAddress)

Lists all eTokens (SLP/ALP tokens) held by an address with automatic protocol detection.

**Parameters:**
- `xecAddress` (string, optional) - XEC address (uses wallet address if omitted)

**Returns:** `Array` - Array of token objects with balances and metadata

**Token Object Properties:**
- `tokenId` - Unique token identifier
- `ticker` - Token symbol/ticker
- `name` - Full token name  
- `decimals` - Decimal places for display
- `balance` - Token balance (formatted with decimals)
- `balanceString` - Human-readable balance
- `protocol` - 'SLP' or 'ALP'
- `utxos` - Array of UTXOs containing this token

**Example:**

```javascript
const tokens = await wallet.listETokens()
tokens.forEach(token => {
  console.log(`${token.ticker} (${token.protocol}): ${token.balance}`)
})

// Example output:
// FLCT (SLP): 10
// TGR (ALP): 10
```

### async getETokenBalance(inObj)

Gets the balance of a specific eToken with automatic protocol detection.

**Parameters:**
- `inObj` (object) - Object containing:
  - `tokenId` (string) - Token ID to check
  - `xecAddress` (string, optional) - Address to check (uses wallet address if omitted)

**Returns:** `number` - Token balance (formatted with proper decimals)

**Example:**

```javascript
// Get balance for specific token
const balance = await wallet.getETokenBalance({
  tokenId: '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135'
})
console.log(`FLCT Balance: ${balance}`)

// Get balance for token at specific address
const balance = await wallet.getETokenBalance({
  tokenId: 'abc123def456...',
  xecAddress: 'ecash:qp123...'
})
```

### async getETokenData(tokenId, withTxHistory, sortOrder)

Gets comprehensive data about an eToken including metadata and transaction history.

**Parameters:**
- `tokenId` (string) - Token ID
- `withTxHistory` (boolean, optional) - Include transaction history (default: false)
- `sortOrder` (string, optional) - Sort order for transactions (default: 'DESCENDING')

**Returns:** `Object` - Token data including metadata, supply, and optional transaction history

**Example:**

```javascript
// Basic token data
const tokenData = await wallet.getETokenData('abc123def456...')

// With transaction history
const tokenData = await wallet.getETokenData('abc123def456...', true)
```

### async sendETokens(tokenId, outputs, satsPerByte)

Sends eTokens to one or multiple recipients with automatic SLP/ALP protocol detection.

**Parameters:**
- `tokenId` (string) - Token ID to send
- `outputs` (array) - Array of output objects with `address` and `amount` properties
- `satsPerByte` (number, optional) - Fee rate (default: wallet fee setting)

**Returns:** `string` - Transaction ID (TXID)

**Output Object Properties:**
- `address` - Recipient XEC address (ecash: format)
- `amount` - Token amount to send (in display units, not atoms)

**Example:**

```javascript
// Send SLP or ALP tokens (protocol auto-detected)
const txid = await wallet.sendETokens('5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135', [
  { address: 'ecash:qp123...', amount: 5 },   // Send 5 FLCT
  { address: 'ecash:qr456...', amount: 3 }    // Send 3 FLCT
])

// Send ALP tokens (same API)
const txid = await wallet.sendETokens('6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801', [
  { address: 'ecash:qp123...', amount: 2 }    // Send 2 TGR
])
```

### async burnETokens(tokenId, amount, satsPerByte)

Burns a specific amount of eTokens (permanently destroys them) with automatic SLP/ALP protocol detection.

**Parameters:**
- `tokenId` (string) - Token ID to burn
- `amount` (number) - Amount of tokens to burn (in display units)
- `satsPerByte` (number, optional) - Fee rate (default: wallet fee setting)

**Returns:** `string` - Transaction ID (TXID)

**Example:**

```javascript
// Burn 5 FLCT tokens (SLP)
const txid = await wallet.burnETokens('5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135', 5)

// Burn 2 TGR tokens (ALP) 
const txid = await wallet.burnETokens('6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801', 2)
```

### async burnAllETokens(tokenId, satsPerByte)

Burns all available eTokens of a specific type with automatic protocol detection.

**Parameters:**
- `tokenId` (string) - Token ID to burn
- `satsPerByte` (number, optional) - Fee rate (default: wallet fee setting)

**Returns:** `string` - Transaction ID (TXID)

**Example:**

```javascript
// Burn all tokens of this type
const txid = await wallet.burnAllETokens('abc123def456...')
```

---

## Advanced Features

### async getTransactions(xecAddress, sortingOrder)

Gets transaction history for an address.

**Parameters:**
- `xecAddress` (string, optional) - XEC address (uses wallet address if omitted)
- `sortingOrder` (string, optional) - Sort order: 'ASCENDING' or 'DESCENDING' (default: 'DESCENDING')

**Returns:** `Array` - Array of transaction objects

**Example:**

```javascript
// Get recent transactions
const txs = await wallet.getTransactions()

// Get oldest transactions first
const txs = await wallet.getTransactions(null, 'ASCENDING')
```

### async getTxData(txids)

Gets detailed data for up to 20 specific transaction IDs.

**Parameters:**
- `txids` (array) - Array of transaction IDs to fetch

**Returns:** `Array` - Array of transaction data objects

**Example:**

```javascript
const txData = await wallet.getTxData(['abc123...', 'def456...'])
```

### async getXecUsd()

Gets the current XEC price in USD.

**Returns:** `number` - Current XEC price in USD

**Example:**

```javascript
const price = await wallet.getXecUsd()
console.log(`Current XEC price: $${price} USD`)
```

### async getPubKey(addr)

Gets the public key for an address (if available from transaction history).

**Parameters:**
- `addr` (string) - XEC address

**Returns:** `string` - Public key in hex format

**Example:**

```javascript
const pubKey = await wallet.getPubKey('ecash:qp123...')
```

---

## Utility Methods

### async broadcast(inObj)

Broadcasts a raw transaction hex to the network.

**Parameters:**
- `inObj` (object) - Object containing:
  - `hex` (string) - Raw transaction hex

**Returns:** `string` - Transaction ID (TXID)

**Example:**

```javascript
const txid = await wallet.broadcast({ hex: '0100000001...' })
```

### async utxoIsValid(utxo)

Validates if a UTXO is still spendable (not already spent).

**Parameters:**
- `utxo` (object) - UTXO object to validate

**Returns:** `boolean` - True if UTXO is still valid

**Example:**

```javascript
const isValid = await wallet.utxoIsValid(utxo)
```

### async cid2json(inObj)

Converts a CID (Content Identifier) to JSON format.

**Parameters:**
- `inObj` (object) - Object containing CID data

**Returns:** `Object` - JSON representation of CID content

**Example:**

```javascript
const json = await wallet.cid2json({ cid: 'Qm...' })
```

---

## Network & Validation

### _validateAddress(address)

Internal method to validate XEC address format.

**Parameters:**
- `address` (string) - Address to validate

**Returns:** `boolean` - True if valid address format

**Throws:** Error if address is invalid

**Example:**

```javascript
// This is an internal method, but address validation happens automatically
// in all methods that accept addresses
```

### _sanitizeError(error, context)

Internal method to sanitize error messages and remove sensitive information.

**Parameters:**
- `error` (Error) - Original error object
- `context` (string) - Context for the error

**Returns:** `Error` - Sanitized error object

---

## Error Handling

All methods throw descriptive errors for common issues:

- **Invalid addresses** - Address format validation
- **Insufficient funds** - Not enough XEC or tokens for transaction
- **Network errors** - Connection issues with Chronik indexer
- **Invalid parameters** - Missing or malformed input parameters
- **Wallet not initialized** - Need to call `initialize()` first

**Example Error Handling:**

```javascript
try {
  const txid = await wallet.sendXec([
    { address: 'invalid-address', amountSats: 1000 }
  ])
} catch (error) {
  console.error('Transaction failed:', error.message)
  // Error messages are sanitized and safe to display
}
```

---

## Configuration

### Default Settings

- **HD Path:** `m/44'/899'/0'/0/0` (XEC coin type 899)
- **Fee Rate:** 1.2 sats/byte
- **Dust Limit:** 546 satoshis (5.46 XEC)
- **Chronik Endpoints:** Multiple fallback endpoints for reliability
- **Donations:** Disabled by default for privacy
- **Analytics:** Disabled by default for performance

### Analytics Configuration

```javascript
const analyticsConfig = {
  utxoAnalytics: {
    enabled: true,
    debug: false,
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
      suspiciousPatterns: {
        dustAttackSize: 10,
        rapidDeposits: 5,
        timeWindow: 3600000 // 1 hour in milliseconds
      }
    }
  }
}
```

### Environment Variables

- `NODE_ENV=test` - Enables test mode features
- `TEST=unit` - Enables unit test mode

---

## Examples

See the `/examples` directory for complete working examples of all API methods:

- **Wallet Creation:** `/examples/wallet-creation/`
- **Transactions:** `/examples/transactions/`
- **Token Operations:** `/examples/tokens/`
- **Key Management:** `/examples/key-management/`
- **Advanced Features:** `/examples/advanced/`
- **Analytics Demos:** `/examples/analytics/`
- **Utilities:** `/examples/utils/`

### Analytics Examples

- **UTXO Classification:** `utxo-classification-demo.js`
- **Health Monitoring:** `health-monitoring-demo.js`
- **Smart Coin Selection:** `advanced-coin-selection-demo.js`
- **Dust Attack Detection:** `dust-attack-detection-demo.js`
- **Wallet Optimization:** `wallet-optimization-demo.js`

Each example includes detailed usage instructions and error handling patterns.