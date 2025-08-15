/*
  Get specific token balance using the main wallet API
  Demonstrates balance checking with automatic protocol detection
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)

function showUsage () {
  console.log('Usage: node get-token-balance.js <token_ticker_or_id>')
  console.log('')
  console.log('Examples:')
  console.log('  node get-token-balance.js FLCT')
  console.log('  node get-token-balance.js TGR')
  console.log('  node get-token-balance.js 5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135')
  console.log('')
  console.log('Parameters:')
  console.log('  token_ticker_or_id: Token ticker (FLCT, TGR) or full token ID')
  console.log('')
  console.log('✨ Features:')
  console.log('   • Protocol (SLP/ALP) detected automatically')
  console.log('   • Displays both display units and raw atoms')
  console.log('   • Uses main wallet API for consistency')
  console.log('   • Works with any token type')
}

async function getTokenBalance () {
  try {
    console.log('💰 Get Token Balance (Main Wallet API)...\n')

    // Check arguments
    if (args.length < 1) {
      console.log('❌ Missing required arguments')
      showUsage()
      return
    }

    const tokenInput = args[0]

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

    // First, try to find token by listing all tokens
    console.log('📦 Searching for token...')
    const tokens = await wallet.listETokens()

    // Find the token by ticker or ID
    let selectedToken = null
    let tokenId = null

    // Try to match by ticker first (case-insensitive)
    selectedToken = tokens.find(t =>
      t.ticker.toLowerCase() === tokenInput.toLowerCase()
    )

    // If not found, try to match by token ID
    if (!selectedToken) {
      selectedToken = tokens.find(t => t.tokenId === tokenInput)
    }

    // If found in wallet tokens, use that token ID
    if (selectedToken) {
      tokenId = selectedToken.tokenId
      console.log(`✅ Found token in wallet: ${selectedToken.ticker} (${selectedToken.protocol})`)
    } else {
      // If not found in wallet, assume it's a token ID and try anyway
      tokenId = tokenInput
      console.log(`🔍 Token not found in wallet, trying as token ID: ${tokenId.substring(0, 12)}...`)
    }

    // Get balance using main wallet API
    console.log('\n💰 Getting token balance...')
    const balance = await wallet.getETokenBalance({ tokenId })

    console.log('')
    console.log('🎯 TOKEN BALANCE DETAILS:')
    console.log('═'.repeat(60))
    console.log(`Token ID: ${balance.tokenId}`)
    console.log(`Ticker: ${balance.ticker}`)
    console.log(`Name: ${balance.name}`)
    console.log(`Protocol: ${balance.protocol}`)
    console.log(`Decimals: ${balance.decimals}`)
    console.log('')
    console.log('💰 Balance Information:')
    console.log(`  Display Balance: ${balance.balance.display.toLocaleString()} ${balance.ticker}`)
    console.log(`  Raw Atoms: ${balance.balance.atoms}`)
    console.log(`  UTXOs: ${balance.utxoCount}`)

    // Show context about balance
    if (balance.balance.display === 0) {
      console.log('')
      console.log('ℹ️  Zero Balance:')
      console.log('   • You do not currently hold any of this token')
      console.log('   • Token metadata is still accessible')
      console.log('   • Token may have been spent, burned, or never received')
    } else {
      console.log('')
      console.log('💡 Token Actions Available:')
      console.log(`   • Send tokens: node examples/tokens/send-any-token.js ${balance.ticker} <address> <amount>`)
      console.log(`   • Burn tokens: node examples/tokens/burn-tokens.js ${balance.ticker} <amount>`)
      console.log(`   • Get token info: node examples/tokens/get-token-info.js ${balance.ticker}`)
    }

    // Show wallet summary
    const xecBalance = await wallet.getXecBalance()
    console.log('')
    console.log('📊 WALLET SUMMARY:')
    console.log('═'.repeat(40))
    console.log(`XEC Balance: ${xecBalance.toLocaleString()} XEC`)
    console.log(`Token Balance: ${balance.balance.display.toLocaleString()} ${balance.ticker}`)
    console.log(`Total UTXOs: ${balance.utxoCount} token + XEC UTXOs`)
  } catch (err) {
    console.error('\n❌ Failed to get token balance:', err.message)

    // Provide context-specific help based on error type
    if (err.message.includes('Token ID is required')) {
      console.log('\n🎯 Token ID Issue:')
      console.log('   • Provide a valid token ticker or full token ID')
      console.log('   • Check available tokens: node examples/tokens/list-all-tokens.js')
    } else if (err.message.includes('not found') || err.message.includes('Invalid token ID')) {
      console.log('\n🔍 Token Not Found:')
      console.log('   • Verify token ticker or ID is correct')
      console.log('   • Token may not exist on this network')
      console.log('   • Check available tokens: node examples/tokens/list-all-tokens.js')
    } else if (err.message.includes('network') || err.message.includes('chronik')) {
      console.log('\n🌐 Network Issue:')
      console.log('   • Check internet connection')
      console.log('   • Chronik API may be temporarily unavailable')
      console.log('   • Try again in a few moments')
    } else {
      console.log('\n🔧 General Error:')
      console.log('   • Check wallet is properly initialized')
      console.log('   • Verify token ID format is correct')
      console.log('   • Try listing tokens first to debug')
    }

    console.log('\nFor debugging, run:')
    console.log('   node examples/tokens/list-all-tokens.js')
    console.log('   node examples/wallet-info/get-balance.js')

    process.exit(1)
  }
}

// Run the balance checker
getTokenBalance()
