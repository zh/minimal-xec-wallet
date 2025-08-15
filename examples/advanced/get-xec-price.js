/*
  Get the current XEC to USD exchange rate.
  This example shows how to fetch pricing information for XEC.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

async function getXecPrice () {
  try {
    console.log('💱 Getting XEC price information...\n')

    // Load wallet from file (optional - just for consistency)
    const walletData = WalletHelper.loadWallet()

    // Create wallet instance (we don't need wallet data for price queries)
    const wallet = new MinimalXECWallet()
    await wallet.walletInfoPromise

    console.log('🔍 Fetching XEC price from exchange APIs...')

    try {
      // Get XEC/USD price
      const xecUsdPrice = await wallet.getXecUsd()

      console.log('\n💰 XEC Price Information:')
      console.log('═'.repeat(50))
      console.log(`XEC/USD: $${xecUsdPrice.toFixed(8)}`)
      console.log(`1 USD: ${(1 / xecUsdPrice).toLocaleString()} XEC`)
      console.log('═'.repeat(50))

      // Calculate various amounts in USD
      const commonAmounts = [100, 1000, 10000, 100000, 1000000]

      console.log('\n📊 XEC to USD Conversion Table:')
      console.log('─'.repeat(50))
      console.log('XEC Amount          USD Value')
      console.log('─'.repeat(50))

      commonAmounts.forEach(xecAmount => {
        const usdValue = xecAmount * xecUsdPrice
        const xecFormatted = xecAmount.toLocaleString().padEnd(15)
        const usdFormatted = `$${usdValue.toFixed(6)}`
        console.log(`${xecFormatted}   ${usdFormatted}`)
      })

      // Show wallet value if wallet exists
      if (walletData) {
        console.log('\n🏦 Your Wallet Value:')
        console.log('─'.repeat(50))

        try {
          const walletForPrice = new MinimalXECWallet(walletData.mnemonic || walletData.privateKey)
          await walletForPrice.walletInfoPromise

          const balance = await walletForPrice.getXecBalance()
          const walletUsdValue = balance * xecUsdPrice

          console.log(`XEC Balance: ${balance.toLocaleString()} XEC`)
          console.log(`USD Value: $${walletUsdValue.toFixed(6)} USD`)

          if (walletUsdValue > 0) {
            console.log('\n💡 Value Breakdown:')
            console.log(`• Your ${balance.toLocaleString()} XEC is worth $${walletUsdValue.toFixed(6)}`)
            console.log(`• At current rate of $${xecUsdPrice.toFixed(8)} per XEC`)
          }
        } catch (err) {
          console.log('(Unable to fetch wallet balance for price calculation)')
        }
      }

      // Market insights
      console.log('\n📈 Market Insights:')
      console.log('─'.repeat(50))

      // Calculate market cap implications (approximate)
      const totalSupply = 21000000000000 // 21 trillion XEC (approximate)
      const marketCap = totalSupply * xecUsdPrice

      console.log(`Estimated Market Cap: $${(marketCap / 1000000).toFixed(2)}M USD`)
      console.log(`Price per Million XEC: $${(xecUsdPrice * 1000000).toFixed(2)}`)
      console.log(`Price per Billion XEC: $${(xecUsdPrice * 1000000000).toFixed(2)}`)

      // Historical context note
      console.log('\n📝 Price Notes:')
      console.log('• XEC prices are highly volatile')
      console.log('• This is real-time data from available APIs')
      console.log('• Prices may vary between exchanges')
      console.log('• Use for informational purposes only')
      console.log('• Not financial advice')

      // Exchange information
      console.log('\n🏪 Where to Trade XEC:')
      console.log('• Binance (XEC/USDT, XEC/BTC)')
      console.log('• KuCoin (XEC/USDT)')
      console.log('• Gate.io (XEC/USDT)')
      console.log('• OKX (XEC/USDT)')
      console.log('• Bitfinex (XEC/USD)')
      console.log('• Check CoinGecko/CoinMarketCap for full list')
    } catch (priceErr) {
      console.log('\n❌ Price API Error:', priceErr.message)
      console.log('\n💡 Price API Issues:')
      console.log('   • Price APIs may be temporarily unavailable')
      console.log('   • Network connectivity issues')
      console.log('   • API rate limiting')
      console.log('')
      console.log('   Alternative price sources:')
      console.log('   • CoinGecko: https://coingecko.com/en/coins/ecash')
      console.log('   • CoinMarketCap: https://coinmarketcap.com/currencies/ecash/')
      console.log('   • Exchange websites directly')
    }

    // Additional resources
    console.log('\n🔗 Useful Resources:')
    console.log('• eCash Website: https://e.cash')
    console.log('• Price Charts: https://coinmarketcap.com/currencies/ecash/')
    console.log('• Market Data: https://coingecko.com/en/coins/ecash')
    console.log('• Exchange List: https://coinmarketcap.com/currencies/ecash/markets/')

    console.log('\n📱 Mobile Apps:')
    console.log('• CoinMarketCap app')
    console.log('• CoinGecko app')
    console.log('• Exchange apps (Binance, KuCoin, etc.)')
  } catch (err) {
    console.error('❌ Failed to get XEC price:', err.message)

    // Provide helpful error context
    if (err.message.includes('network') || err.message.includes('connection')) {
      console.log('\n🌐 Network Error:')
      console.log('   • Check your internet connection')
      console.log('   • Price APIs might be temporarily unavailable')
      console.log('   • Try again in a few moments')
      console.log('')
      console.log('   Manual price check:')
      console.log('   • Visit https://coinmarketcap.com/currencies/ecash/')
      console.log('   • Or https://coingecko.com/en/coins/ecash')
    } else if (err.message.includes('api') || err.message.includes('rate')) {
      console.log('\n🚫 API Error:')
      console.log('   • Price API might be rate-limited')
      console.log('   • API service might be down')
      console.log('   • Try alternative price sources')
    }

    process.exit(1)
  }
}

// Run the example
getXecPrice()
