/*
  Send all available XEC to another address.
  This example shows how to empty your wallet by sending all funds to a recipient.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)

function showUsage () {
  console.log('Usage: node send-all-xec.js <recipient_address>')
  console.log('')
  console.log('Examples:')
  console.log('  node send-all-xec.js ecash:qp1234...abc')
  console.log('')
  console.log('Parameters:')
  console.log('  recipient_address: XEC address starting with ecash:')
  console.log('')
  console.log('Warning: This will send ALL XEC in your wallet to the recipient!')
  console.log('         Transaction fees will be automatically deducted from the amount.')
}

async function sendAllXec () {
  try {
    console.log('💸 Sending ALL XEC from wallet...\n')

    // Check arguments
    if (args.length !== 1) {
      console.log('❌ Invalid arguments')
      showUsage()
      return
    }

    const recipientAddress = args[0]

    // Validate arguments
    if (!recipientAddress || !recipientAddress.startsWith('ecash:')) {
      console.log('❌ Invalid recipient address. Must start with "ecash:"')
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

    if (balance === 0) {
      console.log('\n💸 Wallet is already empty!')
      console.log('   There is no XEC to send.')
      console.log('   Fund your wallet first to use this function.')
      return
    }

    console.log('\n📋 Send All Transaction Details:')
    console.log('═'.repeat(60))
    console.log(`From: ${walletData.xecAddress}`)
    console.log(`To: ${recipientAddress}`)
    console.log(`Available Balance: ${balance.toLocaleString()} XEC`)
    console.log('═'.repeat(60))

    // Show UTXOs for transparency
    console.log('\n🔍 Analyzing wallet UTXOs...')
    const utxoData = await wallet.getUtxos()
    const utxos = utxoData.utxos || []
    const spendableUtxos = utxos.filter(utxo => utxo.blockHeight !== -1)

    console.log(`Total UTXOs: ${utxos.length}`)
    console.log(`Spendable UTXOs: ${spendableUtxos.length}`)

    if (spendableUtxos.length === 0) {
      console.log('\n⏳ No spendable UTXOs found!')
      console.log('   All your XEC might be in unconfirmed transactions.')
      console.log('   Wait for confirmations before trying to send.')
      return
    }

    // Estimate the transaction fee
    const estimatedFeeRate = 1.2 // sats per byte
    const estimatedTxSize = (spendableUtxos.length * 150) + (1 * 34) + 10 // Rough estimate
    const estimatedFee = (estimatedTxSize * estimatedFeeRate) / 100 // Convert to XEC
    const estimatedAmountToSend = balance - estimatedFee

    console.log(`Estimated Fee: ~${estimatedFee.toFixed(4)} XEC`)
    console.log(`Estimated Amount to Send: ~${estimatedAmountToSend.toLocaleString()} XEC`)

    // Warning about emptying wallet
    console.log('\n⚠️  WALLET EMPTYING WARNING')
    console.log('   This transaction will send ALL your XEC to the recipient!')
    console.log('   After this transaction:')
    console.log('   • Your wallet balance will be 0 XEC')
    console.log('   • You will need to fund the wallet again to make new transactions')
    console.log('   • Make sure the recipient address is correct!')
    console.log('')
    console.log('   🔐 SECURITY CHECK:')
    console.log('   • Are you migrating to a new wallet?')
    console.log('   • Are you sending to your own address?')
    console.log('   • Have you verified the recipient address?')

    // Confirm transaction
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    console.log(`\n   Recipient: ${recipientAddress}`)
    const confirmed = await new Promise((resolve) => {
      rl.question('\nAre you ABSOLUTELY SURE you want to empty your wallet? (type "YES" to confirm): ', (answer) => {
        rl.close()
        resolve(answer === 'YES')
      })
    })

    if (!confirmed) {
      console.log('❌ Transaction cancelled by user')
      console.log('   Your XEC is safe in your wallet.')
      return
    }

    console.log('\n🚀 Broadcasting send-all transaction...')

    // Send all XEC to the recipient
    const txid = await wallet.sendAllXec(recipientAddress)

    console.log('\n✅ Send-all transaction sent successfully!')
    console.log('═'.repeat(60))
    console.log(`Transaction ID: ${txid}`)
    console.log(`Recipient: ${recipientAddress}`)
    console.log('═'.repeat(60))

    // Get updated balance
    console.log('\n💰 Checking final balance...')
    const newBalance = await wallet.getXecBalance()
    const actualAmountSent = balance - newBalance

    console.log('\n📊 Final Transaction Summary:')
    console.log(`Previous Balance: ${balance.toLocaleString()} XEC`)
    console.log(`Amount Sent: ${actualAmountSent.toLocaleString()} XEC`)
    console.log(`Final Balance: ${newBalance.toLocaleString()} XEC`)

    if (newBalance > 0) {
      console.log(`\n💡 Note: ${newBalance.toLocaleString()} XEC remains (dust or unconfirmed)`)
    } else {
      console.log('\n🎉 Wallet successfully emptied!')
    }

    console.log('\n🔗 View Transaction:')
    console.log(`   Explorer: https://explorer.e.cash/tx/${txid}`)
    console.log('   Note: It may take a few minutes to appear in the explorer')

    console.log('\n📝 What happens next:')
    console.log('   • The transaction is now being processed by the network')
    console.log('   • Confirmation usually takes 1-10 minutes')
    console.log('   • Your wallet is now empty (balance: 0 XEC)')
    console.log('   • To use this wallet again, send XEC to:', walletData.xecAddress)

    // Suggest next steps
    if (newBalance === 0) {
      console.log('\n💡 Suggested next steps:')
      console.log('   • If migrating: Import your wallet elsewhere using the mnemonic')
      console.log('   • If consolidating: You can delete the wallet.json file')
      console.log('   • If temporarily emptying: Keep the wallet.json for future use')
    }
  } catch (err) {
    console.error('❌ Failed to send all XEC:', err.message)

    // Provide helpful error context
    if (err.message.includes('insufficient')) {
      console.log('\n💸 Insufficient Funds:')
      console.log('   • Your wallet might not have enough XEC to cover transaction fees')
      console.log('   • Try waiting for unconfirmed transactions to confirm')
      console.log('   • Check if you have any spendable UTXOs')
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
sendAllXec()
