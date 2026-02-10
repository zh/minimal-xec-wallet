/**
 * Browser shim for `create-hash` backed by @noble/hashes.
 *
 * Eliminates the hash-base → readable-stream → process.version.slice
 * crash chain by replacing the Node.js stream-based create-hash with
 * pure-JS @noble/hashes implementations.
 *
 * Supports the streaming .update(data).digest(encoding?) pattern used
 * in lib/key-derivation.js.
 */
const { sha256 } = require('@noble/hashes/sha256')
const { sha512 } = require('@noble/hashes/sha512')
const { ripemd160 } = require('@noble/hashes/ripemd160')
const { Buffer } = require('buffer')

const ALGOS = {
  sha256,
  sha512,
  ripemd160
}

class Hash {
  constructor (hasher) {
    this._hasher = hasher
  }

  update (data) {
    if (typeof data === 'string') {
      data = Buffer.from(data, 'utf8')
    }
    this._hasher.update(data)
    return this
  }

  digest (encoding) {
    const result = this._hasher.digest()
    const buf = Buffer.from(result)
    if (encoding === 'hex') return buf.toString('hex')
    if (encoding === 'base64') return buf.toString('base64')
    return buf
  }
}

function createHash (algorithm) {
  const algo = algorithm.toLowerCase()
  const hashFn = ALGOS[algo]
  if (!hashFn) {
    throw new Error('Unsupported hash algorithm: ' + algorithm)
  }
  return new Hash(hashFn.create())
}

module.exports = createHash
