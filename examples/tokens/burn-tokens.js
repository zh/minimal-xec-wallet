/*
  Burn tokens (SLP or ALP) using the main wallet API
  Demonstrates safe token destruction with confirmation prompts
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)
const useFinality = args.includes('--finality')
const filteredArgs = args.filter(arg => arg !== '--finality')

function showUsage () {
  console.log('Usage: node burn-tokens.js <token_ticker_or_id> [amount] [--finality]')
  console.log('')
  console.log('Examples:')
  console.log('  node burn-tokens.js FLCT 2          # Burn 2 FLCT tokens')
  console.log('  node burn-tokens.js TGR 1.5         # Burn 1.5 TGR tokens')
  console.log('  node burn-tokens.js FLCT all        # Burn all FLCT tokens')
  console.log('  node burn-tokens.js 5e40dda12765...912135 3  # Burn by token ID')
  console.log('  node burn-tokens.js FLCT 2 --finality  # Burn with Avalanche finality (~3 sec)')
  console.log('')
  console.log('Parameters:')
  console.log('  token_ticker_or_id: Token ticker (FLCT, TGR) or full token ID')
  console.log('  amount: Amount to burn, or "all" to burn everything (optional)')
  console.log('')
  console.log('Options:')
  console.log('  --finality: Wait for Avalanche Pre-Consensus finality (~3 seconds)')
  console.log('              Without this flag, confirmation takes ~10 minutes (next block)')
  console.log('')
  console.log('⚠️  WARNING: Token burning is PERMANENT and IRREVERSIBLE!')
  console.log('✨ Features:')
  console.log('   • Protocol (SLP/ALP) detected automatically')
  console.log('   • Multiple safety confirmations')
  console.log('   • Burn specific amounts or all tokens')
  console.log('   • Uses main wallet API for consistency')
  console.log('   • Optional Avalanche Pre-Consensus instant finality')
}

async function burnTokens () {
  try {
    console.log('🔥 Burn Tokens (Main Wallet API)...\n')

    // Check arguments
    if (filteredArgs.length < 1) {
      console.log('❌ Missing required arguments')
      showUsage()
      return
    }

    const tokenInput = filteredArgs[0]
    const amountInput = filteredArgs[1] || 'prompt'
    const burnAll = amountInput === 'all'

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
      console.log('💡 Get some tokens first:')
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

    // Find the token to burn
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

    // Handle amount determination
    let amountToBurn

    if (burnAll) {
      amountToBurn = selectedToken.balance.display
      console.log(`🔥 Burning ALL tokens: ${amountToBurn} ${selectedToken.ticker}`)
    } else if (amountInput === 'prompt') {
      // Prompt for amount
      const readline = require('readline')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })

      const amountStr = await new Promise((resolve) => {
        rl.question(`Enter amount to burn (max: ${selectedToken.balance.display} ${selectedToken.ticker}): `, (answer) => {
          rl.close()
          resolve(answer)
        })
      })

      amountToBurn = parseFloat(amountStr)
      if (isNaN(amountToBurn) || amountToBurn <= 0) {
        console.log('❌ Invalid amount entered')
        return
      }
    } else {
      amountToBurn = parseFloat(amountInput)
      if (isNaN(amountToBurn) || amountToBurn <= 0) {
        console.log('❌ Invalid amount. Must be a positive number')
        showUsage()
        return
      }
    }

    // Validate sufficient balance
    if (amountToBurn > selectedToken.balance.display) {
      console.log('❌ Insufficient token balance!')
      console.log(`   Requested: ${amountToBurn} ${selectedToken.ticker}`)
      console.log(`   Available: ${selectedToken.balance.display} ${selectedToken.ticker}`)
      return
    }

    // Get current XEC balance for fee check
    const xecBalance = await wallet.getXecBalance()
    console.log(`💰 XEC Available: ${xecBalance.toLocaleString()} XEC`)

    if (xecBalance < 1) {
      console.log('⚠️  Warning: Low XEC balance for transaction fees')
    }

    // Show burn summary with warnings
    console.log('\n🔥 BURN TRANSACTION SUMMARY:')
    console.log('═'.repeat(50))
    console.log(`Protocol: ${selectedToken.protocol}`)
    console.log(`Token: ${selectedToken.ticker} (${selectedToken.name})`)
    console.log(`Amount to burn: ${amountToBurn} ${selectedToken.ticker}`)
    console.log(`Remaining after burn: ${(selectedToken.balance.display - amountToBurn).toFixed(selectedToken.decimals)} ${selectedToken.ticker}`)
    console.log('Estimated Fee: ~0.01 XEC')
    console.log(`Avalanche Finality: ${useFinality ? 'ENABLED (~3 sec confirmation)' : 'DISABLED (~10 min block confirmation)'}`)
    console.log('')
    console.log('⚠️  WARNING: THIS ACTION IS PERMANENT AND IRREVERSIBLE!')
    console.log('    Burned tokens are destroyed forever and cannot be recovered.')

    // Multiple confirmation prompts for safety
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    // First confirmation
    const confirmed1 = await new Promise((resolve) => {
      rl.question(`\nDo you understand that burning ${amountToBurn} ${selectedToken.ticker} is PERMANENT? (yes/no): `, (answer) => {
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
      })
    })

    if (!confirmed1) {
      rl.close()
      console.log('❌ Burn cancelled - confirmation required')
      return
    }

    // Second confirmation with exact details
    const confirmed2 = await new Promise((resolve) => {
      rl.question(`\nType "BURN ${amountToBurn} ${selectedToken.ticker}" to confirm: `, (answer) => {
        rl.close()
        resolve(answer === `BURN ${amountToBurn} ${selectedToken.ticker}`)
      })
    })

    if (!confirmed2) {
      console.log('❌ Burn cancelled - exact confirmation required')
      return
    }

    console.log('\n🔥 Broadcasting burn transaction...')
    console.log(`   Protocol: ${selectedToken.protocol}`)
    console.log('   Using main wallet API with automatic protocol routing')

    // Burn the tokens using main wallet API (Step 1 integration)
    // The wallet will automatically:
    // - Detect the protocol (SLP/ALP)
    // - Route to appropriate handler
    // - Handle UTXO selection and change
    // - Build and broadcast burn transaction
    let txid
    const txOptions = useFinality ? { awaitFinality: true } : {}

    if (burnAll) {
      txid = await wallet.burnAllETokens(selectedToken.tokenId, 1.2, txOptions)
    } else {
      txid = await wallet.burnETokens(selectedToken.tokenId, amountToBurn, 1.2, txOptions)
    }

    console.log('\n✅ Token burn transaction sent successfully!')
    if (useFinality) {
      console.log('⚡ Avalanche Finality: CONFIRMED (instant ~3 sec)')
    }
    console.log('═'.repeat(60))
    console.log(`Transaction ID: ${txid}`)
    console.log(`Protocol: ${selectedToken.protocol}`)
    console.log(`Token: ${selectedToken.ticker}`)
    console.log(`Amount burned: ${amountToBurn} ${selectedToken.ticker}`)
    console.log('Status: PERMANENTLY DESTROYED')
    console.log('═'.repeat(60))

    console.log('\n🔗 View Transaction:')
    console.log(`   Explorer: https://explorer.e.cash/tx/${txid}`)

    console.log('\n💰 Updated Balances (estimated):')
    console.log(`   ${selectedToken.ticker}: ${(selectedToken.balance.display - amountToBurn).toFixed(selectedToken.decimals)} ${selectedToken.ticker}`)
    console.log(`   XEC: ~${(xecBalance - 0.01).toFixed(2)} XEC (minus fees)`)

    console.log('\n💡 Next Steps:')
    if (useFinality) {
      console.log('   • Transaction is FINAL - confirmed via Avalanche Pre-Consensus')
      console.log('   • No need to wait for block confirmation')
      console.log('   • The burn is permanently confirmed')
    } else {
      console.log('   • The burn transaction is now being processed by the network')
      console.log('   • Confirmation usually takes 1-10 minutes')
      console.log('   • Use --finality flag for instant (~3 sec) Avalanche confirmation')
    }
    console.log('   • Check updated balance: node examples/tokens/list-all-tokens.js')
    console.log('   • Send tokens: node examples/tokens/send-any-token.js')
    console.log('   • Get token info: node examples/tokens/get-token-info.js')
  } catch (err) {
    console.error('\n❌ Failed to burn tokens:', err.message)

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
    } else if (err.message.includes('must be a positive number')) {
      console.log('\n🔢 Amount Issue:')
      console.log('   • Amount must be greater than 0')
      console.log('   • Use decimal notation (e.g., 1.5)')
      console.log('   • Or use "all" to burn everything')
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

// Run the token burner
burnTokens()
