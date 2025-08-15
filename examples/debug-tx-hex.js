/*
  Debug script to examine transaction hex before broadcasting
*/

const MinimalXECWallet = require('../index')
const WalletHelper = require('./utils/wallet-helper')

async function debugTxHex () {
  try {
    console.log('🧪 Debug: Examining transaction hex generation...')

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
    await wallet.initialize()
    console.log('✅ Wallet instance created and initialized')

    // Get UTXOs
    const utxos = await wallet.getUtxos()
    console.log(`UTXOs found: ${utxos.utxos?.length || 0}`)

    if (!utxos.utxos?.length) {
      console.log('❌ No UTXOs available')
      return
    }

    // Prepare transaction
    const testAddress = 'ecash:qpcskwl402g5stqxy26js0j3mx5v54xqtssp0v7kkr'
    const outputs = [{
      address: testAddress,
      amountSat: 1000 // 10 XEC in satoshis (above 546 dust limit)
    }]

    console.log('\n🔍 Testing transaction creation directly...')

    // Access the sendXecLib to test transaction creation without broadcasting
    const txHex = await wallet.sendXecLib.createTransaction(
      outputs,
      wallet.walletInfo,
      wallet.utxos.utxoStore.xecUtxos
    )

    console.log('\n📄 Generated transaction hex:')
    console.log(`Length: ${txHex.length} characters`)
    console.log(`Hex: ${txHex}`)

    // Validate hex format
    const isValidHex = /^[0-9a-fA-F]+$/.test(txHex)
    console.log(`\n✅ Valid hex format: ${isValidHex}`)

    if (txHex.length === 0) {
      console.log('❌ Empty hex string!')
      return
    }

    if (txHex.length % 2 !== 0) {
      console.log('❌ Odd number of hex characters!')
      return
    }

    // Try to parse transaction structure
    try {
      const txBuffer = Buffer.from(txHex, 'hex')
      console.log(`\n📊 Transaction buffer length: ${txBuffer.length} bytes`)
      console.log(`First 20 bytes: ${txBuffer.slice(0, 20).toString('hex')}`)
      console.log(`Last 20 bytes: ${txBuffer.slice(-20).toString('hex')}`)
    } catch (err) {
      console.log('❌ Failed to create buffer from hex:', err.message)
    }

    // Test the broadcast API call directly (but catch the error)
    console.log('\n🚀 Testing broadcast (expecting failure)...')
    try {
      const result = await wallet.ar.sendTx(txHex)
      console.log('✅ Broadcast succeeded unexpectedly!', result)
    } catch (err) {
      console.log('❌ Broadcast failed as expected:', err.message)

      // Check if it's a Chronik API error vs our error
      if (err.message.includes('Transaction broadcast failed:')) {
        console.log('🔍 This is our wrapper error, checking underlying cause...')
      }
    }
  } catch (err) {
    console.error('❌ Debug error:', err.message)
    console.error('Stack:', err.stack)
  }
}

debugTxHex()
