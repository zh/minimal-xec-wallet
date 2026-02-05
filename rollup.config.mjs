import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import terser from '@rollup/plugin-terser'

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
    replace({
      preventAssignment: true,
      values: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.TEST': JSON.stringify('')
      }
    }),
    nodePolyfills({
      include: ['buffer', 'process', 'crypto', 'stream', 'util']
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
    if (warning.code === 'EVAL') return // Suppress eval warning from @protobufjs/inquire
    warn(warning)
  }
}
