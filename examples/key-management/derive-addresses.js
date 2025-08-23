/*
  Derive multiple addresses from wallet mnemonic.
  This example shows how to generate addresses at different HD paths.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

// Get command line arguments
const args = process.argv.slice(2)
const count = parseInt(args[0]) || 10

function showUsage () {
  console.log('Usage: node derive-addresses.js [count]')
  console.log('')
  console.log('Examples:')
  console.log('  node derive-addresses.js        # Derive 10 addresses')
  console.log('  node derive-addresses.js 5      # Derive 5 addresses')
  console.log('  node derive-addresses.js 20     # Derive 20 addresses')
  console.log('')
  console.log('Parameters:')
  console.log('  count: Number of addresses to derive (default: 10, max: 100)')
  console.log('')
  console.log('Note: This only works with wallets created from mnemonic phrases')
}

async function deriveAddresses () {
  try {
    console.log('🔑 Deriving multiple addresses from wallet...\n')

    // Validate count
    if (isNaN(count) || count < 1 || count > 100) {
      console.log('❌ Invalid count. Must be between 1 and 100')
      showUsage()
      return
    }

    // Load wallet from file
    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      console.log('   Run: node examples/wallet-creation/create-new-wallet.js')
      return
    }

    // Check if wallet has mnemonic
    if (!walletData.mnemonic) {
      console.log('❌ This wallet was not created from a mnemonic!')
      console.log('   Address derivation requires a mnemonic phrase.')
      console.log('   Only wallets created with:')
      console.log('   • create-new-wallet.js')
      console.log('   • restore-from-mnemonic.js')
      console.log('   support multiple address derivation.')
      return
    }

    // Create wallet instance from saved data with proper hdPath
    const hdPath = walletData.hdPath || "m/44'/899'/0'/0/0"
    const wallet = new MinimalXECWallet(walletData.mnemonic, { hdPath: hdPath })
    await wallet.walletInfoPromise

    // Determine coin type for display
    const coinType = hdPath.includes('1899') ? '1899' : '899'
    const walletType = coinType === '1899' ? 'CashTab' : 'Standard eCash'

    console.log('📋 Wallet Information:')
    console.log('═'.repeat(60))
    console.log(`Mnemonic: ${walletData.mnemonic.split(' ').length} words`)
    console.log(`Base Address: ${walletData.xecAddress}`)
    console.log(`Base HD Path: ${hdPath}`)
    console.log(`Wallet Type: ${walletType} (coin type ${coinType})`)
    console.log(`Addresses to derive: ${count}`)
    console.log('═'.repeat(60))

    console.log('\n🔍 Deriving addresses...')

    // Derive addresses at different indices
    const addresses = []

    for (let i = 0; i < count; i++) {
      try {
        const keyPair = await wallet.getKeyPair(i)
        addresses.push({
          index: i,
          address: keyPair.xecAddress,
          privateKey: keyPair.wif,
          publicKey: keyPair.publicKey,
          hdIndex: keyPair.hdIndex
        })
      } catch (err) {
        console.log(`   Warning: Failed to derive address at index ${i}:`, err.message)
      }
    }

    console.log('\n📍 Derived Addresses:')
    console.log('═'.repeat(80))
    console.log('Index  Address                                        HD Path')
    console.log('─'.repeat(80))

    addresses.forEach(addr => {
      const derivedPath = `m/44'/${coinType}'/0'/0/${addr.index}`
      const addressShort = `${addr.address.substring(0, 25)}...${addr.address.substring(addr.address.length - 8)}`
      console.log(`${addr.index.toString().padStart(3)}    ${addressShort}  ${derivedPath}`)
    })

    console.log('═'.repeat(80))
    console.log(`Total addresses derived: ${addresses.length}`)

    // Show detailed information for first few addresses
    if (addresses.length > 0) {
      console.log('\n🔍 Detailed Information (first 3 addresses):')

      addresses.slice(0, 3).forEach((addr, i) => {
        console.log(`\n${i + 1}. Address ${addr.index}:`)
        console.log('   ─'.repeat(50))
        console.log(`   Address: ${addr.address}`)
        console.log(`   HD Path: m/44'/${coinType}'/0'/0/${addr.index}`)

        // Show private key format (truncated for security)
        const pkShort = `${addr.privateKey.substring(0, 8)}...${addr.privateKey.substring(addr.privateKey.length - 8)}`
        console.log(`   Private Key: ${pkShort}`)

        const pubShort = `${addr.publicKey.substring(0, 16)}...${addr.publicKey.substring(addr.publicKey.length - 8)}`
        console.log(`   Public Key: ${pubShort}`)
      })

      if (addresses.length > 3) {
        console.log(`\n   ... and ${addresses.length - 3} more addresses`)
      }
    }

    // Address usage guidance
    console.log('\n💡 Address Usage Guidance:')
    console.log('─'.repeat(60))
    console.log('• Address 0: Primary wallet address (current active)')
    console.log('• Address 1+: Additional addresses for privacy/organization')
    console.log('• Each address has its own private key')
    console.log('• All addresses share the same recovery mnemonic')
    console.log('• Use different addresses for different purposes')

    console.log('\n🔐 Security Notes:')
    console.log('─'.repeat(60))
    console.log('• All these addresses are derived from your mnemonic')
    console.log('• Anyone with your mnemonic can access ALL addresses')
    console.log('• Keep your mnemonic phrase secure and private')
    console.log('• Consider using different addresses for enhanced privacy')

    console.log('\n📱 How to Use Multiple Addresses:')
    console.log('─'.repeat(60))
    console.log('• Give different addresses to different people/services')
    console.log('• Use separate addresses for savings vs spending')
    console.log('• Organize funds by purpose (trading, storage, etc.)')
    console.log('• Enhanced privacy by not linking all transactions')

    // Balance checking suggestion
    console.log('\n🔍 Check Balances:')
    console.log('─'.repeat(60))
    console.log('To check individual address balances:')
    addresses.slice(0, 3).forEach(addr => {
      console.log(`• Address ${addr.index}: node examples/wallet-info/get-balance.js`)
      console.log(`  (Then manually check ${addr.address})`)
    })

    console.log('\n⚠️  Important Considerations:')
    console.log('─'.repeat(60))
    console.log('• This wallet library tracks only the primary address (index 0)')
    console.log('• To use other addresses, you would need to:')
    console.log('  - Import their private keys separately, or')
    console.log('  - Modify the wallet to track multiple addresses')
    console.log('• Most wallet software supports multiple address management')
  } catch (err) {
    console.error('❌ Failed to derive addresses:', err.message)

    // Provide helpful error context
    if (err.message.includes('mnemonic')) {
      console.log('\n🔑 Mnemonic Error:')
      console.log('   • Your wallet.json might not contain a valid mnemonic')
      console.log('   • Try restoring from your original mnemonic phrase')
      console.log('   • Only HD wallets support address derivation')
    } else if (err.message.includes('path') || err.message.includes('derivation')) {
      console.log('\n🛤️  Derivation Error:')
      console.log('   • HD path derivation failed')
      console.log('   • Your mnemonic might be invalid')
      console.log('   • Try with a smaller number of addresses')
    }

    process.exit(1)
  }
}

// Show usage if requested
if (args.includes('--help') || args.includes('-h')) {
  showUsage()
  process.exit(0)
}

// Run the example
deriveAddresses()
