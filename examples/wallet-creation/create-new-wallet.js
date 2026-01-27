/*
  Create a new XEC wallet with a randomly generated mnemonic.
  This example shows how to create a new wallet and save it to wallet.json.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

async function createNewWallet () {
  try {
    console.log('🚀 Creating new XEC wallet...\n')

    // Check if wallet already exists
    if (WalletHelper.walletExists()) {
      console.log('⚠️  Wallet already exists!')
      console.log('   Delete existing wallet first or use restore-from-mnemonic.js')
      console.log('   Existing wallet path:', WalletHelper.getWalletPath())

      // Show existing wallet info
      const existingWallet = WalletHelper.loadWallet()
      if (existingWallet) {
        WalletHelper.displayWalletInfo(existingWallet)
      }
      return
    }

    // Create new wallet (no parameters = new random mnemonic)
    // Optional: Enable Avalanche Pre-Consensus features for instant finality (~3 sec)
    // const advancedOptions = {
    //   avalanche: {
    //     enabled: true,                  // Enable Avalanche features
    //     defaultAwaitFinality: false,    // Wait for finality by default on all transactions
    //     finalityTimeout: 30000          // Timeout in milliseconds (default: 30 seconds)
    //   }
    // }
    // const wallet = new MinimalXECWallet(undefined, advancedOptions)
    const wallet = new MinimalXECWallet()

    // Wait for wallet creation to complete
    await wallet.walletInfoPromise

    console.log('✅ New wallet created successfully!\n')

    // Display the wallet information
    console.log('📋 New Wallet Details:')
    console.log('═'.repeat(50))
    console.log(`Mnemonic: ${wallet.walletInfo.mnemonic}`)
    console.log(`XEC Address: ${wallet.walletInfo.xecAddress}`)
    console.log(`HD Path: ${wallet.walletInfo.hdPath}`)
    console.log('═'.repeat(50))

    // Save to wallet.json file
    const saved = WalletHelper.saveWallet(wallet.walletInfo, 'New XEC Wallet')

    if (saved) {
      console.log('\n🎉 Wallet ready for use!')
      console.log('   You can now run other examples to interact with your wallet')
      console.log('   Next steps:')
      console.log('   • Fund your wallet by sending XEC to:', wallet.walletInfo.xecAddress)
      console.log('   • Check balance: node examples/wallet-info/get-balance.js')
      console.log('   • View transactions: node examples/wallet-info/get-transactions.js')
    }

    // Security reminder
    console.log('\n🔐 SECURITY REMINDER:')
    console.log('   • Keep your mnemonic phrase safe and private')
    console.log('   • Anyone with your mnemonic can access your funds')
    console.log('   • Consider backing up your wallet: the mnemonic is in wallet.json')
  } catch (err) {
    console.error('❌ Failed to create wallet:', err.message)
    process.exit(1)
  }
}

// Run the example
createNewWallet()
