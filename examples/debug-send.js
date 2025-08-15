/*
  Debug script to test transaction sending step by step
*/

const MinimalXECWallet = require('../index')
const WalletHelper = require('./utils/wallet-helper')

async function debugSend () {
  try {
    console.log('🧪 Debug: Testing transaction sending steps...')

    // Load wallet
    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      console.log('❌ No wallet found')
      return
    }

    console.log('✅ Wallet loaded')
    console.log(`Address: ${walletData.xecAddress}`)

    // Create wallet instance
    const wallet = new MinimalXECWallet(walletData.mnemonic || walletData.privateKey)
    await wallet.walletInfoPromise
    console.log('✅ Wallet instance created')

    // Debug wallet info
    console.log('\n🔍 Checking wallet info...')
    console.log('walletInfo keys:', Object.keys(wallet.walletInfo))
    console.log('publicKey present:', !!wallet.walletInfo.publicKey)
    console.log('privateKey present:', !!wallet.walletInfo.privateKey)
    console.log('mnemonic present:', !!wallet.walletInfo.mnemonic)

    // Check balance
    console.log('\n🔍 Checking balance...')
    const balance = await wallet.getXecBalance()
    console.log(`Balance: ${balance} XEC`)

    // Check UTXOs
    console.log('\n🔍 Getting UTXOs...')
    const utxos = await wallet.getUtxos()
    console.log(`UTXOs found: ${utxos.utxos?.length || 0}`)

    if (utxos.utxos?.length > 0) {
      console.log('Sample UTXO:', JSON.stringify(utxos.utxos[0], null, 2))
    }

    // Initialize wallet
    console.log('\n🔍 Initializing wallet...')
    await wallet.initialize()
    console.log('✅ Wallet initialized')

    // Prepare transaction
    const testAddress = 'ecash:qpcskwl402g5stqxy26js0j3mx5v54xqtssp0v7kkr'
    const outputs = [{
      address: testAddress,
      amountSat: 1000 // 10 XEC in satoshis (above dust limit)
    }]

    console.log('\n🔍 Testing transaction preparation...')
    console.log('Outputs:', JSON.stringify(outputs, null, 2))

    // Try to send (this is where it might hang)
    console.log('\n🚀 Attempting to send transaction...')
    console.log('⚠️  This might hang if there are Chronik API issues')

    const startTime = Date.now()

    // Log fee setting
    console.log(`Current fee rate: ${wallet.fee} sats/byte`)

    const txid = await Promise.race([
      wallet.sendXec(outputs),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timeout after 30s')), 30000))
    ])

    const endTime = Date.now()
    console.log(`✅ Transaction completed in ${endTime - startTime}ms`)
    console.log(`TXID: ${txid}`)
  } catch (err) {
    console.error('❌ Debug error:', err.message)
    console.error('Stack:', err.stack)
  }
}

debugSend()
