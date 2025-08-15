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
      Script: {
        p2pkh: sinon.stub().returns(Buffer.from('mock_script_buffer'))
      },
      ALL_BIP143: 'mock_sighash',
      shaRmd160: sinon.stub().returns(Buffer.from('mock_hash160', 'hex'))
    }
  }
  if (id === 'ecashaddrjs') {
    return {
      decodeCashAddress: sinon.stub().callsFake((address) => {
        // Mock realistic behavior: only succeed for valid ecash: addresses
        if (typeof address !== 'string') {
          throw new Error(`Invalid value: ${address}.`)
        }
        if (address && address.startsWith('ecash:') && !address.includes('invalid')) {
          return {
            hash: Buffer.from('0123456789abcdef0123456789abcdef01234567', 'hex'),
            type: 'P2PKH'
          }
        }
        throw new Error('Invalid address format')
      }),
      encodeCashAddress: sinon.stub().returns('ecash:mockaddress')
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
        if (address && address.startsWith('ecash:') && !address.includes('invalid')) {
          return {
            hash: Buffer.from('0123456789abcdef0123456789abcdef01234567', 'hex'),
            type: 'P2PKH'
          }
        }
        throw new Error('Invalid address format')
      }),
      encodeCashAddress: sinon.stub().returns('ecash:mockaddress')
    }
  }
} catch (e) {
  // Module not yet loaded, that's fine
}

module.exports = {
  MockChronikClient,
  MockTxBuilder
}
