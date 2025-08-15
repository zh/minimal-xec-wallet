# eToken Test Suite Design Specification

## Overview

This document defines the comprehensive test suite design for eToken (ALP protocol) operations in the Minimal XEC Wallet. The test suite follows the established patterns from the existing XEC test framework while addressing the unique testing requirements of token operations.

## Test Architecture

### Test Hierarchy
```
test/
├── unit/                              # Unit tests (isolated component testing)
│   ├── a06-tokens-unit.js            # Token class unit tests
│   ├── a07-token-utxo-manager-unit.js # UTXO management unit tests  
│   ├── a08-token-balance-unit.js      # Balance calculation unit tests
│   ├── a09-token-fee-estimator-unit.js # Fee estimation unit tests
│   └── mocks/
│       ├── etoken-utxo-mocks.js       # Token UTXO mock data
│       ├── etoken-wallet-mocks.js     # Token wallet mock data
│       └── etoken-chronik-mocks.js    # Chronik token API mocks
├── integration/                       # Integration tests (end-to-end flows)
│   ├── etoken-send-integration.test.js    # Token sending workflows
│   ├── etoken-burn-integration.test.js    # Token burning workflows
│   └── etoken-balance-integration.test.js # Token balance workflows
└── e2e/                              # End-to-end tests (live network)
    ├── etoken-testnet-operations.test.js  # Live testnet operations
    └── etoken-mainnet-readonly.test.js    # Read-only mainnet tests
```

### Test Categories

1. **Unit Tests** - Test individual components in isolation
2. **Integration Tests** - Test component interactions with mocked external services
3. **End-to-End Tests** - Test complete workflows against live networks

## Mock Data Design

### Enhanced Test Setup

```javascript
// Enhanced setup.js with ALP support
const alpMocks = {
  // ALP transaction building mocks
  alpSend: sinon.stub().returns(Buffer.from('mock_alp_send_script')),
  alpBurn: sinon.stub().returns(Buffer.from('mock_alp_burn_script')),
  alpGenesis: sinon.stub().returns(Buffer.from('mock_alp_genesis_script')),
  emppScript: sinon.stub().callsFake((data) => ({
    script: Buffer.concat([Buffer.from([0x6a]), Buffer.from(data)])
  })),
  parseAlp: sinon.stub().returns({
    tokenType: 0,
    tokenId: 'mock_token_id',
    amounts: [1000000n, 2000000n]
  }),
  parseEmppScript: sinon.stub().returns([Buffer.from('mock_empp_data')])
}

// Enhanced chronik mock with token support
MockChronikClient.prototype.token = sinon.stub().callsFake((tokenId) => {
  const mockTokenInfo = {
    tokenId: tokenId,
    tokenType: {
      protocol: 'ALP',
      type: 'ALP_TOKEN_TYPE_STANDARD',
      number: 0
    },
    genesisInfo: {
      tokenTicker: 'TEST',
      tokenName: 'Test Token',
      url: 'https://test.token',
      data: '',
      authPubkey: '',
      decimals: 2
    },
    timeFirstSeen: Date.now()
  }
  return Promise.resolve(mockTokenInfo)
})
```

### Token UTXO Mock Data

```javascript
// test/unit/mocks/etoken-utxo-mocks.js
const alpTokenUtxos = {
  // Single token type UTXOs
  singleTokenUtxos: [
    {
      outpoint: {
        txid: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
        outIdx: 0
      },
      blockHeight: 800000,
      isCoinbase: false,
      sats: 546, // Always dust for token UTXOs
      token: {
        tokenId: 'test_token_id_123',
        tokenType: {
          protocol: 'ALP',
          type: 'ALP_TOKEN_TYPE_STANDARD',
          number: 0
        },
        atoms: '100000', // 1000.00 tokens (2 decimals)
        isMintBaton: false
      }
    },
    {
      outpoint: {
        txid: 'b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1',
        outIdx: 1
      },
      blockHeight: 800001,
      isCoinbase: false,
      sats: 546,
      token: {
        tokenId: 'test_token_id_123',
        tokenType: {
          protocol: 'ALP',
          type: 'ALP_TOKEN_TYPE_STANDARD',
          number: 0
        },
        atoms: '50000', // 500.00 tokens
        isMintBaton: false
      }
    }
  ],

  // Multiple token types in wallet
  multiTokenUtxos: [
    {
      outpoint: {
        txid: 'c3d4e5f6789012345678901234567890123456789012345678901234567890a1b2',
        outIdx: 0
      },
      blockHeight: 800002,
      isCoinbase: false,
      sats: 546,
      token: {
        tokenId: 'token_type_one',
        tokenType: {
          protocol: 'ALP',
          type: 'ALP_TOKEN_TYPE_STANDARD',
          number: 0
        },
        atoms: '1000000000', // 10,000,000.00 tokens (2 decimals)
        isMintBaton: false
      }
    },
    {
      outpoint: {
        txid: 'd4e5f6789012345678901234567890123456789012345678901234567890a1b2c3',
        outIdx: 1
      },
      blockHeight: 800003,
      isCoinbase: false,
      sats: 546,
      token: {
        tokenId: 'token_type_two',
        tokenType: {
          protocol: 'ALP',
          type: 'ALP_TOKEN_TYPE_STANDARD',
          number: 0
        },
        atoms: '500', // 5.00 tokens (2 decimals)
        isMintBaton: false
      }
    }
  ],

  // Mixed XEC and token UTXOs (realistic wallet state)
  mixedWalletUtxos: [
    // XEC UTXOs for fees
    {
      outpoint: {
        txid: 'e5f6789012345678901234567890123456789012345678901234567890a1b2c3d4',
        outIdx: 0
      },
      blockHeight: 800004,
      isCoinbase: false,
      sats: 100000, // 1000 XEC for fees
      // No token property = XEC UTXO
    },
    {
      outpoint: {
        txid: 'f6789012345678901234567890123456789012345678901234567890a1b2c3d4e5',
        outIdx: 1
      },
      blockHeight: 800005,
      isCoinbase: false,
      sats: 50000, // 500 XEC
    },
    // Token UTXOs
    {
      outpoint: {
        txid: '6789012345678901234567890123456789012345678901234567890a1b2c3d4e5f',
        outIdx: 0
      },
      blockHeight: 800006,
      isCoinbase: false,
      sats: 546, // Dust
      token: {
        tokenId: 'wallet_token_id',
        tokenType: {
          protocol: 'ALP',
          type: 'ALP_TOKEN_TYPE_STANDARD',
          number: 0
        },
        atoms: '250000', // 2500.00 tokens (2 decimals)
        isMintBaton: false
      }
    }
  ],

  // Edge case: Zero decimal token (integer only)
  integerTokenUtxos: [
    {
      outpoint: {
        txid: '789012345678901234567890123456789012345678901234567890a1b2c3d4e5f6',
        outIdx: 0
      },
      blockHeight: 800007,
      isCoinbase: false,
      sats: 546,
      token: {
        tokenId: 'integer_token_id',
        tokenType: {
          protocol: 'ALP',
          type: 'ALP_TOKEN_TYPE_STANDARD',
          number: 0
        },
        atoms: '1000', // 1000 integer tokens (0 decimals)
        isMintBaton: false
      }
    }
  ],

  // Edge case: High precision token (8 decimals)
  precisionTokenUtxos: [
    {
      outpoint: {
        txid: '89012345678901234567890123456789012345678901234567890a1b2c3d4e5f67',
        outIdx: 0
      },
      blockHeight: 800008,
      isCoinbase: false,
      sats: 546,
      token: {
        tokenId: 'precision_token_id',
        tokenType: {
          protocol: 'ALP',
          type: 'ALP_TOKEN_TYPE_STANDARD',
          number: 0
        },
        atoms: '100000000', // 1.00000000 tokens (8 decimals)
        isMintBaton: false
      }
    }
  ]
}

module.exports = alpTokenUtxos
```

### Token Metadata Mock Data

```javascript
// test/unit/mocks/etoken-chronik-mocks.js
const tokenMetadataMocks = {
  standardToken: {
    tokenId: 'test_token_id_123',
    tokenType: {
      protocol: 'ALP',
      type: 'ALP_TOKEN_TYPE_STANDARD',
      number: 0
    },
    genesisInfo: {
      tokenTicker: 'TEST',
      tokenName: 'Test Token for Unit Tests',
      url: 'https://example.com/test-token',
      data: '', // Optional data field
      authPubkey: '', // Optional auth pubkey
      decimals: 2 // 2 decimal places
    },
    timeFirstSeen: 1640995200000 // Jan 1, 2022
  },

  integerToken: {
    tokenId: 'integer_token_id',
    tokenType: {
      protocol: 'ALP',
      type: 'ALP_TOKEN_TYPE_STANDARD',
      number: 0
    },
    genesisInfo: {
      tokenTicker: 'INT',
      tokenName: 'Integer Token',
      url: '',
      data: '',
      authPubkey: '',
      decimals: 0 // No decimal places
    },
    timeFirstSeen: 1640995200000
  },

  precisionToken: {
    tokenId: 'precision_token_id',
    tokenType: {
      protocol: 'ALP',
      type: 'ALP_TOKEN_TYPE_STANDARD',
      number: 0
    },
    genesisInfo: {
      tokenTicker: 'PREC',
      tokenName: 'High Precision Token',
      url: 'https://precision.token',
      data: '68656c6c6f', // "hello" in hex
      authPubkey: '021234567890abcdef',
      decimals: 8 // Maximum decimal places
    },
    timeFirstSeen: 1640995200000
  }
}

module.exports = tokenMetadataMocks
```

## Unit Test Specifications

### Token Class Unit Tests

```javascript
// test/unit/a06-tokens-unit.js
describe('#tokens.js - eToken Operations', () => {
  let sandbox, uut, mockChronik, mockAr

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    
    mockChronik = {
      token: sandbox.stub().resolves(tokenMetadataMocks.standardToken),
      broadcastTx: sandbox.stub().resolves('test_token_txid_123')
    }

    mockAr = {
      sendTx: sandbox.stub().resolves('test_token_txid_123'),
      getUtxos: sandbox.stub().resolves(alpTokenUtxos.mixedWalletUtxos)
    }

    const config = { chronik: mockChronik, ar: mockAr }
    uut = new Tokens(config)
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should instantiate Tokens class with required dependencies', () => {
      assert.instanceOf(uut, Tokens)
      assert.property(uut, 'chronik')
      assert.property(uut, 'ar')
    })

    it('should throw error without chronik client', () => {
      try {
        new Tokens({}) // eslint-disable-line no-new
        assert.fail('Should throw error without chronik')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'chronik')
      }
    })
  })

  describe('#listETokensFromAddress', () => {
    it('should list all tokens held by address', async () => {
      const testAddress = 'ecash:qp123...mockaddress'
      mockAr.getUtxos.resolves(alpTokenUtxos.multiTokenUtxos)
      
      const result = await uut.listETokensFromAddress(testAddress)
      
      assert.isArray(result)
      assert.equal(result.length, 2)
      assert.equal(result[0].tokenId, 'token_type_one')
      assert.equal(result[1].tokenId, 'token_type_two')
    })

    it('should return empty array for address with no tokens', async () => {
      const testAddress = 'ecash:qp123...emptyaddress'
      mockAr.getUtxos.resolves([]) // No UTXOs
      
      const result = await uut.listETokensFromAddress(testAddress)
      
      assert.isArray(result)
      assert.equal(result.length, 0)
    })

    it('should handle mixed XEC and token UTXOs correctly', async () => {
      const testAddress = 'ecash:qp123...mixedaddress'
      mockAr.getUtxos.resolves(alpTokenUtxos.mixedWalletUtxos)
      
      const result = await uut.listETokensFromAddress(testAddress)
      
      assert.isArray(result)
      assert.equal(result.length, 1) // Only one token type in mixed UTXOs
      assert.equal(result[0].tokenId, 'wallet_token_id')
    })
  })

  describe('#getETokenBalance', () => {
    it('should calculate correct balance for 2-decimal token', async () => {
      const tokenId = 'test_token_id_123'
      const address = 'ecash:qp123...testaddress'
      
      mockAr.getUtxos.resolves(alpTokenUtxos.singleTokenUtxos)
      
      const result = await uut.getETokenBalance(tokenId, address)
      
      assert.equal(result.balance.total, 1500.00) // 150000 atoms = 1500.00 tokens
      assert.equal(result.atoms.total, 150000n)
      assert.equal(result.decimals, 2)
      assert.equal(result.ticker, 'TEST')
    })

    it('should handle zero-decimal (integer) tokens', async () => {
      const tokenId = 'integer_token_id'
      const address = 'ecash:qp123...integeraddress'
      
      mockChronik.token.resolves(tokenMetadataMocks.integerToken)
      mockAr.getUtxos.resolves(alpTokenUtxos.integerTokenUtxos)
      
      const result = await uut.getETokenBalance(tokenId, address)
      
      assert.equal(result.balance.total, 1000) // 1000 atoms = 1000 integer tokens
      assert.equal(result.atoms.total, 1000n)
      assert.equal(result.decimals, 0)
    })

    it('should handle high-precision (8-decimal) tokens', async () => {
      const tokenId = 'precision_token_id'
      const address = 'ecash:qp123...precisionaddress'
      
      mockChronik.token.resolves(tokenMetadataMocks.precisionToken)
      mockAr.getUtxos.resolves(alpTokenUtxos.precisionTokenUtxos)
      
      const result = await uut.getETokenBalance(tokenId, address)
      
      assert.equal(result.balance.total, 1.00000000) // 100000000 atoms = 1.00000000 tokens
      assert.equal(result.atoms.total, 100000000n)
      assert.equal(result.decimals, 8)
    })
  })

  describe('#sendETokens', () => {
    it('should send tokens to single recipient', async () => {
      const output = {
        address: 'ecash:qp123...recipient',
        amount: 500.00 // 500 tokens
      }
      const walletInfo = mockWallet.mockXecWalletInfo
      const xecUtxos = alpTokenUtxos.mixedWalletUtxos.filter(u => !u.token)
      const tokenUtxos = alpTokenUtxos.mixedWalletUtxos.filter(u => u.token)
      
      sandbox.stub(uut, 'createTransaction').resolves('mock_token_tx_hex')
      
      const result = await uut.sendETokens(output, walletInfo, xecUtxos, tokenUtxos, 1.2)
      
      assert.equal(result, 'test_token_txid_123')
    })

    it('should send tokens to multiple recipients', async () => {
      const outputs = [
        { address: 'ecash:qp123...recipient1', amount: 100.00 },
        { address: 'ecash:qp123...recipient2', amount: 200.00 },
        { address: 'ecash:qp123...recipient3', amount: 50.00 }
      ]
      const walletInfo = mockWallet.mockXecWalletInfo
      const xecUtxos = alpTokenUtxos.mixedWalletUtxos.filter(u => !u.token)
      const tokenUtxos = alpTokenUtxos.singleTokenUtxos
      
      sandbox.stub(uut, 'createTransaction').resolves('mock_multi_tx_hex')
      
      const result = await uut.sendETokens(outputs, walletInfo, xecUtxos, tokenUtxos, 1.2)
      
      assert.equal(result, 'test_token_txid_123')
    })

    it('should handle insufficient token balance error', async () => {
      const output = {
        address: 'ecash:qp123...recipient',
        amount: 5000.00 // More than available (1500.00)
      }
      const walletInfo = mockWallet.mockXecWalletInfo
      const xecUtxos = alpTokenUtxos.mixedWalletUtxos.filter(u => !u.token)
      const tokenUtxos = alpTokenUtxos.singleTokenUtxos
      
      try {
        await uut.sendETokens(output, walletInfo, xecUtxos, tokenUtxos, 1.2)
        assert.fail('Should throw insufficient token balance error')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'insufficient')
        assert.include(err.message.toLowerCase(), 'token')
      }
    })

    it('should handle insufficient XEC for fees error', async () => {
      const output = {
        address: 'ecash:qp123...recipient',
        amount: 100.00
      }
      const walletInfo = mockWallet.mockXecWalletInfo
      const xecUtxos = [] // No XEC UTXOs available
      const tokenUtxos = alpTokenUtxos.singleTokenUtxos
      
      try {
        await uut.sendETokens(output, walletInfo, xecUtxos, tokenUtxos, 1.2)
        assert.fail('Should throw insufficient XEC for fees error')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'insufficient')
        assert.include(err.message.toLowerCase(), 'xec')
        assert.include(err.message.toLowerCase(), 'fee')
      }
    })
  })

  describe('#burnETokens', () => {
    it('should burn specific amount of tokens', async () => {
      const qty = 100.00 // Burn 100 tokens
      const tokenId = 'test_token_id_123'
      const walletInfo = mockWallet.mockXecWalletInfo
      const xecUtxos = alpTokenUtxos.mixedWalletUtxos.filter(u => !u.token)
      const tokenUtxos = alpTokenUtxos.singleTokenUtxos
      
      sandbox.stub(uut, 'createBurnTransaction').resolves('mock_burn_tx_hex')
      
      const result = await uut.burnETokens(qty, tokenId, walletInfo, xecUtxos, tokenUtxos, 1.2)
      
      assert.equal(result, 'test_token_txid_123')
    })

    it('should handle burn amount exceeding balance', async () => {
      const qty = 2000.00 // More than available (1500.00)
      const tokenId = 'test_token_id_123'
      const walletInfo = mockWallet.mockXecWalletInfo
      const xecUtxos = alpTokenUtxos.mixedWalletUtxos.filter(u => !u.token)
      const tokenUtxos = alpTokenUtxos.singleTokenUtxos
      
      try {
        await uut.burnETokens(qty, tokenId, walletInfo, xecUtxos, tokenUtxos, 1.2)
        assert.fail('Should throw burn amount exceeds balance error')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'insufficient')
        assert.include(err.message.toLowerCase(), 'burn')
      }
    })
  })

  describe('#burnAll', () => {
    it('should burn all tokens of specific type', async () => {
      const tokenId = 'test_token_id_123'
      const walletInfo = mockWallet.mockXecWalletInfo
      const xecUtxos = alpTokenUtxos.mixedWalletUtxos.filter(u => !u.token)
      const tokenUtxos = alpTokenUtxos.singleTokenUtxos
      
      sandbox.stub(uut, 'createBurnTransaction').resolves('mock_burn_all_tx_hex')
      
      const result = await uut.burnAll(tokenId, walletInfo, xecUtxos, tokenUtxos)
      
      assert.equal(result, 'test_token_txid_123')
    })

    it('should handle case with no tokens to burn', async () => {
      const tokenId = 'nonexistent_token_id'
      const walletInfo = mockWallet.mockXecWalletInfo
      const xecUtxos = alpTokenUtxos.mixedWalletUtxos.filter(u => !u.token)
      const tokenUtxos = [] // No token UTXOs
      
      try {
        await uut.burnAll(tokenId, walletInfo, xecUtxos, tokenUtxos)
        assert.fail('Should throw no tokens to burn error')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'no')
        assert.include(err.message.toLowerCase(), 'token')
      }
    })
  })
})
```

### UTXO Management Unit Tests

```javascript
// test/unit/a07-token-utxo-manager-unit.js
const TokenUtxoManager = require('../../lib/token-utxo-manager')

describe('#token-utxo-manager.js - Token UTXO Management', () => {
  let sandbox, uut

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    uut = new TokenUtxoManager()
  })

  afterEach(() => sandbox.restore())

  describe('#categorizeUtxos', () => {
    it('should separate XEC and token UTXOs correctly', () => {
      const result = uut.categorizeUtxos(alpTokenUtxos.mixedWalletUtxos)
      
      assert.equal(result.xecUtxos.length, 2) // 2 XEC UTXOs
      assert.equal(result.tokenUtxos.size, 1) // 1 token type
      assert.equal(result.tokenUtxos.get('wallet_token_id').length, 1)
      assert.equal(result.totalXecValue, 150000) // 1000 + 500 XEC in sats
    })

    it('should handle all-XEC wallet (no tokens)', () => {
      const xecOnlyUtxos = alpTokenUtxos.mixedWalletUtxos.filter(u => !u.token)
      const result = uut.categorizeUtxos(xecOnlyUtxos)
      
      assert.equal(result.xecUtxos.length, 2)
      assert.equal(result.tokenUtxos.size, 0)
      assert.equal(result.totalXecValue, 150000)
    })

    it('should handle multiple token types', () => {
      const result = uut.categorizeUtxos(alpTokenUtxos.multiTokenUtxos)
      
      assert.equal(result.xecUtxos.length, 0) // No XEC UTXOs in this set
      assert.equal(result.tokenUtxos.size, 2) // 2 different token types
      assert.isTrue(result.tokenUtxos.has('token_type_one'))
      assert.isTrue(result.tokenUtxos.has('token_type_two'))
    })

    it('should filter for specific token when requested', () => {
      const result = uut.categorizeUtxos(alpTokenUtxos.multiTokenUtxos, 'token_type_one')
      
      assert.equal(result.tokenUtxos.length, 1) // Filtered to single token
      assert.equal(result.tokenUtxos[0].token.tokenId, 'token_type_one')
      assert.property(result, 'targetTokenSummary')
      assert.equal(result.targetTokenSummary.totalAtoms, 1000000000n)
    })

    it('should handle empty UTXO set', () => {
      const result = uut.categorizeUtxos([])
      
      assert.equal(result.xecUtxos.length, 0)
      assert.equal(result.tokenUtxos.size, 0)
      assert.equal(result.totalXecValue, 0)
      assert.equal(result.invalidUtxos.length, 0)
    })

    it('should handle and report invalid UTXOs', () => {
      const invalidUtxos = [
        { ...alpTokenUtxos.singleTokenUtxos[0] },
        {
          outpoint: { txid: 'invalid', outIdx: 0 },
          sats: 546,
          token: { tokenId: null, atoms: 'invalid' } // Invalid token data
        }
      ]
      delete invalidUtxos[0].token.atoms // Remove required field
      
      const result = uut.categorizeUtxos(invalidUtxos)
      
      assert.equal(result.invalidUtxos.length, 2) // Both UTXOs invalid
      assert.equal(result.tokenUtxos.size, 0)
    })
  })
})
```

### Balance Calculation Unit Tests

```javascript
// test/unit/a08-token-balance-unit.js
const TokenBalanceCalculator = require('../../lib/token-balance-calculator')

describe('#token-balance-calculator.js - Token Balance Calculations', () => {
  let sandbox, uut

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    uut = new TokenBalanceCalculator()
  })

  afterEach(() => sandbox.restore())

  describe('#atomsToDisplayUnits', () => {
    it('should convert atoms to display units for 2-decimal token', () => {
      const result = uut.atomsToDisplayUnits(150000n, 2)
      assert.equal(result, 1500.00)
    })

    it('should handle zero-decimal (integer) tokens', () => {
      const result = uut.atomsToDisplayUnits(1000n, 0)
      assert.equal(result, 1000)
    })

    it('should handle 8-decimal high-precision tokens', () => {
      const result = uut.atomsToDisplayUnits(100000000n, 8)
      assert.equal(result, 1.00000000)
    })

    it('should handle zero atoms', () => {
      const result = uut.atomsToDisplayUnits(0n, 2)
      assert.equal(result, 0)
    })

    it('should handle very large atom values', () => {
      const result = uut.atomsToDisplayUnits(281474976710655n, 8) // Max 48-bit value
      assert.equal(result, 2814749767.10655)
    })

    it('should throw error for invalid decimal places', () => {
      try {
        uut.atomsToDisplayUnits(1000n, 9) // > 8 decimals
        assert.fail('Should throw error for invalid decimals')
      } catch (err) {
        assert.include(err.message, 'Invalid decimal places')
      }
    })

    it('should throw error for negative atoms', () => {
      try {
        uut.atomsToDisplayUnits(-1000n, 2)
        assert.fail('Should throw error for negative atoms')
      } catch (err) {
        assert.include(err.message, 'cannot be negative')
      }
    })
  })

  describe('#displayUnitsToAtoms', () => {
    it('should convert display units to atoms for 2-decimal token', () => {
      const result = uut.displayUnitsToAtoms(1500.00, 2)
      assert.equal(result, 150000n)
    })

    it('should handle fractional amounts correctly', () => {
      const result = uut.displayUnitsToAtoms(12.34, 2)
      assert.equal(result, 1234n)
    })

    it('should handle zero-decimal tokens', () => {
      const result = uut.displayUnitsToAtoms(1000, 0)
      assert.equal(result, 1000n)
    })

    it('should throw error for fractional integer tokens', () => {
      try {
        uut.displayUnitsToAtoms(12.5, 0) // Fractional amount for integer token
        assert.fail('Should throw error for fractional integer amount')
      } catch (err) {
        assert.include(err.message, 'does not support decimal places')
      }
    })

    it('should throw error for negative amounts', () => {
      try {
        uut.displayUnitsToAtoms(-100.00, 2)
        assert.fail('Should throw error for negative amount')
      } catch (err) {
        assert.include(err.message, 'cannot be negative')
      }
    })

    it('should handle floating point precision issues', () => {
      // Test the common floating point precision issue: 0.1 + 0.2 = 0.30000000000000004
      const result = uut.displayUnitsToAtoms(0.30000000000000004, 8)
      assert.equal(result, 30000000n) // Should round to exact 0.3
    })
  })

  describe('#calculateTokenBalance', () => {
    it('should calculate balance for standard token correctly', () => {
      const tokenUtxos = alpTokenUtxos.singleTokenUtxos
      const tokenInfo = tokenMetadataMocks.standardToken
      
      const result = uut.calculateTokenBalance(tokenUtxos, tokenInfo)
      
      assert.equal(result.tokenId, 'test_token_id_123')
      assert.equal(result.ticker, 'TEST')
      assert.equal(result.decimals, 2)
      assert.equal(result.atoms.total, 150000n)
      assert.equal(result.balance.total, 1500.00)
      assert.equal(result.utxoCount, 2)
    })

    it('should handle empty token UTXO set', () => {
      const result = uut.calculateTokenBalance([], tokenMetadataMocks.standardToken)
      
      assert.equal(result.atoms.total, 0n)
      assert.equal(result.balance.total, 0)
      assert.equal(result.utxoCount, 0)
    })

    it('should handle integer tokens (0 decimals)', () => {
      const tokenUtxos = alpTokenUtxos.integerTokenUtxos
      const tokenInfo = tokenMetadataMocks.integerToken
      
      const result = uut.calculateTokenBalance(tokenUtxos, tokenInfo)
      
      assert.equal(result.balance.total, 1000) // Integer value
      assert.equal(result.decimals, 0)
    })
  })
})
```

## Integration Test Specifications

### Token Send Integration Tests

```javascript
// test/integration/etoken-send-integration.test.js
describe('eToken Send Integration Tests', () => {
  let wallet, mockChronik, realUtxos

  beforeEach(async () => {
    // Set up integration test environment with partial mocking
    mockChronik = new MockChronikClient()
    
    // Use real UTXOs structure but with controlled data
    realUtxos = require('./fixtures/testnet-token-utxos.json')
    
    wallet = new MinimalXECWallet(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      { chronikUrls: ['mock://test.chronik'] }
    )
    
    await wallet.walletInfoPromise
    await wallet.initialize()
  })

  describe('#sendETokens end-to-end workflow', () => {
    it('should complete full token send workflow', async () => {
      // Mock UTXO fetching to return realistic mixed UTXOs
      mockChronik.script.returns({
        utxos: sinon.stub().resolves({ utxos: realUtxos.mixedTokenUtxos })
      })

      // Mock token metadata
      mockChronik.token.resolves({
        tokenId: 'integration_test_token',
        genesisInfo: { decimals: 2, tokenTicker: 'ITEST' }
      })

      // Mock successful broadcast
      mockChronik.broadcastTx.resolves('integration_test_txid_123')

      const output = {
        address: 'ecash:qpd23pqr5axs2tq7x4j2nlj7m4rzjspz5g0gzn46sk',
        amount: 100.00
      }

      const result = await wallet.sendETokens(output, 1.2)

      assert.equal(result, 'integration_test_txid_123')
      
      // Verify chronik calls were made correctly
      assert.isTrue(mockChronik.token.called)
      assert.isTrue(mockChronik.broadcastTx.called)
      
      // Verify transaction hex format
      const broadcastArgs = mockChronik.broadcastTx.getCall(0).args
      assert.isString(broadcastArgs[0]) // Transaction hex
      assert.match(broadcastArgs[0], /^[0-9a-f]+$/i) // Valid hex string
    })

    it('should handle insufficient balance gracefully', async () => {
      // Mock UTXOs with insufficient token balance
      mockChronik.script.returns({
        utxos: sinon.stub().resolves({ utxos: realUtxos.lowBalanceUtxos })
      })

      mockChronik.token.resolves({
        tokenId: 'low_balance_token',
        genesisInfo: { decimals: 2, tokenTicker: 'LOW' }
      })

      const output = {
        address: 'ecash:qpd23pqr5axs2tq7x4j2nlj7m4rzjspz5g0gzn46sk',
        amount: 1000.00 // More than available
      }

      try {
        await wallet.sendETokens(output, 1.2)
        assert.fail('Should throw insufficient balance error')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'insufficient')
        
        // Verify no broadcast was attempted
        assert.isFalse(mockChronik.broadcastTx.called)
      }
    })

    it('should handle network errors during broadcast', async () => {
      mockChronik.script.returns({
        utxos: sinon.stub().resolves({ utxos: realUtxos.mixedTokenUtxos })
      })

      mockChronik.token.resolves({
        tokenId: 'network_test_token',
        genesisInfo: { decimals: 2, tokenTicker: 'NET' }
      })

      // Mock network error during broadcast
      mockChronik.broadcastTx.rejects(new Error('Network timeout'))

      const output = {
        address: 'ecash:qpd23pqr5axs2tq7x4j2nlj7m4rzjspz5g0gzn46sk',
        amount: 50.00
      }

      try {
        await wallet.sendETokens(output, 1.2)
        assert.fail('Should throw network error')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'network')
        
        // Verify broadcast was attempted
        assert.isTrue(mockChronik.broadcastTx.called)
      }
    })
  })

  describe('#multi-recipient token sends', () => {
    it('should send to multiple recipients successfully', async () => {
      mockChronik.script.returns({
        utxos: sinon.stub().resolves({ utxos: realUtxos.largeBalanceUtxos })
      })

      mockChronik.token.resolves({
        tokenId: 'multi_recipient_token',
        genesisInfo: { decimals: 2, tokenTicker: 'MULTI' }
      })

      mockChronik.broadcastTx.resolves('multi_txid_123')

      const outputs = [
        { address: 'ecash:qpd23pqr5axs2tq7x4j2nlj7m4rzjspz5g0gzn46sk', amount: 100.00 },
        { address: 'ecash:qr83cu3p7yg9yac7qthwm0nul2sjjj6fuqthg66mjs', amount: 200.00 },
        { address: 'ecash:qq6ek2k7wgc7k2k2k2k2k2k2k2k2k2k2kuht6yhm', amount: 50.00 }
      ]

      const result = await wallet.sendETokens(outputs, 1.2)

      assert.equal(result, 'multi_txid_123')
      
      // Verify transaction was built with correct number of outputs
      const broadcastArgs = mockChronik.broadcastTx.getCall(0).args
      // Transaction should have: 1 OP_RETURN + 3 token outputs + optional change
      // This would require parsing the hex, so we just verify broadcast occurred
      assert.isString(broadcastArgs[0])
    })

    it('should respect output count limits', async () => {
      mockChronik.script.returns({
        utxos: sinon.stub().resolves({ utxos: realUtxos.largeBalanceUtxos })
      })

      // Create too many outputs (> 19 per mempool rules)
      const outputs = []
      for (let i = 0; i < 25; i++) {
        outputs.push({
          address: `ecash:qp${i.toString().padStart(40, '0')}`,
          amount: 10.00
        })
      }

      try {
        await wallet.sendETokens(outputs, 1.2)
        assert.fail('Should throw too many outputs error')
      } catch (err) {
        assert.include(err.message.toLowerCase(), 'too many')
        assert.include(err.message.toLowerCase(), 'output')
      }
    })
  })
})
```

### Test Data Management

```javascript
// test/integration/fixtures/testnet-token-utxos.json
{
  "mixedTokenUtxos": [
    {
      "outpoint": { "txid": "a1b2c3d4...", "outIdx": 0 },
      "sats": 100000,
      "blockHeight": 800000
    },
    {
      "outpoint": { "txid": "b2c3d4e5...", "outIdx": 1 },
      "sats": 546,
      "token": {
        "tokenId": "integration_test_token",
        "tokenType": { "protocol": "ALP", "type": "ALP_TOKEN_TYPE_STANDARD", "number": 0 },
        "atoms": "500000",
        "isMintBaton": false
      }
    }
  ],
  "lowBalanceUtxos": [...],
  "largeBalanceUtxos": [...]
}
```

## End-to-End Test Specifications

### Live Testnet Tests

```javascript
// test/e2e/etoken-testnet-operations.test.js
describe('eToken Live Testnet Operations', function() {
  this.timeout(30000) // Extended timeout for network operations

  let wallet
  const TESTNET_TOKEN_ID = 'testnet_real_token_id_here'

  before(async () => {
    // Only run if testnet credentials are available
    if (!process.env.TESTNET_MNEMONIC) {
      this.skip()
    }

    wallet = new MinimalXECWallet(process.env.TESTNET_MNEMONIC, {
      chronikUrls: ['https://chronik-testnet.e.cash']
    })

    await wallet.walletInfoPromise
    await wallet.initialize()
  })

  describe('Live testnet token operations', () => {
    it('should fetch real token balance from testnet', async () => {
      const balance = await wallet.getETokenBalance({ tokenId: TESTNET_TOKEN_ID })

      assert.isObject(balance)
      assert.property(balance, 'balance')
      assert.property(balance, 'atoms')
      assert.property(balance, 'decimals')
      assert.isNumber(balance.balance.total)
      assert.isTrue(balance.atoms.total >= 0n)
    })

    it('should list real tokens from testnet address', async () => {
      const tokens = await wallet.listETokens()

      assert.isArray(tokens)
      // May be empty if test wallet has no tokens
      if (tokens.length > 0) {
        assert.property(tokens[0], 'tokenId')
        assert.property(tokens[0], 'balance')
        assert.property(tokens[0], 'ticker')
      }
    })

    // Note: Actual send tests would require funded testnet wallet
    // and should be marked as manual/optional tests
  })
})
```

## Performance Test Specifications

### Load Testing

```javascript
// test/performance/token-performance.test.js
describe('eToken Performance Tests', () => {
  describe('UTXO handling performance', () => {
    it('should handle large UTXO sets efficiently', () => {
      const startTime = Date.now()
      
      // Generate large UTXO set (1000+ UTXOs)
      const largeUtxoSet = generateLargeUtxoSet(1000)
      
      const manager = new TokenUtxoManager()
      const result = manager.categorizeUtxos(largeUtxoSet)
      
      const elapsedTime = Date.now() - startTime
      
      assert.isBelow(elapsedTime, 1000) // Should complete within 1 second
      assert.isObject(result)
    })

    it('should perform token balance calculation efficiently', () => {
      const startTime = Date.now()
      
      const calculator = new TokenBalanceCalculator()
      
      // Test multiple balance calculations
      for (let i = 0; i < 1000; i++) {
        calculator.atomsToDisplayUnits(BigInt(i * 1000000), 8)
        calculator.displayUnitsToAtoms(i * 10.123456, 8)
      }
      
      const elapsedTime = Date.now() - startTime
      
      assert.isBelow(elapsedTime, 100) // Should complete within 100ms
    })
  })

  describe('Memory usage', () => {
    it('should not leak memory during repeated operations', () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      const manager = new TokenUtxoManager()
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const utxos = generateMockUtxos(50)
        manager.categorizeUtxos(utxos)
      }
      
      // Force garbage collection if available
      if (global.gc) global.gc()
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable (< 50MB)
      assert.isBelow(memoryIncrease, 50 * 1024 * 1024)
    })
  })
})
```

## Coverage and Quality Targets

### Coverage Requirements
- **Unit Tests**: ≥95% line coverage for all token-related code
- **Integration Tests**: ≥90% feature coverage for end-to-end workflows  
- **Edge Cases**: 100% coverage of error conditions and boundary cases

### Quality Metrics
- **Test Execution Time**: All unit tests complete within 10 seconds
- **Reliability**: Zero flaky tests, consistent results across runs
- **Maintainability**: Clear test names, comprehensive mock data, minimal code duplication

### Continuous Integration
- **Pre-commit**: Unit tests must pass before code commits
- **Pull Request**: Full test suite including integration tests
- **Release**: E2E tests against live testnet verification

## Test Execution Strategy

### Development Workflow
1. **TDD Approach**: Write tests before implementation
2. **Incremental Testing**: Test each component as it's built
3. **Regression Prevention**: All existing tests must continue passing

### Test Categories by Environment
- **Unit Tests**: Run in all environments (local, CI, production)
- **Integration Tests**: Run in development and CI
- **E2E Tests**: Run manually before releases and in CI with testnet access

### Mock Strategy
- **Unit Tests**: Full mocking of external dependencies
- **Integration Tests**: Partial mocking (mock network, use real data structures)
- **E2E Tests**: Minimal mocking (only for destructive operations)

This comprehensive test suite design ensures that eToken operations will be thoroughly tested at every level, from individual function validation to complete workflow verification, maintaining the high quality standards established by the existing XEC operations.