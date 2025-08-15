/*
  Send an OP_RETURN transaction with custom data.
  This example shows how to embed data on the XEC blockchain.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)

function showUsage () {
  console.log('Usage: node send-op-return.js <message> [xec_amount]')
  console.log('')
  console.log('Examples:')
  console.log('  node send-op-return.js "Hello XEC blockchain!"')
  console.log('  node send-op-return.js "Document hash: abc123..." 5.46')
  console.log('  node send-op-return.js "Timestamp: 2024-01-01" 0')
  console.log('')
  console.log('Parameters:')
  console.log('  message: Text to embed in the blockchain (max 220 bytes)')
  console.log('  xec_amount: Optional XEC to send to yourself (default: 0)')
  console.log('')
  console.log('Note: OP_RETURN data is permanent and publicly visible!')
}

async function sendOpReturn () {
  try {
    console.log('📝 Sending OP_RETURN transaction...\n')

    // Check arguments
    if (args.length < 1) {
      console.log('❌ No message provided')
      showUsage()
      return
    }

    const message = args[0]
    const xecAmount = args.length > 1 ? parseFloat(args[1]) : 0

    // Validate message
    if (!message || message.length === 0) {
      console.log('❌ Message cannot be empty')
      showUsage()
      return
    }

    if (message.length > 220) {
      console.log('❌ Message too long. Maximum 220 characters allowed.')
      console.log(`   Your message: ${message.length} characters`)
      return
    }

    // Validate amount
    if (isNaN(xecAmount) || xecAmount < 0) {
      console.log('❌ Invalid XEC amount. Must be 0 or positive number')
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

    console.log('\n📋 OP_RETURN Transaction Details:')
    console.log('═'.repeat(60))
    console.log(`From: ${walletData.xecAddress}`)
    console.log(`Message: "${message}"`)
    console.log(`Message Length: ${message.length} bytes`)
    console.log(`XEC Amount: ${xecAmount.toLocaleString()} XEC`)
    console.log(`Current Balance: ${balance.toLocaleString()} XEC`)
    console.log('═'.repeat(60))

    // Check balance
    const estimatedFee = 0.01 // Rough estimate
    const totalCost = xecAmount + estimatedFee

    if (balance < totalCost) {
      console.log('\n❌ Insufficient balance!')
      console.log(`   Required: ~${totalCost.toLocaleString()} XEC (including estimated fee)`)
      console.log(`   Available: ${balance.toLocaleString()} XEC`)
      console.log('   Fund your wallet or reduce the XEC amount')
      return
    }

    // Show what OP_RETURN means
    console.log('\n📚 About OP_RETURN:')
    console.log('   • OP_RETURN allows embedding data in blockchain transactions')
    console.log('   • Data is permanent and publicly visible')
    console.log('   • Useful for timestamps, document hashes, certificates')
    console.log('   • Data cannot be spent (provably unspendable)')

    // Encode message to hex
    const messageHex = Buffer.from(message, 'utf8').toString('hex')
    console.log(`\n🔗 Encoded Message: ${messageHex}`)

    // Confirm transaction
    console.log('\n⚠️  OP_RETURN Transaction Confirmation')
    console.log('   This data will be permanently stored on the blockchain!')
    console.log('   Make sure you want to make this information public.')

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

    console.log('\n🚀 Broadcasting OP_RETURN transaction...')

    // Prepare XEC outputs (optional)
    let xecOutputs = []
    if (xecAmount > 0) {
      xecOutputs = [{
        address: walletData.xecAddress,
        amountSat: Math.round(xecAmount * 100)
      }]
    }

    // Send OP_RETURN transaction
    const txid = await wallet.sendOpReturn(
      message, // message
      '6d02', // prefix (memo protocol)
      xecOutputs, // optional XEC outputs
      1.2 // sats per byte fee rate
    )

    console.log('\n✅ OP_RETURN transaction sent successfully!')
    console.log('═'.repeat(60))
    console.log(`Transaction ID: ${txid}`)
    console.log(`Message: "${message}"`)
    console.log(`Message Hex: ${messageHex}`)
    console.log(`XEC Amount: ${xecAmount.toLocaleString()} XEC`)
    console.log('═'.repeat(60))

    // Get updated balance
    console.log('\n💰 Getting updated balance...')
    const newBalance = await wallet.getXecBalance()
    const feePaid = balance - newBalance - xecAmount

    console.log('\n📊 Transaction Summary:')
    console.log(`Previous Balance: ${balance.toLocaleString()} XEC`)
    console.log(`XEC Sent: ${xecAmount.toLocaleString()} XEC`)
    console.log(`Fee Paid: ${feePaid.toLocaleString()} XEC`)
    console.log(`New Balance: ${newBalance.toLocaleString()} XEC`)

    console.log('\n🔗 View Transaction:')
    console.log(`   Explorer: https://explorer.e.cash/tx/${txid}`)
    console.log('   Note: Look for the OP_RETURN output in the transaction details')

    console.log('\n📝 OP_RETURN Data Location:')
    console.log('   • Your message is now permanently stored on the XEC blockchain')
    console.log('   • Anyone can view it by examining the transaction')
    console.log('   • The data is in the OP_RETURN output of the transaction')
    console.log('   • Blockchain explorers will show the hex data')

    console.log('\n💡 Use Cases for OP_RETURN:')
    console.log('   • Document timestamping')
    console.log('   • Certificate verification')
    console.log('   • Digital signatures')
    console.log('   • Public announcements')
    console.log('   • Hash commitments')
    
    // Ensure process exits cleanly
    process.exit(0)
  } catch (err) {
    console.error('❌ Failed to send OP_RETURN:', err.message)

    // Provide helpful error context
    if (err.message.includes('insufficient')) {
      console.log('\n💸 Insufficient Funds:')
      console.log('   • Your wallet does not have enough XEC for this transaction')
      console.log('   • OP_RETURN transactions still require fees')
      console.log('   • Try reducing the XEC amount or fund your wallet')
    } else if (err.message.includes('size') || err.message.includes('large')) {
      console.log('\n📏 Size Error:')
      console.log('   • Your message might be too large')
      console.log('   • Try a shorter message')
      console.log('   • Maximum recommended: 220 bytes')
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
sendOpReturn()
