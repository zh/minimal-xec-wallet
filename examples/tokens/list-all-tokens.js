/*
  List all tokens (SLP and ALP) in the wallet using the main wallet API
  Demonstrates the unified eToken interface with automatic protocol detection
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

async function listAllTokens () {
  try {
    console.log('🪙 Listing All Tokens (SLP + ALP) - Main Wallet API...\n')

    // Load wallet
    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      console.log('❌ No wallet found')
      console.log('   Run: node examples/wallet-creation/create-new-wallet.js')
      return
    }

    console.log('✅ Wallet loaded:')
    console.log(`   Address: ${walletData.xecAddress}`)
    console.log('')

    // Initialize main wallet (Step 1 integration)
    console.log('🔧 Initializing wallet...')
    const wallet = new MinimalXECWallet(walletData.mnemonic)

    // Wait for wallet creation and initialization
    await wallet.walletInfoPromise
    await wallet.initialize()

    console.log('✅ Wallet initialized successfully!')
    console.log('')

    // Get all tokens using main wallet API
    console.log('📦 Scanning wallet for tokens...')
    const tokens = await wallet.listETokens()

    if (tokens.length === 0) {
      console.log('ℹ️  No tokens found in wallet')

      // Still show XEC balance
      const xecBalance = await wallet.getXecBalance()
      console.log('')
      console.log('💰 Wallet Summary:')
      console.log('═'.repeat(40))
      console.log(`XEC Balance: ${xecBalance.toLocaleString()} XEC`)
      console.log('Token Balance: 0 tokens')

      console.log('\n💡 Get some tokens:')
      console.log('   • Visit eCash faucets for test tokens')
      console.log('   • Use DEX to trade for tokens')
      console.log('   • Receive tokens from other wallets')
      return
    }

    console.log(`🎯 Found ${tokens.length} token type(s):\n`)

    // Display each token with full details
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      console.log(`Token ${i + 1}: ${token.protocol} Protocol`)
      console.log('═'.repeat(60))
      console.log(`Token ID: ${token.tokenId}`)
      console.log(`Ticker: ${token.ticker}`)
      console.log(`Name: ${token.name}`)
      console.log(`Protocol: ${token.protocol}`)
      console.log(`Decimals: ${token.decimals}`)

      if (token.url) {
        console.log(`URL: ${token.url}`)
      }

      console.log('')
      console.log('💰 Balance Information:')
      console.log(`  Display Balance: ${token.balance.display.toLocaleString()} ${token.ticker}`)
      console.log(`  Raw Atoms: ${token.balance.atoms}`)
      console.log(`  UTXOs: ${token.utxoCount}`)
      console.log('')

      // Show UTXO details if available
      if (token.utxos && token.utxos.length > 0) {
        console.log('📦 UTXO Details:')
        for (let j = 0; j < token.utxos.length; j++) {
          const utxo = token.utxos[j]
          console.log(`  UTXO ${j + 1}: ${utxo.outpoint.txid}:${utxo.outpoint.outIdx}`)
          console.log(`    Block: ${utxo.blockHeight === -1 ? 'Mempool' : utxo.blockHeight}`)
          console.log(`    Sats: ${utxo.sats} (dust)`)
          console.log(`    Atoms: ${utxo.token.atoms}`)
        }
      }

      if (i < tokens.length - 1) {
        console.log('\n' + '─'.repeat(60) + '\n')
      }
    }

    // Get XEC balance and show comprehensive wallet summary
    const xecBalance = await wallet.getXecBalance()
    const utxos = await wallet.getUtxos()

    console.log('\n📊 WALLET SUMMARY:')
    console.log('═'.repeat(50))
    console.log(`XEC Balance: ${xecBalance.toLocaleString()} XEC`)
    console.log(`Total UTXOs: ${utxos.utxos.length}`)
    console.log(`Token Types: ${tokens.length}`)

    // Breakdown by protocol
    const slpTokens = tokens.filter(t => t.protocol === 'SLP')
    const alpTokens = tokens.filter(t => t.protocol === 'ALP')

    if (slpTokens.length > 0) {
      console.log(`SLP Tokens: ${slpTokens.length} types`)
      slpTokens.forEach(token => {
        console.log(`  • ${token.ticker}: ${token.balance.display} ${token.ticker}`)
      })
    }

    if (alpTokens.length > 0) {
      console.log(`ALP Tokens: ${alpTokens.length} types`)
      alpTokens.forEach(token => {
        console.log(`  • ${token.ticker}: ${token.balance.display} ${token.ticker}`)
      })
    }

    const isMultiProtocol = slpTokens.length > 0 && alpTokens.length > 0
    console.log(`Multi-Protocol Wallet: ${isMultiProtocol ? 'Yes' : 'No'}`)

    console.log('\n💡 Available Operations:')
    console.log('   • Send tokens: node examples/tokens/send-any-token.js <ticker> <address> <amount>')
    console.log('   • Get token balance: node examples/tokens/get-token-balance.js <ticker>')
    console.log('   • Get token info: node examples/tokens/get-token-info.js <ticker>')
    console.log('   • Burn tokens: node examples/tokens/burn-tokens.js <ticker> <amount>')
  } catch (err) {
    console.error('❌ Failed to list tokens:', err.message)

    // Provide helpful debugging information
    if (err.message.includes('wallet not initialized')) {
      console.log('\n🔧 Wallet initialization issue:')
      console.log('   • Check wallet.json exists')
      console.log('   • Verify mnemonic is valid')
      console.log('   • Try re-creating wallet')
    } else if (err.message.includes('network') || err.message.includes('chronik')) {
      console.log('\n🌐 Network issue:')
      console.log('   • Check internet connection')
      console.log('   • Chronik API may be temporarily unavailable')
      console.log('   • Try again in a few moments')
    } else {
      console.log('\n📍 Error details:')
      if (err.stack) {
        console.error('Stack trace:', err.stack)
      }
    }

    process.exit(1)
  }
}

// Run the token listing
listAllTokens()
