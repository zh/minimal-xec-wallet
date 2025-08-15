/*
  Get comprehensive token information using the main wallet API
  Demonstrates detailed metadata retrieval with automatic protocol detection
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)

function showUsage () {
  console.log('Usage: node get-token-info.js <token_ticker_or_id>')
  console.log('')
  console.log('Examples:')
  console.log('  node get-token-info.js FLCT')
  console.log('  node get-token-info.js TGR')
  console.log('  node get-token-info.js 5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135')
  console.log('')
  console.log('Parameters:')
  console.log('  token_ticker_or_id: Token ticker (FLCT, TGR) or full token ID')
  console.log('')
  console.log('✨ Features:')
  console.log('   • Protocol (SLP/ALP) detected automatically')
  console.log('   • Comprehensive token metadata')
  console.log('   • Genesis information and timestamps')
  console.log('   • Uses main wallet API for consistency')
  console.log('   • Works with any token (even if not held in wallet)')
}

async function getTokenInfo () {
  try {
    console.log('📄 Get Token Information (Main Wallet API)...\n')

    // Check arguments
    if (args.length < 1) {
      console.log('❌ Missing required arguments')
      showUsage()
      return
    }

    const tokenInput = args[0]

    // Load wallet (for API access, not necessarily token holding)
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

    // First, try to find token by listing wallet tokens
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

    // If found in wallet tokens, use that info
    if (selectedToken) {
      tokenId = selectedToken.tokenId
      console.log(`✅ Found token in wallet: ${selectedToken.ticker} (${selectedToken.protocol})`)
    } else {
      // If not found in wallet, assume it's a token ID
      tokenId = tokenInput
      console.log(`🔍 Token not found in wallet, trying as token ID: ${tokenId.substring(0, 12)}...`)
    }

    // Get comprehensive token data using main wallet API
    console.log('\n📄 Getting comprehensive token information...')
    const tokenData = await wallet.getETokenData(tokenId)

    console.log('')
    console.log('🎯 COMPREHENSIVE TOKEN INFORMATION:')
    console.log('═'.repeat(70))

    // Basic Information
    console.log('📋 Basic Information:')
    console.log(`   Token ID: ${tokenData.tokenId}`)
    console.log(`   Ticker: ${tokenData.ticker}`)
    console.log(`   Name: ${tokenData.name}`)
    console.log(`   Protocol: ${tokenData.protocol}`)
    console.log(`   Type: ${tokenData.type}`)
    console.log(`   Decimals: ${tokenData.decimals}`)

    // Links and Resources
    if (tokenData.url) {
      console.log('')
      console.log('🔗 Links and Resources:')
      console.log(`   URL: ${tokenData.url}`)

      // Provide context about URLs
      if (tokenData.url.startsWith('ipfs://')) {
        console.log('   Format: IPFS (decentralized storage)')
        console.log(`   Gateway: https://ipfs.io/ipfs/${tokenData.url.substring(7)}`)
      } else if (tokenData.url.startsWith('http')) {
        console.log('   Format: HTTP(S) web link')
      } else {
        console.log('   Format: Custom URL format')
      }
    }

    // Additional Data
    if (tokenData.data) {
      console.log('')
      console.log('💾 Additional Data:')
      console.log(`   Data: ${tokenData.data}`)

      // Try to decode if it looks like hex
      try {
        if (tokenData.data.startsWith('0x') || tokenData.data.length % 2 === 0) {
          const decoded = Buffer.from(tokenData.data.replace('0x', ''), 'hex').toString('utf8')
          if (decoded.length > 0 && decoded.length < 100) {
            console.log(`   Decoded: ${decoded}`)
          }
        }
      } catch (err) {
        // Ignore decode errors
      }
    }

    // Authority Information
    if (tokenData.authPubkey) {
      console.log('')
      console.log('🔐 Authority Information:')
      console.log(`   Authority Pubkey: ${tokenData.authPubkey}`)
      console.log('   Mint Authority: Present (can create more tokens)')
    } else {
      console.log('')
      console.log('🔐 Authority Information:')
      console.log('   Mint Authority: None (fixed supply token)')
    }

    // Timestamps
    if (tokenData.timeFirstSeen) {
      console.log('')
      console.log('📅 Timeline:')
      const firstSeen = new Date(tokenData.timeFirstSeen * 1000)
      console.log(`   First Seen: ${firstSeen.toLocaleString()}`)
      console.log(`   First Seen (UTC): ${firstSeen.toISOString()}`)

      const daysSince = Math.floor((Date.now() - firstSeen.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`   Age: ${daysSince} day(s) old`)
    }

    // Protocol-Specific Details
    console.log('')
    console.log(`📊 ${tokenData.protocol} Protocol Details:`)

    if (tokenData.protocol === 'SLP') {
      console.log('   Standard: Simple Ledger Protocol')
      console.log('   Version: SLP v1')
      console.log('   Consensus: Bitcoin Cash script validation')
      console.log('   UTXO Model: Token amount stored in UTXO')
    } else if (tokenData.protocol === 'ALP') {
      console.log('   Standard: A Ledger Protocol')
      console.log('   Version: ALP v1')
      console.log('   Consensus: Native Bitcoin Cash consensus')
      console.log('   UTXO Model: Atom-based precision')
      console.log('   Script Type: eMPP (enhanced Memo Push Protocol)')
    }

    // Get balance if wallet holds this token
    if (selectedToken) {
      console.log('')
      console.log('💰 Your Wallet Balance:')
      console.log(`   Balance: ${selectedToken.balance.display} ${selectedToken.ticker}`)
      console.log(`   Raw Atoms: ${selectedToken.balance.atoms}`)
      console.log(`   UTXOs: ${selectedToken.utxoCount}`)

      if (selectedToken.balance.display > 0) {
        console.log('')
        console.log('💡 Available Actions:')
        console.log(`   • Send: node examples/tokens/send-any-token.js ${selectedToken.ticker} <address> <amount>`)
        console.log(`   • Burn: node examples/tokens/burn-tokens.js ${selectedToken.ticker} <amount>`)
        console.log(`   • Balance: node examples/tokens/get-token-balance.js ${selectedToken.ticker}`)
      }
    } else {
      console.log('')
      console.log('💰 Your Wallet Balance:')
      console.log('   Balance: 0 (you do not hold this token)')
      console.log('')
      console.log('💡 How to get this token:')
      console.log('   • Visit eCash token faucets')
      console.log('   • Use decentralized exchanges (DEX)')
      console.log('   • Receive from other wallets')
      console.log('   • Purchase on supported exchanges')
    }

    // Explorer Links
    console.log('')
    console.log('🔗 Blockchain Explorer:')
    console.log(`   Token: https://explorer.e.cash/token/${tokenData.tokenId}`)
    console.log('   View transactions, holders, and statistics')

    // Additional Resources
    console.log('')
    console.log('📚 Additional Resources:')
    if (tokenData.protocol === 'SLP') {
      console.log('   • SLP Specification: https://slp.dev/')
      console.log('   • SLP Token Registry: https://tokens.bch.sx/')
    } else if (tokenData.protocol === 'ALP') {
      console.log('   • ALP Specification: https://ecashbuilders.notion.site/')
      console.log('   • eCash Documentation: https://docs.e.cash/')
    }
    console.log('   • eCash Explorer: https://explorer.e.cash/')
    console.log('   • Chronik API: https://chronik.e.cash/')
  } catch (err) {
    console.error('\n❌ Failed to get token information:', err.message)

    // Provide context-specific help based on error type
    if (err.message.includes('Token ID is required')) {
      console.log('\n🎯 Token ID Issue:')
      console.log('   • Provide a valid token ticker or full token ID')
      console.log('   • Check available tokens: node examples/tokens/list-all-tokens.js')
    } else if (err.message.includes('not found') || err.message.includes('Invalid token ID')) {
      console.log('\n🔍 Token Not Found:')
      console.log('   • Verify token ticker or ID is correct')
      console.log('   • Token may not exist on this network')
      console.log('   • Check token ID format (64-character hex string)')
      console.log('   • Try browsing tokens: https://explorer.e.cash/tokens')
    } else if (err.message.includes('network') || err.message.includes('chronik')) {
      console.log('\n🌐 Network Issue:')
      console.log('   • Check internet connection')
      console.log('   • Chronik API may be temporarily unavailable')
      console.log('   • Try again in a few moments')
    } else {
      console.log('\n🔧 General Error:')
      console.log('   • Check wallet is properly initialized')
      console.log('   • Verify token exists on the network')
      console.log('   • Try with a known token like FLCT or TGR')
    }

    console.log('\nFor debugging, try:')
    console.log('   node examples/tokens/list-all-tokens.js')
    console.log('   node examples/tokens/get-token-balance.js FLCT')

    process.exit(1)
  }
}

// Run the token info fetcher
getTokenInfo()
