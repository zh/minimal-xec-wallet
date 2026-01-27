/*
  Send any token (SLP or ALP) using the main wallet API
  Demonstrates automatic protocol detection and unified token sending interface
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)
const useFinality = args.includes('--finality')
const filteredArgs = args.filter(arg => arg !== '--finality')

function showUsage () {
  console.log('Usage: node send-any-token.js <token_ticker_or_id> <recipient> <amount> [--finality]')
  console.log('')
  console.log('Examples:')
  console.log('  node send-any-token.js FLCT ecash:qpcskwl402g5stqxy26js0j3mx5v54xqtssp0v7kkr 2')
  console.log('  node send-any-token.js TGR etoken:qpcskwl402g5stqxy26js0j3mx5v54xqtssp0v7kkr 3')
  console.log('  node send-any-token.js 5e40dda12765...912135 ecash:qpcskwl402g5stqxy26js0j3mx5v54xqtssp0v7kkr 1')
  console.log('  node send-any-token.js FLCT ecash:qp... 2 --finality  # Wait for Avalanche finality (~3 sec)')
  console.log('')
  console.log('Parameters:')
  console.log('  token_ticker_or_id: Token ticker (FLCT, TGR) or full token ID')
  console.log('  recipient: eCash address (ecash: or etoken: format)')
  console.log('  amount: Amount to send (in display units)')
  console.log('')
  console.log('Options:')
  console.log('  --finality: Wait for Avalanche Pre-Consensus finality (~3 seconds)')
  console.log('              Without this flag, confirmation takes ~10 minutes (next block)')
  console.log('')
  console.log('✨ Features:')
  console.log('   • Protocol (SLP/ALP) detected automatically')
  console.log('   • Uses main wallet API for consistency')
  console.log('   • Unified error handling and validation')
  console.log('   • Optional Avalanche Pre-Consensus instant finality')
}

async function sendAnyToken () {
  try {
    console.log('🚀 Sending Token (Main Wallet API)...\n')

    // Check arguments
    if (filteredArgs.length < 3) {
      console.log('❌ Missing required arguments')
      showUsage()
      return
    }

    const tokenInput = filteredArgs[0]
    const recipient = filteredArgs[1]
    const amount = parseFloat(filteredArgs[2])

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      console.log('❌ Invalid amount. Must be a positive number')
      showUsage()
      return
    }

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

    // Get available tokens using main wallet API
    console.log('📦 Loading available tokens...')
    const tokens = await wallet.listETokens()

    if (tokens.length === 0) {
      console.log('❌ No tokens found in wallet')
      console.log('')
      console.log('💡 Get some tokens:')
      console.log('   • Visit eCash faucets for test tokens')
      console.log('   • Use DEX to trade for tokens')
      console.log('   • Receive tokens from other wallets')
      return
    }

    console.log(`✅ Found ${tokens.length} token type(s):`)
    for (const token of tokens) {
      console.log(`   • ${token.ticker} (${token.protocol}): ${token.balance.display} ${token.ticker}`)
    }
    console.log('')

    // Find the token to send
    let selectedToken = null

    // Try to match by ticker first (case-insensitive)
    selectedToken = tokens.find(t =>
      t.ticker.toLowerCase() === tokenInput.toLowerCase()
    )

    // If not found, try to match by token ID
    if (!selectedToken) {
      selectedToken = tokens.find(t => t.tokenId === tokenInput)
    }

    if (!selectedToken) {
      console.log(`❌ Token "${tokenInput}" not found in wallet`)
      console.log(`Available tokens: ${tokens.map(t => t.ticker).join(', ')}`)
      return
    }

    console.log('🎯 Selected Token:')
    console.log('═'.repeat(50))
    console.log(`Ticker: ${selectedToken.ticker}`)
    console.log(`Name: ${selectedToken.name}`)
    console.log(`Protocol: ${selectedToken.protocol}`)
    console.log(`Token ID: ${selectedToken.tokenId}`)
    console.log(`Current Balance: ${selectedToken.balance.display} ${selectedToken.ticker}`)
    console.log(`Decimals: ${selectedToken.decimals}`)
    console.log('')

    // Validate sufficient balance
    if (selectedToken.balance.display < amount) {
      console.log('❌ Insufficient token balance!')
      console.log(`   Requested: ${amount} ${selectedToken.ticker}`)
      console.log(`   Available: ${selectedToken.balance.display} ${selectedToken.ticker}`)
      return
    }

    // Convert etoken: to ecash: format if needed
    let recipientAddress = recipient
    if (recipient.startsWith('etoken:')) {
      recipientAddress = 'ecash:' + recipient.substring(7)
    }

    console.log(`📍 Recipient: ${recipientAddress}`)

    // Get current XEC balance for fee check
    const xecBalance = await wallet.getXecBalance()
    console.log(`💰 XEC Available: ${xecBalance.toLocaleString()} XEC`)

    if (xecBalance < 1) {
      console.log('⚠️  Warning: Low XEC balance for transaction fees')
    }

    // Show transaction summary
    console.log('\n📋 Transaction Summary:')
    console.log('═'.repeat(50))
    console.log(`Protocol: ${selectedToken.protocol}`)
    console.log(`Token: ${selectedToken.ticker} (${selectedToken.name})`)
    console.log(`From: ${walletData.xecAddress}`)
    console.log(`To: ${recipientAddress}`)
    console.log(`Amount: ${amount} ${selectedToken.ticker}`)
    console.log(`Remaining: ${(selectedToken.balance.display - amount).toFixed(selectedToken.decimals)} ${selectedToken.ticker}`)
    console.log('Estimated Fee: ~0.01 XEC')
    console.log(`Avalanche Finality: ${useFinality ? 'ENABLED (~3 sec confirmation)' : 'DISABLED (~10 min block confirmation)'}`)

    // Confirm transaction
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const confirmed = await new Promise((resolve) => {
      rl.question('\nDo you want to proceed with this token transfer? (yes/no): ', (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
      })
    })

    if (!confirmed) {
      console.log('❌ Transaction cancelled by user')
      return
    }

    console.log('\n🚀 Broadcasting token transaction...')
    console.log(`   Protocol: ${selectedToken.protocol}`)
    console.log('   Using main wallet API with automatic protocol routing')

    // Prepare outputs for main wallet API
    const outputs = [{
      address: recipientAddress,
      amount: amount
    }]

    // Send the tokens using main wallet API (Step 1 integration)
    // The wallet will automatically:
    // - Detect the protocol (SLP/ALP)
    // - Route to appropriate handler
    // - Handle UTXO selection
    // - Build and broadcast transaction
    const txOptions = useFinality ? { awaitFinality: true } : {}
    const txid = await wallet.sendETokens(
      selectedToken.tokenId,
      outputs,
      1.2, // sats per byte fee rate
      txOptions
    )

    console.log('\n✅ Token transaction sent successfully!')
    if (useFinality) {
      console.log('⚡ Avalanche Finality: CONFIRMED (instant ~3 sec)')
    }
    console.log('═'.repeat(60))
    console.log(`Transaction ID: ${txid}`)
    console.log(`Protocol: ${selectedToken.protocol}`)
    console.log(`Token: ${selectedToken.ticker}`)
    console.log(`Amount: ${amount} ${selectedToken.ticker}`)
    console.log(`To: ${recipientAddress}`)
    console.log('═'.repeat(60))

    console.log('\n🔗 View Transaction:')
    console.log(`   Explorer: https://explorer.e.cash/tx/${txid}`)

    console.log('\n💰 Updated Balances (estimated):')
    console.log(`   ${selectedToken.ticker}: ${(selectedToken.balance.display - amount).toFixed(selectedToken.decimals)} ${selectedToken.ticker}`)
    console.log(`   XEC: ~${(xecBalance - 0.01).toFixed(2)} XEC (minus fees)`)

    console.log('\n💡 Next Steps:')
    if (useFinality) {
      console.log('   • Transaction is FINAL - confirmed via Avalanche Pre-Consensus')
      console.log('   • No need to wait for block confirmation')
      console.log('   • Safe to consider the transaction complete')
    } else {
      console.log('   • The transaction is now being processed by the network')
      console.log('   • Confirmation usually takes 1-10 minutes')
      console.log('   • Use --finality flag for instant (~3 sec) Avalanche confirmation')
    }
    console.log('   • Check updated balance: node examples/tokens/list-all-tokens.js')
    console.log('   • Send more tokens: node examples/tokens/send-any-token.js')
    console.log('   • Get token info: node examples/tokens/get-token-info.js')
  } catch (err) {
    console.error('\n❌ Failed to send token:', err.message)

    // Provide context-specific help based on error type
    if (err.message.includes('Token ID is required')) {
      console.log('\n🎯 Token Selection Issue:')
      console.log('   • Verify token ticker or ID is correct')
      console.log('   • Check available tokens: node examples/tokens/list-all-tokens.js')
    } else if (err.message.includes('insufficient')) {
      console.log('\n💸 Balance Issue:')
      console.log('   • Check token balance is sufficient')
      console.log('   • Ensure XEC available for fees')
      console.log('   • Balance check: node examples/tokens/list-all-tokens.js')
    } else if (err.message.includes('address') || err.message.includes('Invalid address')) {
      console.log('\n📍 Address Issue:')
      console.log('   • Verify recipient address format')
      console.log('   • Use ecash: or etoken: format')
      console.log('   • Example: ecash:qpcskwl402g5stqxy26js0j3mx5v54xqtssp0v7kkr')
    } else if (err.message.includes('network') || err.message.includes('chronik')) {
      console.log('\n🌐 Network Issue:')
      console.log('   • Check internet connection')
      console.log('   • Chronik API may be temporarily unavailable')
      console.log('   • Try again in a few moments')
    } else {
      console.log('\n🔧 General Error:')
      console.log('   • Check wallet is properly initialized')
      console.log('   • Verify wallet has tokens and XEC for fees')
      console.log('   • Try listing tokens first to debug')
    }

    console.log('\nFor debugging, run:')
    console.log('   node examples/tokens/list-all-tokens.js')
    console.log('   node examples/wallet-info/get-balance.js')

    process.exit(1)
  }
}

// Run the token sender
sendAnyToken()
