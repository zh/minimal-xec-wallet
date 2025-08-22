/*
  Advanced Coin Selection Demo

  This example demonstrates the smart UTXO selection strategies
  that use classification data to optimize transaction building.
*/

const MinimalXECWallet = require('../../index')

async function demonstrateAdvancedCoinSelection () {
  try {
    console.log('\n=== Advanced Coin Selection Demo ===\n')

    // Create wallet with analytics enabled
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

    const walletOptions = {
      utxoAnalytics: {
        enabled: true,
        debug: false, // Disable debug for cleaner output
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
        }
      }
    }

    const wallet = new MinimalXECWallet(mnemonic, walletOptions)
    await wallet.walletInfoPromise

    console.log('📧 Wallet Address:', wallet.walletInfo.xecAddress)
    console.log('🎯 Smart Selection Enabled:', wallet.utxos.hasAnalytics())

    // Initialize wallet
    console.log('\n🔄 Initializing wallet...')
    await wallet.initialize()

    const utxos = await wallet.getUtxos()
    console.log(`📦 Found ${utxos.utxos.length} UTXOs`)

    if (utxos.utxos.length === 0) {
      console.log('💡 Note: This demo wallet has no UTXOs.')
      console.log('🧪 Running coin selection with mock data instead...\n')
      return demonstrateWithMockData()
    }

    // Demonstrate different selection strategies
    const targetAmount = 50000 // 500 XEC
    const feeRate = 1.0 // 1 sat/byte

    console.log(`\n🎯 Target Amount: ${targetAmount} satoshis (${targetAmount / 100} XEC)`)
    console.log(`⚡ Fee Rate: ${feeRate} sat/byte\n`)

    // Strategy 1: Efficient (default)
    console.log('📊 === EFFICIENT STRATEGY ===')
    console.log('Goal: Minimize transaction fees and UTXO count')
    try {
      const efficientSelection = wallet.utxos.selectOptimalUtxos(targetAmount, {
        strategy: 'efficient',
        feeRate
      })
      displaySelectionResult('Efficient', efficientSelection)
    } catch (err) {
      console.log(`❌ Efficient selection failed: ${err.message}`)
    }

    // Strategy 2: Privacy-focused
    console.log('\n🔒 === PRIVACY STRATEGY ===')
    console.log('Goal: Maximize transaction privacy and avoid fingerprinting')
    try {
      const privacySelection = wallet.utxos.selectOptimalUtxos(targetAmount, {
        strategy: 'privacy',
        feeRate
      })
      displaySelectionResult('Privacy', privacySelection)
    } catch (err) {
      console.log(`❌ Privacy selection failed: ${err.message}`)
    }

    // Strategy 3: Balanced
    console.log('\n⚖️  === BALANCED STRATEGY ===')
    console.log('Goal: Balance efficiency, privacy, and health considerations')
    try {
      const balancedSelection = wallet.utxos.selectOptimalUtxos(targetAmount, {
        strategy: 'balanced',
        feeRate
      })
      displaySelectionResult('Balanced', balancedSelection)
    } catch (err) {
      console.log(`❌ Balanced selection failed: ${err.message}`)
    }

    // Strategy 4: Conservative
    console.log('\n🛡️  === CONSERVATIVE STRATEGY ===')
    console.log('Goal: Prefer confirmed, older UTXOs for maximum reliability')
    try {
      const conservativeSelection = wallet.utxos.selectOptimalUtxos(targetAmount, {
        strategy: 'conservative',
        feeRate
      })
      displaySelectionResult('Conservative', conservativeSelection)
    } catch (err) {
      console.log(`❌ Conservative selection failed: ${err.message}`)
    }

    // Demonstrate filtering with classification criteria
    console.log('\n🎯 === FILTERED SELECTION ===')
    console.log('Using only high-quality UTXOs for selection')
    try {
      const filteredSelection = wallet.utxos.selectOptimalUtxos(targetAmount, {
        strategy: 'efficient',
        useClassifications: true,
        classificationFilter: {
          minHealthScore: 70,
          minPrivacyScore: 60,
          allowedAges: ['mature', 'aged', 'ancient']
        },
        feeRate
      })
      displaySelectionResult('Filtered (High Quality)', filteredSelection)
    } catch (err) {
      console.log(`❌ Filtered selection failed: ${err.message}`)
    }

    console.log('\n✨ Advanced coin selection demo completed!')
  } catch (err) {
    console.error('❌ Error in coin selection demo:', err.message)
  }
}

function displaySelectionResult (strategyName, result) {
  console.log(`\n📊 ${strategyName} Selection Result:`)
  console.log(`  Selected UTXOs: ${result.utxos.length}`)
  console.log(`  Total Input: ${result.totalValue} satoshis (${result.totalValue / 100} XEC)`)
  console.log(`  Estimated Fee: ${result.estimatedFee} satoshis (${result.estimatedFee / 100} XEC)`)
  console.log(`  Change: ${result.change} satoshis (${result.change / 100} XEC)`)
  console.log(`  Transaction Size: ${result.txSize} bytes`)
  console.log(`  Fee Rate: ${(result.estimatedFee / result.txSize).toFixed(2)} sat/byte`)

  // Calculate efficiency metrics
  const totalCost = result.estimatedFee
  const efficiency = ((result.totalValue - totalCost) / result.totalValue * 100)
  console.log(`  Efficiency: ${efficiency.toFixed(2)}% (value preserved after fees)`)

  if (result.change > 0) {
    console.log('  💡 Note: Change output will be created')
  }

  if (result.utxos.length <= 2) {
    console.log('  ✅ Excellent: Low input count minimizes fees')
  } else if (result.utxos.length <= 5) {
    console.log('  ✅ Good: Reasonable input count')
  } else {
    console.log('  ⚠️  High input count may increase fees')
  }
}

// Demo with mock data to show all strategies
async function demonstrateWithMockData () {
  console.log('🧪 === Mock Data Coin Selection Demo ===\n')

  // Create wallet with mock UTXOs
  const wallet = await createMockWallet()

  // Test different target amounts
  const testAmounts = [
    { amount: 5000, description: '50 XEC (small payment)' },
    { amount: 50000, description: '500 XEC (medium payment)' },
    { amount: 200000, description: '2000 XEC (large payment)' }
  ]

  const strategies = ['efficient', 'privacy', 'balanced', 'conservative']
  const feeRate = 1.0

  for (const testCase of testAmounts) {
    console.log(`\n💰 === Testing with ${testCase.description} ===`)

    for (const strategy of strategies) {
      try {
        const selection = wallet.utxos.selectOptimalUtxos(testCase.amount, {
          strategy,
          feeRate,
          useClassifications: true
        })

        console.log(`\n${getStrategyEmoji(strategy)} ${strategy.toUpperCase()}:`)
        console.log(`  UTXOs: ${selection.utxos.length}, Fee: ${selection.estimatedFee} sats, Change: ${selection.change} sats`)

        // Show which UTXOs were selected
        const selectedIds = selection.utxos.map(utxo =>
          `${utxo.outpoint.txid.substring(0, 8)}:${utxo.outpoint.outIdx}`
        )
        console.log(`  Selected: ${selectedIds.join(', ')}`)
      } catch (err) {
        console.log(`  ❌ ${strategy}: ${err.message}`)
      }
    }
  }

  // Demonstrate advanced filtering scenarios
  console.log('\n🎯 === Advanced Filtering Scenarios ===')

  // Scenario 1: Only use confirmed UTXOs
  console.log('\n📋 Scenario 1: Confirmed UTXOs only')
  try {
    const confirmedOnly = wallet.utxos.getSpendableXecUtxos({
      includeUnconfirmed: false,
      useClassifications: true
    })
    console.log(`  Available confirmed UTXOs: ${confirmedOnly.utxos.length}`)
  } catch (err) {
    console.log(`  ❌ ${err.message}`)
  }

  // Scenario 2: High privacy UTXOs only
  console.log('\n🔒 Scenario 2: High privacy UTXOs only')
  try {
    const highPrivacy = wallet.utxos.getSpendableXecUtxos({
      useClassifications: true,
      classificationFilter: {
        strategy: 'privacy',
        minPrivacyScore: 80
      }
    })
    console.log(`  High privacy UTXOs: ${highPrivacy.utxos.length}`)
  } catch (err) {
    console.log(`  ❌ ${err.message}`)
  }

  // Scenario 3: Exclude dust and micro UTXOs
  console.log('\n💎 Scenario 3: Large UTXOs only')
  try {
    const largeOnly = wallet.utxos.getSpendableXecUtxos({
      useClassifications: true,
      classificationFilter: {
        allowedValues: ['medium', 'large', 'whale']
      }
    })
    console.log(`  Large UTXOs available: ${largeOnly.utxos.length}`)
  } catch (err) {
    console.log(`  ❌ ${err.message}`)
  }
}

// Create a mock wallet with diverse UTXOs for testing
async function createMockWallet () {
  const UtxoClassifier = require('../../lib/utxo-analytics/UtxoClassifier')

  // Create mock UTXOs with different characteristics
  const mockUtxos = [
    // Large, mature UTXO (whale)
    {
      outpoint: { txid: '1'.repeat(64), outIdx: 0 },
      blockHeight: 795000, // Old (aged)
      sats: 10000000, // 100,000 XEC
      script: '76a914' + '0'.repeat(40) + '88ac'
    },
    // Medium, recent UTXO
    {
      outpoint: { txid: '2'.repeat(64), outIdx: 0 },
      blockHeight: 799900, // Recent
      sats: 200000, // 2,000 XEC
      script: '76a914' + '1'.repeat(40) + '88ac'
    },
    // Small, fresh UTXO
    {
      outpoint: { txid: '3'.repeat(64), outIdx: 0 },
      blockHeight: 799995, // Fresh
      sats: 25000, // 250 XEC
      script: '76a914' + '2'.repeat(40) + '88ac'
    },
    // Multiple small UTXOs
    {
      outpoint: { txid: '4'.repeat(64), outIdx: 0 },
      blockHeight: 799800,
      sats: 15000, // 150 XEC
      script: '76a914' + '3'.repeat(40) + '88ac'
    },
    {
      outpoint: { txid: '5'.repeat(64), outIdx: 0 },
      blockHeight: 799850,
      sats: 12000, // 120 XEC
      script: '76a914' + '4'.repeat(40) + '88ac'
    },
    {
      outpoint: { txid: '6'.repeat(64), outIdx: 0 },
      blockHeight: 799900,
      sats: 8000, // 80 XEC
      script: '76a914' + '5'.repeat(40) + '88ac'
    },
    // Micro UTXOs (might be dust attack)
    {
      outpoint: { txid: '7'.repeat(64), outIdx: 0 },
      blockHeight: -1, // Unconfirmed
      sats: 2000, // 20 XEC
      script: '76a914' + '6'.repeat(40) + '88ac'
    },
    {
      outpoint: { txid: '8'.repeat(64), outIdx: 0 },
      blockHeight: -1, // Unconfirmed
      sats: 1500, // 15 XEC
      script: '76a914' + '7'.repeat(40) + '88ac'
    },
    // Dust UTXO
    {
      outpoint: { txid: '9'.repeat(64), outIdx: 0 },
      blockHeight: 799990,
      sats: 800, // 8 XEC (dust)
      script: '76a914' + '8'.repeat(40) + '88ac'
    },
    // Token UTXO
    {
      outpoint: { txid: 'a'.repeat(64), outIdx: 0 },
      blockHeight: 799950,
      sats: 10000, // 100 XEC
      script: '76a914' + '9'.repeat(40) + '88ac',
      token: { tokenId: 'token123', amount: '1000' }
    }
  ]

  // Create classifier and classify UTXOs
  const classifier = new UtxoClassifier()
  const classifications = classifier.classifyUtxos(mockUtxos, 800000)

  // Create mock wallet object with UTXO management
  const mockWallet = {
    utxos: {
      utxoStore: { xecUtxos: mockUtxos },
      analyticsEnabled: true,
      classifications: classifications,
      classifier: classifier,

      // Mock the selection methods
      selectOptimalUtxos (targetAmount, options = {}) {
        const { strategy = 'efficient', feeRate = 1.0, useClassifications = true } = options

        // Simple selection logic for demo
        let sortedUtxos
        if (useClassifications && this.classifications.size > 0) {
          sortedUtxos = this.sortUtxosByStrategy(mockUtxos, strategy)
        } else {
          sortedUtxos = [...mockUtxos].sort((a, b) => b.sats - a.sats)
        }

        return this.selectFromSorted(sortedUtxos, targetAmount, feeRate)
      },

      getSpendableXecUtxos (options = {}) {
        const { includeUnconfirmed = false, useClassifications = false, classificationFilter = {} } = options

        let filtered = mockUtxos.filter(utxo => {
          if (!includeUnconfirmed && utxo.blockHeight === -1) return false
          if (utxo.sats < 1000) return false // Basic dust filter
          return true
        })

        if (useClassifications && classificationFilter) {
          filtered = filtered.filter(utxo => {
            const utxoId = `${utxo.outpoint.txid}:${utxo.outpoint.outIdx}`
            const classification = this.classifications.get(utxoId)
            if (!classification) return true

            if (classificationFilter.minPrivacyScore && classification.privacy < classificationFilter.minPrivacyScore) return false
            if (classificationFilter.allowedValues && !classificationFilter.allowedValues.includes(classification.value)) return false
            if (classificationFilter.strategy === 'privacy' && classification.privacy < 80) return false

            return true
          })
        }

        return { utxos: filtered }
      },

      sortUtxosByStrategy (utxos, strategy) {
        return [...utxos].sort((a, b) => {
          const aId = `${a.outpoint.txid}:${a.outpoint.outIdx}`
          const bId = `${b.outpoint.txid}:${b.outpoint.outIdx}`
          const aClassification = this.classifications.get(aId)
          const bClassification = this.classifications.get(bId)

          if (!aClassification || !bClassification) {
            return b.sats - a.sats // Fallback to value sorting
          }

          switch (strategy) {
            case 'privacy':
              return bClassification.privacy - aClassification.privacy
            case 'efficient':
              return bClassification.valueScore - aClassification.valueScore
            case 'balanced': {
              const aScore = (aClassification.healthScore + aClassification.privacy + aClassification.valueScore) / 3
              const bScore = (bClassification.healthScore + bClassification.privacy + bClassification.valueScore) / 3
              return bScore - aScore
            }
            case 'conservative':
              if (aClassification.metadata.isConfirmed !== bClassification.metadata.isConfirmed) {
                return aClassification.metadata.isConfirmed ? -1 : 1
              }
              return bClassification.ageScore - aClassification.ageScore
            default:
              return bClassification.healthScore - aClassification.healthScore
          }
        })
      },

      selectFromSorted (sortedUtxos, targetAmount, feeRate) {
        const selectedUtxos = []
        let totalAmount = 0
        const inputCost = 148

        for (const utxo of sortedUtxos) {
          selectedUtxos.push(utxo)
          totalAmount += utxo.sats

          const estimatedFee = Math.ceil((selectedUtxos.length * inputCost + 34 + 10) * feeRate)

          if (totalAmount >= targetAmount + estimatedFee) {
            const finalFee = Math.ceil((selectedUtxos.length * inputCost + 34 + 10) * feeRate)
            const change = totalAmount - targetAmount - finalFee

            return {
              utxos: selectedUtxos,
              totalValue: totalAmount,
              estimatedFee: finalFee,
              change: Math.max(0, change),
              txSize: selectedUtxos.length * inputCost + 34 + 10
            }
          }
        }

        throw new Error('Insufficient funds')
      }
    }
  }

  return mockWallet
}

function getStrategyEmoji (strategy) {
  switch (strategy) {
    case 'efficient': return '⚡'
    case 'privacy': return '🔒'
    case 'balanced': return '⚖️'
    case 'conservative': return '🛡️'
    default: return '🎯'
  }
}

// Export functions for use in other examples
module.exports = {
  demonstrateAdvancedCoinSelection,
  demonstrateWithMockData,
  createMockWallet,
  displaySelectionResult
}

// Run demo if called directly
if (require.main === module) {
  demonstrateAdvancedCoinSelection()
    .catch(console.error)
}
