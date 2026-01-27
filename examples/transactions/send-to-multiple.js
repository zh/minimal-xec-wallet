/*
  Send XEC to multiple recipients in a single transaction.
  This example shows how to create a transaction with multiple outputs.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)
const useFinality = args.includes('--finality')
const filteredArgs = args.filter(arg => arg !== '--finality')

function showUsage () {
  console.log('Usage: node send-to-multiple.js <address1> <amount1> <address2> <amount2> [...] [--finality]')
  console.log('')
  console.log('Examples:')
  console.log('  node send-to-multiple.js ecash:qp1234...abc 50 ecash:qr5678...def 30')
  console.log('  node send-to-multiple.js ecash:qa1111...111 100 ecash:qb2222...222 25.5 ecash:qc3333...333 75')
  console.log('  node send-to-multiple.js ecash:qp1234...abc 50 ecash:qr5678...def 30 --finality  # Wait for Avalanche finality')
  console.log('')
  console.log('Parameters:')
  console.log('  addressN: XEC address starting with ecash:')
  console.log('  amountN: Amount in XEC (minimum 5.46 XEC per output due to dust limit)')
  console.log('')
  console.log('Options:')
  console.log('  --finality: Wait for Avalanche Pre-Consensus finality (~3 seconds)')
  console.log('              Without this flag, confirmation takes ~10 minutes (next block)')
  console.log('')
  console.log('Note: You can send to up to 100 recipients in a single transaction')
  console.log('      Transaction fee will be automatically calculated and deducted')
}

function parseRecipients (args) {
  if (args.length < 4 || args.length % 2 !== 0) {
    return null
  }

  const recipients = []
  for (let i = 0; i < args.length; i += 2) {
    const address = args[i]
    const amount = parseFloat(args[i + 1])

    if (!address || !address.startsWith('ecash:')) {
      console.log(`❌ Invalid address at position ${i + 1}: ${address}`)
      return null
    }

    if (isNaN(amount) || amount <= 0) {
      console.log(`❌ Invalid amount at position ${i + 2}: ${args[i + 1]}`)
      return null
    }

    if (amount < 5.46) {
      console.log(`❌ Amount too small at position ${i + 2}: ${amount} XEC (minimum 5.46 XEC due to dust limit)`)
      return null
    }

    recipients.push({ address, amount })
  }

  return recipients
}

async function sendToMultiple () {
  try {
    console.log('📤 Sending XEC to multiple recipients...\n')

    // Check arguments
    if (filteredArgs.length < 4) {
      console.log('❌ Not enough arguments')
      showUsage()
      return
    }

    // Parse recipients
    const recipients = parseRecipients(filteredArgs)
    if (!recipients) {
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

    // Calculate total amount to send
    const totalAmount = recipients.reduce((sum, recipient) => sum + recipient.amount, 0)

    console.log('\n📋 Multi-Output Transaction Details:')
    console.log('═'.repeat(70))
    console.log(`From: ${walletData.xecAddress}`)
    console.log(`Recipients: ${recipients.length}`)
    console.log(`Total Amount: ${totalAmount.toLocaleString()} XEC`)
    console.log(`Current Balance: ${balance.toLocaleString()} XEC`)
    console.log(`Avalanche Finality: ${useFinality ? 'ENABLED (~3 sec confirmation)' : 'DISABLED (~10 min block confirmation)'}`)
    console.log('═'.repeat(70))

    // Show all recipients
    console.log('\n📨 Recipients:')
    recipients.forEach((recipient, index) => {
      const addressShort = `${recipient.address.substring(0, 20)}...${recipient.address.substring(recipient.address.length - 8)}`
      console.log(`${index + 1}. ${addressShort}: ${recipient.amount.toLocaleString()} XEC`)
    })

    // Check if we have enough balance (rough estimate)
    const estimatedFee = recipients.length * 0.01 // Rough estimate: 0.01 XEC per output
    if (balance < totalAmount + estimatedFee) {
      console.log('\n❌ Insufficient balance!')
      console.log(`   Required: ~${(totalAmount + estimatedFee).toLocaleString()} XEC (including estimated fee)`)
      console.log(`   Available: ${balance.toLocaleString()} XEC`)
      console.log('   Fund your wallet or reduce the amounts')
      return
    }

    // Confirm transaction
    console.log('\n⚠️  Transaction Confirmation Required')
    console.log('   This will send real XEC from your wallet!')
    console.log('   Make sure all recipient addresses are correct.')
    console.log(`   Total recipients: ${recipients.length}`)
    console.log(`   Total amount: ${totalAmount.toLocaleString()} XEC`)

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

    console.log('\n🚀 Broadcasting multi-output transaction...')

    // Prepare the outputs
    const outputs = recipients.map(recipient => ({
      address: recipient.address,
      amountSat: Math.round(recipient.amount * 100) // Convert XEC to satoshis
    }))

    // Send the transaction with optional Avalanche finality
    const txOptions = useFinality ? { awaitFinality: true } : {}
    const txid = await wallet.sendXec(outputs, txOptions)

    console.log('\n✅ Multi-output transaction sent successfully!')
    if (useFinality) {
      console.log('⚡ Avalanche Finality: CONFIRMED (instant ~3 sec)')
    }
    console.log('═'.repeat(70))
    console.log(`Transaction ID: ${txid}`)
    console.log(`Recipients: ${recipients.length}`)
    console.log(`Total Amount: ${totalAmount.toLocaleString()} XEC`)
    console.log('═'.repeat(70))

    // Get updated balance
    console.log('\n💰 Getting updated balance...')
    const newBalance = await wallet.getXecBalance()
    const totalCost = balance - newBalance
    const feePaid = totalCost - totalAmount

    console.log('\n📊 Transaction Summary:')
    console.log(`Previous Balance: ${balance.toLocaleString()} XEC`)
    console.log(`Total Sent: ${totalAmount.toLocaleString()} XEC`)
    console.log(`Fee Paid: ${feePaid.toLocaleString()} XEC`)
    console.log(`Total Cost: ${totalCost.toLocaleString()} XEC`)
    console.log(`New Balance: ${newBalance.toLocaleString()} XEC`)

    console.log('\n📨 Delivery Summary:')
    recipients.forEach((recipient, index) => {
      const addressShort = `${recipient.address.substring(0, 15)}...${recipient.address.substring(recipient.address.length - 6)}`
      console.log(`${index + 1}. ${addressShort}: ${recipient.amount.toLocaleString()} XEC ✅`)
    })

    console.log('\n🔗 View Transaction:')
    console.log(`   Explorer: https://explorer.e.cash/tx/${txid}`)
    console.log('   Note: It may take a few minutes to appear in the explorer')

    console.log('\n💡 Benefits of Multi-Output Transactions:')
    console.log('   • Lower total fees compared to separate transactions')
    console.log('   • Single confirmation for all recipients')
    console.log('   • More efficient use of blockchain space')
    if (useFinality) {
      console.log('   • Instant Avalanche finality for all recipients (~3 sec)')
    } else {
      console.log('   • Use --finality flag for instant (~3 sec) Avalanche confirmation')
    }
  } catch (err) {
    console.error('❌ Failed to send multi-output transaction:', err.message)

    // Provide helpful error context
    if (err.message.includes('insufficient')) {
      console.log('\n💸 Insufficient Funds:')
      console.log('   • Your wallet does not have enough XEC for this transaction')
      console.log('   • Multi-output transactions require higher fees')
      console.log('   • Try reducing amounts or number of recipients')
    } else if (err.message.includes('address')) {
      console.log('\n📍 Address Error:')
      console.log('   • Check that all recipient addresses are valid')
      console.log('   • Make sure they all start with "ecash:"')
      console.log('   • Verify addresses with recipients')
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
sendToMultiple()
