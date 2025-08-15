/*
  Get the XEC balance of your wallet.
  This example shows how to check your wallet's balance using the saved wallet.json.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

async function getBalance () {
  try {
    console.log('💰 Getting XEC wallet balance...\n')

    // Load wallet from file
    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      console.log('   Run: node examples/wallet-creation/create-new-wallet.js')
      return
    }

    // Create wallet instance from saved data
    const wallet = new MinimalXECWallet(walletData.mnemonic || walletData.privateKey)
    await wallet.walletInfoPromise

    console.log('🔍 Fetching balance from blockchain...')

    // Get detailed balance for the wallet
    const detailedBalance = await wallet.getDetailedBalance()

    console.log('\n📊 Balance Information:')
    console.log('═'.repeat(50))
    console.log(`XEC Address: ${walletData.xecAddress}`)
    console.log(`Total Balance: ${detailedBalance.total.toLocaleString()} XEC`)
    console.log(`  • Confirmed: ${detailedBalance.confirmed.toLocaleString()} XEC`)
    console.log(`  • Unconfirmed: ${detailedBalance.unconfirmed.toLocaleString()} XEC`)
    console.log(`Total Satoshis: ${detailedBalance.satoshis.total.toLocaleString()}`)

    // Show confirmation status
    if (detailedBalance.unconfirmed > 0) {
      console.log(`⏳ ${detailedBalance.unconfirmed} XEC pending confirmation`)
    }
    if (detailedBalance.confirmed > 0) {
      console.log(`✅ ${detailedBalance.confirmed} XEC confirmed`)
    }
    console.log('═'.repeat(50))

    // Show balance in different formats
    if (detailedBalance.total > 0) {
      console.log('\n💵 Balance Breakdown:')
      console.log(`• ${detailedBalance.total} XEC`)
      console.log(`• ${detailedBalance.satoshis.total} satoshis`)
      console.log(`• ${(detailedBalance.total / 1000000).toFixed(6)} Million XEC`)

      // Approximate USD value (if price available)
      try {
        const xecUsdPrice = await wallet.getXecUsd()
        if (xecUsdPrice > 0) {
          const usdValue = detailedBalance.total * xecUsdPrice
          console.log(`• ~$${usdValue.toFixed(6)} USD (at $${xecUsdPrice.toFixed(8)} per XEC)`)
        }
      } catch (err) {
        console.log('• USD value unavailable (price API error)')
      }
    } else {
      console.log('\n💸 Your wallet is empty!')
      console.log('   To receive XEC, share your address:', walletData.xecAddress)
      console.log('   You can fund your wallet from:')
      console.log('   • A eCash exchange')
      console.log('   • Another XEC wallet')
      console.log('   • eCash faucets (for testnet)')
    }

    // Show additional info for empty wallets
    if (detailedBalance.total === 0) {
      console.log('\n🔗 Useful Links:')
      console.log('   • Block Explorer: https://explorer.e.cash')
      console.log('   • CashTab Wallet: https://cashtab.com')
      console.log('   • eCash.org: https://e.cash')
    }
  } catch (err) {
    console.error('❌ Failed to get balance:', err.message)

    // Provide helpful error context
    if (err.message.includes('network') || err.message.includes('connection')) {
      console.log('\n🌐 Network Error:')
      console.log('   • Check your internet connection')
      console.log('   • Chronik indexer might be temporarily unavailable')
      console.log('   • Try again in a few moments')
    } else if (err.message.includes('address')) {
      console.log('\n📍 Address Error:')
      console.log('   • Your wallet.json might be corrupted')
      console.log('   • Try restoring from mnemonic')
    }

    process.exit(1)
  }
}

// Run the example
getBalance()
