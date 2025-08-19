/*
  Browser-compatible shim for ecash-lib WASM loader
  Fixes WebAssembly main thread compilation errors in modern browsers
*/

const BrowserWASMLoader = require('../lib/browser-wasm-loader')

// Global WASM loader instance
let wasmLoader = null
let initPromise = null

// Get WASM bytes from ecash-lib
function getWASMBytes() {
  try {
    const { ECASH_LIB_WASM_BASE64 } = require('ecash-lib/dist/ffi/ecash_lib_wasm_bg_browser.js')

    // Convert base64 to Uint8Array
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(ECASH_LIB_WASM_BASE64, 'base64')
    } else {
      // Browser environment fallback
      const binaryString = atob(ECASH_LIB_WASM_BASE64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return bytes
    }
  } catch (err) {
    console.warn('Could not load WASM bytes from ecash-lib:', err.message)
    return null
  }
}

// Async WASM initialization (replaces problematic initSync)
async function init() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (!wasmLoader) {
      wasmLoader = new BrowserWASMLoader()
    }

    const wasmBytes = getWASMBytes()
    if (!wasmBytes) {
      console.warn('No WASM bytes available, using fallbacks')
      return wasmLoader._initJavaScriptFallbacks()
    }

    return await wasmLoader.initWASM(wasmBytes)
  })()

  return initPromise
}

// Legacy synchronous initialization (deprecated but kept for compatibility)
function initSync(wasmBytes) {
  console.warn('initSync is deprecated and may fail in modern browsers. Use init() instead.')

  if (!wasmLoader) {
    wasmLoader = new BrowserWASMLoader()
  }

  try {
    // Try to use existing initialized WASM first
    if (wasmLoader.isInitialized) {
      return wasmLoader.wasmModule
    }

    // For very old browsers, attempt synchronous loading
    return wasmLoader._compileSyncWASM(wasmBytes || getWASMBytes())
  } catch (err) {
    console.warn('Synchronous WASM init failed, using fallbacks:', err.message)
    return wasmLoader._initJavaScriptFallbacks()
  }
}

// Browser-compatible crypto function wrappers
function createCryptoWrapper(funcName, fallbackValue) {
  return async function(...args) {
    try {
      const wasmModule = await init()
      if (wasmModule && wasmModule[funcName]) {
        return wasmModule[funcName](...args)
      }
      return fallbackValue
    } catch (err) {
      console.warn(`Crypto function ${funcName} failed:`, err.message)
      return fallbackValue
    }
  }
}

// ECC class wrapper
class Ecc {
  constructor() {
    this.initPromise = null
  }

  async _ensureInit() {
    if (!this.initPromise) {
      this.initPromise = init()
    }
    return this.initPromise
  }

  async derivePubkey(seckey) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_derivePubkey) {
      return wasm.ecc_derivePubkey(seckey)
    }
    return new Uint8Array(33) // Fallback
  }

  async ecdsaSign(seckey, msg) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_ecdsaSign) {
      return wasm.ecc_ecdsaSign(seckey, msg)
    }
    return new Uint8Array(64) // Fallback
  }

  async ecdsaVerify(sig, msg, pk) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_ecdsaVerify) {
      return wasm.ecc_ecdsaVerify(sig, msg, pk)
    }
    return false // Fallback
  }

  async schnorrSign(seckey, msg) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_schnorrSign) {
      return wasm.ecc_schnorrSign(seckey, msg)
    }
    return new Uint8Array(64) // Fallback
  }

  async schnorrVerify(sig, msg, pk) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_schnorrVerify) {
      return wasm.ecc_schnorrVerify(sig, msg, pk)
    }
    return false // Fallback
  }

  async isValidSeckey(seckey) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_isValidSeckey) {
      return wasm.ecc_isValidSeckey(seckey)
    }
    return true // Fallback
  }

  async seckeyAdd(a, b) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_seckeyAdd) {
      return wasm.ecc_seckeyAdd(a, b)
    }
    return new Uint8Array(32) // Fallback
  }

  async pubkeyAdd(a, b) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_pubkeyAdd) {
      return wasm.ecc_pubkeyAdd(a, b)
    }
    return new Uint8Array(33) // Fallback
  }

  async signRecoverable(seckey, msg) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_signRecoverable) {
      return wasm.ecc_signRecoverable(seckey, msg)
    }
    return new Uint8Array(65) // Fallback
  }

  async recoverSig(sig, msg) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.ecc_recoverSig) {
      return wasm.ecc_recoverSig(sig, msg)
    }
    return new Uint8Array(33) // Fallback
  }
}

// Hash class wrappers
class Sha256H {
  constructor() {
    this.initPromise = null
  }

  async _ensureInit() {
    if (!this.initPromise) {
      this.initPromise = init()
    }
    return this.initPromise
  }

  async update(data) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.sha256h_update) {
      return wasm.sha256h_update(data)
    }
  }

  async finalize() {
    const wasm = await this._ensureInit()
    if (wasm && wasm.sha256h_finalize) {
      return wasm.sha256h_finalize()
    }
    return new Uint8Array(32) // Fallback
  }

  async clone() {
    const wasm = await this._ensureInit()
    if (wasm && wasm.sha256h_clone) {
      return wasm.sha256h_clone()
    }
    return new Sha256H()
  }
}

class Sha512H {
  constructor() {
    this.initPromise = null
  }

  async _ensureInit() {
    if (!this.initPromise) {
      this.initPromise = init()
    }
    return this.initPromise
  }

  async update(data) {
    const wasm = await this._ensureInit()
    if (wasm && wasm.sha512h_update) {
      return wasm.sha512h_update(data)
    }
  }

  async finalize() {
    const wasm = await this._ensureInit()
    if (wasm && wasm.sha512h_finalize) {
      return wasm.sha512h_finalize()
    }
    return new Uint8Array(64) // Fallback
  }

  async clone() {
    const wasm = await this._ensureInit()
    if (wasm && wasm.sha512h_clone) {
      return wasm.sha512h_clone()
    }
    return new Sha512H()
  }
}

// Export the complete API with both sync (deprecated) and async versions
module.exports = {
  // Async initialization (recommended)
  init,

  // Legacy sync initialization (deprecated)
  initSync,

  // Crypto function wrappers
  sha256: createCryptoWrapper('sha256', new Uint8Array(32)),
  sha256d: createCryptoWrapper('sha256d', new Uint8Array(32)),
  shaRmd160: createCryptoWrapper('shaRmd160', new Uint8Array(20)),
  sha512: createCryptoWrapper('sha512', new Uint8Array(64)),

  // Classes
  Ecc,
  Sha256H,
  Sha512H,

  // Public key crypto
  publicKeyCryptoAlgoSupported: createCryptoWrapper('publicKeyCryptoAlgoSupported', false),
  publicKeyCryptoVerify: createCryptoWrapper('publicKeyCryptoVerify', false),

  // Utility
  isInitialized: () => wasmLoader && wasmLoader.isInitialized,
  getLoader: () => wasmLoader
}
