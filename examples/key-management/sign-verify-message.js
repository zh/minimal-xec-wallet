/*
  Sign and verify a message using the eCash message signing protocol.
  This is a pure crypto operation — no network calls needed.

  Usage:
    node examples/key-management/sign-verify-message.js [message]

  If no message is provided, "Hello eCash!" is used as default.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

async function signVerifyMessage () {
  try {
    // Check for --help flag
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log('Usage: node examples/key-management/sign-verify-message.js [message]')
      console.log('')
      console.log('Signs a message with the wallet private key and verifies the signature.')
      console.log('If no message is provided, "Hello eCash!" is used as default.')
      process.exit(0)
    }

    console.log('✍️  eCash Message Sign & Verify\n')

    // Check if wallet exists
    if (!WalletHelper.walletExists()) {
      console.error('❌ No wallet found!')
      console.log('   Create a wallet first using one of these commands:')
      console.log('   • node examples/wallet-creation/create-new-wallet.js')
      console.log('   • node examples/wallet-creation/restore-from-mnemonic.js')
      process.exit(1)
    }

    // Load wallet from wallet.json
    const walletInfo = WalletHelper.loadWallet()
    const wallet = new MinimalXECWallet(walletInfo.mnemonic || walletInfo.privateKey)
    await wallet.walletInfoPromise

    // Get message from command line or use default
    const message = process.argv[2] || 'Hello eCash!'

    console.log('\n📋 Wallet Information:')
    console.log('═'.repeat(50))
    console.log(`XEC Address: ${wallet.walletInfo.xecAddress}`)
    console.log('═'.repeat(50))

    // Sign the message
    console.log(`\n📝 Message: "${message}"`)
    console.log('─'.repeat(50))

    const signature = wallet.signMessage(message)
    console.log(`✅ Signature (base64): ${signature}`)

    // Verify the signature against the wallet's own address
    console.log('\n🔍 Verification:')
    console.log('─'.repeat(50))

    const isValid = wallet.verifyMessage(message, signature, wallet.walletInfo.xecAddress)
    console.log(`Against own address:  ${isValid ? '✅ VALID' : '❌ INVALID'}`)

    // Verify against a wrong address (demonstrates negative case)
    const wrongResult = wallet.verifyMessage(message, signature, 'ecash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqs7ratqfx')
    console.log(`Against wrong address: ${wrongResult ? '✅ VALID' : '❌ INVALID (expected)'}`)

    console.log('\n💡 Notes:')
    console.log('═'.repeat(50))
    console.log('• Message signing is a pure crypto operation (no network needed)')
    console.log('• The signature proves the wallet owner signed the message')
    console.log('• Anyone can verify a signature given the message, signature, and address')
    console.log('• Compatible with ecash-lib signMsg/verifyMsg protocol')
  } catch (err) {
    console.error('❌ Failed:', err.message)
    process.exit(1)
  }
}

// Run the example
signVerifyMessage()
