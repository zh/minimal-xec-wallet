/*
  The browser bundle swaps ecash-lib's WASM for browser-shims/initBrowser-shim.js.
  Its message signatures must interoperate with the WASM (Node) build.
  Runs in a child process so the shim does not replace the WASM Ecc for other tests.
*/

const assert = require('chai').assert
const { execFileSync } = require('child_process')
const path = require('path')

// Signed by the WASM build: 'abandon ... about' mnemonic, m/44'/899'/0'/0/0
const ADDR = 'ecash:qpluxjhhlxfjwsymf9nmctvsdrwzwygadsh2pq0ang'
const WASM_SIG = 'HxqaIW4MpjBDE7udw6kYuKszQiaO/iBee2S6UbvmzxBuCSqB+4hacCzvv1CLvzyXYzcDe+0e+Qol2RItJdn8qHk='

describe('#browser-shim', () => {
  it('signs and verifies messages compatibly with the WASM build', function () {
    this.timeout(20000)
    const shim = path.resolve(__dirname, '../../browser-shims/initBrowser-shim.js')
    const script = `
      import { signMsg, verifyMsg, fromHex } from 'ecash-lib'
      import KeyDerivation from '${path.resolve(__dirname, '../../lib/key-derivation.js')}'
      const kd = new KeyDerivation()
      const sk = kd.deriveFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about').privateKey
      await import('${shim}')
      const sig = signMsg('hello ecash', fromHex(sk))
      console.log(JSON.stringify({
        header: Buffer.from(sig, 'base64')[0],
        ownOk: verifyMsg('hello ecash', sig, '${ADDR}'),
        wasmOk: verifyMsg('hello ecash', '${WASM_SIG}', '${ADDR}'),
        wrongMsg: verifyMsg('other', sig, '${ADDR}')
      }))
    `
    const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }))
    assert.oneOf(out.header, [31, 32])
    assert.isTrue(out.ownOk)
    assert.isTrue(out.wasmOk)
    assert.isFalse(out.wrongMsg)
  })
})
