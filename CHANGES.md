# Changelog

## [2.2.3] - 2025-02-10

### Fixed

#### Message Signing BigInt Error (CRITICAL)

Fixed `signMessage()` crashing in the browser with `Cannot mix BigInt and other types, use explicit conversions`.

**The Problem:**
The `signRecoverable` method in `initBrowser-shim.js` called `secp256k1.sign()` and accessed `.r`, `.s`, `.recovery` on the result. But `@noble/curves` v2 `sign()` returns a `Uint8Array`, not a Signature object. Accessing `.r` on a Uint8Array yields `undefined`, and `bigIntToBytes(undefined, 32)` triggers the BigInt TypeError.

The same issue affected `recoverSig()` which manually reconstructed a Signature via `new Signature(r, s, recoveryId)` — functional but unnecessarily complex.

**The Fix:**
- `signRecoverable`: use `format: 'recovered'` option which makes `sign()` return the 65-byte `[recovery_id, r(32), s(32)]` format directly
- `recoverSig`: use `secp256k1.recoverPublicKey(sig, msg)` which natively parses the recovered format and returns compressed public key bytes

**Note:** The CLI wallet was unaffected because it runs in Node.js where ecash-lib uses native WASM — the browser shim is never invoked.

### Files Updated
- `browser-shims/initBrowser-shim.js` — Fix signRecoverable and recoverSig for noble curves v2 API

## [2.2.2] - 2025-02-10

### Added

#### Message Signing & Verification
New public API methods for the eCash message signing protocol (compatible with ecash-lib's `signMsg`/`verifyMsg`):

- `signMessage(msg)` — Sign a message with the wallet's private key, returns base64 signature
- `verifyMessage(msg, signature, address)` — Verify a message signature against an address, returns boolean
- `_magicHash(msg)` (static) — Internal: compute sha256d of prefixed message (`"\x16eCash Signed Message:\n" + varint(len) + msg`)

These methods use the already-shimmed pure-JS crypto (via `@noble/curves`) and work in both Node.js and browser environments without WASM.

**New test file:** `test/unit/a15-sign-verify-message-unit.js` — 15 unit tests covering validation, happy paths, and edge cases

**New example:** `examples/key-management/sign-verify-message.js` — Demonstrates sign + verify round-trip

### Fixed
- Removed stray `console.error` in `verifyMessage()` (missed during v2.2.1 cleanup)

## [2.2.1] - 2025-02-10

### Changed

#### Code Cleanup & Deduplication

Major internal cleanup reducing code duplication and removing dead code. No public API changes.

**Dead code removed:**
- Deleted `lib/browser-wasm-loader.js` (446 lines) and `browser-shims/ecash_lib_wasm_browser.js` (309 lines) — unused WASM loader code
- Removed 3 dead `require('./browser-shims/...')` calls and `_initializeWASM()` method from `index.js`
- Removed 3 stub methods from `lib/adapters/router.js` (`getETokenData`, `getETokenData2`, `getPsfWritePrice`)

**Debug statements removed:**
- Removed all ~120 `console.log`/`console.warn`/`console.error` statements from lib/ and index.js
- Errors now propagate via `throw` only, no console side-effects

**Shared utilities extracted (`lib/tx-utils.js`):**
- `getUtxoValue()` — single implementation replacing 6 duplicate copies across lib/
- `estimateFee()` — single fee calculator replacing 5 duplicates, uses 141 bytes/input (Schnorr P2PKH)
- `getPrivateKey()` — shared key derivation helper
- `getOutputScript()` — shared P2PKH script builder

**Token handler base class (`lib/base-token-handler.js`):**
- Extracted ~400 lines of shared logic from SLP and ALP token handlers
- Shared methods: `sendTokens()`, `burnTokens()`, `_categorizeUtxos()`, `_selectTokenUtxos()`, `_selectXecUtxos()`, `_displayToAtoms()`, `_atomsToDisplay()`
- SLP and ALP handlers now extend `BaseTokenHandler`, keeping only protocol-specific transaction building

**Dependencies cleaned up:**
- Removed unused: `@chris.troutner/retry-queue-commonjs`, `bignumber.js`
- Removed unused devDep: `lodash.clonedeep`
- Moved `qrcode-terminal` to devDependencies (only used in examples/)
- Fixed `"module"` field to point to ESM bundle (`./dist/minimal-xec-wallet.esm.js`)

**Impact:**
- Bundle size: ~711KB → ~574KB minified (-19%)
- 0 console statements in production code (was ~120)
- 527 tests passing (was 504, +23 new tests for shared utilities)

### Files Added
- `lib/tx-utils.js` — shared transaction utilities
- `lib/base-token-handler.js` — shared SLP/ALP base class
- `test/unit/a14-tx-utils.js` — unit tests for tx-utils

### Files Deleted
- `lib/browser-wasm-loader.js`
- `browser-shims/ecash_lib_wasm_browser.js`

### Files Modified
- `index.js` — removed dead WASM code and console statements
- `lib/slp-token-handler.js` — extends BaseTokenHandler, uses tx-utils
- `lib/alp-token-handler.js` — extends BaseTokenHandler, uses tx-utils
- `lib/send-xec.js` — uses tx-utils
- `lib/op-return.js` — uses tx-utils
- `lib/consolidate-utxos.js` — uses tx-utils
- `lib/utxos.js` — uses tx-utils
- `lib/hybrid-token-manager.js` — removed console statements
- `lib/adapters/router.js` — removed stubs and console statements
- `lib/adapters/robust-chronik-router.js` — removed console statements
- `lib/utxo-analytics/UtxoHealthMonitor.js` — removed console statements
- `lib/utxo-analytics/UtxoClassifier.js` — removed console statements
- `lib/token-protocol-detector.js` — removed console statements
- `lib/security.js` — removed console statements
- `package.json` — removed unused deps, fixed module field

## [2.1.4] - 2025-02-10

### Fixed

#### Browser Token Sends (CRITICAL)

Fixed SLP/ALP token sends crashing in the browser with `Cannot read properties of undefined (reading 'BASE')`.

**The Problem:**
The `initBrowser-shim.js` used `secp256k1.ProjectivePoint` to access the elliptic curve point class, but `@noble/curves` v2's `ecdsa()` exports it as `Point`, not `ProjectivePoint`. This caused all transaction signing to fail in the browser bundle.

**The Fix:**
- Replaced all 7 `secp256k1.ProjectivePoint` references with `secp256k1.Point` in `browser-shims/initBrowser-shim.js`

#### Improved ALP Token Send Error Messages

Replaced raw sats values with human-readable XEC amounts and actionable advice in ALP insufficient-funds errors.

- "Need 1452 sats, have 546 from tokens" becomes "Need 14.52 XEC total, but only have 5.46 XEC from token UTXOs. Send some XEC to this address first."
- Added shortfall amount when wallet is partially funded

#### More Accurate Fee Estimation

Updated transaction size estimation for Schnorr-signed P2PKH inputs (141 bytes instead of 148 for DER-encoded signatures).

- `lib/alp-token-handler.js`: 148 -> 141 bytes/input, 50 -> 43 overhead
- `lib/slp-token-handler.js`: 148 -> 141 bytes/input

#### Example Pre-check Threshold

Raised the minimum XEC balance check in `examples/test-examples.js` from 1 XEC to 15 XEC, which is the realistic minimum needed for dust outputs + fees in a token send.

### Files Updated

- `browser-shims/initBrowser-shim.js` - Fix ProjectivePoint -> Point
- `lib/alp-token-handler.js` - Error messages and fee estimation
- `lib/slp-token-handler.js` - Fee estimation
- `examples/test-examples.js` - Pre-check threshold

## [2.1.3] - 2025-02-05

### Fixed

#### BIP32 Key Derivation (CRITICAL)

Fixed incorrect BIP32 HD key derivation that was generating wrong addresses from mnemonics.

**The Problem:**
The `_deriveChild()` method was incorrectly using the HMAC-SHA512 output directly as the child private key, instead of adding it to the parent private key as specified by BIP32.

**The Fix:**
- Added `SECP256K1_ORDER` constant for proper modular arithmetic
- Implemented `_privateKeyAdd()` method for BIP32-compliant key addition: `childKey = (parentKey + tweak) mod n`
- Updated `_deriveChild()` to use proper BIP32 derivation formula

**Impact:**
- Wallets created with v2.1.2 or earlier generated incorrect addresses
- The fix ensures addresses now match other BIP32-compliant wallets (Electron Cash, Cashtab, etc.)
- Users who created wallets with old versions will see different addresses after upgrading

**Files Updated:**
- `lib/key-derivation.js` - Core derivation fix
- `examples/wallet.json` - Regenerated with correct keys
- `examples/README.md` - Updated example addresses
- `test/unit/mocks/xec-wallet-mocks.js` - Use dynamic addresses instead of hardcoded

## [2.1.2] - 2025-02-05

### Security

This release eliminates all 59 npm audit vulnerabilities (7 critical, 33 high, 13 moderate, 6 low).

#### Build System Replacement

Replaced browserify + babel build chain with Rollup to fix critical arbitrary code execution vulnerability in babel-traverse (GHSA-67hx-6x53-jw92).

**Removed:**
- `@babel/core`, `@babel/plugin-syntax-import-meta`, `@babel/plugin-transform-modules-commonjs`, `@babel/preset-env`
- `babel-plugin-transform-import-meta`, `babelify`
- `browserify`, `browser-resolve`, `esmify`, `tinyify`, `through2`

**Added:**
- `rollup` ^4.30.0
- `@rollup/plugin-node-resolve` ^16.0.0
- `@rollup/plugin-commonjs` ^28.0.0
- `@rollup/plugin-json` ^6.1.0
- `@rollup/plugin-replace` ^6.0.0
- `@rollup/plugin-terser` ^0.4.4
- `rollup-plugin-polyfill-node` ^0.13.0

#### Dependency Updates

| Package | Previous | Updated | Severity Fixed |
|---------|----------|---------|----------------|
| `crypto-js` | 4.0.0 | ^4.2.0 | CRITICAL (PBKDF2 weakness) |
| `mocha` | 9.2.1 | ^11.0.0 | HIGH (diff, js-yaml, minimatch, nanoid, serialize-javascript) |
| `sinon` | 9.2.0 | ^17.0.0 | HIGH (diff) |
| `chai` | 4.2.0 | ^5.0.0 | Compatibility |
| `semantic-release` | 19.0.3 | ^25.0.0 | HIGH (tar, @octokit/*, npm-related) |
| `eslint` | 7.17.0 | ^8.57.0 | Compatibility |
| `eslint-config-prettier` | 7.1.0 | ^9.1.0 | Compatibility |
| `eslint-config-standard` | 16.0.2 | ^17.1.0 | Compatibility |
| `eslint-plugin-prettier` | 3.3.1 | ^5.0.0 | Compatibility |
| `eslint-plugin-standard` | 4.0.1 | ^5.0.0 | Compatibility |

#### Removed Packages

| Package | Reason |
|---------|--------|
| `coveralls` | CRITICAL form-data vulnerability, MODERATE tough-cookie (no fix available) |
| `terser` | Moved to devDependency via @rollup/plugin-terser |
| `uglifyify` | Browserify plugin with vulnerable terser |

#### Added Packages

| Package | Purpose |
|---------|---------|
| `c8` ^10.0.0 | Modern coverage tool (replaces coveralls) |

#### Transitive Dependency Overrides

Added `overrides` section to force secure versions of transitive dependencies:

```json
"overrides": {
  "elliptic": "^6.6.1",
  "semver": "^7.6.0",
  "diff": "^8.0.3"
}
```

### Changed

- Build system migrated from browserify to Rollup
- Build output now includes three formats: UMD, minified UMD, and ESM
- Build time improved from ~30s to ~5s
- Removed `.babelrc` and `transform-import-meta.js` (no longer needed)

### Scripts Updated

| Script | Previous | Updated |
|--------|----------|---------|
| `build` | browserify with babel transforms | `rollup -c` |
| `build:dev` | browserify without minification | `rollup -c --environment NODE_ENV:development` |
| `coverage` | nyc with coveralls | `c8 --reporter=lcov mocha ...` |
| `coverage:report` | nyc html reporter | `c8 report --reporter=html` |

**New script:**
- `build:watch` - `rollup -c --watch`
