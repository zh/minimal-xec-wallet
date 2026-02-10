# Changelog

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
