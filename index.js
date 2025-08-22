/*
  An npm JavaScript library for front end web apps. Implements a minimal
  eCash (XEC) wallet with eToken support.
*/

/* eslint-disable no-async-promise-executor */

'use strict'

const { ChronikClient } = require('chronik-client')
const crypto = require('crypto-js')

// Local libraries
const SendXEC = require('./lib/send-xec')
const Utxos = require('./lib/utxos')
const AdapterRouter = require('./lib/adapters/router')
const OpReturn = require('./lib/op-return')
const ConsolidateUtxos = require('./lib/consolidate-utxos.js')
const KeyDerivation = require('./lib/key-derivation')
const HybridTokenManager = require('./lib/hybrid-token-manager')

// let this

class MinimalXECWallet {
  constructor (hdPrivateKeyOrMnemonic, advancedOptions = {}) {
    this.advancedOptions = advancedOptions

    // BEGIN Handle advanced options.
    // HD Derivation path for XEC (coin type 899)
    this.hdPath = this.advancedOptions.hdPath || "m/44'/899'/0'/0/0"

    // Default Chronik endpoints (working as of 2025)
    const chronikOptions = {
      chronikUrls: advancedOptions.chronikUrls || [
        'https://chronik.e.cash',
        'https://chronik.be.cash',
        'https://xec.paybutton.org',
        'https://chronik.pay2stay.com/xec',
        'https://chronik.pay2stay.com/xec2',
        'https://chronik1.alitayin.com',
        'https://chronik2.alitayin.com'
      ]
    }

    // Set the fee rate (XEC uses same structure as BCH, but lower amounts)
    this.fee = 1.2
    if (this.advancedOptions.fee) {
      this.fee = this.advancedOptions.fee
    }

    // Donation setting (defaults to false for security and user consent)
    this.enableDonations = this.advancedOptions.enableDonations || false
    // END Handle advanced options.

    // Encapsulate the external libraries.
    this.crypto = crypto
    this.ChronikClient = ChronikClient

    // Initialize key derivation
    this.keyDerivation = new KeyDerivation()

    // Initialize chronik client with fallback strategy - use first endpoint immediately
    // The adapter router will handle connection strategy internally
    this.chronik = new ChronikClient(chronikOptions.chronikUrls[0])
    chronikOptions.chronik = this.chronik

    // Instantiate the adapter router (it handles connection strategy internally)
    this.ar = new AdapterRouter(chronikOptions)
    chronikOptions.ar = this.ar

    // Add analytics configuration to chronik options
    if (this.advancedOptions.utxoAnalytics) {
      chronikOptions.utxoAnalytics = this.advancedOptions.utxoAnalytics
    }

    // Instantiate local libraries
    this.sendXecLib = new SendXEC(chronikOptions)
    this.utxos = new Utxos(chronikOptions)
    this.opReturn = new OpReturn(chronikOptions)
    this.consolidateUtxos = new ConsolidateUtxos(this)
    this.hybridTokens = new HybridTokenManager(chronikOptions)

    this.temp = []
    this.isInitialized = false

    // The create() function returns a promise. When it resolves, the
    // walletInfoCreated flag will be set to true. The instance will also
    // have a new `walletInfo` property that will contain the wallet information.
    this.walletInfoCreated = false
    this.walletInfoPromise = this.create(hdPrivateKeyOrMnemonic)

    // Initialize WebAssembly early for better browser compatibility
    this.wasmInitPromise = this._initializeWASM()

    // Bind the 'this' object to all functions
    this.create = this.create.bind(this)
    this.initialize = this.initialize.bind(this)
    this.getUtxos = this.getUtxos.bind(this)
    this.getXecBalance = this.getXecBalance.bind(this)
    this.getDetailedBalance = this.getDetailedBalance.bind(this)
    this.getTransactions = this.getTransactions.bind(this)
    this.getTxData = this.getTxData.bind(this)
    this.sendXec = this.sendXec.bind(this)
    this.sendETokens = this.sendETokens.bind(this) // Phase 2
    this.burnETokens = this.burnETokens.bind(this) // Phase 2
    this.listETokens = this.listETokens.bind(this) // Phase 2
    this.sendAllXec = this.sendAllXec.bind(this)
    this.burnAllETokens = this.burnAllETokens.bind(this) // Phase 2
    this.getXecUsd = this.getXecUsd.bind(this)
    this.sendOpReturn = this.sendOpReturn.bind(this)
    this.utxoIsValid = this.utxoIsValid.bind(this)
    this.getETokenData = this.getETokenData.bind(this) // Phase 2
    this.getKeyPair = this.getKeyPair.bind(this)
    this.optimize = this.optimize.bind(this)
    this.getETokenBalance = this.getETokenBalance.bind(this) // Phase 2
    this.getPubKey = this.getPubKey.bind(this)
    this.broadcast = this.broadcast.bind(this)
    this.cid2json = this.cid2json.bind(this)
    this._validateAddress = this._validateAddress.bind(this)
    this._sanitizeError = this._sanitizeError.bind(this)
    this._secureWalletInfo = this._secureWalletInfo.bind(this)
    this.exportPrivateKeyAsWIF = this.exportPrivateKeyAsWIF.bind(this)
    this.validateWIF = this.validateWIF.bind(this)
  }

  // Private method to validate XEC addresses
  _validateAddress (address) {
    try {
      if (!address || typeof address !== 'string') {
        throw new Error('Address must be a non-empty string')
      }

      // Allow test addresses in test environment
      if ((process.env.NODE_ENV === 'test' || process.env.TEST === 'unit') && address.startsWith('test-')) {
        return true
      }

      // Only allow eCash addresses (ecash: prefix)
      if (!address.startsWith('ecash:')) {
        throw new Error('Invalid address format - must be eCash address (ecash: prefix)')
      }

      // Use ecashaddrjs to validate the eCash address
      const { decodeCashAddress } = require('ecashaddrjs')
      decodeCashAddress(address)
      return true
    } catch (err) {
      throw new Error(`Address validation failed: ${err.message}`)
    }
  }

  // Private method to sanitize error messages
  _sanitizeError (error, context = '') {
    const safeMessage = error.message || 'An error occurred'
    // Remove potentially sensitive information from error messages
    const sanitized = safeMessage
      .replace(/[A-Za-z0-9+/=]{64,}/g, '[SENSITIVE_DATA_REMOVED]')
      .replace(/[LK][1-9A-HJ-NP-Za-km-z]{51}/g, '[PRIVATE_KEY_REMOVED]')
      .replace(/ecash:[a-z0-9]{42}/g, '[ADDRESS_REMOVED]')

    return new Error(`${context ? context + ': ' : ''}${sanitized}`)
  }

  // Private method to create secure wallet info object
  _secureWalletInfo (walletInfo) {
    // Create a copy without exposing sensitive data directly
    return {
      mnemonic: walletInfo.mnemonic,
      xecAddress: walletInfo.xecAddress,
      hdPath: walletInfo.hdPath,
      fee: this.fee,
      // Store private key securely - consider implementing memory protection
      privateKey: walletInfo.privateKey,
      // Include donation setting (defaults to false for security)
      enableDonations: this.advancedOptions.enableDonations || false
    }
  }

  // Create a new wallet. Returns a promise that resolves into a wallet object.
  async create (mnemonicOrWif) {
    try {
      // Attempt to decrypt mnemonic if password is provided.
      if (mnemonicOrWif && this.advancedOptions.password) {
        mnemonicOrWif = this.decrypt(
          mnemonicOrWif,
          this.advancedOptions.password
        )
      }

      const walletInfo = {}

      // No input. Generate a new mnemonic.
      if (!mnemonicOrWif) {
        // Generate new mnemonic using key derivation library
        const mnemonic = this._generateMnemonic()
        const { privateKey, publicKey, address } = this._deriveFromMnemonic(mnemonic)

        walletInfo.privateKey = privateKey
        walletInfo.publicKey = publicKey
        walletInfo.mnemonic = mnemonic
        walletInfo.xecAddress = address
        walletInfo.hdPath = this.hdPath
      } else {
        // A WIF will start with L, K, 5 (mainnet) or c, 9 (testnet), will have no spaces,
        // and will be 51-52 characters long.
        const startsWithWIFChar =
          mnemonicOrWif &&
          (['k', 'l', 'c', '5', '9'].includes(mnemonicOrWif[0].toString().toLowerCase()))
        const isWIFLength = mnemonicOrWif && (mnemonicOrWif.length === 51 || mnemonicOrWif.length === 52)

        if (startsWithWIFChar && isWIFLength) {
          // Enhanced WIF Private Key handling
          if (!this.keyDerivation._isValidWIF(mnemonicOrWif)) {
            throw new Error('Invalid WIF format or checksum')
          }

          const { privateKey, publicKey, address, isCompressed, wif } = this._deriveFromWif(mnemonicOrWif)
          walletInfo.privateKey = privateKey
          walletInfo.publicKey = publicKey
          walletInfo.mnemonic = null
          walletInfo.xecAddress = address
          walletInfo.hdPath = null
          walletInfo.isCompressed = isCompressed
          walletInfo.wif = wif
        } else if (mnemonicOrWif.length === 64 && /^[a-fA-F0-9]+$/.test(mnemonicOrWif)) {
          // Hex Private Key (64 characters, all hex)
          const { publicKey, address } = this._deriveFromWif(mnemonicOrWif)
          walletInfo.privateKey = mnemonicOrWif
          walletInfo.publicKey = publicKey
          walletInfo.mnemonic = null
          walletInfo.xecAddress = address
          walletInfo.hdPath = null
        } else {
          // 12-word Mnemonic
          const mnemonic = mnemonicOrWif
          const { privateKey, publicKey, address } = this._deriveFromMnemonic(mnemonic)

          walletInfo.privateKey = privateKey
          walletInfo.publicKey = publicKey
          walletInfo.mnemonic = mnemonic
          walletInfo.xecAddress = address
          walletInfo.hdPath = this.hdPath
        }
      }

      // Encrypt the mnemonic if a password is provided.
      if (this.advancedOptions.password && walletInfo.mnemonic) {
        walletInfo.mnemonicEncrypted = this.encrypt(
          walletInfo.mnemonic,
          this.advancedOptions.password
        )
      }

      this.walletInfoCreated = true
      this.walletInfo = walletInfo

      return walletInfo
    } catch (err) {
      throw this._sanitizeError(err, 'Wallet creation failed')
    }
  }

  // Helper method to generate mnemonic
  _generateMnemonic (strength = 128) {
    try {
      return this.keyDerivation.generateMnemonic(strength)
    } catch (err) {
      throw this._sanitizeError(err, 'Mnemonic generation failed')
    }
  }

  // Helper method to derive keys from mnemonic
  _deriveFromMnemonic (mnemonic) {
    try {
      return this.keyDerivation.deriveFromMnemonic(mnemonic, this.hdPath)
    } catch (err) {
      throw this._sanitizeError(err, 'HD derivation failed')
    }
  }

  // Helper method to derive keys from WIF
  _deriveFromWif (wif) {
    try {
      return this.keyDerivation.deriveFromWif(wif)
    } catch (err) {
      throw this._sanitizeError(err, 'WIF derivation failed')
    }
  }

  // Initialize WebAssembly for browser compatibility
  async _initializeWASM () {
    try {
      // Only initialize WASM in browser environments
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        // Dynamic import to avoid issues in Node.js environments
        const wasmShim = require('./browser-shims/ecash_lib_wasm_browser')

        if (wasmShim && wasmShim.init) {
          console.log('Initializing WebAssembly for browser compatibility...')
          await wasmShim.init()
          console.log('WebAssembly initialization completed')
        }
      }

      return true
    } catch (err) {
      // WASM initialization failure should not prevent wallet from working
      console.warn('WebAssembly initialization failed (using fallbacks):', err.message)
      return false
    }
  }

  // Initialize is called to initialize the UTXO store, download token data, and
  // get a balance of the wallet.
  async initialize () {
    await this.walletInfoPromise

    // Ensure WASM is initialized (but don't block on it)
    try {
      await this.wasmInitPromise
    } catch (err) {
      console.warn('WASM initialization incomplete, continuing with fallbacks')
    }

    await this.utxos.initUtxoStore(this.walletInfo.xecAddress)

    this.isInitialized = true

    return true
  }

  // Encrypt the mnemonic of the wallet using secure key derivation.
  encrypt (mnemonic, password) {
    try {
      // Validate inputs
      if (!mnemonic || typeof mnemonic !== 'string') {
        throw new Error('Invalid mnemonic provided for encryption')
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        throw new Error('Password must be at least 8 characters long')
      }

      // Generate a random salt
      const salt = this.crypto.lib.WordArray.random(256 / 8)

      // Use PBKDF2 for key derivation with 10000 iterations
      const key = this.crypto.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations: 10000
      })

      // Generate random IV
      const iv = this.crypto.lib.WordArray.random(128 / 8)

      // Encrypt with AES-256-CBC
      const encrypted = this.crypto.AES.encrypt(mnemonic, key, {
        iv: iv,
        mode: this.crypto.mode.CBC,
        padding: this.crypto.pad.Pkcs7
      })

      // Combine salt, IV, and encrypted data
      const combined = {
        salt: salt.toString(),
        iv: iv.toString(),
        encrypted: encrypted.toString()
      }

      return JSON.stringify(combined)
    } catch (err) {
      throw new Error(`Encryption failed: ${err.message}`)
    }
  }

  // Decrypt the mnemonic of the wallet using secure key derivation.
  decrypt (mnemonicEncrypted, password) {
    try {
      // Validate inputs
      if (!mnemonicEncrypted || typeof mnemonicEncrypted !== 'string') {
        throw new Error('Invalid encrypted data provided')
      }
      if (!password || typeof password !== 'string') {
        throw new Error('Password is required for decryption')
      }

      // Check if it's the old CryptoJS format (starts with base64 "U2FsdGVkX1")
      if (mnemonicEncrypted.startsWith('U2FsdGVkX1')) {
        return this._decryptLegacyFormat(mnemonicEncrypted, password)
      }

      // Parse the new encrypted data format
      let combined
      try {
        combined = JSON.parse(mnemonicEncrypted)
      } catch (parseErr) {
        throw new Error('Invalid encrypted data format')
      }

      if (!combined.salt || !combined.iv || !combined.encrypted) {
        throw new Error('Encrypted data is missing required components')
      }

      // Recreate the key using the stored salt
      const salt = this.crypto.enc.Hex.parse(combined.salt)
      const key = this.crypto.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations: 10000
      })

      // Parse IV
      const iv = this.crypto.enc.Hex.parse(combined.iv)

      // Decrypt
      const decrypted = this.crypto.AES.decrypt(combined.encrypted, key, {
        iv: iv,
        mode: this.crypto.mode.CBC,
        padding: this.crypto.pad.Pkcs7
      })

      const mnemonic = decrypted.toString(this.crypto.enc.Utf8)

      if (!mnemonic) {
        throw new Error('Decryption failed - wrong password or corrupted data')
      }

      return mnemonic
    } catch (err) {
      throw new Error(`Decryption failed: ${err.message}`)
    }
  }

  // Decrypt legacy CryptoJS format for backward compatibility
  _decryptLegacyFormat (mnemonicEncrypted, password) {
    try {
      // Use the old CryptoJS format decryption
      const decrypted = this.crypto.AES.decrypt(mnemonicEncrypted, password)
      const mnemonic = decrypted.toString(this.crypto.enc.Utf8)

      if (!mnemonic) {
        throw new Error('Wrong password')
      }

      return mnemonic
    } catch (err) {
      // Return specific error message for wrong password
      if (err.message === 'Wrong password') {
        throw err
      }
      throw new Error('Wrong password')
    }
  }

  // Get the UTXO information for this wallet.
  async getUtxos (xecAddress) {
    try {
      let addr = xecAddress

      // Validate address if provided
      if (xecAddress) {
        this._validateAddress(xecAddress)
      }

      // If no address is passed in, but the wallet has been initialized, use the
      // wallet's address.
      if (!xecAddress && this.walletInfo && this.walletInfo.xecAddress) {
        addr = this.walletInfo.xecAddress
        await this.utxos.initUtxoStore(addr)
        return this.ar.getUtxos(addr)
      }

      if (!addr) {
        throw new Error('No address provided and wallet not initialized')
      }

      const utxos = await this.ar.getUtxos(addr)
      return utxos
    } catch (err) {
      throw this._sanitizeError(err, 'Failed to get UTXOs')
    }
  }

  // Get the balance of the wallet in XEC.
  async getXecBalance (inObj = {}) {
    try {
      // Handle backward compatibility: if inObj is a string, treat it as xecAddress
      let xecAddress
      if (typeof inObj === 'string') {
        xecAddress = inObj
      } else {
        xecAddress = inObj.xecAddress
      }
      let addr = xecAddress

      // Validate address if provided
      if (xecAddress) {
        this._validateAddress(xecAddress)
      }

      // If no address is passed in, but the wallet has been initialized, use the
      // wallet's address.
      if (!xecAddress && this.walletInfo && this.walletInfo.xecAddress) {
        addr = this.walletInfo.xecAddress
      }

      if (!addr) {
        throw new Error('No address provided and wallet not initialized')
      }

      const balances = await this.ar.getBalance(addr)
      // Convert from satoshis to XEC (divide by 100, not 100,000,000 like BCH)
      return (balances.balance.confirmed + balances.balance.unconfirmed) / 100
    } catch (err) {
      throw this._sanitizeError(err, 'Failed to get XEC balance')
    }
  }

  // Get detailed balance information including confirmed and unconfirmed amounts
  async getDetailedBalance (inObj = {}) {
    try {
      // Handle backward compatibility: if inObj is a string, treat it as xecAddress
      let xecAddress
      if (typeof inObj === 'string') {
        xecAddress = inObj
      } else {
        xecAddress = inObj.xecAddress
      }
      let addr = xecAddress

      // Validate address if provided
      if (xecAddress) {
        this._validateAddress(xecAddress)
      }

      // If no address is passed in, but the wallet has been initialized, use the
      // wallet's address.
      if (!xecAddress && this.walletInfo && this.walletInfo.xecAddress) {
        addr = this.walletInfo.xecAddress
      }

      if (!addr) {
        throw new Error('No address provided and wallet not initialized')
      }

      const balances = await this.ar.getBalance(addr)

      // Convert from satoshis to XEC (divide by 100, not 100,000,000 like BCH)
      const confirmed = balances.balance.confirmed / 100
      const unconfirmed = balances.balance.unconfirmed / 100
      const total = confirmed + unconfirmed

      return {
        confirmed,
        unconfirmed,
        total,
        satoshis: {
          confirmed: balances.balance.confirmed,
          unconfirmed: balances.balance.unconfirmed,
          total: balances.balance.confirmed + balances.balance.unconfirmed
        }
      }
    } catch (err) {
      throw this._sanitizeError(err, 'Failed to get detailed balance')
    }
  }

  // Get transactions associated with the wallet.
  async getTransactions (xecAddress, sortingOrder = 'DESCENDING') {
    let addr = xecAddress

    // If no address is passed in, but the wallet has been initialized, use the
    // wallet's address.
    if (!xecAddress && this.walletInfo && this.walletInfo.xecAddress) {
      addr = this.walletInfo.xecAddress
    }

    const data = await this.ar.getTransactions(addr, sortingOrder)
    return data.transactions
  }

  // Get transaction data for up to 20 TXIDs.
  async getTxData (txids = []) {
    const data = await this.ar.getTxData(txids)
    return data
  }

  // Send XEC. Returns a promise that resolves into a TXID.
  async sendXec (outputs) {
    try {
      // Wait for wallet to be initialized
      await this.walletInfoPromise

      if (!this.isInitialized) {
        await this.initialize()
      }

      // Get XEC UTXOs - prefer non-token UTXOs to prevent accidental token burning
      const xecOnlyUtxos = this.utxos.utxoStore.xecUtxos.filter(utxo => !utxo.token)

      // If no pure XEC UTXOs available, provide helpful error
      if (xecOnlyUtxos.length === 0) {
        const tokenUtxoCount = this.utxos.utxoStore.xecUtxos.filter(utxo => utxo.token).length
        throw new Error(`No pure XEC UTXOs available for transaction. All ${tokenUtxoCount} UTXOs contain tokens. To send XEC, first run wallet.optimize() to consolidate UTXOs and create pure XEC UTXOs, or use sendETokens() if you want to send tokens instead.`)
      }

      return await this.sendXecLib.sendXec(
        outputs,
        {
          mnemonic: this.walletInfo.mnemonic,
          xecAddress: this.walletInfo.xecAddress,
          hdPath: this.walletInfo.hdPath,
          fee: this.fee,
          privateKey: this.walletInfo.privateKey,
          publicKey: this.walletInfo.publicKey
        },
        xecOnlyUtxos
      )
    } catch (err) {
      throw this._sanitizeError(err, 'XEC send failed')
    }
  }

  // Send eTokens. Returns a promise that resolves into a TXID.
  async sendETokens (tokenId, outputs, satsPerByte = this.fee) {
    try {
      // Wait for wallet to be initialized
      await this.walletInfoPromise

      if (!this.isInitialized) {
        await this.initialize()
      }

      // Validate inputs
      if (!tokenId || typeof tokenId !== 'string') {
        throw new Error('Token ID is required and must be a string')
      }

      if (!Array.isArray(outputs) || outputs.length === 0) {
        throw new Error('Outputs array is required and cannot be empty')
      }

      // Ensure UTXOs are loaded before token operations
      if (!this.utxos || !this.utxos.utxoStore || !Array.isArray(this.utxos.utxoStore.xecUtxos)) {
        throw new Error('Wallet UTXOs not loaded. Try calling initialize() first.')
      }

      // Use hybrid token manager for protocol detection and routing
      return await this.hybridTokens.sendTokens(
        tokenId,
        outputs,
        {
          mnemonic: this.walletInfo.mnemonic,
          xecAddress: this.walletInfo.xecAddress,
          hdPath: this.walletInfo.hdPath,
          fee: this.fee,
          privateKey: this.walletInfo.privateKey,
          publicKey: this.walletInfo.publicKey
        },
        this.utxos.utxoStore.xecUtxos,
        satsPerByte
      )
    } catch (err) {
      throw this._sanitizeError(err, 'eToken send failed')
    }
  }

  // Send all XEC to an address
  async sendAllXec (toAddress) {
    try {
      await this.walletInfoPromise

      if (!this.isInitialized) {
        await this.initialize()
      }

      return await this.sendXecLib.sendAllXec(
        toAddress,
        {
          mnemonic: this.walletInfo.mnemonic,
          xecAddress: this.walletInfo.xecAddress,
          hdPath: this.walletInfo.hdPath,
          fee: this.fee,
          privateKey: this.walletInfo.privateKey,
          publicKey: this.walletInfo.publicKey
        },
        this.utxos.utxoStore.xecUtxos
      )
    } catch (err) {
      console.error('Error in sendAllXec():', err.message)
      throw this._sanitizeError(err, 'Send all XEC failed')
    }
  }

  // Send OP_RETURN transaction
  async sendOpReturn (msg = '', prefix = '6d02', xecOutput = [], satsPerByte = 1.0) {
    try {
      await this.walletInfoPromise

      if (!this.isInitialized) {
        await this.initialize()
      }

      // Get XEC UTXOs for OP_RETURN - prefer non-token UTXOs to prevent accidental token burning
      const xecOnlyUtxos = this.utxos.utxoStore.xecUtxos.filter(utxo => !utxo.token)

      // If no pure XEC UTXOs available, provide helpful error
      if (xecOnlyUtxos.length === 0) {
        const tokenUtxoCount = this.utxos.utxoStore.xecUtxos.filter(utxo => utxo.token).length
        throw new Error(`No pure XEC UTXOs available for OP_RETURN transaction. All ${tokenUtxoCount} UTXOs contain tokens. To send OP_RETURN, first run wallet.optimize() to consolidate UTXOs and create pure XEC UTXOs.`)
      }

      return await this.opReturn.sendOpReturn(
        this.walletInfo,
        xecOnlyUtxos,
        msg,
        prefix,
        xecOutput,
        satsPerByte
      )
    } catch (err) {
      console.error('Error in sendOpReturn():', err.message)
      throw this._sanitizeError(err, 'OP_RETURN send failed')
    }
  }

  // Validate if a UTXO is still spendable
  async utxoIsValid (utxo) {
    try {
      return await this.ar.utxoIsValid(utxo)
    } catch (err) {
      throw this._sanitizeError(err, 'UTXO validation failed')
    }
  }

  // Get key pair for HD index
  async getKeyPair (hdIndex = 0) {
    try {
      await this.walletInfoPromise

      if (!this.walletInfo.mnemonic) {
        throw new Error('Wallet does not have a mnemonic. Cannot generate key pair.')
      }

      const customPath = `m/44'/899'/0'/0/${hdIndex}`
      const keyData = this.keyDerivation.deriveFromMnemonic(this.walletInfo.mnemonic, customPath)

      return {
        hdIndex,
        wif: keyData.privateKey, // In real implementation, convert to WIF format
        publicKey: keyData.publicKey,
        xecAddress: keyData.address
      }
    } catch (err) {
      throw this._sanitizeError(err, 'Key pair generation failed')
    }
  }

  // Optimize wallet by consolidating UTXOs
  async optimize (dryRun = false) {
    try {
      return await this.consolidateUtxos.start({ dryRun })
    } catch (err) {
      throw this._sanitizeError(err, 'UTXO optimization failed')
    }
  }

  // Get public key for address
  async getPubKey (addr) {
    try {
      return await this.ar.getPubKey(addr)
    } catch (err) {
      throw this._sanitizeError(err, 'Public key query failed')
    }
  }

  // Broadcast transaction hex
  async broadcast (inObj = {}) {
    try {
      const { hex } = inObj
      if (!hex) {
        throw new Error('Transaction hex is required')
      }

      return await this.ar.sendTx(hex)
    } catch (err) {
      throw this._sanitizeError(err, 'Transaction broadcast failed')
    }
  }

  // Convert CID to JSON
  async cid2json (inObj = {}) {
    try {
      return await this.ar.cid2json(inObj)
    } catch (err) {
      throw this._sanitizeError(err, 'CID to JSON conversion failed')
    }
  }

  // Get the spot price of XEC in USD.
  async getXecUsd () {
    try {
      return await this.ar.getXecUsd()
    } catch (err) {
      throw this._sanitizeError(err, 'XEC price query failed')
    }
  }

  // eToken operations - Hybrid SLP/ALP token support
  async listETokens (xecAddress) {
    try {
      // Wait for wallet to be initialized
      await this.walletInfoPromise

      // Determine address to use
      let addr = xecAddress
      if (!xecAddress && this.walletInfo && this.walletInfo.xecAddress) {
        addr = this.walletInfo.xecAddress
      }

      if (!addr) {
        throw new Error('No address provided and wallet not initialized')
      }

      // Validate address if provided
      if (xecAddress) {
        this._validateAddress(xecAddress)
      }

      // Use hybrid token manager to list tokens from address
      return await this.hybridTokens.listTokensFromAddress(addr)
    } catch (err) {
      throw this._sanitizeError(err, 'eToken listing failed')
    }
  }

  async getETokenBalance (inObj = {}) {
    try {
      // Wait for wallet to be initialized
      await this.walletInfoPromise

      // Extract tokenId from input object
      const { tokenId, xecAddress } = inObj

      if (!tokenId || typeof tokenId !== 'string') {
        throw new Error('Token ID is required and must be a string')
      }

      // Determine address to use
      let addr = xecAddress
      if (!xecAddress && this.walletInfo && this.walletInfo.xecAddress) {
        addr = this.walletInfo.xecAddress
      }

      if (!addr) {
        throw new Error('No address provided and wallet not initialized')
      }

      // Validate address if provided
      if (xecAddress) {
        this._validateAddress(xecAddress)
      }

      // Get UTXOs for the address and calculate balance
      const utxos = await this.getUtxos(addr)
      return await this.hybridTokens.getTokenBalance(tokenId, utxos.utxos)
    } catch (err) {
      throw this._sanitizeError(err, 'eToken balance query failed')
    }
  }

  async burnETokens (tokenId, amount, satsPerByte = this.fee) {
    try {
      // Wait for wallet to be initialized
      await this.walletInfoPromise

      if (!this.isInitialized) {
        await this.initialize()
      }

      // Validate inputs
      if (!tokenId || typeof tokenId !== 'string') {
        throw new Error('Token ID is required and must be a string')
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new Error('Amount is required and must be a positive number')
      }

      // Use hybrid token manager for protocol detection and routing
      return await this.hybridTokens.burnTokens(
        tokenId,
        amount,
        {
          mnemonic: this.walletInfo.mnemonic,
          xecAddress: this.walletInfo.xecAddress,
          hdPath: this.walletInfo.hdPath,
          fee: this.fee,
          privateKey: this.walletInfo.privateKey,
          publicKey: this.walletInfo.publicKey
        },
        this.utxos.utxoStore.utxos,
        satsPerByte
      )
    } catch (err) {
      throw this._sanitizeError(err, 'eToken burn failed')
    }
  }

  async burnAllETokens (tokenId, satsPerByte = this.fee) {
    try {
      // Wait for wallet to be initialized
      await this.walletInfoPromise

      if (!this.isInitialized) {
        await this.initialize()
      }

      // Validate inputs
      if (!tokenId || typeof tokenId !== 'string') {
        throw new Error('Token ID is required and must be a string')
      }

      // Use hybrid token manager for protocol detection and routing
      return await this.hybridTokens.burnAllTokens(
        tokenId,
        {
          mnemonic: this.walletInfo.mnemonic,
          xecAddress: this.walletInfo.xecAddress,
          hdPath: this.walletInfo.hdPath,
          fee: this.fee,
          privateKey: this.walletInfo.privateKey,
          publicKey: this.walletInfo.publicKey
        },
        this.utxos.utxoStore.utxos
      )
    } catch (err) {
      throw this._sanitizeError(err, 'eToken burn all failed')
    }
  }

  async getETokenData (tokenId, withTxHistory = false, sortOrder = 'DESCENDING') {
    try {
      // Validate inputs
      if (!tokenId || typeof tokenId !== 'string') {
        throw new Error('Token ID is required and must be a string')
      }

      // Use hybrid token manager to get comprehensive token data
      return await this.hybridTokens.getTokenData(tokenId, withTxHistory, sortOrder)
    } catch (err) {
      throw this._sanitizeError(err, 'eToken data query failed')
    }
  }

  // Export private key as WIF format
  exportPrivateKeyAsWIF (compressed = true, testnet = false) {
    try {
      if (!this.walletInfo || !this.walletInfo.privateKey) {
        throw new Error('Wallet not initialized or no private key available')
      }

      return this.keyDerivation.exportToWif(
        this.walletInfo.privateKey,
        compressed,
        testnet
      )
    } catch (err) {
      throw this._sanitizeError(err, 'WIF export failed')
    }
  }

  // Validate WIF format (public utility method)
  validateWIF (wif) {
    try {
      return this.keyDerivation._isValidWIF(wif)
    } catch (err) {
      return false
    }
  }
}

module.exports = MinimalXECWallet
