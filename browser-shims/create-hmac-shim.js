/**
 * Browser shim for `create-hmac` backed by @noble/hashes/hmac.
 *
 * Eliminates the cipher-base → stream.Transform → readable-stream →
 * process.version.slice crash chain by replacing the Node.js stream-based
 * create-hmac with pure-JS @noble/hashes implementation.
 *
 * Supports the streaming .update(data).digest(encoding?) pattern used
 * in lib/key-derivation.js for BIP32 key derivation.
 */
const { hmac: nobleHmac } = require('@noble/hashes/hmac')
const { sha256 } = require('@noble/hashes/sha256')
const { sha512 } = require('@noble/hashes/sha512')
const { Buffer } = require('buffer')

const ALGOS = {
  sha256,
  sha512
}

class Hmac {
  constructor (hashFn, key) {
    this._hashFn = hashFn
    this._key = key
    this._data = []
  }

  update (data) {
    if (typeof data === 'string') {
      data = Buffer.from(data, 'utf8')
    }
    this._data.push(data)
    return this
  }

  digest (encoding) {
    const combined = Buffer.concat(this._data)
    const result = nobleHmac(this._hashFn, this._key, combined)
    const buf = Buffer.from(result)
    if (encoding === 'hex') return buf.toString('hex')
    if (encoding === 'base64') return buf.toString('base64')
    return buf
  }
}

function createHmac (algorithm, key) {
  const algo = algorithm.toLowerCase()
  const hashFn = ALGOS[algo]
  if (!hashFn) {
    throw new Error('Unsupported HMAC algorithm: ' + algorithm)
  }
  if (typeof key === 'string') {
    key = Buffer.from(key, 'utf8')
  }
  return new Hmac(hashFn, key)
}

module.exports = createHmac
