/*
  Wallet utility helper for managing wallet.json file across examples.
  This provides consistent wallet persistence for all examples.
*/

const fs = require('fs')
const path = require('path')

// Path to wallet.json file (in examples directory)
const WALLET_FILE_PATH = path.join(__dirname, '..', 'wallet.json')

class WalletHelper {
  /**
   * Save wallet information to wallet.json file
   * @param {Object} walletInfo - Wallet data from wallet creation
   * @param {String} walletInfo.mnemonic - 12-word mnemonic phrase
   * @param {String} walletInfo.xecAddress - XEC address
   * @param {String} walletInfo.privateKey - Private key
   * @param {String} walletInfo.publicKey - Public key
   * @param {String} walletInfo.hdPath - HD derivation path
   * @param {String} description - Optional description for this wallet
   */
  static saveWallet (walletInfo, description = 'XEC Wallet') {
    try {
      // Backup existing wallet before overwriting
      if (fs.existsSync(WALLET_FILE_PATH)) {
        console.log('📂 Existing wallet found - creating backup...')
        const backupPath = path.join(__dirname, '..', 'wallet_backup.json')
        fs.copyFileSync(WALLET_FILE_PATH, backupPath)
        console.log('💾 Previous wallet backed up to: wallet_backup.json')
      }

      const walletData = {
        description,
        created: new Date().toISOString(),
        mnemonic: walletInfo.mnemonic,
        xecAddress: walletInfo.xecAddress,
        privateKey: walletInfo.privateKey,
        publicKey: walletInfo.publicKey,
        hdPath: walletInfo.hdPath || "m/44'/899'/0'/0/0",
        // Don't save encrypted mnemonic for simplicity in examples
        fee: 1.2,
        enableDonations: false
      }

      fs.writeFileSync(WALLET_FILE_PATH, JSON.stringify(walletData, null, 2))

      console.log(`✅ Wallet saved to: ${WALLET_FILE_PATH}`)
      console.log(`📍 XEC Address: ${walletInfo.xecAddress}`)

      return true
    } catch (err) {
      console.error('❌ Failed to save wallet:', err.message)
      return false
    }
  }

  /**
   * Load wallet information from wallet.json file
   * @returns {Object|null} Wallet data or null if file doesn't exist
   */
  static loadWallet () {
    try {
      if (!fs.existsSync(WALLET_FILE_PATH)) {
        console.log('📄 No wallet.json file found. Please run a wallet creation example first.')
        console.log('   Try: node examples/wallet-creation/create-new-wallet.js')
        return null
      }

      const walletData = JSON.parse(fs.readFileSync(WALLET_FILE_PATH, 'utf8'))

      console.log(`✅ Wallet loaded from: ${WALLET_FILE_PATH}`)
      console.log(`📍 XEC Address: ${walletData.xecAddress}`)
      console.log(`📅 Created: ${walletData.created}`)

      return walletData
    } catch (err) {
      console.error('❌ Failed to load wallet:', err.message)
      return null
    }
  }

  /**
   * Check if wallet.json file exists
   * @returns {Boolean} True if wallet file exists
   */
  static walletExists () {
    return fs.existsSync(WALLET_FILE_PATH)
  }

  /**
   * Delete wallet.json file (use with caution!)
   * @returns {Boolean} True if successfully deleted
   */
  static deleteWallet () {
    try {
      if (fs.existsSync(WALLET_FILE_PATH)) {
        fs.unlinkSync(WALLET_FILE_PATH)
        console.log('🗑️  Wallet file deleted successfully')
        return true
      } else {
        console.log('📄 No wallet file to delete')
        return false
      }
    } catch (err) {
      console.error('❌ Failed to delete wallet:', err.message)
      return false
    }
  }

  /**
   * Display wallet information in a readable format
   * @param {Object} walletData - Wallet data to display
   */
  static displayWalletInfo (walletData) {
    if (!walletData) {
      console.log('❌ No wallet data to display')
      return
    }

    console.log('\n📋 Wallet Information:')
    console.log('═'.repeat(50))
    console.log(`Description: ${walletData.description}`)
    console.log(`Created: ${walletData.created}`)
    console.log(`XEC Address: ${walletData.xecAddress}`)
    console.log(`HD Path: ${walletData.hdPath}`)
    console.log(`Fee Rate: ${walletData.fee} sats per byte`)

    // Only show first/last few characters of sensitive data
    if (walletData.mnemonic) {
      const words = walletData.mnemonic.split(' ')
      console.log(`Mnemonic: ${words[0]} ${words[1]} ... ${words[words.length - 2]} ${words[words.length - 1]} (${words.length} words)`)
    }

    if (walletData.privateKey) {
      const pk = walletData.privateKey
      console.log(`Private Key: ${pk.substring(0, 8)}...${pk.substring(pk.length - 8)}`)
    }

    console.log('═'.repeat(50))
  }

  /**
   * Get the wallet file path
   * @returns {String} Path to wallet.json file
   */
  static getWalletPath () {
    return WALLET_FILE_PATH
  }

  /**
   * Backup wallet to a timestamped file
   * @returns {String|null} Backup file path or null on failure
   */
  static backupWallet () {
    try {
      if (!fs.existsSync(WALLET_FILE_PATH)) {
        console.log('📄 No wallet file to backup')
        return null
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(__dirname, '..', `wallet-backup-${timestamp}.json`)

      fs.copyFileSync(WALLET_FILE_PATH, backupPath)
      console.log(`💾 Wallet backed up to: ${backupPath}`)

      return backupPath
    } catch (err) {
      console.error('❌ Failed to backup wallet:', err.message)
      return null
    }
  }
}

module.exports = WalletHelper
