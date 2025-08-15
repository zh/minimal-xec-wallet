/*
  Optimize wallet UTXOs by consolidating them.
  This example shows how to reduce the number of UTXOs to lower future transaction fees.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run') || args.includes('-n')

function showUsage () {
  console.log('Usage: node optimize-utxos.js [--dry-run]')
  console.log('')
  console.log('Options:')
  console.log('  --dry-run, -n    Show optimization plan without executing')
  console.log('')
  console.log('Examples:')
  console.log('  node optimize-utxos.js --dry-run    # Preview optimization')
  console.log('  node optimize-utxos.js              # Execute optimization')
  console.log('')
  console.log('Purpose:')
  console.log('  • Consolidates multiple small UTXOs into fewer larger ones')
  console.log('  • Reduces future transaction fees')
  console.log('  • Improves wallet performance')
  console.log('  • Cleans up "dust" outputs')
}

async function analyzeUtxos (wallet) {
  console.log('🔍 Analyzing wallet UTXOs...')

  const utxoData = await wallet.getUtxos()
  const utxos = utxoData.utxos || []
  const spendableUtxos = utxos.filter(utxo => utxo.blockHeight !== -1)

  if (spendableUtxos.length === 0) {
    console.log('\n💸 No spendable UTXOs found!')
    console.log('   Your wallet has no confirmed UTXOs to optimize.')
    return null
  }

  // Calculate statistics
  const totalValue = spendableUtxos.reduce((sum, utxo) => sum + utxo.value, 0)
  const averageValue = totalValue / spendableUtxos.length
  const values = spendableUtxos.map(utxo => utxo.value).sort((a, b) => a - b)
  const medianValue = values[Math.floor(values.length / 2)]

  // Categorize UTXOs
  const dustUtxos = spendableUtxos.filter(utxo => utxo.value < 546) // < 5.46 XEC
  const smallUtxos = spendableUtxos.filter(utxo => utxo.value >= 546 && utxo.value < 10000) // 5.46 - 100 XEC
  const mediumUtxos = spendableUtxos.filter(utxo => utxo.value >= 10000 && utxo.value < 100000) // 100 - 1000 XEC
  const largeUtxos = spendableUtxos.filter(utxo => utxo.value >= 100000) // > 1000 XEC

  console.log('\n📊 UTXO Analysis:')
  console.log('═'.repeat(60))
  console.log(`Total UTXOs: ${spendableUtxos.length}`)
  console.log(`Total Value: ${(totalValue / 100).toLocaleString()} XEC`)
  console.log(`Average Size: ${(averageValue / 100).toLocaleString()} XEC`)
  console.log(`Median Size: ${(medianValue / 100).toLocaleString()} XEC`)
  console.log('═'.repeat(60))

  console.log('\n🏷️  UTXO Categories:')
  console.log(`Dust (< 5.46 XEC): ${dustUtxos.length} UTXOs`)
  console.log(`Small (5.46 - 100 XEC): ${smallUtxos.length} UTXOs`)
  console.log(`Medium (100 - 1000 XEC): ${mediumUtxos.length} UTXOs`)
  console.log(`Large (> 1000 XEC): ${largeUtxos.length} UTXOs`)

  // Calculate potential fee savings
  const currentTxCost = spendableUtxos.length * 150 * 1.2 / 100 // 150 bytes per input * 1.2 sat/byte
  const optimizedTxCost = Math.min(spendableUtxos.length, 5) * 150 * 1.2 / 100 // Assume max 5 UTXOs after optimization
  const potentialSavings = currentTxCost - optimizedTxCost

  console.log('\n💰 Fee Impact Analysis:')
  console.log(`Current TX cost estimate: ${currentTxCost.toFixed(4)} XEC`)
  console.log(`Optimized TX cost estimate: ${optimizedTxCost.toFixed(4)} XEC`)
  console.log(`Potential savings per TX: ${potentialSavings.toFixed(4)} XEC`)

  return {
    total: spendableUtxos.length,
    dust: dustUtxos.length,
    small: smallUtxos.length,
    medium: mediumUtxos.length,
    large: largeUtxos.length,
    totalValue,
    needsOptimization: spendableUtxos.length > 10 || dustUtxos.length > 0
  }
}

async function optimizeUtxos () {
  try {
    console.log('⚡ UTXO Optimization Tool\n')

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No transactions will be sent\n')
    }

    // Load wallet from file
    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      console.log('   Run: node examples/wallet-creation/create-new-wallet.js')
      return
    }

    // Create wallet instance from saved data
    const wallet = new MinimalXECWallet(walletData.mnemonic || walletData.privateKey)
    await wallet.walletInfoPromise

    // Initialize wallet
    await wallet.initialize()

    console.log('💰 Checking wallet balance...')
    const balance = await wallet.getXecBalance()

    console.log('\n📋 Wallet Information:')
    console.log('═'.repeat(60))
    console.log(`Address: ${walletData.xecAddress}`)
    console.log(`Balance: ${balance.toLocaleString()} XEC`)
    console.log('═'.repeat(60))

    // Analyze current UTXO state
    const analysis = await analyzeUtxos(wallet)
    if (!analysis) {
      return
    }

    // Check if optimization is needed
    if (!analysis.needsOptimization) {
      console.log('\n✅ Your wallet is already optimized!')
      console.log('   • You have a reasonable number of UTXOs')
      console.log('   • No dust UTXOs detected')
      console.log('   • Transaction fees should be minimal')
      return
    }

    console.log('\n💡 Optimization Recommendations:')

    if (analysis.dust > 0) {
      console.log(`   • Consolidate ${analysis.dust} dust UTXOs (< 5.46 XEC)`)
    }

    if (analysis.total > 20) {
      console.log(`   • Reduce UTXO count from ${analysis.total} to ~5-10`)
    }

    if (analysis.small > 10) {
      console.log(`   • Combine ${analysis.small} small UTXOs`)
    }

    // In dry run mode, just show the plan
    if (dryRun) {
      console.log('\n📋 DRY RUN COMPLETE')
      console.log('   Run without --dry-run to execute optimization')
      console.log('   Estimated optimization fee: ~0.01-0.05 XEC')
      return
    }

    // Confirm optimization
    console.log('\n⚠️  UTXO Optimization Confirmation')
    console.log('   This will consolidate your UTXOs to improve efficiency.')
    console.log('   Benefits:')
    console.log('   • Lower future transaction fees')
    console.log('   • Faster transaction creation')
    console.log('   • Cleaner wallet state')
    console.log('')
    console.log('   Cost:')
    console.log('   • One-time consolidation fee (~0.01-0.05 XEC)')
    console.log('   • UTXOs will be temporarily locked during confirmation')

    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const confirmed = await new Promise((resolve) => {
      rl.question('\nDo you want to optimize your UTXOs? (yes/no): ', (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
      })
    })

    if (!confirmed) {
      console.log('❌ UTXO optimization cancelled by user')
      return
    }

    console.log('\n🚀 Starting UTXO optimization...')

    // Run the optimization
    const result = await wallet.optimize(false) // false = not dry run

    if (result && result.txid) {
      console.log('\n✅ UTXO optimization completed successfully!')
      console.log('═'.repeat(60))
      console.log(`Transaction ID: ${result.txid}`)
      console.log(`UTXOs consolidated: ${result.utxosConsolidated || 'Multiple'}`)
      console.log(`Fee paid: ${result.fee ? (result.fee / 100).toLocaleString() + ' XEC' : 'Calculated automatically'}`)
      console.log('═'.repeat(60))

      // Show updated state
      console.log('\n💰 Getting updated balance...')
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds

      const newBalance = await wallet.getXecBalance()
      console.log(`New Balance: ${newBalance.toLocaleString()} XEC`)

      console.log('\n🔗 View Transaction:')
      console.log(`   Explorer: https://explorer.e.cash/tx/${result.txid}`)

      console.log('\n📝 What happened:')
      console.log('   • Multiple small UTXOs were combined into fewer larger ones')
      console.log('   • Future transactions will require lower fees')
      console.log('   • Your wallet is now more efficient')
      console.log('   • Wait for confirmation before making new transactions')

      console.log('\n⏱️  Next Steps:')
      console.log('   • Wait 1-10 minutes for transaction confirmation')
      console.log('   • Check new UTXO state: node examples/wallet-info/get-utxos.js')
      console.log('   • Your wallet is now optimized for efficient transactions')
    } else {
      console.log('\n❌ UTXO optimization failed or was not needed')
      console.log('   Possible reasons:')
      console.log('   • UTXOs are already optimal')
      console.log('   • Insufficient balance for optimization fee')
      console.log('   • Network error during optimization')
    }
  } catch (err) {
    console.error('❌ Failed to optimize UTXOs:', err.message)

    // Provide helpful error context
    if (err.message.includes('insufficient')) {
      console.log('\n💸 Insufficient Funds:')
      console.log('   • Your wallet needs enough XEC to pay consolidation fees')
      console.log('   • Try optimizing when you have a larger balance')
      console.log('   • Each consolidation transaction requires a small fee')
    } else if (err.message.includes('network')) {
      console.log('\n🌐 Network Error:')
      console.log('   • Check your internet connection')
      console.log('   • The network might be temporarily unavailable')
      console.log('   • Try again in a few moments')
    }

    process.exit(1)
  }
}

// Show usage if requested
if (args.includes('--help') || args.includes('-h')) {
  showUsage()
  process.exit(0)
}

// Run the example
optimizeUtxos()
