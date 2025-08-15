/*
  Global test setup to prevent all network calls in unit tests.
  This completely replaces chronik-client with a mock before any modules load.
*/

const sinon = require('sinon')

// Create a comprehensive mock that behaves like ChronikClient
function MockChronikClient (url) {
  this.url = url

  // Add blockchain info method
  this.blockchainInfo = sinon.stub().resolves({
    tipHash: 'mock_tip_hash',
    tipHeight: 100000
  })

  this.script = sinon.stub().returns({
    utxos: sinon.stub().resolves({
      utxos: [
        {
          outpoint: { txid: 'mock_txid_123', outIdx: 0 },
          blockHeight: 100000,
          isCoinbase: false,
          sats: 150000n,
          value: 150000,
          script: 'mock_script'
        },
        {
          outpoint: { txid: 'mock_txid_456', outIdx: 1 },
          blockHeight: 100001,
          isCoinbase: false,
          sats: 200000n,
          value: 200000,
          script: 'mock_script_2'
        }
      ]
    }),
    history: sinon.stub().resolves({
      txs: [
        {
          txid: 'mock_txid_123',
          version: 2,
          inputs: [],
          outputs: [],
          lockTime: 0,
          block: { height: 100000, hash: 'mock_block_hash', timestamp: Date.now() }
        }
      ]
    })
  })

  this.tx = sinon.stub().resolves({
    txid: 'mock_txid_123',
    version: 2,
    inputs: [],
    outputs: [{ value: 60000, spent: false }],
    lockTime: 0
  })

  this.token = sinon.stub().callsFake((tokenId) => {
    // Return appropriate token metadata based on token ID
    if (tokenId === '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135') {
      return Promise.resolve({
        tokenId: '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135',
        tokenType: {
          protocol: 'SLP',
          type: 'SLP_TOKEN_TYPE_FUNGIBLE',
          number: 1
        },
        genesisInfo: {
          tokenTicker: 'FLCT',
          tokenName: 'Falcon Token',
          decimals: 0,
          url: 'ipfs://QmSzJtStHGm3W1p4ALJcPutwYyaLQHpi2mSQ9mHDH37xry'
        },
        timeFirstSeen: 1691234567
      })
    } else if (tokenId === '6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801') {
      return Promise.resolve({
        tokenId: '6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801',
        tokenType: {
          protocol: 'ALP',
          type: 'ALP_TOKEN_TYPE_STANDARD',
          number: 0
        },
        genesisInfo: {
          tokenTicker: 'TGR',
          tokenName: 'Tiger Cub',
          decimals: 0,
          url: 'cashtab.com'
        },
        timeFirstSeen: 1691345678
      })
    } else {
      return Promise.reject(new Error('Token not found'))
    }
  })

  this.broadcastTx = sinon.stub().resolves('mock_txid_123')

  this.ws = sinon.stub().returns({
    waitForOpen: sinon.stub().resolves(),
    subscribe: sinon.stub(),
    close: sinon.stub()
  })
}

// Set up static methods outside constructor to avoid infinite recursion
MockChronikClient.useStrategy = sinon.stub().callsFake(async (strategy, urls) => {
  // Return a mock instance without triggering recursion
  const mockInstance = Object.create(MockChronikClient.prototype)
  mockInstance.url = urls && urls[0] ? urls[0] : 'mock://strategy.url'
  mockInstance.blockchainInfo = sinon.stub().resolves({ tipHash: 'mock_tip_hash', tipHeight: 100000 })
  mockInstance.script = sinon.stub().returns({
    utxos: sinon.stub().resolves({ utxos: [] }),
    history: sinon.stub().resolves({ txs: [] }),
    balance: sinon.stub().resolves({ confirmed: 0n, unconfirmed: 0n })
  })
  mockInstance.tx = sinon.stub().resolves({ txid: 'mock_txid', outputs: [] })
  mockInstance.token = sinon.stub().callsFake((tokenId) => {
    // Same token metadata as main mock
    if (tokenId === '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135') {
      return Promise.resolve({
        tokenId: '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135',
        tokenType: { protocol: 'SLP', type: 'SLP_TOKEN_TYPE_FUNGIBLE', number: 1 },
        genesisInfo: { tokenTicker: 'FLCT', tokenName: 'Falcon Token', decimals: 0 },
        timeFirstSeen: 1691234567
      })
    } else if (tokenId === '6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801') {
      return Promise.resolve({
        tokenId: '6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801',
        tokenType: { protocol: 'ALP', type: 'ALP_TOKEN_TYPE_STANDARD', number: 0 },
        genesisInfo: { tokenTicker: 'TGR', tokenName: 'Tiger Cub', decimals: 0 },
        timeFirstSeen: 1691345678
      })
    } else {
      return Promise.reject(new Error('Token not found'))
    }
  })
  mockInstance.broadcastTx = sinon.stub().resolves('mock_txid_123')
  return mockInstance
})

// Mock the entire chronik-client module by hijacking require
const Module = require('module')
const originalRequire = Module.prototype.require

// Mock ecash-lib for transaction building tests
const MockTxBuilder = function (options) {
  this.inputs = options?.inputs || []
  this.outputs = options?.outputs || []
  this.addInput = sinon.stub().returns(this)
  this.addOutput = sinon.stub().returns(this)
  this.sign = sinon.stub().returns({
    ser: sinon.stub().returns(Buffer.from('020000000001abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex'))
  })
  this.build = sinon.stub().returns({
    ser: sinon.stub().returns(Buffer.from('020000000001abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex'))
  })
  return this
}

Module.prototype.require = function (id) {
  if (id === 'chronik-client') {
    return {
      ChronikClient: MockChronikClient,
      ConnectionStrategy: {
        ClosestFirst: 'ClosestFirst',
        Random: 'Random',
        RoundRobin: 'RoundRobin'
      }
    }
  }
  if (id === 'ecash-lib') {
    return {
      TxBuilder: MockTxBuilder,
      P2PKHSignatory: sinon.stub().returns('mock_signatory'),
      fromHex: sinon.stub().returns(Buffer.from('mock_buffer')),
      toHex: sinon.stub().returns('020000000001abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
      Ecc: function MockEcc () {
        this.derivePubkey = sinon.stub().returns(Buffer.from('mock_pubkey', 'hex'))
        return this
      },
      Script: (() => {
        function MockScript (bytecode) {
          this.bytecode = bytecode || Buffer.from('mock_script_bytecode')
          return this
        }
        MockScript.p2pkh = sinon.stub().returns(Buffer.from('mock_script_buffer'))
        return MockScript
      })(),
      ALL_BIP143: 'mock_sighash',
      shaRmd160: sinon.stub().returns(Buffer.from('mock_hash160', 'hex')),
      // Token-specific mocks
      slpSend: sinon.stub().returns({
        bytecode: Buffer.from('6a04534c500001010453454e44205e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135080000000000000001080000000000000005', 'hex')
      }),
      slpBurn: sinon.stub().returns({
        bytecode: Buffer.from('6a04534c50000101044255524e205e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135080000000000000001', 'hex')
      }),
      alpSend: sinon.stub().returns(Buffer.from('534c503200045345544400016887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801020300000000000007', 'hex')),
      alpBurn: sinon.stub().returns(Buffer.from('534c50320004434855524e6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801080000000000000001', 'hex')),
      emppScript: sinon.stub().returns({
        bytecode: Buffer.from('6a50534c503200045345544400016887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801020300000000000007', 'hex')
      }),
      SLP_FUNGIBLE: 1,
      SLP_TOKEN_TYPE_FUNGIBLE: { protocol: 'SLP', type: 'SLP_TOKEN_TYPE_FUNGIBLE', number: 1 },
      ALP_STANDARD: 0
    }
  }
  if (id === 'ecashaddrjs') {
    return {
      decodeCashAddress: sinon.stub().callsFake((address) => {
        // Mock realistic behavior: support both ecash: and etoken: addresses
        if (typeof address !== 'string') {
          throw new Error(`Invalid value: ${address}.`)
        }
        if (address && (address.startsWith('ecash:') || address.startsWith('etoken:')) && !address.includes('invalid')) {
          return {
            hash: Buffer.from('0123456789abcdef0123456789abcdef01234567', 'hex'),
            type: 'P2PKH'
          }
        }
        throw new Error(`Invalid checksum: ${address}.`)
      }),
      encodeCashAddress: (() => {
        const addressCache = new Map()
        let uniqueCounter = 0 // For truly unique cases

        const stub = sinon.stub().callsFake((prefix, type, hash) => {
          // Create deterministic key based on all input parameters
          const key = `${prefix}:${type}:${hash ? hash.toString('hex') : 'null'}`

          // Return cached address if we've seen this combination before
          if (addressCache.has(key)) {
            return addressCache.get(key)
          }

          // Generate deterministic address based on hash content
          if (hash && hash.length > 0) {
            // Use hash content to create unique deterministic address
            const hashStr = hash.toString('hex')
            const hashNumber = parseInt(hashStr.substring(0, 8), 16)
            const deterministicSuffix = (hashNumber % 0xffffff).toString(16).padStart(6, '0')
            const address = `ecash:mock${deterministicSuffix}`
            addressCache.set(key, address)
            return address
          } else {
            // Fallback for cases without hash - use counter for uniqueness
            uniqueCounter++
            const address = `ecash:mockfallback${uniqueCounter.toString(16).padStart(4, '0')}`
            addressCache.set(key, address)
            return address
          }
        })

        // Add method to clear cache for test isolation
        stub.clearCache = () => {
          addressCache.clear()
          uniqueCounter = 0
        }

        return stub
      })()
    }
  }
  return originalRequire.apply(this, arguments)
}

// Also mock it directly for tests that may have already cached it
require.cache[require.resolve('chronik-client')] = {
  exports: {
    ChronikClient: MockChronikClient,
    ConnectionStrategy: {
      ClosestFirst: 'ClosestFirst',
      Random: 'Random',
      RoundRobin: 'RoundRobin'
    }
  }
}

// Also mock ecashaddrjs in cache if it's already loaded
try {
  require.cache[require.resolve('ecashaddrjs')] = {
    exports: {
      decodeCashAddress: sinon.stub().callsFake((address) => {
        if (typeof address !== 'string') {
          throw new Error(`Invalid value: ${address}.`)
        }
        if (address && (address.startsWith('ecash:') || address.startsWith('etoken:')) && !address.includes('invalid')) {
          return {
            hash: Buffer.from('0123456789abcdef0123456789abcdef01234567', 'hex'),
            type: 'P2PKH'
          }
        }
        throw new Error(`Invalid checksum: ${address}.`)
      }),
      encodeCashAddress: (() => {
        const addressCache = new Map()
        let uniqueCounter = 0 // For truly unique cases

        const stub = sinon.stub().callsFake((prefix, type, hash) => {
          // Create deterministic key based on all input parameters
          const key = `${prefix}:${type}:${hash ? hash.toString('hex') : 'null'}`

          // Return cached address if we've seen this combination before
          if (addressCache.has(key)) {
            return addressCache.get(key)
          }

          // Generate deterministic address based on hash content
          if (hash && hash.length > 0) {
            // Use hash content to create unique deterministic address
            const hashStr = hash.toString('hex')
            const hashNumber = parseInt(hashStr.substring(0, 8), 16)
            const deterministicSuffix = (hashNumber % 0xffffff).toString(16).padStart(6, '0')
            const address = `ecash:mock${deterministicSuffix}`
            addressCache.set(key, address)
            return address
          } else {
            // Fallback for cases without hash - use counter for uniqueness
            uniqueCounter++
            const address = `ecash:mockfallback${uniqueCounter.toString(16).padStart(4, '0')}`
            addressCache.set(key, address)
            return address
          }
        })

        // Add method to clear cache for test isolation
        stub.clearCache = () => {
          addressCache.clear()
          uniqueCounter = 0
        }

        return stub
      })()
    }
  }
} catch (e) {
  // Module not yet loaded, that's fine
}

module.exports = {
  MockChronikClient,
  MockTxBuilder
}
