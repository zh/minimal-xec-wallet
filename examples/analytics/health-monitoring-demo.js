/*
  UTXO Health Monitoring Demo

  This example demonstrates how to use the health monitoring features
  to assess wallet health, detect issues, and get optimization recommendations.
*/

const MinimalXECWallet = require('../../index')

async function demonstrateHealthMonitoring () {
  try {
    console.log('\n=== UTXO Health Monitoring Demo ===\n')

    // Create wallet with health monitoring enabled
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

    const walletOptions = {
      utxoAnalytics: {
        enabled: true,
        debug: true,
        healthMonitorConfig: {
          dustLimit: 546,
          economicalThreshold: 2.0,
          stuckThreshold: 144,
          alertThresholds: {
            highDustRatio: 0.8,
            lowLiquidity: 0.1,
            highConsolidationNeed: 0.6
          },
          suspiciousPatterns: {
            dustAttackSize: 10,
            rapidDeposits: 5,
            timeWindow: 3600000 // 1 hour
          }
        }
      }
    }

    const wallet = new MinimalXECWallet(mnemonic, walletOptions)
    await wallet.walletInfoPromise

    console.log('📧 Wallet Address:', wallet.walletInfo.xecAddress)
    console.log('🏥 Health Monitoring Enabled:', wallet.utxos.hasAnalytics())

    // Initialize wallet
    console.log('\n🔄 Initializing wallet...')
    await wallet.initialize()

    const utxos = await wallet.getUtxos()
    console.log(`📦 Found ${utxos.utxos.length} UTXOs`)

    if (utxos.utxos.length === 0) {
      console.log('💡 Note: This demo wallet has no UTXOs.')
      console.log('📊 Running health monitoring with mock data instead...\n')
      return demonstrateWithMockHealthData()
    }

    // Get comprehensive health report
    console.log('\n🏥 Generating wallet health report...')
    const healthReport = wallet.utxos.getWalletHealthReport()

    displayHealthReport(healthReport)

    // Get optimization recommendations
    console.log('\n🎯 Getting optimization recommendations...')
    const recommendations = wallet.utxos.getOptimizationRecommendations()

    displayOptimizationRecommendations(recommendations)

    // Demonstrate security threat detection
    console.log('\n🛡️  Checking for security threats...')
    const threats = wallet.utxos.detectSecurityThreats(wallet.walletInfo.xecAddress)

    displaySecurityThreats(threats)

    console.log('\n✨ Health monitoring demo completed!')
  } catch (err) {
    console.error('❌ Error in health monitoring demo:', err.message)
  }
}

function displayHealthReport (healthReport) {
  console.log('\n📊 === WALLET HEALTH REPORT ===')

  const { summary, alerts, recommendations } = healthReport

  // Overall health metrics
  console.log('\n🔍 Health Summary:')
  console.log(`  Total UTXOs: ${summary.total}`)
  console.log(`  Healthy: ${summary.healthy} (${(summary.healthy / summary.total * 100).toFixed(1)}%)`)
  console.log(`  At Risk: ${summary.atRisk}`)
  console.log(`  Unhealthy: ${summary.unhealthy}`)
  console.log(`  Dust: ${summary.dust}`)
  console.log(`  Suspicious: ${summary.suspicious}`)
  console.log(`  Unconfirmed: ${summary.unconfirmed}`)

  // Value distribution
  console.log('\n💰 Value Distribution:')
  console.log(`  Total Value: ${summary.totalValue} satoshis`)
  console.log(`  Spendable: ${summary.spendableValue} satoshis (${summary.spendablePercentage.toFixed(1)}%)`)
  console.log(`  Uneconomical: ${summary.uneconomicalValue} satoshis`)
  console.log(`  Token UTXOs: ${summary.tokenUtxos}`)

  // Health percentage
  const healthStatus = getHealthStatusEmoji(summary.healthPercentage)
  console.log(`\n${healthStatus} Overall Health: ${summary.healthPercentage.toFixed(1)}%`)

  // Active alerts
  if (alerts.length > 0) {
    console.log('\n🚨 Active Alerts:')
    alerts.forEach((alert, index) => {
      const severityEmoji = getSeverityEmoji(alert.severity)
      console.log(`  ${index + 1}. ${severityEmoji} ${alert.message}`)
      if (alert.recommendations) {
        alert.recommendations.forEach(rec => {
          console.log(`     💡 ${rec}`)
        })
      }
    })
  } else {
    console.log('\n✅ No active alerts')
  }

  // System recommendations
  if (recommendations.length > 0) {
    console.log('\n💡 System Recommendations:')
    recommendations.forEach((rec, index) => {
      const priorityEmoji = getPriorityEmoji(rec.priority)
      console.log(`  ${index + 1}. ${priorityEmoji} ${rec.message}`)
      console.log(`     Action: ${rec.action}`)
      console.log(`     Benefit: ${rec.estimatedSavings}`)
    })
  }
}

function displayOptimizationRecommendations (recommendations) {
  console.log('\n🔧 === OPTIMIZATION RECOMMENDATIONS ===')

  const { analysis, consolidation } = recommendations

  console.log('\n📈 Analysis:')
  console.log(`  Fragmentation Score: ${analysis.fragmentationScore}/100`)
  console.log(`  Efficiency Score: ${analysis.efficiencyScore.toFixed(1)}%`)
  console.log(`  Dust UTXOs: ${analysis.dustUtxos}`)

  console.log('\n🔗 Consolidation Analysis:')
  console.log(`  Recommended: ${consolidation.recommended ? 'Yes' : 'No'}`)
  console.log(`  Candidate UTXOs: ${consolidation.candidateUtxos}`)
  console.log(`  Estimated Cost: ${consolidation.estimatedCost} satoshis`)
  console.log(`  Long-term Savings: ${consolidation.longTermSavings} satoshis`)
  console.log(`  Break-even: ${consolidation.breakEvenTxCount} transactions`)

  if (consolidation.recommended) {
    console.log('\n💡 Consolidation is recommended to improve wallet efficiency!')
  }
}

function displaySecurityThreats (threats) {
  console.log('\n🛡️  === SECURITY ANALYSIS ===')

  const riskEmoji = getRiskEmoji(threats.riskLevel)
  console.log(`\n${riskEmoji} Risk Level: ${threats.riskLevel.toUpperCase()}`)

  // Dust attack analysis
  console.log('\n🕵️  Dust Attack Detection:')
  console.log(`  Detected: ${threats.dustAttack.detected ? 'YES' : 'No'}`)
  console.log(`  Suspicious UTXOs: ${threats.dustAttack.suspiciousUtxos.length}`)
  console.log(`  Confidence: ${threats.dustAttack.confidence}%`)

  if (threats.dustAttack.detected) {
    console.log('\n⚠️  DUST ATTACK DETECTED!')
    console.log('  This wallet may be under surveillance.')
    console.log('  Consider using privacy features and avoiding micro-UTXO spending.')
  }

  // Suspicious patterns
  if (threats.suspiciousPatterns.length > 0) {
    console.log('\n🔍 Suspicious Patterns:')
    threats.suspiciousPatterns.forEach((pattern, index) => {
      console.log(`  ${index + 1}. ${pattern}`)
    })
  }
}

// Demo with mock health data
async function demonstrateWithMockHealthData () {
  console.log('🧪 === Mock Health Monitoring Demo ===\n')

  const UtxoHealthMonitor = require('../../lib/utxo-analytics/UtxoHealthMonitor')

  const healthMonitor = new UtxoHealthMonitor({
    debug: true,
    dustLimit: 546,
    economicalThreshold: 2.0
  })

  // Create mock UTXOs with various health states
  const mockUtxos = [
    // Healthy UTXO
    {
      outpoint: { txid: '1'.repeat(64), outIdx: 0 },
      blockHeight: 800000,
      sats: 100000, // 1000 XEC
      script: '76a914' + '0'.repeat(40) + '88ac'
    },
    // Dust UTXO
    {
      outpoint: { txid: '2'.repeat(64), outIdx: 0 },
      blockHeight: 799990,
      sats: 300, // 3 XEC - dust
      script: '76a914' + '1'.repeat(40) + '88ac'
    },
    // Unconfirmed UTXO
    {
      outpoint: { txid: '3'.repeat(64), outIdx: 0 },
      blockHeight: -1,
      sats: 10000, // 100 XEC
      script: '76a914' + '2'.repeat(40) + '88ac'
    },
    // Suspicious micro UTXO (potential dust attack)
    {
      outpoint: { txid: '4'.repeat(64), outIdx: 0 },
      blockHeight: -1,
      sats: 600, // 6 XEC - just above dust
      script: '76a914' + '3'.repeat(40) + '88ac'
    },
    // Token UTXO
    {
      outpoint: { txid: '5'.repeat(64), outIdx: 0 },
      blockHeight: 799995,
      sats: 1000, // 10 XEC
      script: '76a914' + '4'.repeat(40) + '88ac',
      token: { tokenId: 'abc123', amount: '1000' }
    }
  ]

  console.log('🔍 Assessing individual UTXO health...')

  mockUtxos.forEach((utxo, index) => {
    try {
      const assessment = healthMonitor.assessUtxoHealth(utxo, null, 1.0)

      console.log(`\n📦 UTXO ${index + 1}:`)
      console.log(`  Status: ${assessment.status}`)
      console.log(`  Health Score: ${assessment.healthScore}/100`)
      console.log(`  Economic: ${assessment.economic.isEconomical}`)
      console.log(`  Spending Cost: ${assessment.economic.spendingCost} satoshis`)
      console.log(`  Efficiency: ${(assessment.economic.efficiency * 100).toFixed(1)}%`)

      if (assessment.risks.isDust) {
        console.log('  ⚠️  Warning: Dust UTXO')
      }
      if (assessment.risks.isSuspicious) {
        console.log('  🚨 Alert: Suspicious pattern detected')
      }
      if (assessment.risks.isUnconfirmed) {
        console.log('  ⏳ Note: Unconfirmed transaction')
      }

      if (assessment.recommendations.length > 0) {
        console.log('  💡 Recommendations:')
        assessment.recommendations.forEach(rec => {
          console.log(`    - ${rec}`)
        })
      }
    } catch (err) {
      console.log(`  ❌ Failed to assess: ${err.message}`)
    }
  })

  // Monitor the entire UTXO set
  console.log('\n🏥 Monitoring UTXO set health...')
  try {
    const healthReport = healthMonitor.monitorUtxoSet(mockUtxos, null, 1.0)
    displayHealthReport(healthReport)

    // Test dust attack detection
    console.log('\n🕵️  Testing dust attack detection...')
    const dustAnalysis = healthMonitor.detectDustAttack(mockUtxos, 'ecash:test123')

    console.log(`Severity: ${dustAnalysis.severity}`)
    console.log(`Indicators: ${dustAnalysis.indicators.join(', ')}`)
    console.log(`Suspicious UTXOs: ${dustAnalysis.utxos.length}`)

    if (dustAnalysis.recommendations.length > 0) {
      console.log('Recommendations:')
      dustAnalysis.recommendations.forEach(rec => {
        console.log(`  - ${rec}`)
      })
    }
  } catch (err) {
    console.log(`❌ Error in set monitoring: ${err.message}`)
  }
}

// Helper functions for display formatting
function getHealthStatusEmoji (percentage) {
  if (percentage >= 90) return '💚'
  if (percentage >= 70) return '💛'
  if (percentage >= 50) return '🧡'
  return '❤️'
}

function getSeverityEmoji (severity) {
  switch (severity) {
    case 'critical': return '🔴'
    case 'high': return '🟠'
    case 'medium': return '🟡'
    case 'low': return '🟢'
    default: return 'ℹ️'
  }
}

function getPriorityEmoji (priority) {
  switch (priority) {
    case 'high': return '🔥'
    case 'medium': return '⚡'
    case 'low': return '💡'
    default: return 'ℹ️'
  }
}

function getRiskEmoji (riskLevel) {
  switch (riskLevel) {
    case 'critical': return '🚨'
    case 'high': return '⚠️'
    case 'medium': return '🟡'
    case 'low': return '✅'
    default: return 'ℹ️'
  }
}

// Export functions for use in other examples
module.exports = {
  demonstrateHealthMonitoring,
  demonstrateWithMockHealthData,
  displayHealthReport,
  displayOptimizationRecommendations,
  displaySecurityThreats
}

// Run demo if called directly
if (require.main === module) {
  demonstrateHealthMonitoring()
    .catch(console.error)
}
