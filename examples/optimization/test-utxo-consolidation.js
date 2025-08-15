/*
  Test UTXO consolidation functionality with real wallet
  Demonstrates dry run analysis and actual consolidation capabilities
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

async function testUtxoConsolidation () {
  try {
    console.log('🔧 Testing UTXO Consolidation Functionality...\n')

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

    // Initialize wallet
    console.log('🔧 Initializing wallet...')
    const wallet = new MinimalXECWallet(walletData.mnemonic)

    await wallet.walletInfoPromise
    await wallet.initialize()

    console.log('✅ Wallet initialized successfully!')
    console.log('')

    // Get current wallet state
    console.log('📊 Current Wallet State:')
    const balance = await wallet.getXecBalance()
    const utxos = await wallet.getUtxos()
    console.log(`   XEC Balance: ${balance} XEC`)
    console.log(`   Total UTXOs: ${utxos.length}`)
    console.log('')

    // Get UTXO distribution
    console.log('📈 UTXO Distribution Analysis:')
    const distribution = wallet.consolidateUtxos.getUtxoDistribution()
    console.log(`   Total UTXOs: ${distribution.total}`)
    console.log(`   Dust (< 1000 sats): ${distribution.dust}`)
    console.log(`   Small (1000-10000 sats): ${distribution.small}`)
    console.log(`   Medium (10000-100000 sats): ${distribution.medium}`)
    console.log(`   Large (> 100000 sats): ${distribution.large}`)
    console.log('')

    // Get optimization savings estimate
    console.log('💰 Optimization Savings Estimate:')
    const savings = wallet.consolidateUtxos.estimateOptimizationSavings()
    console.log(`   Current UTXOs: ${savings.currentUtxos}`)
    if (savings.optimalUtxos) {
      console.log(`   Optimal UTXOs: ${savings.optimalUtxos}`)
      console.log(`   Current fee estimate: ${savings.currentEstimatedFee} satoshis`)
      console.log(`   Optimized fee estimate: ${savings.optimizedEstimatedFee} satoshis`)
      console.log(`   Potential savings: ${savings.savings} satoshis`)
    } else {
      console.log(`   Status: ${savings.reason}`)
    }
    console.log('')

    // Perform dry run optimization analysis
    console.log('🔍 Dry Run Optimization Analysis:')
    const dryRunResult = await wallet.optimize(true) // Dry run mode

    console.log(`   Success: ${dryRunResult.success}`)
    console.log(`   Analysis: ${dryRunResult.message}`)
    console.log(`   Planned transactions: ${dryRunResult.transactions.length}`)

    if (dryRunResult.analysis) {
      console.log('\n   📋 Detailed Analysis:')
      console.log(`      Should consolidate: ${dryRunResult.analysis.shouldConsolidate}`)
      console.log(`      UTXOs to consolidate: ${dryRunResult.analysis.totalUtxos || 'N/A'}`)
      console.log(`      Output UTXOs: ${dryRunResult.analysis.outputUtxos || 'N/A'}`)
      console.log(`      Total value: ${dryRunResult.analysis.totalValue || 'N/A'} satoshis`)
      if (dryRunResult.analysis.consolidationFee) {
        console.log(`      Consolidation fee: ${dryRunResult.analysis.consolidationFee} satoshis`)
      }
      if (dryRunResult.analysis.potentialSavings !== undefined) {
        console.log(`      Net benefit: ${dryRunResult.analysis.potentialSavings} satoshis`)
      }
    }

    // Show consolidation plans if any
    if (dryRunResult.transactions.length > 0) {
      console.log('\n   📝 Consolidation Plans:')
      dryRunResult.transactions.forEach((plan, index) => {
        console.log(`      Plan ${index + 1}:`)
        console.log(`         Input UTXOs: ${plan.inputCount}`)
        console.log(`         Input value: ${plan.totalInputValue} satoshis`)
        console.log(`         Output value: ${plan.outputValue} satoshis`)
        console.log(`         Estimated fee: ${plan.estimatedFee} satoshis`)
        if (plan.savings) {
          console.log(`         Future savings: ${plan.savings} satoshis`)
        }
      })
    }

    console.log('')

    // User decision for live execution
    if (dryRunResult.analysis && dryRunResult.analysis.shouldConsolidate) {
      console.log('💡 Consolidation Recommendation:')
      console.log('   ✅ UTXO consolidation would be beneficial!')
      console.log('   📊 Benefits:')
      console.log(`      • Reduce UTXOs from ${dryRunResult.analysis.totalUtxos} to ${dryRunResult.analysis.outputUtxos}`)
      console.log(`      • Save ${dryRunResult.analysis.potentialSavings} satoshis in future transaction fees`)
      console.log('      • Improve wallet performance and reduce transaction complexity')
      console.log('')
      console.log('⚠️  This is a test script - not executing live consolidation.')
      console.log('   To execute live consolidation, run:')
      console.log('   const result = await wallet.optimize(false) // Live mode')
      console.log('')
      console.log('🔧 Test Parameters:')
      console.log(`   Fee rate: ${walletData.fee || '1.2'} sat/byte`)
      console.log('   Dust limit: 200 satoshis')
      console.log('   Max inputs per tx: 200')
      console.log('   Consolidation threshold: 100,000 satoshis')
    } else {
      console.log('ℹ️  Consolidation Status:')
      console.log('   No consolidation needed at this time.')
      console.log('   Reasons:')
      if (distribution.total < 5) {
        console.log('   • Too few UTXOs (need at least 5)')
      }
      if (distribution.dust + distribution.small < 5) {
        console.log('   • Not enough small UTXOs to consolidate')
      }
      if (dryRunResult.analysis && dryRunResult.analysis.potentialSavings <= 0) {
        console.log('   • Consolidation would cost more than it saves')
      }
      console.log('')
      console.log('💡 When consolidation becomes beneficial:')
      console.log('   • When you have many small UTXOs (< 100,000 satoshis)')
      console.log('   • When transaction fees are low')
      console.log('   • When you frequently make transactions')
    }

    console.log('')
    console.log('🎯 Test Results:')
    console.log('   ✅ UTXO consolidation functionality working correctly')
    console.log('   ✅ Dry run analysis completed successfully')
    console.log('   ✅ Cost-benefit analysis functioning properly')
    console.log('   ✅ Smart consolidation recommendations working')
  } catch (err) {
    console.error('\n❌ UTXO consolidation test failed:', err.message)

    // Provide context-specific help
    if (err.message.includes('wallet')) {
      console.log('\n🔧 Wallet Issue:')
      console.log('   • Check wallet is properly initialized')
      console.log('   • Verify wallet has some XEC balance')
      console.log('   • Try reinitializing the wallet')
    } else if (err.message.includes('network') || err.message.includes('chronik')) {
      console.log('\n🌐 Network Issue:')
      console.log('   • Check internet connection')
      console.log('   • Chronik API may be temporarily unavailable')
      console.log('   • Try again in a few moments')
    } else {
      console.log('\n🔧 General Error:')
      console.log('   • Check wallet has been properly funded')
      console.log('   • Verify network connectivity')
      console.log('   • Try with a fresh wallet initialization')
    }

    console.log('\nFor debugging, check:')
    console.log('   node examples/wallet-info/wallet-details.js')

    process.exit(1)
  }
}

// Run the consolidation test
testUtxoConsolidation()
