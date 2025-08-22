/*
  Dust Attack Detection Demo

  This example demonstrates how to detect and analyze potential dust attacks
  using the UTXO analytics system. Dust attacks are a privacy threat where
  attackers send small amounts to many addresses to track wallet activity.
*/

const MinimalXECWallet = require('../../index')

async function demonstrateDustAttackDetection () {
  try {
    console.log('\n=== Dust Attack Detection Demo ===\n')

    // Create wallet with enhanced dust attack detection
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

    const walletOptions = {
      utxoAnalytics: {
        enabled: true,
        debug: true,
        healthMonitorConfig: {
          dustLimit: 546,
          suspiciousPatterns: {
            dustAttackSize: 5, // Lower threshold for demo
            rapidDeposits: 3, // Detect rapid sequences
            timeWindow: 3600000 // 1 hour window
          },
          alertThresholds: {
            highDustRatio: 0.6, // Alert if 60%+ are dust
            lowLiquidity: 0.2, // Alert if <20% spendable
            highConsolidationNeed: 0.5
          }
        }
      }
    }

    const wallet = new MinimalXECWallet(mnemonic, walletOptions)
    await wallet.walletInfoPromise

    console.log('📧 Wallet Address:', wallet.walletInfo.xecAddress)
    console.log('🕵️  Dust Attack Detection Enabled:', wallet.utxos.hasAnalytics())

    // Initialize wallet
    console.log('\n🔄 Initializing wallet...')
    await wallet.initialize()

    const utxos = await wallet.getUtxos()
    console.log(`📦 Found ${utxos.utxos.length} UTXOs`)

    if (utxos.utxos.length === 0) {
      console.log('💡 Note: This demo wallet has no UTXOs.')
      console.log('🧪 Running dust attack detection with simulated scenarios...\n')
      return demonstrateDustAttackScenarios()
    }

    // Analyze current wallet for dust attack indicators
    console.log('\n🔍 Analyzing wallet for dust attack indicators...')
    const securityThreats = wallet.utxos.detectSecurityThreats(wallet.walletInfo.xecAddress)

    displayDustAttackAnalysis(securityThreats)

    // Get detailed health report with dust analysis
    console.log('\n🏥 Getting comprehensive health report...')
    const healthReport = wallet.utxos.getWalletHealthReport()

    analyzeDustPatterns(healthReport)

    console.log('\n✨ Dust attack detection demo completed!')
  } catch (err) {
    console.error('❌ Error in dust attack detection demo:', err.message)
  }
}

function displayDustAttackAnalysis (threats) {
  console.log('\n🛡️  === DUST ATTACK ANALYSIS ===')

  const riskEmoji = getRiskEmoji(threats.riskLevel)
  console.log(`\n${riskEmoji} Overall Risk Level: ${threats.riskLevel.toUpperCase()}`)

  // Dust attack specific analysis
  const { dustAttack } = threats

  console.log('\n🕵️  Dust Attack Detection:')
  console.log(`  Status: ${dustAttack.detected ? '🚨 DETECTED' : '✅ Not Detected'}`)
  console.log(`  Suspicious UTXOs: ${dustAttack.suspiciousUtxos.length}`)
  console.log(`  Confidence Level: ${dustAttack.confidence}%`)

  if (dustAttack.detected) {
    console.log('\n⚠️  DUST ATTACK INDICATORS FOUND!')
    console.log('  This wallet may be under surveillance or tracking attempts.')
    console.log('  Recommendation: Avoid spending micro-UTXOs and consider privacy measures.')

    if (dustAttack.suspiciousUtxos.length > 0) {
      console.log('\n🔍 Suspicious UTXO Details:')
      dustAttack.suspiciousUtxos.slice(0, 5).forEach((utxo, index) => {
        const value = utxo.sats || utxo.value || 0
        console.log(`    ${index + 1}. ${value} satoshis (${value / 100} XEC) - ${utxo.blockHeight === -1 ? 'Unconfirmed' : 'Block ' + utxo.blockHeight}`)
      })

      if (dustAttack.suspiciousUtxos.length > 5) {
        console.log(`    ... and ${dustAttack.suspiciousUtxos.length - 5} more`)
      }
    }
  }

  // Display any suspicious patterns
  if (threats.suspiciousPatterns.length > 0) {
    console.log('\n🔍 Suspicious Patterns Detected:')
    threats.suspiciousPatterns.forEach((pattern, index) => {
      console.log(`  ${index + 1}. ${pattern}`)
    })
  }

  // Risk mitigation recommendations
  console.log('\n💡 Security Recommendations:')
  if (dustAttack.detected) {
    console.log('  🔒 Enable privacy features when possible')
    console.log('  🚫 Avoid spending suspicious micro-UTXOs')
    console.log('  🔄 Consider coin mixing or privacy tools')
    console.log('  📱 Use different addresses for different purposes')
    console.log('  ⏰ Wait for confirmations before acting on unconfirmed UTXOs')
  } else {
    console.log('  ✅ No immediate privacy threats detected')
    console.log('  🔍 Continue monitoring for unusual patterns')
    console.log('  💡 Consider periodic UTXO consolidation for efficiency')
  }
}

function analyzeDustPatterns (healthReport) {
  console.log('\n📊 === DUST PATTERN ANALYSIS ===')

  const { summary, alerts } = healthReport

  // Calculate dust metrics
  const dustRatio = summary.total > 0 ? (summary.dust / summary.total) : 0
  const dustValue = summary.uneconomicalValue
  const spendableRatio = summary.spendablePercentage / 100

  console.log('\n📈 Dust Metrics:')
  console.log(`  Dust UTXOs: ${summary.dust} (${(dustRatio * 100).toFixed(1)}% of total)`)
  console.log(`  Dust Value: ${dustValue} satoshis (${dustValue / 100} XEC)`)
  console.log(`  Spendable Ratio: ${(spendableRatio * 100).toFixed(1)}%`)
  console.log(`  Suspicious UTXOs: ${summary.suspicious}`)
  console.log(`  Unconfirmed UTXOs: ${summary.unconfirmed}`)

  // Dust attack risk assessment
  console.log('\n🎯 Risk Assessment:')

  if (dustRatio > 0.7) {
    console.log('  🚨 CRITICAL: Very high dust ratio suggests coordinated attack')
  } else if (dustRatio > 0.5) {
    console.log('  ⚠️  HIGH: High dust ratio may indicate attack attempt')
  } else if (dustRatio > 0.3) {
    console.log('  🟡 MEDIUM: Elevated dust levels require monitoring')
  } else {
    console.log('  ✅ LOW: Dust levels are within normal range')
  }

  if (spendableRatio < 0.2) {
    console.log('  🚨 CRITICAL: Very low spendable value may indicate wallet compromise')
  } else if (spendableRatio < 0.5) {
    console.log('  ⚠️  WARNING: Low spendable ratio affects wallet utility')
  }

  if (summary.suspicious > 0) {
    console.log(`  🔍 SUSPICIOUS: ${summary.suspicious} UTXOs show attack patterns`)
  }

  // Check for specific alert patterns
  const dustAlerts = alerts.filter(alert =>
    alert.type === 'wallet_fragmentation' ||
    alert.type === 'potential_attack'
  )

  if (dustAlerts.length > 0) {
    console.log('\n🚨 Active Dust-Related Alerts:')
    dustAlerts.forEach((alert, index) => {
      console.log(`  ${index + 1}. ${alert.message}`)
      if (alert.recommendations) {
        alert.recommendations.forEach(rec => {
          console.log(`     💡 ${rec}`)
        })
      }
    })
  }
}

// Demonstrate different dust attack scenarios
async function demonstrateDustAttackScenarios () {
  console.log('🧪 === Dust Attack Scenario Simulations ===\n')

  const UtxoHealthMonitor = require('../../lib/utxo-analytics/UtxoHealthMonitor')

  const healthMonitor = new UtxoHealthMonitor({
    debug: true,
    suspiciousPatterns: {
      dustAttackSize: 5,
      rapidDeposits: 3,
      timeWindow: 3600000
    }
  })

  // Scenario 1: Legitimate wallet with normal UTXOs
  console.log('📋 === SCENARIO 1: Normal Wallet ===')
  const normalUtxos = createNormalWalletUtxos()
  const normalAnalysis = healthMonitor.detectDustAttack(normalUtxos, 'ecash:qp1234normal')

  console.log(`Risk Level: ${normalAnalysis.severity}`)
  console.log(`Detected: ${normalAnalysis.detectedAt ? 'No' : 'Yes'}`)
  console.log(`Indicators: ${normalAnalysis.indicators.join(', ') || 'None'}`)
  console.log(`Recommendations: ${normalAnalysis.recommendations.join(', ') || 'None'}`)

  // Scenario 2: Wallet under dust attack
  console.log('\n📋 === SCENARIO 2: Dust Attack Victim ===')
  const attackedUtxos = createDustAttackUtxos()
  const attackAnalysis = healthMonitor.detectDustAttack(attackedUtxos, 'ecash:qp1234attacked')

  console.log(`Risk Level: ${attackAnalysis.severity}`)
  console.log(`Detected: ${attackAnalysis.severity !== 'none' ? 'YES' : 'No'}`)
  console.log(`Indicators: ${attackAnalysis.indicators.join(', ')}`)
  console.log(`Suspicious UTXOs: ${attackAnalysis.utxos.length}`)
  console.log('Recommendations:')
  attackAnalysis.recommendations.forEach(rec => {
    console.log(`  - ${rec}`)
  })

  // Scenario 3: Sophisticated attack with round numbers
  console.log('\n📋 === SCENARIO 3: Sophisticated Round-Number Attack ===')
  const sophisticatedUtxos = createSophisticatedAttackUtxos()
  const sophisticatedAnalysis = healthMonitor.detectDustAttack(sophisticatedUtxos, 'ecash:qp1234sophisticated')

  console.log(`Risk Level: ${sophisticatedAnalysis.severity}`)
  console.log(`Detected: ${sophisticatedAnalysis.severity !== 'none' ? 'YES' : 'No'}`)
  console.log(`Indicators: ${sophisticatedAnalysis.indicators.join(', ')}`)
  console.log(`Suspicious UTXOs: ${sophisticatedAnalysis.utxos.length}`)

  // Scenario 4: Mixed wallet (legitimate + attack)
  console.log('\n📋 === SCENARIO 4: Mixed Wallet (Legitimate + Attack) ===')
  const mixedUtxos = [...normalUtxos.slice(0, 3), ...attackedUtxos.slice(0, 8)]
  const mixedAnalysis = healthMonitor.detectDustAttack(mixedUtxos, 'ecash:qp1234mixed')

  console.log(`Risk Level: ${mixedAnalysis.severity}`)
  console.log(`Detected: ${mixedAnalysis.severity !== 'none' ? 'YES' : 'No'}`)
  console.log(`Indicators: ${mixedAnalysis.indicators.join(', ')}`)
  console.log(`Total UTXOs: ${mixedUtxos.length}, Suspicious: ${mixedAnalysis.utxos.length}`)

  // Demonstrate comprehensive health monitoring
  console.log('\n🏥 === COMPREHENSIVE HEALTH ANALYSIS ===')

  for (const [name, utxos] of [
    ['Normal Wallet', normalUtxos],
    ['Dust Attack Victim', attackedUtxos],
    ['Sophisticated Attack', sophisticatedUtxos],
    ['Mixed Wallet', mixedUtxos]
  ]) {
    console.log(`\n📊 ${name}:`)
    try {
      const healthReport = healthMonitor.monitorUtxoSet(utxos, null, 1.0)

      const dustRatio = healthReport.summary.dust / healthReport.summary.total
      const healthScore = healthReport.summary.healthPercentage

      console.log(`  Health Score: ${healthScore.toFixed(1)}%`)
      console.log(`  Dust Ratio: ${(dustRatio * 100).toFixed(1)}%`)
      console.log(`  Alerts: ${healthReport.alerts.length}`)
      console.log(`  Risk Level: ${healthScore > 80 ? 'Low' : healthScore > 60 ? 'Medium' : 'High'}`)
    } catch (err) {
      console.log(`  Error: ${err.message}`)
    }
  }

  // Defense strategies
  console.log('\n🛡️  === DEFENSE STRATEGIES ===')
  console.log('\n1. 🔍 Detection:')
  console.log('   - Monitor for multiple small, unconfirmed transactions')
  console.log('   - Check for round number amounts (10, 100, 1000 XEC)')
  console.log('   - Identify rapid sequences of micro-payments')
  console.log('   - Watch for identical amounts from different sources')

  console.log('\n2. 🚫 Prevention:')
  console.log('   - Use new addresses for each transaction')
  console.log('   - Avoid address reuse')
  console.log('   - Consider using privacy-focused wallets')
  console.log('   - Implement address rotation strategies')

  console.log('\n3. 🔧 Mitigation:')
  console.log('   - Do not spend suspicious micro-UTXOs')
  console.log('   - Use coin mixing services when available')
  console.log('   - Consolidate legitimate UTXOs separately')
  console.log('   - Wait for confirmations before reacting')

  console.log('\n4. 📊 Monitoring:')
  console.log('   - Regular wallet health checks')
  console.log('   - Track UTXO patterns over time')
  console.log('   - Set up alerts for suspicious activity')
  console.log('   - Maintain privacy-focused practices')
}

// Helper functions to create test scenarios

function createNormalWalletUtxos () {
  return [
    {
      outpoint: { txid: 'normal1'.padEnd(64, '0'), outIdx: 0 },
      blockHeight: 800000,
      sats: 500000, // 5000 XEC
      script: '76a914' + '1'.repeat(40) + '88ac'
    },
    {
      outpoint: { txid: 'normal2'.padEnd(64, '0'), outIdx: 0 },
      blockHeight: 799995,
      sats: 150000, // 1500 XEC
      script: '76a914' + '2'.repeat(40) + '88ac'
    },
    {
      outpoint: { txid: 'normal3'.padEnd(64, '0'), outIdx: 0 },
      blockHeight: 799990,
      sats: 75000, // 750 XEC
      script: '76a914' + '3'.repeat(40) + '88ac'
    },
    {
      outpoint: { txid: 'normal4'.padEnd(64, '0'), outIdx: 0 },
      blockHeight: 799985,
      sats: 25000, // 250 XEC
      script: '76a914' + '4'.repeat(40) + '88ac'
    }
  ]
}

function createDustAttackUtxos () {
  const attackUtxos = []

  // Create multiple micro-UTXOs (dust attack signature)
  for (let i = 0; i < 12; i++) {
    attackUtxos.push({
      outpoint: { txid: `attack${i}`.padEnd(64, '0'), outIdx: 0 },
      blockHeight: -1, // Unconfirmed
      sats: 1000 + (i * 50), // 10-15.5 XEC (just above dust limit)
      script: '76a914' + i.toString().padStart(40, '0') + '88ac'
    })
  }

  return attackUtxos
}

function createSophisticatedAttackUtxos () {
  const attackUtxos = []

  // Round number amounts (common in sophisticated attacks)
  const roundAmounts = [1000, 1000, 2000, 2000, 5000, 5000, 10000, 10000] // 10, 20, 50, 100 XEC

  roundAmounts.forEach((amount, i) => {
    attackUtxos.push({
      outpoint: { txid: `round${i}`.padEnd(64, '0'), outIdx: 0 },
      blockHeight: -1, // Unconfirmed
      sats: amount,
      script: '76a914' + i.toString().padStart(40, '0') + '88ac'
    })
  })

  return attackUtxos
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
  demonstrateDustAttackDetection,
  demonstrateDustAttackScenarios,
  displayDustAttackAnalysis,
  analyzeDustPatterns,
  createNormalWalletUtxos,
  createDustAttackUtxos,
  createSophisticatedAttackUtxos
}

// Run demo if called directly
if (require.main === module) {
  demonstrateDustAttackDetection()
    .catch(console.error)
}
