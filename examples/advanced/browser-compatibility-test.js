/*
  Browser Compatibility Test - WebAssembly Loading

  Tests various WASM loading strategies for browser compatibility.
  Demonstrates fallback mechanisms for older browsers.
*/

/* global WebAssembly, Worker, navigator, crypto */

const MinimalXECWallet = require('../../index')

// Browser compatibility detection utility
function detectBrowserCapabilities () {
  const capabilities = {
    webAssembly: false,
    webAssemblyCompile: false,
    webAssemblyInstantiate: false,
    webWorkers: false,
    cryptoSubtle: false,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js'
  }

  try {
    // WebAssembly support
    if (typeof WebAssembly !== 'undefined') {
      capabilities.webAssembly = true

      if (typeof WebAssembly.compile === 'function') {
        capabilities.webAssemblyCompile = true
      }

      if (typeof WebAssembly.instantiate === 'function') {
        capabilities.webAssemblyInstantiate = true
      }
    }

    // Web Worker support
    if (typeof Worker !== 'undefined') {
      capabilities.webWorkers = true
    }

    // Crypto.subtle support
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      capabilities.cryptoSubtle = true
    }
  } catch (err) {
    console.warn('Error detecting browser capabilities:', err.message)
  }

  return capabilities
}

// Test WebAssembly loading strategies
async function testWASMStrategies () {
  console.log('🧪 Testing WebAssembly Loading Strategies...\n')

  const capabilities = detectBrowserCapabilities()

  console.log('📊 Browser Capabilities:')
  console.log('═══════════════════════════════════════════════')
  console.log(`WebAssembly Support: ${capabilities.webAssembly ? '✅' : '❌'}`)
  console.log(`WebAssembly.compile: ${capabilities.webAssemblyCompile ? '✅' : '❌'}`)
  console.log(`WebAssembly.instantiate: ${capabilities.webAssemblyInstantiate ? '✅' : '❌'}`)
  console.log(`Web Workers: ${capabilities.webWorkers ? '✅' : '❌'}`)
  console.log(`Crypto.subtle: ${capabilities.cryptoSubtle ? '✅' : '❌'}`)
  console.log(`User Agent: ${capabilities.userAgent}`)
  console.log('═══════════════════════════════════════════════\n')

  // Test different loading strategies
  const strategies = [
    {
      name: 'Async Compilation',
      available: capabilities.webAssemblyCompile,
      description: 'Modern async WebAssembly.compile() method'
    },
    {
      name: 'Web Worker Compilation',
      available: capabilities.webWorkers && capabilities.webAssembly,
      description: 'Compile WASM in worker thread (bypasses main thread restrictions)'
    },
    {
      name: 'Chunked Loading',
      available: capabilities.webAssembly,
      description: 'Split large WASM into smaller chunks'
    },
    {
      name: 'JavaScript Fallbacks',
      available: true,
      description: 'Pure JavaScript crypto implementations (always available)'
    }
  ]

  console.log('⚙️ Available Loading Strategies:')
  console.log('═══════════════════════════════════════════════')
  strategies.forEach((strategy, index) => {
    const status = strategy.available ? '✅ Available' : '❌ Not Available'
    console.log(`${index + 1}. ${strategy.name}: ${status}`)
    console.log(`   ${strategy.description}`)
  })
  console.log('═══════════════════════════════════════════════\n')

  return capabilities
}

// Test wallet initialization with WASM compatibility
async function testWalletCompatibility () {
  console.log('🏦 Testing Wallet Initialization...\n')

  try {
    console.log('Creating wallet instance...')
    const startTime = Date.now()

    // Create wallet (this will trigger WASM initialization)
    const wallet = new MinimalXECWallet()

    console.log('Waiting for wallet creation...')
    await wallet.walletInfoPromise

    console.log('Waiting for WASM initialization...')
    const wasmResult = await wallet.wasmInitPromise

    console.log('Initializing wallet services...')
    await wallet.initialize()

    const endTime = Date.now()
    const initTime = endTime - startTime

    console.log('✅ Wallet initialization completed!')
    console.log('═══════════════════════════════════════════════')
    console.log(`Initialization Time: ${initTime}ms`)
    console.log(`WASM Initialized: ${wasmResult ? '✅' : '❌ (using fallbacks)'}`)
    console.log(`Wallet Address: ${wallet.walletInfo.xecAddress}`)
    console.log(`Wallet Created: ${wallet.walletInfoCreated ? '✅' : '❌'}`)
    console.log(`Services Initialized: ${wallet.isInitialized ? '✅' : '❌'}`)
    console.log('═══════════════════════════════════════════════\n')

    return {
      success: true,
      initTime,
      wasmResult,
      address: wallet.walletInfo.xecAddress
    }
  } catch (err) {
    console.error('❌ Wallet initialization failed:')
    console.error('═══════════════════════════════════════════════')
    console.error(`Error: ${err.message}`)
    console.error('═══════════════════════════════════════════════\n')

    return {
      success: false,
      error: err.message
    }
  }
}

// Test basic wallet operations
async function testBasicOperations () {
  console.log('🔧 Testing Basic Wallet Operations...\n')

  try {
    const wallet = new MinimalXECWallet()
    await wallet.walletInfoPromise
    await wallet.wasmInitPromise
    await wallet.initialize()

    console.log('Testing wallet operations...')

    // Test address validation
    const isValidAddress = wallet._validateAddress(wallet.walletInfo.xecAddress)
    console.log(`Address validation: ${isValidAddress ? '✅' : '❌'}`)

    // Test key derivation
    const keyPair = await wallet.getKeyPair(0)
    console.log(`Key derivation: ${keyPair && keyPair.xecAddress ? '✅' : '❌'}`)

    // Test WIF operations
    const wif = wallet.exportPrivateKeyAsWIF()
    const isValidWIF = wallet.validateWIF(wif)
    console.log(`WIF operations: ${isValidWIF ? '✅' : '❌'}`)

    // Test balance query (will fail without funds, but should not crash)
    try {
      await wallet.getXecBalance()
      console.log('Balance query: ✅')
    } catch (err) {
      console.log(`Balance query: ⚠️ (${err.message})`)
    }

    console.log('\n✅ Basic operations test completed!')
    return true
  } catch (err) {
    console.error(`❌ Basic operations failed: ${err.message}`)
    return false
  }
}

// Main test function
async function runCompatibilityTests () {
  console.log('🚀 Minimal XEC Wallet - Browser Compatibility Test\n')
  console.log('This test checks WebAssembly loading and fallback mechanisms.\n')

  const results = {
    capabilities: null,
    walletInit: null,
    basicOps: null
  }

  try {
    // Test 1: Browser capabilities
    results.capabilities = await testWASMStrategies()

    // Test 2: Wallet initialization
    results.walletInit = await testWalletCompatibility()

    // Test 3: Basic operations (only if wallet init succeeded)
    if (results.walletInit.success) {
      results.basicOps = await testBasicOperations()
    }

    // Final report
    console.log('\n📋 Compatibility Test Summary:')
    console.log('═══════════════════════════════════════════════')
    console.log(`Browser Support: ${results.capabilities.webAssembly ? 'Modern' : 'Legacy'}`)
    console.log(`Wallet Initialization: ${results.walletInit.success ? '✅' : '❌'}`)
    console.log(`Basic Operations: ${results.basicOps ? '✅' : results.walletInit.success ? 'Skipped' : '❌'}`)

    if (results.walletInit.success) {
      console.log(`Initialization Time: ${results.walletInit.initTime}ms`)
      console.log(`WASM Status: ${results.walletInit.wasmResult ? 'Active' : 'Fallback'}`)
    }

    console.log('═══════════════════════════════════════════════')

    if (results.walletInit.success) {
      console.log('\n🎉 SUCCESS: Wallet is compatible with this browser!')
      console.log('You can use all wallet features normally.')
    } else {
      console.log('\n⚠️  WARNING: Wallet initialization failed in this browser.')
      console.log('Please check browser console for detailed error messages.')
    }

    console.log('\n📚 For more info: https://github.com/your-repo/minimal-xec-wallet#browser-compatibility')
  } catch (err) {
    console.error('\n💥 Compatibility test crashed:', err.message)
    console.error('Please report this issue with your browser details.')
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runCompatibilityTests().catch(err => {
    console.error('Test execution failed:', err)
    process.exit(1)
  })
}

module.exports = {
  detectBrowserCapabilities,
  testWASMStrategies,
  testWalletCompatibility,
  testBasicOperations,
  runCompatibilityTests
}
