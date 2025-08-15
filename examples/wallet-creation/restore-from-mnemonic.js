/*
  Restore an existing XEC wallet from a 12-word mnemonic phrase.
  This example shows how to recover a wallet and save it to wallet.json.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get mnemonic from command line argument or prompt for input
const readline = require('readline')

async function getMnemonicFromUser () {
  // Check if mnemonic provided as command line argument
  const args = process.argv.slice(2)
  if (args.length >= 12) {
    return args.join(' ')
  }

  // Prompt user for mnemonic
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question('Enter your 12-word mnemonic phrase: ', (mnemonic) => {
      rl.close()
      resolve(mnemonic.trim())
    })
  })
}

async function restoreFromMnemonic () {
  try {
    console.log('🔄 Restoring XEC wallet from mnemonic...\n')

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

    // Get mnemonic from user
    const mnemonic = await getMnemonicFromUser()

    if (!mnemonic || mnemonic.split(' ').length !== 12) {
      console.error('❌ Invalid mnemonic. Please provide a 12-word mnemonic phrase.')
      console.log('   Usage: node restore-from-mnemonic.js word1 word2 ... word12')
      console.log('   Or run without arguments to be prompted for input')
      process.exit(1)
    }

    console.log('🔍 Validating mnemonic...')

    // Create wallet from mnemonic
    const wallet = new MinimalXECWallet(mnemonic)

    // Wait for wallet creation to complete
    await wallet.walletInfoPromise

    console.log('✅ Wallet restored successfully!\n')

    // Display the wallet information
    console.log('📋 Restored Wallet Details:')
    console.log('═'.repeat(50))
    console.log(`XEC Address: ${wallet.walletInfo.xecAddress}`)
    console.log(`HD Path: ${wallet.walletInfo.hdPath}`)
    console.log('═'.repeat(50))

    // Save to wallet.json file
    const saved = WalletHelper.saveWallet(wallet.walletInfo, 'Restored XEC Wallet')

    if (saved) {
      console.log('\n🎉 Wallet restored and ready for use!')
      console.log('   You can now run other examples to interact with your wallet')
      console.log('   Next steps:')
      console.log('   • Check balance: node examples/wallet-info/get-balance.js')
      console.log('   • View UTXOs: node examples/wallet-info/get-utxos.js')
      console.log('   • View transactions: node examples/wallet-info/get-transactions.js')
    }

    // Security reminder
    console.log('\n🔐 SECURITY REMINDER:')
    console.log('   • Your mnemonic phrase is now stored in wallet.json')
    console.log('   • Keep this file secure and private')
    console.log('   • Consider encrypting sensitive data for production use')
  } catch (err) {
    console.error('❌ Failed to restore wallet:', err.message)
    process.exit(1)
  }
}

// Run the example
restoreFromMnemonic()
