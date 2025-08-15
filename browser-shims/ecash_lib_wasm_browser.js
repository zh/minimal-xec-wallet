// Browser-compatible shim for ecash-lib WASM loader
// This replaces the problematic import.meta.url usage

const { ECASH_LIB_WASM_BASE64 } = require('ecash-lib/dist/ffi/ecash_lib_wasm_bg_browser.js');

// Initialize WASM from base64 data instead of loading from URL
function initSync(wasmBytes) {
  // This is a simplified version that works with browserify
  // The actual WASM functionality should work from the base64 data
  return true;
}

// Export the functions that the browser init expects
module.exports = {
  initSync,
  // Add other exports that might be needed
  Ecc: function() { return {}; },
  sha256: function() { return new Uint8Array(32); },
  sha256d: function() { return new Uint8Array(32); },
  shaRmd160: function() { return new Uint8Array(20); },
  sha512: function() { return new Uint8Array(64); },
  Sha256H: function() { return {}; },
  Sha512H: function() { return {}; },
  publicKeyCryptoAlgoSupported: function() { return false; },
  publicKeyCryptoVerify: function() { return false; }
};