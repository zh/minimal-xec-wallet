/*
  Validate XEC addresses for correctness.
  This example shows how to check if an address is valid before sending funds.
*/

const MinimalXECWallet = require('../../index')

// Get command line arguments
const args = process.argv.slice(2)

function showUsage () {
  console.log('Usage: node validate-address.js <address1> [address2] [address3] ...')
  console.log('')
  console.log('Examples:')
  console.log('  node validate-address.js ecash:qp1234567890abcdef1234567890abcdef12345678')
  console.log('  node validate-address.js ecash:qr123... ecash:qp456... bitcoincash:qz789...')
  console.log('')
  console.log('Parameters:')
  console.log('  addressN: XEC or other cryptocurrency addresses to validate')
  console.log('')
  console.log('Purpose:')
  console.log('  • Verify address format and checksum')
  console.log('  • Detect common address format errors')
  console.log('  • Prevent sending funds to invalid addresses')
}

function validateSingleAddress (address) {
  console.log(`\n🔍 Validating: ${address}`)
  console.log('─'.repeat(60))

  // Basic format checks
  const checks = {
    notEmpty: address && address.length > 0,
    hasPrefix: address && address.includes(':'),
    correctPrefix: address && address.startsWith('ecash:'),
    correctLength: address && address.length >= 40 && address.length <= 60,
    validCharacters: address && /^ecash:[a-z0-9]+$/.test(address)
  }

  // Show basic format analysis
  console.log('📋 Basic Format Analysis:')
  console.log(`   Length: ${address ? address.length : 0} characters`)
  console.log(`   Prefix: ${address ? address.split(':')[0] : 'none'}`)
  console.log(`   Body: ${address ? address.split(':')[1]?.substring(0, 10) + '...' : 'none'}`)

  // Check against other cryptocurrency formats
  const formatAnalysis = {
    isXEC: address && address.startsWith('ecash:'),
    isBCH: address && address.startsWith('bitcoincash:'),
    isBTC: address && (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^bc1[a-z0-9]{39,59}$/.test(address)),
    isETH: address && /^0x[a-fA-F0-9]{40}$/.test(address),
    isLTC: address && (/^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(address) || /^ltc1[a-z0-9]{39,59}$/.test(address))
  }

  console.log('\n🔍 Format Detection:')
  if (formatAnalysis.isXEC) {
    console.log('   ✅ Detected as XEC (eCash) address')
  } else if (formatAnalysis.isBCH) {
    console.log('   ⚠️  Detected as BCH (Bitcoin Cash) address')
    console.log('       This is NOT compatible with XEC!')
  } else if (formatAnalysis.isBTC) {
    console.log('   ⚠️  Detected as BTC (Bitcoin) address')
    console.log('       This is NOT compatible with XEC!')
  } else if (formatAnalysis.isETH) {
    console.log('   ⚠️  Detected as ETH (Ethereum) address')
    console.log('       This is NOT compatible with XEC!')
  } else if (formatAnalysis.isLTC) {
    console.log('   ⚠️  Detected as LTC (Litecoin) address')
    console.log('       This is NOT compatible with XEC!')
  } else {
    console.log('   ❓ Unknown or invalid address format')
  }

  // Attempt validation using wallet library
  let isValid = false
  let validationError = null

  try {
    const wallet = new MinimalXECWallet()
    wallet._validateAddress(address)
    isValid = true
    console.log('\n✅ Validation Result: VALID XEC ADDRESS')
  } catch (err) {
    validationError = err.message
    console.log('\n❌ Validation Result: INVALID')
    console.log(`   Error: ${validationError}`)
  }

  // Detailed check results
  console.log('\n📊 Detailed Checks:')
  Object.entries(checks).forEach(([check, passed]) => {
    const status = passed ? '✅' : '❌'
    const checkName = check.replace(/([A-Z])/g, ' $1').toLowerCase()
    console.log(`   ${status} ${checkName}`)
  })

  // Security warnings
  if (!isValid) {
    console.log('\n⚠️  Security Warnings:')

    if (formatAnalysis.isBCH) {
      console.log('   • This appears to be a Bitcoin Cash address')
      console.log('   • Sending XEC to BCH addresses will result in LOSS OF FUNDS')
      console.log('   • XEC and BCH are different cryptocurrencies')
    } else if (formatAnalysis.isBTC) {
      console.log('   • This appears to be a Bitcoin address')
      console.log('   • Sending XEC to BTC addresses will result in LOSS OF FUNDS')
    } else if (formatAnalysis.isETH) {
      console.log('   • This appears to be an Ethereum address')
      console.log('   • XEC cannot be sent to Ethereum addresses')
    } else {
      console.log('   • Address format is not recognized as valid XEC')
      console.log('   • Double-check the address with the recipient')
      console.log('   • Sending to invalid addresses may result in loss of funds')
    }
  }

  // Usage recommendations
  console.log('\n💡 Recommendations:')
  if (isValid) {
    console.log('   ✅ Safe to send XEC to this address')
    console.log('   ✅ Address format and checksum are correct')
    console.log('   ✅ Compatible with eCash network')
  } else {
    console.log('   ❌ DO NOT send XEC to this address')
    console.log('   ❌ Verify the address with the recipient')
    console.log('   ❌ Request a proper XEC address (starting with ecash:)')
  }

  return {
    address,
    isValid,
    format: formatAnalysis,
    error: validationError
  }
}

async function validateAddresses () {
  try {
    console.log('🔍 XEC Address Validation Tool\n')

    // Check arguments
    if (args.length === 0) {
      console.log('❌ No addresses provided')
      showUsage()
      return
    }

    console.log(`📋 Validating ${args.length} address(es):`)
    console.log('═'.repeat(60))

    const results = []

    // Validate each address
    for (const address of args) {
      const result = validateSingleAddress(address)
      results.push(result)
    }

    // Summary
    console.log('\n📊 Validation Summary:')
    console.log('═'.repeat(60))

    const validCount = results.filter(r => r.isValid).length
    const invalidCount = results.length - validCount

    console.log(`Total addresses checked: ${results.length}`)
    console.log(`Valid XEC addresses: ${validCount}`)
    console.log(`Invalid addresses: ${invalidCount}`)

    if (invalidCount > 0) {
      console.log('\n⚠️  Invalid Addresses Found:')
      results.filter(r => !r.isValid).forEach(result => {
        console.log(`   ❌ ${result.address}`)
        console.log(`      Error: ${result.error}`)
      })
    }

    if (validCount > 0) {
      console.log('\n✅ Valid XEC Addresses:')
      results.filter(r => r.isValid).forEach(result => {
        console.log(`   ✅ ${result.address}`)
      })
    }

    // Best practices
    console.log('\n💡 Best Practices:')
    console.log('─'.repeat(60))
    console.log('• Always validate addresses before sending funds')
    console.log('• Double-check with recipients when in doubt')
    console.log('• XEC addresses must start with "ecash:"')
    console.log('• Never send XEC to Bitcoin, Ethereum, or other crypto addresses')
    console.log('• Use small test amounts for first-time recipients')
    console.log('• Copy addresses carefully to avoid typos')

    console.log('\n🔗 Resources:')
    console.log('─'.repeat(60))
    console.log('• eCash Explorer: https://explorer.e.cash')
    console.log('• Address format docs: https://e.cash/developers')
    console.log('• CashAddr format: https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/cashaddr.md')
  } catch (err) {
    console.error('❌ Address validation failed:', err.message)
    process.exit(1)
  }
}

// Show usage if requested
if (args.includes('--help') || args.includes('-h')) {
  showUsage()
  process.exit(0)
}

// Run the example
validateAddresses()
