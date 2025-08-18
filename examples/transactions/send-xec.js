/*
  Send XEC to another address.
  This example shows how to send a specific amount of XEC to a recipient.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)

function showUsage () {
  console.log('Usage: node send-xec.js <recipient_address> <amount_xec>')
  console.log('')
  console.log('Examples:')
  console.log('  node send-xec.js ecash:qp1234...abc 100')
  console.log('  node send-xec.js ecash:qr5678...def 50.25')
  console.log('')
  console.log('Parameters:')
  console.log('  recipient_address: XEC address starting with ecash:')
  console.log('  amount_xec: Amount in XEC (minimum 5.46 XEC due to dust limit)')
  console.log('')
  console.log('Note: Transaction fee will be automatically calculated and deducted')
}

async function sendXec () {
  try {
    console.log('💸 Sending XEC transaction...\n')

    // Check arguments
    if (args.length !== 2) {
      console.log('❌ Invalid arguments')
      showUsage()
      return
    }

    const recipientAddress = args[0]
    const amountXec = parseFloat(args[1])

    // Validate arguments
    if (!recipientAddress || !recipientAddress.startsWith('ecash:')) {
      console.log('❌ Invalid recipient address. Must start with "ecash:"')
      showUsage()
      return
    }

    if (isNaN(amountXec) || amountXec <= 0) {
      console.log('❌ Invalid amount. Must be a positive number')
      showUsage()
      return
    }

    if (amountXec < 5.46) {
      console.log('❌ Amount too small. Must be at least 5.46 XEC (dust limit)')
      showUsage()
      return
    }

    // Load wallet from file
    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      console.log('   Run: node examples/wallet-creation/create-new-wallet.js')
      return
    }

    // Create wallet instance from saved data
    const wallet = new MinimalXECWallet(walletData.mnemonic || walletData.privateKey)
    await wallet.walletInfoPromise

    // Initialize wallet
    await wallet.initialize()

    console.log('💰 Checking wallet balance...')
    const balance = await wallet.getXecBalance()

    console.log('\n📋 Transaction Details:')
    console.log('═'.repeat(60))
    console.log(`From: ${walletData.xecAddress}`)
    console.log(`To: ${recipientAddress}`)
    console.log(`Amount: ${amountXec.toLocaleString()} XEC`)
    console.log(`Current Balance: ${balance.toLocaleString()} XEC`)
    console.log('═'.repeat(60))

    // Check if we have enough balance (rough estimate)
    if (balance < amountXec + 0.1) { // +0.1 XEC for estimated fee (more buffer for higher amounts)
      console.log('\n❌ Insufficient balance!')
      console.log(`   Required: ~${(amountXec + 0.1).toLocaleString()} XEC (including estimated fee)`)
      console.log(`   Available: ${balance.toLocaleString()} XEC`)
      console.log('   Fund your wallet or try a smaller amount')
      return
    }

    // Confirm transaction
    console.log('\n⚠️  Transaction Confirmation Required')
    console.log('   This will send real XEC from your wallet!')
    console.log('   Make sure the recipient address is correct.')

    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const confirmed = await new Promise((resolve) => {
      rl.question('\nDo you want to proceed? (yes/no): ', (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
      })
    })

    if (!confirmed) {
      console.log('❌ Transaction cancelled by user')
      return
    }

    console.log('\n🚀 Broadcasting transaction...')

    // Prepare the output
    const outputs = [{
      address: recipientAddress,
      amountSat: Math.round(amountXec * 100) // Convert XEC to satoshis (1 XEC = 100 satoshis for eCash)
    }]

    // Debug UTXO structure before sending
    const utxos = wallet.utxos.utxoStore.xecUtxos
    // Safe JSON stringify to handle BigInt values
    const safeStringify = (obj) => {
      return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2)
    }
    console.log('🔍 Debug: First UTXO structure:', safeStringify(utxos[0]))

    // Send the transaction
    const txid = await wallet.sendXec(outputs)

    console.log('\n✅ Transaction sent successfully!')
    console.log('═'.repeat(60))
    console.log(`Transaction ID: ${txid}`)
    console.log(`Amount Sent: ${amountXec.toLocaleString()} XEC`)
    console.log(`Recipient: ${recipientAddress}`)
    console.log('═'.repeat(60))

    // Get updated balance
    console.log('\n💰 Getting updated balance...')
    const newBalance = await wallet.getXecBalance()
    const feePaid = balance - newBalance - amountXec

    console.log('\n📊 Transaction Summary:')
    console.log(`Previous Balance: ${balance.toLocaleString()} XEC`)
    console.log(`Amount Sent: ${amountXec.toLocaleString()} XEC`)
    console.log(`Fee Paid: ${feePaid.toLocaleString()} XEC`)
    console.log(`New Balance: ${newBalance.toLocaleString()} XEC`)

    console.log('\n🔗 View Transaction:')
    console.log(`   Explorer: https://explorer.e.cash/tx/${txid}`)
    console.log('   Note: It may take a few minutes to appear in the explorer')

    console.log('\n📝 Next Steps:')
    console.log('   • The transaction is now being processed by the network')
    console.log('   • Confirmation usually takes 1-10 minutes')
    console.log('   • Check status: node examples/wallet-info/get-transactions.js')

    // Ensure process exits cleanly
    process.exit(0)
  } catch (err) {
    console.error('❌ Failed to send XEC:', err.message)

    // Provide helpful error context
    if (err.message.includes('insufficient')) {
      console.log('\n💸 Insufficient Funds:')
      console.log('   • Your wallet does not have enough XEC for this transaction')
      console.log('   • Remember that transaction fees are deducted from your balance')
      console.log('   • Try a smaller amount or fund your wallet')
    } else if (err.message.includes('address')) {
      console.log('\n📍 Address Error:')
      console.log('   • Check that the recipient address is valid')
      console.log('   • Make sure it starts with "ecash:"')
      console.log('   • Verify the address with the recipient')
    } else if (err.message.includes('network')) {
      console.log('\n🌐 Network Error:')
      console.log('   • Check your internet connection')
      console.log('   • The network might be temporarily unavailable')
      console.log('   • Try again in a few moments')
    }

    process.exit(1)
  }
}

// Run the example
sendXec()
