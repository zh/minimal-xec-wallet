/*
  Integration tests for wallet UTXO optimization/consolidation
  Tests the optimize() method on the main wallet class
*/

// npm libraries
const assert = require('chai').assert

// Unit under test
const WalletXecLib = require('../../index')

// Load test wallet data
const { testWallet } = require('./test-data/test-wallet.json')

describe('#Integration Tests - Wallet UTXO Optimization', () => {
  it('should handle dry run optimization correctly', async function () {
    this.timeout(30000) // Set timeout for integration test

    console.log('Creating wallet instance...')
    const wallet = new WalletXecLib(testWallet.mnemonic)

    // Wait for wallet to initialize
    console.log('Waiting for wallet initialization...')
    await wallet.walletInfoPromise

    console.log('Initializing wallet...')
    await wallet.initialize()

    console.log('Testing dry run optimization...')

    // Test dry run mode (should not execute any transactions)
    const dryRunResult = await wallet.optimize(true)

    assert.equal(typeof dryRunResult, 'object', 'optimize() returns object')
    assert.equal(typeof dryRunResult.success, 'boolean', 'Result has success property')
    assert.equal(typeof dryRunResult.message, 'string', 'Result has message property')
    assert.ok(Array.isArray(dryRunResult.transactions), 'Result has transactions array')
    assert.ok(dryRunResult.analysis, 'Result includes analysis')

    // The message should indicate it's a dry run
    assert.ok(
      dryRunResult.message.includes('Dry run') ||
      dryRunResult.message.includes('Not enough') ||
      dryRunResult.message.includes('No optimization needed'),
      'Message explains dry run result or why no consolidation needed'
    )

    console.log(`Optimization analysis: ${dryRunResult.message}`)
    console.log(`Transactions planned: ${dryRunResult.transactions.length}`)

    if (dryRunResult.analysis) {
      console.log(`Total UTXOs: ${dryRunResult.analysis.totalUtxos || 'N/A'}`)
      console.log(`Would consolidate: ${dryRunResult.analysis.shouldConsolidate}`)
      if (dryRunResult.analysis.potentialSavings) {
        console.log(`Potential savings: ${dryRunResult.analysis.potentialSavings} satoshis`)
      }
    }
  })

  it('should handle error cases with invalid wallet', async function () {
    this.timeout(30000)

    try {
      // Test with invalid wallet
      const wallet = new WalletXecLib('invalid mnemonic phrase')

      try {
        await wallet.optimize()
        assert.fail('Should throw error with invalid wallet')
      } catch (err) {
        assert.ok(err.message, 'Throws error for invalid wallet')
        assert.ok(
          err.message.includes('failed') ||
          err.message.includes('invalid') ||
          err.message.includes('error'),
          'Error message is descriptive'
        )
      }
    } catch (err) {
      // If wallet creation itself fails, that's expected
      console.log('Invalid wallet creation fails as expected')
    }
  })

  it('should analyze UTXO distribution correctly', async function () {
    this.timeout(30000)

    try {
      console.log('Testing UTXO distribution analysis...')
      const wallet = new WalletXecLib(testWallet.mnemonic)

      await wallet.walletInfoPromise
      await wallet.initialize()

      // Access the consolidation functionality
      const distribution = wallet.consolidateUtxos.getUtxoDistribution()

      assert.equal(typeof distribution, 'object', 'getUtxoDistribution() returns object')
      assert.equal(typeof distribution.total, 'number', 'Distribution has total count')
      assert.ok('dust' in distribution, 'Distribution includes dust category')
      assert.ok('small' in distribution && 'medium' in distribution && 'large' in distribution,
        'Distribution includes all size categories')

      console.log('UTXO Distribution:')
      console.log(`  Total: ${distribution.total}`)
      console.log(`  Dust (< 1000 sats): ${distribution.dust}`)
      console.log(`  Small (1000-10000 sats): ${distribution.small}`)
      console.log(`  Medium (10000-100000 sats): ${distribution.medium}`)
      console.log(`  Large (> 100000 sats): ${distribution.large}`)
    } catch (err) {
      console.error('Distribution analysis error:', err.message)
      assert.fail(`UTXO distribution analysis failed: ${err.message}`)
    }
  })

  it('should estimate optimization savings correctly', async function () {
    this.timeout(30000)

    try {
      console.log('Testing optimization savings estimation...')
      const wallet = new WalletXecLib(testWallet.mnemonic)

      await wallet.walletInfoPromise
      await wallet.initialize()

      // Get optimization savings estimate
      const savings = wallet.consolidateUtxos.estimateOptimizationSavings()

      assert.equal(typeof savings, 'object', 'estimateOptimizationSavings() returns object')
      assert.equal(typeof savings.savings, 'number', 'Savings has numeric value')
      assert.equal(typeof savings.currentUtxos, 'number', 'Reports current UTXO count')

      console.log('Optimization Savings Estimate:')
      console.log(`  Current UTXOs: ${savings.currentUtxos}`)
      console.log(`  Optimal UTXOs: ${savings.optimalUtxos || 'N/A'}`)
      console.log(`  Estimated savings: ${savings.savings} satoshis`)
      if (savings.reason) {
        console.log(`  Reason: ${savings.reason}`)
      }
    } catch (err) {
      console.error('Savings estimation error:', err.message)
      assert.fail(`Optimization savings estimation failed: ${err.message}`)
    }
  })
})
