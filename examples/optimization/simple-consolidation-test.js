/*
  Simple UTXO consolidation test to debug wallet issues
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

async function simpleTest () {
  try {
    console.log('🔧 Simple UTXO Consolidation Test...\n')

    // Load the shared examples/wallet.json
    const walletData = WalletHelper.loadWallet()
    if (!walletData) return
    console.log('✅ Wallet loaded:')
    console.log(`   Address: ${walletData.xecAddress}`)
    console.log('')

    // Initialize wallet
    console.log('🔧 Initializing wallet...')
    const wallet = new MinimalXECWallet(walletData.mnemonic)

    await wallet.walletInfoPromise
    console.log('✅ Wallet info ready')

    await wallet.initialize()
    console.log('✅ Wallet initialized')
    console.log('')

    // Check if wallet is properly initialized
    console.log('🔍 Wallet State Check:')
    console.log(`   isInitialized: ${wallet.isInitialized}`)
    console.log(`   walletInfo exists: ${!!wallet.walletInfo}`)
    console.log(`   utxos exists: ${!!wallet.utxos}`)
    console.log(`   consolidateUtxos exists: ${!!wallet.consolidateUtxos}`)
    console.log('')

    // Try to get balance
    console.log('💰 Getting balance...')
    try {
      const balance = await wallet.getXecBalance()
      console.log(`   Balance: ${JSON.stringify(balance)}`)
    } catch (err) {
      console.log(`   Balance error: ${err.message}`)
    }
    console.log('')

    // Try to get UTXOs
    console.log('📦 Getting UTXOs...')
    try {
      const utxos = await wallet.getUtxos()
      console.log(`   UTXOs count: ${utxos.utxos.length}`)
      if (utxos.length > 0) {
        console.log(`   First UTXO: ${JSON.stringify(utxos[0], null, 2)}`)
      }
    } catch (err) {
      console.log(`   UTXOs error: ${err.message}`)
    }
    console.log('')

    // Try consolidation analysis
    console.log('🔍 Testing consolidation analysis...')
    try {
      const dryRunResult = await wallet.optimize(true)
      console.log(`   Dry run success: ${dryRunResult.success}`)
      console.log(`   Message: ${dryRunResult.message}`)
      console.log(`   Transactions: ${dryRunResult.transactions.length}`)
    } catch (err) {
      console.log(`   Consolidation error: ${err.message}`)
    }
  } catch (err) {
    console.error('\n❌ Test failed:', err.message)
    console.log('\n🔧 Debugging info:')
    console.log(`   Error type: ${err.constructor.name}`)
    console.log(`   Stack: ${err.stack}`)
  }
}

// Run test
simpleTest()
