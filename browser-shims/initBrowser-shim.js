/**
 * Pure-JS replacement for ecash-lib's initBrowser.js
 *
 * The original initBrowser.js calls ffi.initSync(wasmRaw) which uses
 * new WebAssembly.Module(1.2MB buffer) synchronously — blocked by modern
 * Chrome on the main thread for buffers > 4KB, crashing the UMD factory.
 *
 * This shim provides the same crypto via @noble/curves + @noble/hashes,
 * which are pure JS and work synchronously in all browsers.
 */
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { sha256 as nobleSha256, sha512 as nobleSha512 } from '@noble/hashes/sha2'
import { ripemd160 } from '@noble/hashes/ripemd160'
import { hmac } from '@noble/hashes/hmac'
import { concatBytes } from '@noble/hashes/utils'
import { __setEcc } from 'ecash-lib/dist/ecc.js'
import { __setHashes } from 'ecash-lib/dist/hash.js'
import { __setPkc } from 'ecash-lib/dist/publicKeyCrypto.js'

// --- Curve order for scalar arithmetic ---
const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141')

function bytesToBigInt (bytes) {
  let result = BigInt(0)
  for (let i = 0; i < bytes.length; i++) {
    result = (result << BigInt(8)) | BigInt(bytes[i])
  }
  return result
}

function bigIntToBytes (n, len) {
  const bytes = new Uint8Array(len)
  for (let i = len - 1; i >= 0; i--) {
    bytes[i] = Number(n & BigInt(0xff))
    n >>= BigInt(8)
  }
  return bytes
}

function mod (a, m) {
  const result = a % m
  return result >= BigInt(0) ? result : result + m
}

// --- BCH Schnorr helpers ---
const P = BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f')

function modPow (base, exp, m) {
  base = base % m
  let result = 1n
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % m
    base = (base * base) % m
    exp >>= 1n
  }
  return result
}

function isQuadResidue (y) {
  return modPow(y, (P - 1n) / 2n, P) === 1n
}

// RFC 6979 deterministic k via HMAC-DRBG (simplified for 32-byte output)
function rfc6979k (seckey, msg, algo16) {
  const seed = concatBytes(seckey, msg, algo16)
  // HMAC-DRBG per RFC 6979 section 3.2
  let v = new Uint8Array(32).fill(0x01)
  let k = new Uint8Array(32).fill(0x00)
  const hmacFn = (key, data) => hmac(nobleSha256, key, data)
  k = hmacFn(k, concatBytes(v, new Uint8Array([0x00]), seed))
  v = hmacFn(k, v)
  k = hmacFn(k, concatBytes(v, new Uint8Array([0x01]), seed))
  v = hmacFn(k, v)
  for (;;) {
    v = hmacFn(k, v)
    const candidate = bytesToBigInt(v)
    if (candidate > 0n && candidate < N) return candidate
    k = hmacFn(k, concatBytes(v, new Uint8Array([0x00])))
    v = hmacFn(k, v)
  }
}

// --- Ecc implementation backed by @noble/curves/secp256k1 ---
class NobleEcc {
  derivePubkey (seckey) {
    return secp256k1.getPublicKey(seckey, true)
  }

  ecdsaSign (seckey, msg) {
    const sig = secp256k1.sign(msg, seckey, { lowS: true, prehash: false })
    return sig.toDERRawBytes()
  }

  ecdsaVerify (sig, msg, pk) {
    const valid = secp256k1.verify(sig, msg, pk, { lowS: true, prehash: false })
    if (!valid) {
      throw new Error('ECDSA signature verification failed')
    }
  }

  schnorrSign (seckey, msg) {
    // BCH Schnorr: RFC 6979 nonce with algo16 = "Schnorr+SHA256  " (16 bytes)
    const algo16 = new Uint8Array([
      0x53, 0x63, 0x68, 0x6e, 0x6f, 0x72, 0x72, 0x2b,
      0x53, 0x48, 0x41, 0x32, 0x35, 0x36, 0x20, 0x20
    ])
    const k = rfc6979k(seckey, msg, algo16)

    // R = k * G
    const R = secp256k1.Point.BASE.multiply(k)
    const Raff = R.toAffine()

    // If jacobi(R.y) != 1, negate k
    const kPrime = isQuadResidue(Raff.y) ? k : N - k

    // r = R.x (32 bytes big-endian)
    const r = bigIntToBytes(Raff.x, 32)

    // Compressed pubkey (33 bytes)
    const pk = secp256k1.getPublicKey(seckey, true)

    // e = SHA256(r || pk || msg) mod n — BCH Schnorr challenge hash
    const eHash = nobleSha256(concatBytes(r, pk, msg))
    const e = mod(bytesToBigInt(eHash), N)

    // s = (kPrime + e * d) mod n
    const d = bytesToBigInt(seckey)
    const s = mod(kPrime + e * d, N)

    // Return r || s (64 bytes)
    const sig = new Uint8Array(64)
    sig.set(r, 0)
    sig.set(bigIntToBytes(s, 32), 32)
    return sig
  }

  schnorrVerify (sig, msg, pk) {
    const r = bytesToBigInt(sig.slice(0, 32))
    const s = bytesToBigInt(sig.slice(32, 64))
    if (r >= P || s >= N) throw new Error('Schnorr signature verification failed')

    // Ensure compressed pubkey for hash (BCH Schnorr spec)
    const compressedPk = pk.length === 33
      ? pk
      : secp256k1.Point.fromHex(pk).toRawBytes(true)

    // e = SHA256(r || pk || msg) mod n
    const eHash = nobleSha256(concatBytes(sig.slice(0, 32), compressedPk, msg))
    const e = mod(bytesToBigInt(eHash), N)

    // R' = sG - eP
    const Ppoint = secp256k1.Point.fromHex(pk)
    const Rprime = secp256k1.Point.BASE.multiply(s)
      .add(Ppoint.negate().multiply(e))

    // Fail if R' is infinity
    if (Rprime.equals(secp256k1.Point.ZERO)) {
      throw new Error('Schnorr signature verification failed')
    }

    const Raff = Rprime.toAffine()

    // Fail if R'.x != r
    if (Raff.x !== r) throw new Error('Schnorr signature verification failed')

    // Fail if jacobi(R'.y) != 1
    if (!isQuadResidue(Raff.y)) throw new Error('Schnorr signature verification failed')
  }

  isValidSeckey (seckey) {
    try {
      if (seckey.length !== 32) return false
      const n = bytesToBigInt(seckey)
      return n > BigInt(0) && n < N
    } catch (_) {
      return false
    }
  }

  seckeyAdd (a, b) {
    const sum = mod(bytesToBigInt(a) + bytesToBigInt(b), N)
    return bigIntToBytes(sum, 32)
  }

  pubkeyAdd (a, b) {
    const pointA = secp256k1.Point.fromHex(a)
    const pointB = secp256k1.Point.fromHex(b)
    const sum = pointA.add(pointB)
    return sum.toRawBytes(true)
  }

  signRecoverable (seckey, msg) {
    return secp256k1.sign(msg, seckey, { lowS: true, prehash: false, format: 'recovered' })
  }

  recoverSig (sig, msg) {
    return secp256k1.recoverPublicKey(sig, msg, { prehash: false })
  }
}

// --- Hash functions ---
function sha256 (data) {
  return nobleSha256(data)
}

function sha256d (data) {
  return nobleSha256(nobleSha256(data))
}

function shaRmd160 (data) {
  return ripemd160(nobleSha256(data))
}

function sha512 (data) {
  return nobleSha512(data)
}

// --- Streaming hasher classes ---
class Sha256H {
  constructor () {
    this._hasher = nobleSha256.create()
  }

  update (data) {
    this._hasher.update(data)
  }

  finalize () {
    return this._hasher.clone().digest()
  }

  clone () {
    const c = new Sha256H()
    c._hasher = this._hasher.clone()
    return c
  }

  free () {}
}

class Sha512H {
  constructor () {
    this._hasher = nobleSha512.create()
  }

  update (data) {
    this._hasher.update(data)
  }

  finalize () {
    return this._hasher.clone().digest()
  }

  clone () {
    const c = new Sha512H()
    c._hasher = this._hasher.clone()
    return c
  }

  free () {}
}

// --- PKC stub (not needed for wallet operations) ---
function pkcAlgoSupported (_algoOid, _params) {
  throw new Error('Public key crypto not available in browser shim')
}

function pkcVerify (_algoOid, _params, _sig, _msg, _pk) {
  throw new Error('Public key crypto not available in browser shim')
}

// --- Wire everything up ---
__setEcc(new NobleEcc())
__setHashes({
  sha256,
  sha256d,
  shaRmd160,
  sha512,
  Sha256H,
  Sha512H
})
__setPkc({
  algoSupported: pkcAlgoSupported,
  verify: pkcVerify
})
