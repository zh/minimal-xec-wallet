# Changelog

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
