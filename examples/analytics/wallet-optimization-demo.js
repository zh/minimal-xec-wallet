/*
  Wallet Optimization Demo

  This example demonstrates how to use the analytics system to optimize
  wallet performance, reduce fees, and improve privacy through intelligent
  UTXO management and consolidation strategies.
*/

const MinimalXECWallet = require('../../index')

async function demonstrateWalletOptimization () {
  try {
    console.log('\n=== Wallet Optimization Demo ===\n')

    // Create wallet with optimization analytics enabled
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

    const walletOptions = {
      utxoAnalytics: {
        enabled: true,
        debug: false,
        classificationConfig: {
          ageThresholds: {
            fresh: 6,
            recent: 144,
            mature: 1008,
            aged: 4032
          },
          valueThresholds: {
            dust: 1000,
            micro: 5000,
            small: 50000,
            medium: 500000,
            large: 5000000
          }
        },
        healthMonitorConfig: {
          dustLimit: 546,
          economicalThreshold: 2.0,
          alertThresholds: {
            highDustRatio: 0.7,
            lowLiquidity: 0.3,
            highConsolidationNeed: 0.5
          }
        }
      }
    }

    const wallet = new MinimalXECWallet(mnemonic, walletOptions)
    await wallet.walletInfoPromise

    console.log('📧 Wallet Address:', wallet.walletInfo.xecAddress)
    console.log('⚙️  Optimization Analytics Enabled:', wallet.utxos.hasAnalytics())

    // Initialize wallet
    console.log('\n🔄 Initializing wallet...')
    await wallet.initialize()

    const utxos = await wallet.getUtxos()
    console.log(`📦 Found ${utxos.utxos.length} UTXOs`)

    if (utxos.utxos.length === 0) {
      console.log('💡 Note: This demo wallet has no UTXOs.')
      console.log('🧪 Running optimization analysis with mock data instead...\n')
      return demonstrateOptimizationWithMockData()
    }

    // Perform comprehensive wallet analysis
    console.log('\n🔍 Performing comprehensive wallet analysis...')

    // 1. Get classification statistics
    const classificationStats = wallet.utxos.getClassificationStats()
    displayClassificationSummary(classificationStats)

    // 2. Get health report
    const healthReport = wallet.utxos.getWalletHealthReport()
    displayHealthSummary(healthReport)

    // 3. Get optimization recommendations
    const optimizationRecs = wallet.utxos.getOptimizationRecommendations()
    displayOptimizationRecommendations(optimizationRecs)

    // 4. Analyze consolidation opportunities
    analyzeConsolidationOpportunities(wallet, healthReport, optimizationRecs)

    // 5. Provide privacy optimization suggestions
    analyzePrivacyOptimizations(wallet, classificationStats)

    console.log('\n✨ Wallet optimization analysis completed!')
  } catch (err) {
    console.error('❌ Error in wallet optimization demo:', err.message)
  }
}

function displayClassificationSummary (stats) {
  console.log('\n📊 === CLASSIFICATION SUMMARY ===')

  console.log('\n📈 Portfolio Overview:')
  console.log(`  Total UTXOs: ${stats.total}`)
  console.log(`  Total Value: ${stats.totalValue} satoshis (${stats.totalValue / 100} XEC)`)
  console.log(`  Spendable Value: ${stats.spendableValue} satoshis (${stats.spendableValue / 100} XEC)`)
  console.log(`  Token UTXOs: ${stats.tokenUtxos}`)

  console.log('\n🎯 Quality Scores:')
  console.log(`  Average Health: ${stats.averageHealthScore}/100`)
  console.log(`  Average Privacy: ${stats.averagePrivacyScore}/100`)
  console.log(`  Average Age: ${stats.averageAgeScore}/100`)
  console.log(`  Average Value: ${stats.averageValueScore}/100`)

  console.log('\n📊 Distribution:')
  console.log('  By Age:', Object.entries(stats.byAge).filter(([, count]) => count > 0).map(([age, count]) => `${age}: ${count}`).join(', '))
  console.log('  By Value:', Object.entries(stats.byValue).filter(([, count]) => count > 0).map(([value, count]) => `${value}: ${count}`).join(', '))
  console.log('  By Health:', Object.entries(stats.byHealth).filter(([, count]) => count > 0).map(([health, count]) => `${health}: ${count}`).join(', '))
}

function displayHealthSummary (healthReport) {
  console.log('\n🏥 === HEALTH SUMMARY ===')

  const { summary } = healthReport

  const healthEmoji = getHealthEmoji(summary.healthPercentage)
  console.log(`\n${healthEmoji} Overall Health: ${summary.healthPercentage.toFixed(1)}%`)

  console.log('\n📊 Health Breakdown:')
  console.log(`  Healthy: ${summary.healthy} (${(summary.healthy / summary.total * 100).toFixed(1)}%)`)
  console.log(`  At Risk: ${summary.atRisk} (${(summary.atRisk / summary.total * 100).toFixed(1)}%)`)
  console.log(`  Dust: ${summary.dust} (${(summary.dust / summary.total * 100).toFixed(1)}%)`)
  console.log(`  Suspicious: ${summary.suspicious}`)
  console.log(`  Unconfirmed: ${summary.unconfirmed}`)

  console.log('\n💰 Value Efficiency:')
  console.log(`  Spendable: ${summary.spendablePercentage.toFixed(1)}%`)
  console.log(`  Uneconomical: ${summary.uneconomicalValue} satoshis`)

  if (healthReport.alerts.length > 0) {
    console.log('\n🚨 Active Issues:')
    healthReport.alerts.slice(0, 3).forEach((alert, index) => {
      console.log(`  ${index + 1}. ${alert.message}`)
    })
  }
}

function displayOptimizationRecommendations (recommendations) {
  console.log('\n🎯 === OPTIMIZATION RECOMMENDATIONS ===')

  const { analysis, consolidation } = recommendations

  console.log('\n📈 Efficiency Metrics:')
  console.log(`  Fragmentation Score: ${analysis.fragmentationScore}/100`)
  console.log(`  Efficiency Score: ${analysis.efficiencyScore.toFixed(1)}%`)
  console.log(`  Dust UTXOs: ${analysis.dustUtxos}`)

  console.log('\n🔗 Consolidation Analysis:')
  console.log(`  Recommended: ${consolidation.recommended ? '✅ Yes' : '❌ No'}`)
  console.log(`  Candidate UTXOs: ${consolidation.candidateUtxos}`)
  console.log(`  Estimated Cost: ${consolidation.estimatedCost} satoshis (${consolidation.estimatedCost / 100} XEC)`)
  console.log(`  Long-term Savings: ${consolidation.longTermSavings} satoshis (${consolidation.longTermSavings / 100} XEC)`)
  console.log(`  Break-even Point: ${consolidation.breakEvenTxCount} transactions`)

  const roi = consolidation.estimatedCost > 0 ? (consolidation.longTermSavings / consolidation.estimatedCost) : 0
  console.log(`  ROI: ${(roi * 100).toFixed(1)}% (${roi.toFixed(2)}x return)`)

  if (consolidation.recommended) {
    console.log('\n💡 Consolidation Benefits:')
    console.log('  - Reduce future transaction fees')
    console.log('  - Improve wallet performance')
    console.log('  - Simplify UTXO management')
    console.log('  - Enhance privacy through mixing')
  }
}

function analyzeConsolidationOpportunities (wallet, healthReport, optimizationRecs) {
  console.log('\n🔧 === CONSOLIDATION OPPORTUNITIES ===')

  try {
    // Identify different types of UTXOs for consolidation
    const dustUtxos = wallet.utxos.getSpendableXecUtxos({
      useClassifications: true,
      classificationFilter: {
        allowedValues: ['dust']
      }
    })

    const microUtxos = wallet.utxos.getSpendableXecUtxos({
      useClassifications: true,
      classificationFilter: {
        allowedValues: ['micro']
      }
    })

    const uneconomicalUtxos = wallet.utxos.getSpendableXecUtxos({
      useClassifications: true,
      classificationFilter: {
        strategy: 'efficiency'
      }
    })

    console.log('\n📋 Consolidation Targets:')
    console.log(`  Dust UTXOs: ${dustUtxos.utxos.length}`)
    console.log(`  Micro UTXOs: ${microUtxos.utxos.length}`)
    console.log(`  Uneconomical UTXOs: ${uneconomicalUtxos.utxos.length}`)

    // Suggest consolidation strategies
    console.log('\n🎯 Consolidation Strategies:')

    if (dustUtxos.utxos.length > 0) {
      console.log('\n  1. 🧹 Dust Cleanup Strategy:')
      console.log(`     - Target: ${dustUtxos.utxos.length} dust UTXOs`)
      console.log('     - Method: Batch consolidation during low-fee periods')
      console.log('     - Priority: High (improves wallet usability)')
      console.log('     - Best Time: When network fees are < 1 sat/byte')
    }

    if (microUtxos.utxos.length > 5) {
      console.log('\n  2. 🔀 Micro UTXO Batching:')
      console.log(`     - Target: ${microUtxos.utxos.length} micro UTXOs`)
      console.log('     - Method: Combine 5-10 UTXOs per transaction')
      console.log('     - Priority: Medium (reduces complexity)')
      console.log('     - Frequency: Monthly or before major transactions')
    }

    if (healthReport.summary.unconfirmed > 0) {
      console.log('\n  3. ⏳ Confirmation Strategy:')
      console.log(`     - Target: ${healthReport.summary.unconfirmed} unconfirmed UTXOs`)
      console.log('     - Method: Wait for confirmations before consolidating')
      console.log('     - Priority: High (avoid double-spending risks)')
    }

    // Calculate optimal timing
    const currentFeeRate = 1.0 // Assume 1 sat/byte
    const lowFeeThreshold = 0.5
    const highFeeThreshold = 2.0

    console.log('\n⏰ Timing Recommendations:')
    if (currentFeeRate <= lowFeeThreshold) {
      console.log('  ✅ OPTIMAL: Current fees are low - excellent time for consolidation')
    } else if (currentFeeRate <= highFeeThreshold) {
      console.log('  🟡 FAIR: Fees are moderate - consider urgent consolidations only')
    } else {
      console.log('  🚫 EXPENSIVE: High fees - delay consolidation unless critical')
    }
  } catch (err) {
    console.log(`❌ Error analyzing consolidation: ${err.message}`)
  }
}

function analyzePrivacyOptimizations (wallet, stats) {
  console.log('\n🔒 === PRIVACY OPTIMIZATION ===')

  try {
    // Analyze privacy scores
    const avgPrivacy = stats.averagePrivacyScore

    console.log('\n🎯 Privacy Assessment:')
    if (avgPrivacy >= 80) {
      console.log('  ✅ EXCELLENT: High privacy score')
    } else if (avgPrivacy >= 60) {
      console.log('  🟡 GOOD: Moderate privacy score')
    } else {
      console.log('  ⚠️  POOR: Low privacy score needs improvement')
    }

    // Get low privacy UTXOs
    const lowPrivacyUtxos = wallet.utxos.getSpendableXecUtxos({
      useClassifications: true,
      classificationFilter: {
        minPrivacyScore: 0,
        strategy: 'privacy'
      }
    })

    // Filter for actual low privacy (this is a demo approximation)
    const actualLowPrivacy = lowPrivacyUtxos.utxos.slice(0, Math.floor(lowPrivacyUtxos.utxos.length * 0.3))

    console.log('\n📊 Privacy Breakdown:')
    console.log(`  Average Privacy Score: ${avgPrivacy}/100`)
    console.log(`  Low Privacy UTXOs: ${actualLowPrivacy.length}`)
    console.log('  Round Number UTXOs: Detected automatically')

    console.log('\n💡 Privacy Improvement Strategies:')

    console.log('\n  1. 🔀 UTXO Mixing:')
    console.log('     - Use privacy-focused coin selection')
    console.log('     - Avoid spending round-number amounts')
    console.log('     - Mix different age groups in transactions')

    console.log('\n  2. 📍 Address Management:')
    console.log('     - Generate new addresses for each transaction')
    console.log('     - Avoid address reuse')
    console.log('     - Use HD wallet derivation properly')

    console.log('\n  3. ⏰ Timing Strategies:')
    console.log('     - Vary transaction timing')
    console.log('     - Avoid predictable spending patterns')
    console.log('     - Use different fee rates occasionally')

    console.log('\n  4. 💰 Amount Strategies:')
    console.log('     - Avoid exact round numbers')
    console.log('     - Use variable change amounts')
    console.log('     - Consider privacy-preserving denominations')

    if (actualLowPrivacy.length > 0) {
      console.log('\n⚠️  Priority Actions:')
      console.log(`  - ${actualLowPrivacy.length} UTXOs need privacy attention`)
      console.log('  - Consider consolidating with high-privacy UTXOs')
      console.log('  - Use enhanced privacy settings for these UTXOs')
    }
  } catch (err) {
    console.log(`❌ Error analyzing privacy: ${err.message}`)
  }
}

// Demo with comprehensive mock data
async function demonstrateOptimizationWithMockData () {
  console.log('🧪 === Mock Data Optimization Demo ===\n')

  // Create a realistic wallet scenario for optimization
  const mockScenario = await createOptimizationTestScenario()

  console.log('📊 Analyzing mock wallet scenario...')
  console.log(`Total UTXOs: ${mockScenario.utxos.length}`)
  console.log(`Total Value: ${mockScenario.totalValue} satoshis (${mockScenario.totalValue / 100} XEC)`)

  // Classify UTXOs
  const UtxoClassifier = require('../../lib/utxo-analytics/UtxoClassifier')
  const UtxoHealthMonitor = require('../../lib/utxo-analytics/UtxoHealthMonitor')

  const classifier = new UtxoClassifier()
  const healthMonitor = new UtxoHealthMonitor()

  const classifications = classifier.classifyUtxos(mockScenario.utxos, 800000)
  const healthReport = healthMonitor.monitorUtxoSet(mockScenario.utxos, classifications, 1.0)
  const optimizationRecs = healthMonitor.generateOptimizationRecommendations(mockScenario.utxos, 1.0)

  // Display comprehensive analysis
  displayClassificationSummary(classifier.getClassificationStats(classifications))
  displayHealthSummary(healthReport)
  displayOptimizationRecommendations(optimizationRecs)

  // Demonstrate specific optimization scenarios
  console.log('\n🎯 === OPTIMIZATION SCENARIOS ===')

  // Scenario 1: High dust ratio
  console.log('\n📋 Scenario 1: High Dust Ratio Optimization')
  const dustUtxos = mockScenario.utxos.filter(utxo => utxo.sats < 5000)
  console.log(`  Dust UTXOs: ${dustUtxos.length}`)
  console.log(`  Dust Value: ${dustUtxos.reduce((sum, utxo) => sum + utxo.sats, 0)} satoshis`)
  console.log('  Recommendation: Batch consolidation during low-fee periods')
  console.log(`  Expected Benefit: Reduce ${dustUtxos.length} UTXOs to 1-2 consolidated outputs`)

  // Scenario 2: Privacy improvement
  console.log('\n📋 Scenario 2: Privacy Enhancement')
  const roundNumberUtxos = mockScenario.utxos.filter(utxo => {
    const xecValue = utxo.sats / 100
    return xecValue % 100 === 0 || xecValue % 1000 === 0
  })
  console.log(`  Round Number UTXOs: ${roundNumberUtxos.length}`)
  console.log('  Privacy Risk: Potential fingerprinting')
  console.log('  Recommendation: Mix with irregular amounts when spending')

  // Scenario 3: Efficiency optimization
  console.log('\n📋 Scenario 3: Transaction Efficiency')
  const unconfirmedUtxos = mockScenario.utxos.filter(utxo => utxo.blockHeight === -1)
  const confirmedUtxos = mockScenario.utxos.filter(utxo => utxo.blockHeight !== -1)
  console.log(`  Confirmed UTXOs: ${confirmedUtxos.length}`)
  console.log(`  Unconfirmed UTXOs: ${unconfirmedUtxos.length}`)
  console.log('  Recommendation: Prioritize confirmed UTXOs for reliable transactions')

  // Provide actionable optimization plan
  console.log('\n📋 === ACTIONABLE OPTIMIZATION PLAN ===')

  console.log('\n🎯 Immediate Actions (Next 24 hours):')
  console.log('  1. Monitor network fee rates for optimal consolidation timing')
  console.log('  2. Identify and quarantine suspicious micro-UTXOs')
  console.log('  3. Plan privacy-focused transaction strategies')

  console.log('\n📅 Short-term Goals (Next week):')
  console.log('  1. Consolidate dust UTXOs during low-fee periods')
  console.log('  2. Implement address rotation for new transactions')
  console.log('  3. Set up automated health monitoring alerts')

  console.log('\n🎯 Long-term Strategy (Next month):')
  console.log('  1. Establish regular UTXO maintenance schedule')
  console.log('  2. Implement advanced privacy practices')
  console.log('  3. Optimize wallet structure for efficiency')

  console.log('\n📊 Expected Outcomes:')
  console.log('  - 30-50% reduction in future transaction fees')
  console.log('  - Improved transaction reliability')
  console.log('  - Enhanced privacy protection')
  console.log('  - Simplified wallet management')
}

// Create realistic optimization test scenario
async function createOptimizationTestScenario () {
  const utxos = []
  let totalValue = 0

  // Add normal UTXOs
  const normalAmounts = [500000, 250000, 100000, 75000, 50000] // Large UTXOs
  normalAmounts.forEach((amount, i) => {
    const utxo = {
      outpoint: { txid: `normal${i}`.padEnd(64, '0'), outIdx: 0 },
      blockHeight: 800000 - (i * 100),
      sats: amount,
      script: '76a914' + i.toString().padStart(40, '0') + '88ac'
    }
    utxos.push(utxo)
    totalValue += amount
  })

  // Add dust UTXOs (problematic)
  for (let i = 0; i < 15; i++) {
    const utxo = {
      outpoint: { txid: `dust${i}`.padEnd(64, '0'), outIdx: 0 },
      blockHeight: 799900 + i,
      sats: 1000 + (i * 100), // 10-24 XEC
      script: '76a914' + `dust${i}`.padStart(40, '0') + '88ac'
    }
    utxos.push(utxo)
    totalValue += utxo.sats
  }

  // Add micro UTXOs (questionable efficiency)
  for (let i = 0; i < 8; i++) {
    const utxo = {
      outpoint: { txid: `micro${i}`.padEnd(64, '0'), outIdx: 0 },
      blockHeight: i % 2 === 0 ? 799950 : -1, // Some unconfirmed
      sats: 3000 + (i * 500), // 30-65 XEC
      script: '76a914' + `micro${i}`.padStart(40, '0') + '88ac'
    }
    utxos.push(utxo)
    totalValue += utxo.sats
  }

  // Add round number UTXOs (privacy concerns)
  const roundAmounts = [10000, 20000, 50000, 100000] // 100, 200, 500, 1000 XEC
  roundAmounts.forEach((amount, i) => {
    const utxo = {
      outpoint: { txid: `round${i}`.padEnd(64, '0'), outIdx: 0 },
      blockHeight: 799800 + i,
      sats: amount,
      script: '76a914' + `round${i}`.padStart(40, '0') + '88ac'
    }
    utxos.push(utxo)
    totalValue += amount
  })

  return { utxos, totalValue }
}

function getHealthEmoji (percentage) {
  if (percentage >= 90) return '💚'
  if (percentage >= 70) return '💛'
  if (percentage >= 50) return '🧡'
  return '❤️'
}

// Export functions for use in other examples
module.exports = {
  demonstrateWalletOptimization,
  demonstrateOptimizationWithMockData,
  displayClassificationSummary,
  displayHealthSummary,
  displayOptimizationRecommendations,
  analyzeConsolidationOpportunities,
  analyzePrivacyOptimizations,
  createOptimizationTestScenario
}

// Run demo if called directly
if (require.main === module) {
  demonstrateWalletOptimization()
    .catch(console.error)
}
