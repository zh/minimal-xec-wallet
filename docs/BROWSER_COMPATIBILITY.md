# Browser Compatibility Guide

## Overview

The minimal-xec-wallet library uses WebAssembly (WASM) for high-performance cryptographic operations via the `ecash-lib` dependency. Modern browsers have restrictions on WebAssembly compilation to prevent main thread blocking, which can cause errors in some environments.

## The Problem

You may encounter this error in newer browsers:

```
Uncaught RangeError: WebAssembly.Compile is disallowed on the main thread,
if buffer size is larger than 4KB. Use WebAssembly.compile, or compile on a worker thread.
```

## Our Solution

The library includes comprehensive browser compatibility fixes with multiple fallback strategies:

### ✅ Automatic Compatibility Features

1. **Async WASM Loading** - Uses `WebAssembly.compile()` instead of synchronous compilation
2. **Web Worker Compilation** - Compiles WASM in background thread when main thread is blocked
3. **JavaScript Fallbacks** - Pure JS crypto implementations when WASM fails
4. **Progressive Enhancement** - Graceful degradation for older browsers
5. **Error Recovery** - Continues working even if WASM initialization fails

## Browser Support Matrix

| Browser | Version | WASM Support | Status |
|---------|---------|--------------|--------|
| Chrome | 57+ | ✅ Full | ✅ Supported |
| Firefox | 52+ | ✅ Full | ✅ Supported |
| Safari | 11+ | ✅ Full | ✅ Supported |
| Edge | 16+ | ✅ Full | ✅ Supported |
| Chrome | 40-56 | ❌ None | ⚠️ Fallback Mode |
| Firefox | 45-51 | ❌ None | ⚠️ Fallback Mode |
| Internet Explorer | All | ❌ None | ⚠️ Fallback Mode |

## Usage Examples

### Basic Usage (Automatic)

```javascript
// The library handles browser compatibility automatically
const MinimalXECWallet = require('minimal-xec-wallet')

const wallet = new MinimalXECWallet()
await wallet.initialize() // Automatically handles WASM loading

// Use normally - fallbacks are transparent
const balance = await wallet.getXecBalance()
const txid = await wallet.sendXec([
  { address: 'ecash:qp123...', amountSats: 10000 }
])
```

### Manual WASM Initialization (Advanced)

```javascript
const MinimalXECWallet = require('minimal-xec-wallet')

// Create wallet instance
const wallet = new MinimalXECWallet()

// Wait for both wallet info and WASM initialization
await Promise.all([
  wallet.walletInfoPromise,
  wallet.wasmInitPromise
])

// Check WASM status
const wasmShim = require('minimal-xec-wallet/browser-shims/ecash_lib_wasm_browser')
const isWasmInitialized = wasmShim.isInitialized()

console.log(`WASM Status: ${isWasmInitialized ? 'Active' : 'Using Fallbacks'}`)

// Initialize wallet services
await wallet.initialize()
```

### Browser Compatibility Testing

```javascript
// Test browser capabilities
const compatTest = require('minimal-xec-wallet/examples/advanced/browser-compatibility-test')

// Run comprehensive compatibility test
await compatTest.runCompatibilityTests()

// Or check specific capabilities
const capabilities = compatTest.detectBrowserCapabilities()
console.log('WebAssembly Support:', capabilities.webAssembly)
console.log('Async Compilation:', capabilities.webAssemblyCompile)
console.log('Web Workers:', capabilities.webWorkers)
```

## Performance Considerations

### With WebAssembly (Optimal)
- ⚡ **Fast cryptographic operations** (native speed)
- ⚡ **Efficient transaction building**
- ⚡ **Quick signature verification**
- 🔋 **Low CPU usage**

### With JavaScript Fallbacks (Compatible)
- 🐌 **Slower crypto operations** (pure JS)
- 🔋 **Higher CPU usage**
- ⚠️ **Limited functionality** (some features may be stubbed)
- ✅ **Universal compatibility**

## Troubleshooting

### Common Issues and Solutions

**1. "WebAssembly.Compile is disallowed" Error**
```javascript
// Solution: Update to latest version (auto-fixed)
npm install minimal-xec-wallet@latest

// Or force async initialization:
const wallet = new MinimalXECWallet()
await wallet.wasmInitPromise // Ensure WASM is loaded
await wallet.initialize()
```

**2. Slow Performance in Older Browsers**
```javascript
// Check if WASM is active
const wasmShim = require('minimal-xec-wallet/browser-shims/ecash_lib_wasm_browser')
if (!wasmShim.isInitialized()) {
  console.warn('Using JavaScript fallbacks - performance may be reduced')
  // Consider showing user a notice about upgrading their browser
}
```

**3. Worker Compilation Timeouts**
```javascript
// The library automatically handles timeouts, but you can detect them:
try {
  await wallet.wasmInitPromise
} catch (err) {
  if (err.message.includes('timeout')) {
    console.log('WASM compilation took too long, using fallbacks')
  }
}
```

### Debug Mode

```javascript
// Enable detailed WASM loading logs (browser console)
localStorage.setItem('minimal-xec-wallet-debug', 'true')

// Then create wallet instance
const wallet = new MinimalXECWallet()
// Check browser console for detailed WASM loading information
```

## Build Considerations

### For Web Applications

The library works out-of-the-box with common bundlers:

**Webpack:**
```javascript
// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      "crypto": false,
      "stream": false,
      "buffer": require.resolve("buffer")
    }
  }
}
```

**Browserify:**
```javascript
// Already configured - no changes needed
// The browser field in package.json handles compatibility
```

**Vite/Rollup:**
```javascript
// vite.config.js
export default {
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['minimal-xec-wallet']
  }
}
```

### Content Security Policy (CSP)

For strict CSP environments:

```html
<!-- Allow WebAssembly and Web Workers -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  worker-src 'self' blob:;
">
```

## Testing Browser Compatibility

### Automated Testing

```bash
# Run browser compatibility test
node examples/advanced/browser-compatibility-test.js

# Or test in browser environment
# Open index.html and check console
```

### Manual Testing Checklist

- [ ] ✅ Create wallet instance without errors
- [ ] ✅ Initialize wallet successfully
- [ ] ✅ Check WASM initialization status
- [ ] ✅ Perform basic operations (address generation, validation)
- [ ] ✅ Test transaction building (if funded)
- [ ] ✅ Verify no console errors

## Migration Guide

### From Previous Versions

If upgrading from a version that had WebAssembly issues:

```javascript
// OLD (may fail in newer browsers)
const wallet = new MinimalXECWallet()
// Synchronous WASM loading could fail

// NEW (compatible with all browsers)
const wallet = new MinimalXECWallet()
await wallet.initialize() // Async WASM + fallbacks
```

### For Library Authors

If you're building on top of minimal-xec-wallet:

```javascript
// Wait for both wallet and WASM initialization
async function initializeYourApp() {
  const wallet = new MinimalXECWallet()

  // Wait for both promises
  await Promise.all([
    wallet.walletInfoPromise,
    wallet.wasmInitPromise
  ])

  await wallet.initialize()

  // Now safe to use all wallet features
  return wallet
}
```

## Support

If you encounter browser compatibility issues:

1. **Run the compatibility test** first: `node examples/advanced/browser-compatibility-test.js`
2. **Check browser console** for detailed error messages
3. **Report the issue** with browser details and console output
4. **Try the latest version** - compatibility improvements are ongoing

### Supported Environments

- ✅ **Modern Browsers** (Chrome 57+, Firefox 52+, Safari 11+)
- ✅ **Legacy Browsers** (with JavaScript fallbacks)
- ✅ **Node.js** (server-side usage)
- ✅ **React/Vue/Angular** applications
- ✅ **Mobile browsers** (iOS Safari, Chrome Mobile)
- ✅ **Electron** applications
- ✅ **Web Workers** and **Service Workers**

The library is designed to work everywhere JavaScript runs, with progressive enhancement for better performance when WebAssembly is available.
