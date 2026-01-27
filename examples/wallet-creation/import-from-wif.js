/*
  Import an XEC wallet from a WIF (Wallet Import Format) private key.
  This example shows how to import a single private key and save it to wallet.json.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get WIF from command line argument or prompt for input
const readline = require('readline')

async function getWifFromUser () {
  // Check if WIF provided as command line argument
  const args = process.argv.slice(2)
  if (args.length === 1 && (args[0].length === 52 || args[0].length === 64)) {
    return args[0]
  }

  // Prompt user for WIF
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question('Enter your WIF private key (K/L/5 for mainnet, c/9 for testnet) or hex private key: ', (wif) => {
      rl.close()
      resolve(wif.trim())
    })
  })
}

async function importFromWif () {
  try {
    console.log('📥 Importing XEC wallet from private key...\n')

    // Check if wallet already exists
    if (WalletHelper.walletExists()) {
      console.log('⚠️  Wallet already exists!')
      console.log('   This will overwrite your existing wallet.')

      // Create backup first
      const backupPath = WalletHelper.backupWallet()
      if (backupPath) {
        console.log(`   Backup created: ${backupPath}`)
      }
    }

    // Get WIF from user
    const wif = await getWifFromUser()

    if (!wif) {
      console.error('❌ No private key provided.')
      console.log('   Usage: node import-from-wif.js <WIF_OR_HEX_PRIVATE_KEY>')
      console.log('   WIF example: L1234...abcd (52 characters starting with K or L)')
      console.log('   Hex example: 1234567890abcdef... (64 hex characters)')
      process.exit(1)
    }

    console.log('🔍 Validating private key...')

    // Create a temporary wallet instance to validate WIF
    const tempWallet = new MinimalXECWallet()
    await tempWallet.walletInfoPromise

    // Check if it's a valid WIF format
    const isValidWIF = tempWallet.validateWIF(wif)
    const isHex = wif.length === 64 && /^[a-fA-F0-9]+$/.test(wif)

    if (!isValidWIF && !isHex) {
      console.error('❌ Invalid private key format.')
      console.log('   Expected formats:')
      console.log('   • WIF: 51-52 characters (K/L/5 for mainnet, c/9 for testnet)')
      console.log('   • Hex: 64 hexadecimal characters')
      console.log(`   Provided: ${wif.length} characters`)
      if (wif.length >= 50 && wif.length <= 53) {
        console.log('   Note: This looks like a WIF but failed validation (invalid checksum?)')
      }
      process.exit(1)
    }

    // Create wallet from WIF/hex private key
    // Optional: Enable Avalanche Pre-Consensus features for instant finality (~3 sec)
    // const advancedOptions = {
    //   avalanche: {
    //     enabled: true,                  // Enable Avalanche features
    //     defaultAwaitFinality: false,    // Wait for finality by default on all transactions
    //     finalityTimeout: 30000          // Timeout in milliseconds (default: 30 seconds)
    //   }
    // }
    // const wallet = new MinimalXECWallet(wif, advancedOptions)
    const wallet = new MinimalXECWallet(wif)

    // Wait for wallet creation to complete
    await wallet.walletInfoPromise

    console.log('✅ Wallet imported successfully!\n')

    // Display the wallet information
    console.log('📋 Imported Wallet Details:')
    console.log('═'.repeat(50))
    console.log(`XEC Address: ${wallet.walletInfo.xecAddress}`)
    console.log(`Key Type: ${isValidWIF ? 'WIF' : 'Hex'} Private Key`)
    console.log(`HD Path: ${wallet.walletInfo.hdPath || 'N/A (single key import)'}`)
    if (isValidWIF) {
      console.log(`Compression: ${wallet.walletInfo.isCompressed ? 'Compressed' : 'Uncompressed'}`)
      console.log(`Original WIF: ${wallet.walletInfo.wif}`)
    }
    console.log('═'.repeat(50))

    // Save to wallet.json file
    const saved = WalletHelper.saveWallet(wallet.walletInfo, 'Imported XEC Wallet')

    if (saved) {
      console.log('\n🎉 Wallet imported and ready for use!')
      console.log('   You can now run other examples to interact with your wallet')
      console.log('   Next steps:')
      console.log('   • Check balance: node examples/wallet-info/get-balance.js')
      console.log('   • View UTXOs: node examples/wallet-info/get-utxos.js')
      console.log('   • Send XEC: node examples/transactions/send-xec.js')
    }

    // Important note for imported keys
    console.log('\n📝 IMPORTANT NOTE:')
    if (!wallet.walletInfo.mnemonic) {
      console.log('   • This wallet was imported from a single private key')
      console.log('   • No mnemonic phrase available for recovery')
      console.log('   • Make sure to backup your private key safely')
      console.log('   • For HD wallet features, use restore-from-mnemonic.js instead')
    }

    // Security reminder
    console.log('\n🔐 SECURITY REMINDER:')
    console.log('   • Your private key is now stored in wallet.json')
    console.log('   • Keep this file secure and private')
    console.log('   • Anyone with your private key can access your funds')
  } catch (err) {
    console.error('❌ Failed to import wallet:', err.message)
    process.exit(1)
  }
}

// Run the example
importFromWif()
