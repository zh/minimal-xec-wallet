# Changelog

## [1.0.7] - 2025-02-05

### Fixed

- **CRITICAL**: Fixed BIP32 child key derivation to comply with BIP32 specification
  - Previous implementation incorrectly replaced parent private key with HMAC output
  - Now correctly calculates: `childPrivateKey = (parentPrivateKey + tweak) mod secp256k1_order`
  - This fix enables CashTab wallet compatibility

### Added

- Added `SECP256K1_ORDER` constant for BIP32 modular arithmetic
- Added `_privateKeyAdd()` helper method for proper key addition modulo curve order

### Changed

- Updated `_deriveChild()` method in `lib/key-derivation.js` to use correct BIP32 derivation

### CashTab Compatibility

Wallets can now generate addresses compatible with CashTab by using the CashTab HD path:

```javascript
const wallet = new MinimalXecWallet(mnemonic, {
  hdPath: "m/44'/1899'/0'/0/0"  // CashTab-compatible path
})
```

### Breaking Change Notice

**IMPORTANT:** This fix changes the key derivation algorithm. Wallets created with the old broken derivation will generate different addresses after this fix. Users with existing wallets should:
1. Create a new wallet after upgrading
2. Transfer funds from old addresses to new addresses

---

## [1.0.6] - 2025-02-05

### Security

- **CRITICAL**: Eliminated babel-traverse vulnerability (GHSA-67hx-6x53-jw92) by migrating build system from browserify to Rollup
- Removed vulnerable dependency chain: `esmify` → `babel-plugin-import-to-require` → `babel-template` → `babel-traverse@6.26.0`
- Reduced total package count from 1280 to 1036 (-244 packages)
- `npm audit` now reports 0 vulnerabilities

### Changed

- **Build System**: Replaced `browserify + esmify + babelify` with Rollup
  - Build time reduced from ~30s to ~5s
  - Added ESM output format (`dist/minimal-xec-wallet.esm.js`)
  - Improved tree-shaking support

### Removed

- Removed devDependencies:
  - `@babel/core`
  - `@babel/plugin-syntax-import-meta`
  - `@babel/plugin-transform-modules-commonjs`
  - `@babel/preset-env`
  - `babel-plugin-transform-import-meta`
  - `babelify`
  - `browserify`
  - `browser-resolve`
  - `esmify`
  - `through2`
- Removed `terser` from dependencies (now handled by `@rollup/plugin-terser`)
- Deleted `transform-import-meta.js` (browserify transform)
- Deleted `.babelrc` (babel configuration)

### Added

- New devDependencies for Rollup build:
  - `rollup`
  - `@rollup/plugin-commonjs`
  - `@rollup/plugin-json`
  - `@rollup/plugin-node-resolve`
  - `@rollup/plugin-replace`
  - `@rollup/plugin-terser`
  - `rollup-plugin-polyfill-node`
- New build scripts:
  - `build:dev` - Development build
  - `build:watch` - Watch mode for development
- New output: `dist/minimal-xec-wallet.esm.js` (ES module format)

### Build Output

| Format | File | Size |
|--------|------|------|
| UMD | `dist/minimal-xec-wallet.js` | ~3.0 MB |
| UMD (minified) | `dist/minimal-xec-wallet.min.js` | ~2.2 MB |
| ESM | `dist/minimal-xec-wallet.esm.js` | ~3.0 MB |

---

## [1.0.5] and earlier

See git history for previous changes.
