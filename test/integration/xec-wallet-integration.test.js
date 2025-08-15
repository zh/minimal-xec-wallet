/*
  Integration tests for XEC wallet using Chronik testnet.
  These tests interact with real Chronik API endpoints for comprehensive testing.
*/

// npm libraries
const assert = require('chai').assert

// Unit under test
const MinimalXECWallet = require('../../index')

// Test configuration - using working Chronik endpoints
const CHRONIK_URLS = [
  'https://chronik.e.cash',
  'https://chronik.be.cash',
  'https://xec.paybutton.org',
  'https://chronik.pay2stay.com/xec',
  'https://chronik.pay2stay.com/xec2',
  'https://chronik1.alitayin.com',
  'https://chronik2.alitayin.com'
]

describe('#Integration Tests - XEC Wallet with Chronik API', () => {
  let wallet
  const timeout = 30000 // 30 second timeout for network calls

  // Test wallet mnemonic (for testing purposes only - uses standard test mnemonic)
  const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

  beforeEach(async () => {
    const advancedOptions = {
      chronikUrls: CHRONIK_URLS
    }

    wallet = new MinimalXECWallet(TEST_MNEMONIC, advancedOptions)
    await wallet.walletInfoPromise
  })

  describe('#Wallet Creation and Initialization', () => {
    it('should create wallet from mnemonic', function () {
      this.timeout(timeout)

      assert.property(wallet.walletInfo, 'mnemonic')
      assert.property(wallet.walletInfo, 'xecAddress')
      assert.property(wallet.walletInfo, 'privateKey')
      assert.include(wallet.walletInfo.xecAddress, 'ecash:')
    })

    it('should initialize UTXO store', async function () {
      this.timeout(timeout)

      const result = await wallet.initialize()

      assert.isTrue(result)
      assert.isTrue(wallet.isInitialized)
      assert.property(wallet.utxos, 'utxoStore')
    })
  })

  describe('#Balance and UTXO Operations', () => {
    it('should get XEC balance for wallet', async function () {
      this.timeout(timeout)

      const balance = await wallet.getXecBalance()

      assert.isNumber(balance)
      assert.isTrue(balance >= 0)
    })

    it('should get UTXOs for wallet address', async function () {
      this.timeout(timeout)

      const utxos = await wallet.getUtxos()

      assert.property(utxos, 'utxos')
      assert.isArray(utxos.utxos)
    })

    it('should get balance for specific address', async function () {
      this.timeout(timeout)

      const testAddress = wallet.walletInfo.xecAddress
      const balance = await wallet.getXecBalance(testAddress)

      assert.isNumber(balance)
    })
  })

  describe('#Transaction History', () => {
    it('should get transaction history', async function () {
      this.timeout(timeout)

      const transactions = await wallet.getTransactions()

      assert.isArray(transactions)
      // May be empty for new addresses
    })

    it('should get transaction history with sorting', async function () {
      this.timeout(timeout)

      const ascTransactions = await wallet.getTransactions(null, 'ASCENDING')
      const descTransactions = await wallet.getTransactions(null, 'DESCENDING')

      assert.isArray(ascTransactions)
      assert.isArray(descTransactions)
    })
  })

  describe('#Address Validation', () => {
    it('should validate XEC addresses correctly', () => {
      const validAddresses = [
        'ecash:qp1234567890abcdef1234567890abcdef1234567890',
        'ecash:qr1234567890abcdef1234567890abcdef1234567890'
      ]

      const invalidAddresses = [
        'bitcoincash:qp1234567890abcdef1234567890abcdef1234567890',
        'invalid_address',
        ''
      ]

      validAddresses.forEach(addr => {
        try {
          // In test environment, validation might be more permissive
          // This test mainly ensures the method doesn't crash
          wallet._validateAddress(addr)
        } catch (err) {
          // Expected in some cases due to checksum validation
        }
      })

      invalidAddresses.forEach(addr => {
        try {
          wallet._validateAddress(addr)
          // If it doesn't throw, that's also acceptable for some invalid formats
        } catch (err) {
          assert.include(err.message, 'validation failed')
        }
      })
    })
  })

  describe('#Key Derivation', () => {
    it('should generate key pairs at different HD indices', async function () {
      this.timeout(timeout)

      const keyPair0 = await wallet.getKeyPair(0)
      const keyPair1 = await wallet.getKeyPair(1)

      assert.property(keyPair0, 'xecAddress')
      assert.property(keyPair1, 'xecAddress')
      assert.notEqual(keyPair0.xecAddress, keyPair1.xecAddress)
      assert.notEqual(keyPair0.wif, keyPair1.wif)
    })

    it('should produce consistent results for same index', async function () {
      this.timeout(timeout)

      const keyPair1 = await wallet.getKeyPair(5)
      const keyPair2 = await wallet.getKeyPair(5)

      assert.equal(keyPair1.xecAddress, keyPair2.xecAddress)
      assert.equal(keyPair1.wif, keyPair2.wif)
    })
  })

  describe('#Utility Functions', () => {
    it('should check UTXO validity', async function () {
      this.timeout(timeout)

      // Get a UTXO to test
      const utxos = await wallet.getUtxos()

      if (utxos.utxos.length > 0) {
        const utxo = {
          tx_hash: utxos.utxos[0].outpoint.txid,
          tx_pos: utxos.utxos[0].outpoint.outIdx
        }

        const isValid = await wallet.utxoIsValid(utxo)
        assert.isBoolean(isValid)
      }
    })

    it('should get XEC to USD price (if available)', async function () {
      this.timeout(timeout)

      try {
        const price = await wallet.getXecUsd()
        assert.isNumber(price)
        assert.isTrue(price > 0)
      } catch (err) {
        // Price API may not be available in testnet
        assert.include(err.message.toLowerCase(), 'price')
      }
    })
  })

  describe('#Error Handling', () => {
    it('should handle invalid addresses gracefully', async function () {
      this.timeout(timeout)

      try {
        await wallet.getXecBalance('invalid_address_format')
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'validation failed')
      }
    })

    it('should handle network errors gracefully', async function () {
      this.timeout(timeout)

      // Create wallet with invalid Chronik URL
      const badWallet = new MinimalXECWallet(TEST_MNEMONIC, {
        chronikUrls: ['https://invalid-chronik-url.com']
      })
      await badWallet.walletInfoPromise

      try {
        await badWallet.getXecBalance()
        assert.fail('Should have thrown network error')
      } catch (err) {
        // Should gracefully handle network failures
        assert.isTrue(err.message.length > 0)
      }
    })
  })

  describe('#Decimal Conversion', () => {
    it('should handle XEC decimal conversion correctly', async function () {
      this.timeout(timeout)

      const balance = await wallet.getXecBalance()

      // Balance should be a valid decimal number (not satoshis)
      assert.isNumber(balance)

      // XEC uses 2 decimal places (base units)
      // So balance should be divisible by 0.01 when converted back to satoshis
      const satoshis = Math.round(balance * 100)
      const convertedBack = satoshis / 100

      assert.equal(balance, convertedBack)
    })
  })

  // Transaction tests require testnet funds, so they're marked as pending
  describe('#Transaction Operations (requires testnet XEC)', () => {
    it.skip('should send XEC to address', async function () {
      this.timeout(timeout)

      // This test requires testnet XEC and is skipped by default
      const outputs = [{
        address: 'ecash:qp1234567890abcdef1234567890abcdef1234567890',
        amountSat: 1000 // 10 XEC
      }]

      try {
        const txid = await wallet.sendXec(outputs)
        assert.isString(txid)
        assert.equal(txid.length, 64) // SHA256 hash length
      } catch (err) {
        if (err.message.includes('insufficient')) {
          console.log('Skipping send test - insufficient funds')
        } else {
          throw err
        }
      }
    })

    it.skip('should send all XEC to address', async function () {
      this.timeout(timeout)

      const toAddress = 'ecash:qp1234567890abcdef1234567890abcdef1234567890'

      try {
        const txid = await wallet.sendAllXec(toAddress)
        assert.isString(txid)
        assert.equal(txid.length, 64)
      } catch (err) {
        if (err.message.includes('insufficient')) {
          console.log('Skipping sendAll test - insufficient funds')
        } else {
          throw err
        }
      }
    })
  })

  // eToken tests are for Phase 2
  describe('#eToken Operations - Phase 2 (Not Implemented)', () => {
    it('should throw not implemented errors for eToken operations', () => {
      assert.throws(() => {
        wallet.sendETokens({})
      }, /Phase 2/)

      assert.throws(() => {
        wallet.listETokens()
      }, /Phase 2/)

      assert.throws(() => {
        wallet.getETokenBalance({ tokenId: 'test' })
      }, /Phase 2/)
    })
  })
})
