import { fileURLToPath } from 'url'
import path from 'path'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import terser from '@rollup/plugin-terser'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
  input: 'index.js',
  output: [
    {
      file: 'dist/minimal-xec-wallet.js',
      format: 'umd',
      name: 'MinimalXecWallet',
      sourcemap: false,
      exports: 'auto'
    },
    {
      file: 'dist/minimal-xec-wallet.min.js',
      format: 'umd',
      name: 'MinimalXecWallet',
      sourcemap: false,
      exports: 'auto',
      plugins: [terser({
        compress: { drop_console: false, drop_debugger: true },
        mangle: { reserved: ['MinimalXecWallet', 'MinimalXECWallet'] }
      })]
    },
    {
      file: 'dist/minimal-xec-wallet.esm.js',
      format: 'es',
      sourcemap: false
    }
  ],
  plugins: [
    {
      name: 'ecash-lib-init-shim',
      resolveId (source, importer) {
        // Redirect initBrowser.js to our pure-JS shim
        if (
          importer &&
          importer.includes('ecash-lib') &&
          (source === './initBrowser.js' || source.endsWith('/initBrowser.js'))
        ) {
          return path.resolve(__dirname, 'browser-shims/initBrowser-shim.js')
        }
        // Prevent the 1.2MB WASM base64 blob from being bundled
        if (
          source.includes('ecash_lib_wasm_browser') ||
          source.includes('ecash_lib_wasm_bg_browser')
        ) {
          return '\0ecash-wasm-noop'
        }
        // Redirect create-hash to our stream-free shim
        if (source === 'create-hash' || source === 'create-hash/browser') {
          return path.resolve(__dirname, 'browser-shims/create-hash-shim.js')
        }
        // Redirect create-hmac to our stream-free shim
        if (source === 'create-hmac' || source === 'create-hmac/browser') {
          return path.resolve(__dirname, 'browser-shims/create-hmac-shim.js')
        }
        return null
      },
      load (id) {
        if (id === '\0ecash-wasm-noop') {
          return 'export default {}; export var ECASH_LIB_WASM_BASE64 = "";'
        }
        return null
      }
    },
    replace({
      preventAssignment: true,
      values: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.TEST': JSON.stringify('')
      }
    }),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util']
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
      mainFields: ['browser', 'module', 'main']
    }),
    commonjs({
      transformMixedEsModules: true,
      requireReturnsDefault: 'auto'
    }),
    json()
  ],
  onwarn (warning, warn) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') return
    if (warning.code === 'EVAL') return
    warn(warning)
  }
}
