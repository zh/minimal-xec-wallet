/*
  Get the transaction history of your wallet.
  This example shows how to view all transactions associated with your wallet address.
*/

const MinimalXECWallet = require('../../index')
const { Address } = require('ecash-lib')
const WalletHelper = require('../utils/wallet-helper')

async function getTransactions () {
  try {
    console.log('📜 Getting wallet transaction history...\n')

    // Load wallet from file
    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      console.log('   Run: node examples/wallet-creation/create-new-wallet.js')
      return
    }

    // Create wallet instance from saved data
    const wallet = new MinimalXECWallet(walletData.mnemonic || walletData.privateKey)
    await wallet.walletInfoPromise

    console.log('🔗 Fetching transaction history from blockchain...')

    // Get transaction history (default: descending order - newest first)
    const transactions = await wallet.getTransactions()

    console.log('\n📋 Transaction History:')
    console.log('═'.repeat(80))
    console.log(`XEC Address: ${walletData.xecAddress}`)
    console.log(`Total Transactions: ${transactions.length}`)
    console.log('═'.repeat(80))

    if (transactions.length === 0) {
      console.log('\n📭 No transactions found!')
      console.log('   Your wallet address has no transaction history.')
      console.log('   This means:')
      console.log('   • This is a new wallet that has never been used')
      console.log('   • The address has never received or sent any XEC')
      console.log('')
      console.log('   To get started:')
      console.log('   • Send some XEC to your address:', walletData.xecAddress)
      console.log('   • Use a faucet (for testnet)')
      console.log('   • Receive XEC from another wallet')
      return
    }

    // Our P2PKH output script, to spot our inputs/outputs in each tx
    const myScript = Address.fromCashAddress(walletData.xecAddress).toScriptHex()

    // Analyze transactions
    let receivedCount = 0
    let sentCount = 0
    let totalReceived = 0
    let totalSent = 0

    console.log('\n📊 Transaction List (most recent first):')
    console.log('─'.repeat(80))

    // Totals cover every transaction; only the 10 most recent are printed
    transactions.forEach((tx, index) => {
      const log = index < 10 ? console.log : () => {}
      const txidShort = `${tx.txid.substring(0, 12)}...${tx.txid.substring(52)}`
      const isConfirmed = tx.block !== null
      const status = isConfirmed ? '✅ Confirmed' : '⏳ Pending'

      log(`${index + 1}. ${txidShort} - ${status}`)

      if (isConfirmed) {
        const date = new Date(tx.block.timestamp * 1000).toLocaleString()
        log(`   Block: ${tx.block.height} | Time: ${date}`)
      } else {
        log('   Block: Unconfirmed | Time: Pending')
      }

      // Analyze inputs and outputs to determine if this was received or sent
      let isReceived = false
      let isSent = false
      let netAmount = 0

      // Check outputs for our address
      tx.outputs.forEach(output => {
        if (output.outputScript === myScript) {
          isReceived = true
          netAmount += Number(output.sats)
        }
      })

      // Check inputs for our address (indicates we sent this transaction)
      tx.inputs.forEach(input => {
        if (input.outputScript === myScript) {
          isSent = true
          netAmount -= Number(input.sats)
        }
      })

      if (isReceived && !isSent) {
        log(`   📥 Received: ${(netAmount / 100).toLocaleString()} XEC`)
        receivedCount++
        totalReceived += netAmount
      } else if (isSent && !isReceived) {
        log(`   📤 Sent: ${(Math.abs(netAmount) / 100).toLocaleString()} XEC`)
        sentCount++
        totalSent += Math.abs(netAmount)
      } else if (isSent && isReceived) {
        if (netAmount > 0) totalReceived += netAmount
        else totalSent += Math.abs(netAmount)
        const action = netAmount > 0 ? 'Net Received' : 'Net Sent'
        log(`   🔄 ${action}: ${(Math.abs(netAmount) / 100).toLocaleString()} XEC`)
      }

      log(`   Inputs: ${tx.inputs.length} | Outputs: ${tx.outputs.length}`)
      log()
    })

    if (transactions.length > 10) {
      console.log(`... and ${transactions.length - 10} more transactions`)
      console.log('💡 Use transaction explorer for full history')
    }

    // Transaction summary
    console.log('\n📈 Transaction Summary:')
    console.log('─'.repeat(80))
    console.log(`Total Transactions: ${transactions.length}`)
    console.log(`Received Transactions: ${receivedCount}`)
    console.log(`Sent Transactions: ${sentCount}`)
    console.log(`Total Received: ${(totalReceived / 100).toLocaleString()} XEC`)
    console.log(`Total Sent: ${(totalSent / 100).toLocaleString()} XEC`)
    console.log(`Net Balance: ${((totalReceived - totalSent) / 100).toLocaleString()} XEC`)

    // Show pending transactions warning
    const pendingTxs = transactions.filter(tx => tx.block === null)
    if (pendingTxs.length > 0) {
      console.log('\n⚠️  Pending Transactions:')
      console.log(`   You have ${pendingTxs.length} unconfirmed transaction(s)`)
      console.log('   These transactions are waiting to be included in a block')
      console.log('   Confirmation usually takes 1-10 minutes')
    }

    // Explorer links
    console.log('\n🔗 Explore More:')
    console.log(`   Address Explorer: https://explorer.e.cash/address/${walletData.xecAddress}`)
    if (transactions.length > 0) {
      console.log(`   Latest TX: https://explorer.e.cash/tx/${transactions[0].txid}`)
    }
  } catch (err) {
    console.error('❌ Failed to get transactions:', err.message)

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
getTransactions()
