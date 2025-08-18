/*
  Get the UTXOs (Unspent Transaction Outputs) of your wallet.
  This example shows how to view all spendable outputs in your wallet.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

async function getUtxos () {
  try {
    console.log('🔍 Getting wallet UTXOs...\n')

    // Load wallet from file
    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      console.log('   Run: node examples/wallet-creation/create-new-wallet.js')
      return
    }

    // Create wallet instance from saved data
    const wallet = new MinimalXECWallet(walletData.mnemonic || walletData.privateKey)
    await wallet.walletInfoPromise

    console.log('🔗 Fetching UTXOs from blockchain...')

    // Get UTXOs for the wallet
    const utxoData = await wallet.getUtxos()
    const utxos = utxoData.utxos || []

    console.log('\n📦 UTXO Information:')
    console.log('═'.repeat(70))
    console.log(`XEC Address: ${walletData.xecAddress}`)
    console.log(`Total UTXOs: ${utxos.length}`)
    console.log('═'.repeat(70))

    if (utxos.length === 0) {
      console.log('\n💸 No UTXOs found!')
      console.log('   Your wallet has no spendable outputs.')
      console.log('   This means either:')
      console.log('   • Your wallet is empty')
      console.log('   • All funds are in unconfirmed transactions')
      console.log('   • The address has never received any XEC')
      return
    }

    // Group UTXOs by confirmation status
    const confirmedUtxos = utxos.filter(utxo => utxo.blockHeight !== -1)
    const unconfirmedUtxos = utxos.filter(utxo => utxo.blockHeight === -1)

    // Calculate totals - handle sats field properly
    const getUtxoValue = (utxo) => {
      if (utxo.sats !== undefined) {
        return typeof utxo.sats === 'bigint' ? Number(utxo.sats) : parseInt(utxo.sats)
      }
      if (utxo.value !== undefined) {
        return typeof utxo.value === 'bigint' ? Number(utxo.value) : parseInt(utxo.value)
      }
      return 0
    }

    const totalConfirmed = confirmedUtxos.reduce((sum, utxo) => sum + getUtxoValue(utxo), 0)
    const totalUnconfirmed = unconfirmedUtxos.reduce((sum, utxo) => sum + getUtxoValue(utxo), 0)
    const totalValue = totalConfirmed + totalUnconfirmed

    console.log('\n💰 Balance Summary:')
    console.log(`Confirmed: ${(totalConfirmed / 100).toLocaleString()} XEC (${confirmedUtxos.length} UTXOs)`)
    console.log(`Unconfirmed: ${(totalUnconfirmed / 100).toLocaleString()} XEC (${unconfirmedUtxos.length} UTXOs)`)
    console.log(`Total: ${(totalValue / 100).toLocaleString()} XEC`)

    // Show confirmed UTXOs
    if (confirmedUtxos.length > 0) {
      console.log('\n✅ Confirmed UTXOs:')
      console.log('─'.repeat(70))
      confirmedUtxos.forEach((utxo, index) => {
        const satsValue = typeof utxo.sats === 'bigint' ? Number(utxo.sats) : parseInt(utxo.sats)
        const xecValue = (satsValue / 100).toLocaleString()
        const txidShort = `${utxo.outpoint.txid.substring(0, 8)}...${utxo.outpoint.txid.substring(56)}`
        console.log(`${index + 1}. ${xecValue} XEC`)
        console.log(`   TXID: ${txidShort}:${utxo.outpoint.outIdx}`)
        console.log(`   Block: ${utxo.blockHeight}`)
        console.log(`   Coinbase: ${utxo.isCoinbase ? 'Yes' : 'No'}`)
        console.log()
      })
    }

    // Show unconfirmed UTXOs
    if (unconfirmedUtxos.length > 0) {
      console.log('⏳ Unconfirmed UTXOs:')
      console.log('─'.repeat(70))
      unconfirmedUtxos.forEach((utxo, index) => {
        const satsValue = typeof utxo.sats === 'bigint' ? Number(utxo.sats) : parseInt(utxo.sats)
        const xecValue = (satsValue / 100).toLocaleString()
        const txidShort = `${utxo.outpoint.txid.substring(0, 8)}...${utxo.outpoint.txid.substring(56)}`
        console.log(`${index + 1}. ${xecValue} XEC (pending confirmation)`)
        console.log(`   TXID: ${txidShort}:${utxo.outpoint.outIdx}`)
        console.log()
      })
      console.log('📝 Note: Unconfirmed UTXOs cannot be spent until they are confirmed.')
    }

    // UTXO analysis
    console.log('\n📊 UTXO Analysis:')
    console.log('─'.repeat(70))

    if (confirmedUtxos.length > 0) {
      const values = confirmedUtxos.map(utxo => getUtxoValue(utxo) / 100)
      const avgValue = values.reduce((a, b) => a + b, 0) / values.length
      const maxValue = Math.max(...values)
      const minValue = Math.min(...values)

      console.log(`Average UTXO size: ${avgValue.toLocaleString()} XEC`)
      console.log(`Largest UTXO: ${maxValue.toLocaleString()} XEC`)
      console.log(`Smallest UTXO: ${minValue.toLocaleString()} XEC`)

      // Dust analysis (UTXOs < 5.46 XEC are considered dust)
      const dustUtxos = confirmedUtxos.filter(utxo => utxo.value < 546)
      if (dustUtxos.length > 0) {
        console.log(`Dust UTXOs: ${dustUtxos.length} (< 5.46 XEC)`)
        console.log('💡 Consider consolidating dust UTXOs to reduce transaction fees')
      }
    }

    // Suggest optimizations
    if (confirmedUtxos.length > 20) {
      console.log('\n⚡ Optimization Suggestion:')
      console.log(`   You have ${confirmedUtxos.length} UTXOs, which might increase transaction fees.`)
      console.log('   Consider running: node examples/advanced/optimize-utxos.js')
    }
  } catch (err) {
    console.error('❌ Failed to get UTXOs:', err.message)

    // Provide helpful error context
    if (err.message.includes('network') || err.message.includes('connection')) {
      console.log('\n🌐 Network Error:')
      console.log('   • Check your internet connection')
      console.log('   • Chronik indexer might be temporarily unavailable')
      console.log('   • Try again in a few moments')
    }

    process.exit(1)
  }
}

// Run the example
getUtxos()
