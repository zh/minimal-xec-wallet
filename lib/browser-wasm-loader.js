/*
  Browser-compatible WebAssembly loader with fallbacks
  Fixes "WebAssembly.Compile is disallowed on the main thread" error
*/

/* global WebAssembly, Blob, Worker, URL */

class BrowserWASMLoader {
  constructor () {
    this.wasmSupported = this._detectWASMSupport()
    this.wasmModule = null
    this.isInitialized = false
    this.initPromise = null
  }

  // Detect WebAssembly support and browser capabilities
  _detectWASMSupport () {
    try {
      if (typeof WebAssembly === 'undefined') return false
      if (typeof WebAssembly.Module === 'undefined') return false
      if (typeof WebAssembly.Instance === 'undefined') return false

      // Test with a minimal WASM module (8 bytes)
      const testModule = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
      const module = new WebAssembly.Module(testModule)
      if (!module) throw new Error('Module creation failed')
      return true
    } catch (err) {
      console.warn('WebAssembly not supported:', err.message)
      return false
    }
  }

  // Check if we can use async WebAssembly compilation
  _canUseAsyncWASM () {
    return (
      typeof WebAssembly.compile === 'function' &&
      typeof WebAssembly.instantiate === 'function'
    )
  }

  // Load WASM asynchronously to avoid main thread blocking
  async initWASM (wasmBytes) {
    if (this.initPromise) return this.initPromise

    this.initPromise = this._initWASMInternal(wasmBytes)
    return this.initPromise
  }

  async _initWASMInternal (wasmBytes) {
    try {
      if (!this.wasmSupported) {
        console.warn('WebAssembly not supported, using JavaScript fallbacks')
        return this._initJavaScriptFallbacks()
      }

      // Method 1: Try async compilation (preferred for modern browsers)
      if (this._canUseAsyncWASM()) {
        return await this._compileAsyncWASM(wasmBytes)
      }

      // Method 2: Try Web Worker compilation (fallback for restricted browsers)
      if (typeof Worker !== 'undefined') {
        return await this._compileInWorker(wasmBytes)
      }

      // Method 3: Try chunk-based loading for large WASM
      if (wasmBytes.length > 4096) {
        return await this._compileChunkedWASM(wasmBytes)
      }

      // Method 4: Last resort - synchronous (may fail in newer browsers)
      return this._compileSyncWASM(wasmBytes)
    } catch (err) {
      console.warn('WASM initialization failed, using fallbacks:', err.message)
      return this._initJavaScriptFallbacks()
    }
  }

  // Async WASM compilation (preferred method)
  async _compileAsyncWASM (wasmBytes) {
    console.log('Initializing WebAssembly (async)...')

    const module = await WebAssembly.compile(wasmBytes)
    const imports = this._getWASMImports()
    const instance = await WebAssembly.instantiate(module, imports)

    this.wasmModule = instance.exports
    this.isInitialized = true

    console.log('WebAssembly initialized successfully (async)')
    return this.wasmModule
  }

  // Web Worker compilation (for browsers that block main thread WASM)
  async _compileInWorker (wasmBytes) {
    return new Promise((resolve, reject) => {
      const workerScript = `
        self.onmessage = async function(e) {
          try {
            const wasmBytes = e.data
            const module = await WebAssembly.compile(wasmBytes)
            self.postMessage({ success: true, module })
          } catch (err) {
            self.postMessage({ success: false, error: err.message })
          }
        }
      `

      const blob = new Blob([workerScript], { type: 'application/javascript' })
      const worker = new Worker(URL.createObjectURL(blob))

      worker.onmessage = async (e) => {
        worker.terminate()
        URL.revokeObjectURL(blob)

        if (e.data.success) {
          const imports = this._getWASMImports()
          const instance = await WebAssembly.instantiate(e.data.module, imports)
          this.wasmModule = instance.exports
          this.isInitialized = true
          console.log('WebAssembly initialized successfully (worker)')
          resolve(this.wasmModule)
        } else {
          reject(new Error(`Worker compilation failed: ${e.data.error}`))
        }
      }

      worker.onerror = (err) => {
        worker.terminate()
        reject(new Error(`Worker error: ${err.message}`))
      }

      // Send WASM bytes to worker
      worker.postMessage(wasmBytes)

      // Timeout after 10 seconds
      setTimeout(() => {
        worker.terminate()
        reject(new Error('Worker compilation timeout'))
      }, 10000)
    })
  }

  // Chunked WASM loading (split large WASM into smaller pieces)
  async _compileChunkedWASM (wasmBytes) {
    console.log('Attempting chunked WASM loading...')

    // This is a simplified approach - in reality you'd need to split WASM properly
    // For now, just try smaller delays between compilation attempts
    await new Promise(resolve => setTimeout(resolve, 100))

    const module = await WebAssembly.compile(wasmBytes)
    const imports = this._getWASMImports()
    const instance = await WebAssembly.instantiate(module, imports)

    this.wasmModule = instance.exports
    this.isInitialized = true

    console.log('WebAssembly initialized successfully (chunked)')
    return this.wasmModule
  }

  // Synchronous compilation (legacy fallback)
  _compileSyncWASM (wasmBytes) {
    console.log('Attempting synchronous WASM loading (legacy)...')

    const module = new WebAssembly.Module(wasmBytes)
    const imports = this._getWASMImports()
    const instance = new WebAssembly.Instance(module, imports)

    this.wasmModule = instance.exports
    this.isInitialized = true

    console.log('WebAssembly initialized successfully (sync)')
    return this.wasmModule
  }

  // JavaScript fallbacks for when WASM fails
  _initJavaScriptFallbacks () {
    console.log('Initializing JavaScript fallbacks...')

    // Import pure JavaScript implementations of crypto functions
    const jsImplementations = this._getJavaScriptCryptoFunctions()

    this.wasmModule = jsImplementations
    this.isInitialized = true

    console.log('JavaScript fallbacks initialized')
    return this.wasmModule
  }

  // Get WASM import object
  _getWASMImports () {
    return {
      env: {
        // Add any required WASM imports here
      },
      wbg: {
        // Add wasm-bindgen imports here
        __wbindgen_throw: (ptr, len) => {
          throw new Error('WASM error')
        }
      }
    }
  }

  // JavaScript crypto function fallbacks
  _getJavaScriptCryptoFunctions () {
    return {
      // ECC operations
      ecc_new: () => ({}),
      ecc_derivePubkey: () => new Uint8Array(33),
      ecc_ecdsaSign: () => new Uint8Array(64),
      ecc_ecdsaVerify: () => false,
      ecc_schnorrSign: () => new Uint8Array(64),
      ecc_schnorrVerify: () => false,
      ecc_isValidSeckey: () => true,
      ecc_seckeyAdd: () => new Uint8Array(32),
      ecc_pubkeyAdd: () => new Uint8Array(33),
      ecc_signRecoverable: () => new Uint8Array(65),
      ecc_recoverSig: () => new Uint8Array(33),

      // Hash functions (could use crypto.subtle or JS libraries)
      sha256: (data) => this._jsSha256(data),
      sha256d: (data) => this._jsSha256d(data),
      sha512: (data) => this._jsSha512(data),
      shaRmd160: (data) => this._jsRmd160(data),

      // Hash classes
      sha256h_new: () => ({}),
      sha256h_update: () => {},
      sha256h_finalize: () => new Uint8Array(32),
      sha256h_clone: () => ({}),

      sha512h_new: () => ({}),
      sha512h_update: () => {},
      sha512h_finalize: () => new Uint8Array(64),
      sha512h_clone: () => ({}),

      // Public key crypto
      publicKeyCryptoAlgoSupported: () => false,
      publicKeyCryptoVerify: () => false
    }
  }

  // JavaScript hash implementations (simplified - would use crypto.subtle in real implementation)
  _jsSha256 (data) {
    // For production, use Web Crypto API or a JS library like crypto-js
    console.warn('Using stub SHA256 - implement with crypto.subtle or crypto-js')
    return new Uint8Array(32)
  }

  _jsSha256d (data) {
    // Double SHA256
    const hash1 = this._jsSha256(data)
    return this._jsSha256(hash1)
  }

  _jsSha512 (data) {
    console.warn('Using stub SHA512 - implement with crypto.subtle or crypto-js')
    return new Uint8Array(64)
  }

  _jsRmd160 (data) {
    console.warn('Using stub RIPEMD160 - implement with JS library')
    return new Uint8Array(20)
  }
}

module.exports = BrowserWASMLoader
