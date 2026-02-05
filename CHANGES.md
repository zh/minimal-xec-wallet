# Changelog

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
