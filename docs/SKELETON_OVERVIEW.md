# Minimal XEC Wallet - Skeleton Structure

## Main Class: MinimalXECWallet (index.js)

### Core Methods
- `constructor(hdPrivateKeyOrMnemonic, advancedOptions)` - Initialize XEC wallet instance
- `create(mnemonicOrWif)` - Create wallet from mnemonic or WIF, returns wallet info
- `initialize()` - Initialize UTXO store and token data
- `encrypt(mnemonic, password)` - Encrypt mnemonic with secure key derivation
- `decrypt(mnemonicEncrypted, password)` - Decrypt encrypted mnemonic

### XEC Operations
- `getXecBalance(inObj)` - Get XEC balance for address (handles XEC decimals)
- `sendXec(outputs)` - Send XEC to outputs, returns TXID
- `sendAllXec(toAddress)` - Send all XEC to single address
- `getUtxos(xecAddress)` - Get UTXOs for XEC address
- `getTransactions(xecAddress, sortingOrder)` - Get transaction history
- `getTxData(txids)` - Get detailed data for transaction IDs

### eToken Operations  
- `sendETokens(output, satsPerByte, opts)` - Send eTokens using ALP protocol
- `burnETokens(qty, tokenId, satsPerByte)` - Burn specified eToken amount
- `listETokens(xecAddress)` - List eTokens held by address
- `getETokenBalance(inObj)` - Get balance of specific eToken
- `burnAllETokens(tokenId)` - Burn all eTokens of specific ID
- `getETokenData(tokenId)` - Get eToken metadata and info

### Utility Methods
- `getXecUsd()` - Get XEC to USD exchange rate
- `sendOpReturn(msg, prefix, xecOutput, satsPerByte)` - Send OP_RETURN transaction
- `utxoIsValid(utxo)` - Validate UTXO is spendable
- `getKeyPair(hdIndex)` - Generate key pair at HD index
- `optimize(dryRun)` - Optimize wallet by consolidating UTXOs
- `getPubKey(addr)` - Get public key for address
- `broadcast(inObj)` - Broadcast transaction hex
- `cid2json(inObj)` - Convert IPFS CID to JSON

### Private Methods
- `_validateAddress(address)` - Validate XEC address format
- `_sanitizeError(error, context)` - Remove sensitive data from errors
- `_secureWalletInfo(walletInfo)` - Create secure wallet info object

## Library Files

### lib/send-xec.js - SendXEC Class
- `sendXec(outputs, walletInfo, utxos)` - Send XEC to one or more outputs
- `createTransaction(outputs, walletInfo, utxos)` - Create transaction hex string
- `getNecessaryUtxosAndChange(outputs, availableUtxos, satsPerByte, opts)` - Calculate UTXOs and change
- `sortUtxosBySize(utxos, sortingOrder)` - Sort UTXOs by value
- `calculateFee(numInputs, numOutputs, satsPerByte)` - Calculate transaction fee
- `getKeyPairFromMnemonic(walletInfo)` - Generate key pair from mnemonic
- `sendAllXec(toAddress, walletInfo, utxos)` - Send all XEC to address
- `createSendAllTx(toAddress, walletInfo, utxos)` - Create send-all transaction

### lib/utxos.js - Utxos Class
- `initUtxoStore(addr, forceRefresh)` - Initialize UTXO store for address
- `_fetchUtxosWithRetry(addr, maxRetries)` - Fetch UTXOs with retry logic
- `getSpendableETokenUtxos()` - Filter spendable eToken UTXOs
- `getPerformanceMetrics()` - Return UTXO operation metrics
- `refreshCache(addr)` - Refresh cached UTXO data
- `clearCache()` - Clear all cached data

### lib/tokens.js - Tokens Class  
- `listETokensFromAddress(addr)` - List eTokens held by address
- `getETokenBalance(tokenId, addr)` - Get specific eToken balance
- `listETokensFromUtxos(utxos)` - Extract eToken info from UTXOs
- `sendETokens(output, walletInfo, xecUtxos, eTokenUtxos, satsPerByte, opts)` - Send eTokens
- `createTransaction(...)` - Create eToken transaction hex
- `createBurnTransaction(qty, tokenId, walletInfo, xecUtxos, eTokenUtxos, satsPerByte)` - Create burn transaction
- `burnETokens(qty, tokenId, walletInfo, xecUtxos, eTokenUtxos, satsPerByte)` - Burn eTokens
- `burnAll(tokenId, walletInfo, xecUtxos, eTokenUtxos)` - Burn all of token ID

### lib/adapters/router.js - AdapterRouter Class
- `getBalance(addr)` - Get XEC balance using Chronik
- `_getSingleBalance(addr)` - Get single address balance
- `_batchGetBalance(requests)` - Batch balance requests
- `getUtxos(addr)` - Get UTXOs using Chronik
- `_getSingleUtxos(addr)` - Get single address UTXOs  
- `_batchGetUtxos(requests)` - Batch UTXO requests
- `getTransactions(addr, sortingOrder)` - Get transaction history
- `getTxData(txids)` - Get detailed transaction data
- `_getSingleTxData(txids)` - Single transaction data request
- `_batchGetTxData(txids)` - Batch transaction data requests
- `sendTx(hex)` - Broadcast transaction to network
- `getXecUsd()` - Get XEC/USD exchange rate
- `utxoIsValid(utxo)` - Validate UTXO spendability
- `getETokenData(tokenId, withTxHistory, sortOrder)` - Get eToken metadata
- `getETokenData2(tokenId, updateCache)` - Enhanced eToken data
- `getPubKey(addr)` - Get public key for address
- `getPsfWritePrice()` - Get PSF write price
- `cid2json(inObj)` - Convert CID to JSON

### lib/op-return.js - OpReturn Class
- `sendOpReturn(walletInfo, xecUtxos, msg, prefix, xecOutput, satsPerByte)` - Send OP_RETURN transaction
- `createOpReturnTx(walletInfo, xecUtxos, msg, prefix, xecOutput, satsPerByte)` - Create OP_RETURN hex
- `buildOpReturnScript(msg, prefix)` - Build OP_RETURN script

### lib/consolidate-utxos.js - ConsolidateUtxos Class
- `start(opts)` - Start UTXO consolidation process
- `analyzeUtxos()` - Analyze UTXOs for consolidation strategy
- `createConsolidationTx(utxosToConsolidate)` - Create consolidation transaction
- `calculateOptimalConsolidation(utxos)` - Calculate optimal consolidation

### lib/key-derivation.js - KeyDerivation Class
- `generateMnemonic(strength)` - Generate BIP39 mnemonic
- `deriveFromMnemonic(mnemonic, hdPath)` - HD derivation from mnemonic
- `deriveFromWif(wif)` - Derive from WIF private key
- `validateMnemonic(mnemonic)` - Validate BIP39 mnemonic
- `mnemonicToSeed(mnemonic, passphrase)` - Convert mnemonic to seed
- `seedToMasterKey(seed)` - Convert seed to master key
- `derivePath(masterKey, path)` - Derive child key from path

## Key Differences from BCH Wallet

1. **Decimal Handling**: XEC uses base units (no decimals), BCH uses 8 decimals
2. **Address Format**: `ecash:` prefix vs `bitcoincash:` prefix
3. **API Client**: Chronik client vs bch-js
4. **Token Protocol**: eTokens (ALP) vs SLP tokens
5. **HD Path**: `m/44'/899'/0'/0/0` for XEC vs `m/44'/245'/0'/0/0` for BCH
6. **Method Naming**: `getXecBalance()` vs `getBalance()`, `sendXec()` vs `send()`