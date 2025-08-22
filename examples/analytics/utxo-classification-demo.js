/*
  UTXO Classification Demo

  This example demonstrates how to use the UTXO analytics features
  to classify UTXOs by age, value, and privacy characteristics.
*/

const MinimalXECWallet = require('../../index')

async function demonstrateUtxoClassification () {
  try {
    console.log('\n=== UTXO Classification Demo ===\n')

    // Create wallet with analytics enabled
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

    const walletOptions = {
      utxoAnalytics: {
        enabled: true,
        debug: true, // Enable debug output to see classification in action
        classificationConfig: {
          // Customize age thresholds (in blocks)
          ageThresholds: {
            fresh: 6, // ~1 hour
            recent: 144, // ~1 day
            mature: 1008, // ~1 week
            aged: 4032 // ~1 month
          },
          // Customize value thresholds (in satoshis)
          valueThresholds: {
            dust: 1000, // 10 XEC
            micro: 5000, // 50 XEC
            small: 50000, // 500 XEC
            medium: 500000, // 5000 XEC
            large: 5000000 // 50000 XEC
          }
        }
      }
    }

    const wallet = new MinimalXECWallet(mnemonic, walletOptions)
    await wallet.walletInfoPromise

    console.log('📧 Wallet Address:', wallet.walletInfo.xecAddress)
    console.log('⚙️  Analytics Enabled:', wallet.utxos.hasAnalytics())

    // Initialize wallet and fetch UTXOs
    console.log('\n🔄 Initializing wallet and fetching UTXOs...')
    await wallet.initialize()

    const utxos = await wallet.getUtxos()
    console.log(`📦 Found ${utxos.utxos.length} UTXOs`)

    if (utxos.utxos.length === 0) {
      console.log('💡 Note: This demo wallet has no UTXOs. In a real scenario with UTXOs, you would see detailed classifications.')
      return
    }

    // Get UTXO classifications
    console.log('\n📊 Getting UTXO classifications...')
    const classifications = wallet.utxos.getUtxoClassifications()

    console.log(`✅ Classified ${classifications.size} UTXOs`)

    // Display classification statistics
    console.log('\n📈 Classification Statistics:')
    const stats = wallet.utxos.getClassificationStats()

    console.log('  Age Distribution:')
    Object.entries(stats.byAge).forEach(([age, count]) => {
      if (count > 0) console.log(`    ${age}: ${count} UTXOs`)
    })

    console.log('  Value Distribution:')
    Object.entries(stats.byValue).forEach(([value, count]) => {
      if (count > 0) console.log(`    ${value}: ${count} UTXOs`)
    })

    console.log('  Health Distribution:')
    Object.entries(stats.byHealth).forEach(([health, count]) => {
      if (count > 0) console.log(`    ${health}: ${count} UTXOs`)
    })

    console.log('\n📊 Average Scores:')
    console.log(`  Privacy Score: ${stats.averagePrivacyScore}/100`)
    console.log(`  Health Score: ${stats.averageHealthScore}/100`)
    console.log(`  Age Score: ${stats.averageAgeScore}/100`)
    console.log(`  Value Score: ${stats.averageValueScore}/100`)

    console.log('\n💰 Value Summary:')
    console.log(`  Total Value: ${stats.totalValue} satoshis`)
    console.log(`  Spendable Value: ${stats.spendableValue} satoshis`)
    console.log(`  Token UTXOs: ${stats.tokenUtxos}`)

    // Demonstrate individual UTXO classification details
    if (classifications.size > 0) {
      console.log('\n🔍 Individual UTXO Classifications:')

      let count = 0
      for (const [utxoId, classification] of classifications) {
        if (count >= 3) break // Show only first 3 for brevity

        console.log(`\n  UTXO: ${utxoId}`)
        console.log(`    Age: ${classification.age} (${classification.ageInBlocks} blocks)`)
        console.log(`    Value: ${classification.value} (${classification.satsValue} satoshis)`)
        console.log(`    Health: ${classification.health} (score: ${classification.healthScore}/100)`)
        console.log(`    Privacy Score: ${classification.privacy}/100`)
        console.log(`    Economical to spend: ${classification.metadata.isEconomical}`)
        console.log(`    Confirmed: ${classification.metadata.isConfirmed}`)
        console.log(`    Has Token: ${classification.metadata.hasToken}`)

        if (classification.privacyFactors.isRoundNumber) {
          console.log('    ⚠️  Privacy concern: Round number amount')
        }

        count++
      }
    }

    // Demonstrate filtering by classification criteria
    console.log('\n🎯 Demonstrating Classification-Based Filtering:')

    try {
      // Get only mature, economical UTXOs
      const matureUtxos = wallet.utxos.getSpendableXecUtxos({
        useClassifications: true,
        classificationFilter: {
          allowedAges: ['mature', 'aged', 'ancient'],
          minHealthScore: 70
        }
      })
      console.log(`  Mature & healthy UTXOs: ${matureUtxos.utxos.length}`)

      // Get high-privacy UTXOs
      const privateUtxos = wallet.utxos.getSpendableXecUtxos({
        useClassifications: true,
        classificationFilter: {
          minPrivacyScore: 80
        }
      })
      console.log(`  High-privacy UTXOs: ${privateUtxos.utxos.length}`)

      // Get dust UTXOs that might need consolidation
      const dustUtxos = wallet.utxos.getSpendableXecUtxos({
        useClassifications: true,
        classificationFilter: {
          allowedValues: ['dust', 'micro']
        }
      })
      console.log(`  Dust/micro UTXOs: ${dustUtxos.utxos.length}`)
    } catch (err) {
      console.log(`  ℹ️  Filtering not available: ${err.message}`)
    }

    console.log('\n✨ Classification demo completed!')
  } catch (err) {
    console.error('❌ Error in classification demo:', err.message)
  }
}

// Helper function to create example UTXOs for testing
function createExampleUtxos () {
  return [
    {
      outpoint: { txid: '1'.repeat(64), outIdx: 0 },
      blockHeight: 800000,
      sats: 1000000, // 10000 XEC - large amount
      script: '76a914' + '0'.repeat(40) + '88ac'
    },
    {
      outpoint: { txid: '2'.repeat(64), outIdx: 0 },
      blockHeight: 799900, // 100 blocks old
      sats: 50000, // 500 XEC - medium amount
      script: '76a914' + '1'.repeat(40) + '88ac'
    },
    {
      outpoint: { txid: '3'.repeat(64), outIdx: 0 },
      blockHeight: -1, // Unconfirmed
      sats: 1000, // 10 XEC - small amount
      script: '76a914' + '2'.repeat(40) + '88ac'
    },
    {
      outpoint: { txid: '4'.repeat(64), outIdx: 0 },
      blockHeight: 795000, // ~5000 blocks old (aged)
      sats: 500, // 5 XEC - dust
      script: '76a914' + '3'.repeat(40) + '88ac'
    }
  ]
}

// Alternative demo with mock data
async function demonstrateWithMockData () {
  console.log('\n=== Mock Data Classification Demo ===\n')

  const UtxoClassifier = require('../../lib/utxo-analytics/UtxoClassifier')

  const classifier = new UtxoClassifier({
    debug: true
  })

  const mockUtxos = createExampleUtxos()
  const currentBlockHeight = 800000

  console.log('🧪 Classifying mock UTXOs...')
  const classifications = classifier.classifyUtxos(mockUtxos, currentBlockHeight)

  console.log(`✅ Successfully classified ${classifications.size} UTXOs`)

  for (const [utxoId, classification] of classifications) {
    console.log(`\n📦 UTXO ${utxoId}:`)
    console.log(`  Age: ${classification.age} (${classification.ageInBlocks} blocks)`)
    console.log(`  Value: ${classification.value} (${classification.satsValue} sats)`)
    console.log(`  Health: ${classification.health} (${classification.healthScore}/100)`)
    console.log(`  Privacy: ${classification.privacy}/100`)
    console.log(`  Economical: ${classification.metadata.isEconomical}`)
  }
}

// Export functions for use in other examples
module.exports = {
  demonstrateUtxoClassification,
  demonstrateWithMockData,
  createExampleUtxos
}

// Run demo if called directly
if (require.main === module) {
  demonstrateUtxoClassification()
    .then(() => demonstrateWithMockData())
    .catch(console.error)
}
