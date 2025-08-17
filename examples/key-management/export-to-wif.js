/*
  Export an XEC wallet's private key to WIF (Wallet Import Format).
  This example shows how to export private keys in different formats.
*/

const MinimalXECWallet = require('../../index')
const WalletHelper = require('../utils/wallet-helper')

async function exportToWif () {
  try {
    console.log('🔐 Exporting XEC wallet private key to WIF format...\n')

    // Check if wallet exists
    if (!WalletHelper.walletExists()) {
      console.error('❌ No wallet found!')
      console.log('   Create a wallet first using one of these commands:')
      console.log('   • node examples/wallet-creation/create-new-wallet.js')
      console.log('   • node examples/wallet-creation/restore-from-mnemonic.js')
      console.log('   • node examples/wallet-creation/import-from-wif.js')
      process.exit(1)
    }

    // Load wallet from wallet.json
    const walletInfo = WalletHelper.loadWallet()
    const wallet = new MinimalXECWallet(walletInfo.mnemonic || walletInfo.privateKey)
    await wallet.walletInfoPromise

    console.log('📋 Current Wallet Information:')
    console.log('═'.repeat(50))
    console.log(`XEC Address: ${wallet.walletInfo.xecAddress}`)
    console.log(`Wallet Type: ${wallet.walletInfo.mnemonic ? 'HD Wallet' : 'Single Key'}`)
    console.log('═'.repeat(50))

    console.log('\n🔑 Exporting Private Key in WIF Formats:')
    console.log('═'.repeat(50))

    // Export mainnet compressed WIF
    const mainnetCompressed = wallet.exportPrivateKeyAsWIF(true, false)
    console.log(`Mainnet Compressed:   ${mainnetCompressed}`)
    console.log(`├─ Validation:        ${wallet.validateWIF(mainnetCompressed) ? '✅ Valid' : '❌ Invalid'}`)
    console.log(`├─ Length:            ${mainnetCompressed.length} characters`)
    console.log('└─ Usage:             Most common format for importing')

    // Export mainnet uncompressed WIF
    const mainnetUncompressed = wallet.exportPrivateKeyAsWIF(false, false)
    console.log(`\nMainnet Uncompressed: ${mainnetUncompressed}`)
    console.log(`├─ Validation:        ${wallet.validateWIF(mainnetUncompressed) ? '✅ Valid' : '❌ Invalid'}`)
    console.log(`├─ Length:            ${mainnetUncompressed.length} characters`)
    console.log('└─ Usage:             Legacy format, less common')

    // Export testnet compressed WIF
    const testnetCompressed = wallet.exportPrivateKeyAsWIF(true, true)
    console.log(`\nTestnet Compressed:   ${testnetCompressed}`)
    console.log(`├─ Validation:        ${wallet.validateWIF(testnetCompressed) ? '✅ Valid' : '❌ Invalid'}`)
    console.log(`├─ Length:            ${testnetCompressed.length} characters`)
    console.log('└─ Usage:             For testnet applications')

    // Export testnet uncompressed WIF
    const testnetUncompressed = wallet.exportPrivateKeyAsWIF(false, true)
    console.log(`\nTestnet Uncompressed: ${testnetUncompressed}`)
    console.log(`├─ Validation:        ${wallet.validateWIF(testnetUncompressed) ? '✅ Valid' : '❌ Invalid'}`)
    console.log(`├─ Length:            ${testnetUncompressed.length} characters`)
    console.log('└─ Usage:             For testnet, legacy format')

    console.log('\n📊 WIF Format Reference:')
    console.log('═'.repeat(50))
    console.log('Format                 | Prefix | Network | Compression')
    console.log('─'.repeat(50))
    console.log('Mainnet Compressed     | K, L   | Mainnet | Yes')
    console.log('Mainnet Uncompressed   | 5      | Mainnet | No')
    console.log('Testnet Compressed     | c      | Testnet | Yes')
    console.log('Testnet Uncompressed   | 9      | Testnet | No')

    console.log('\n🔍 Round-trip Validation Test:')
    console.log('─'.repeat(30))

    // Test round-trip conversion
    const testWIF = mainnetCompressed
    const importedWallet = new MinimalXECWallet(testWIF)
    await importedWallet.walletInfoPromise

    const addressMatch = importedWallet.walletInfo.xecAddress === wallet.walletInfo.xecAddress
    console.log(`Original Address:  ${wallet.walletInfo.xecAddress}`)
    console.log(`Imported Address:  ${importedWallet.walletInfo.xecAddress}`)
    console.log(`Addresses Match:   ${addressMatch ? '✅ Yes' : '❌ No'}`)

    if (addressMatch) {
      console.log('\n🎉 Success! WIF export and import working correctly.')
    } else {
      console.log('\n❌ Warning! Address mismatch detected.')
    }

    console.log('\n🔐 SECURITY WARNINGS:')
    console.log('═'.repeat(50))
    console.log('• WIF private keys provide FULL access to your funds')
    console.log('• Never share WIF keys with anyone')
    console.log('• Store WIF keys securely and offline')
    console.log('• Anyone with your WIF can steal your XEC')
    console.log('• Use WIF export only when necessary (wallet recovery, etc.)')

    console.log('\n💡 Usage Examples:')
    console.log('═'.repeat(50))
    console.log('• Import into other wallets or applications')
    console.log('• Paper wallet creation for cold storage')
    console.log('• Wallet backup and recovery')
    console.log('• Cross-platform wallet migration')
  } catch (err) {
    console.error('❌ Failed to export WIF:', err.message)
    process.exit(1)
  }
}

// Run the example
exportToWif()
