/*
  Unit test mocks for XEC UTXOs.
  These mocks simulate Chronik API responses for XEC addresses.
*/

// Simple UTXO set for basic testing - increased amount to support transaction tests
const simpleXecUtxos = {
  success: true,
  utxos: [
    {
      outpoint: {
        txid: 'd5228d2cdc77fbe5a9aa79f19b0933b6802f9f0067f42847fc4fe343664723e5',
        outIdx: 0
      },
      blockHeight: 629922,
      isCoinbase: false,
      sats: 150000n, // 1500 XEC - enough for tests with fees
      isFinal: true,
      script: '76a914...'
    }
  ]
}

// Mixed UTXOs with different values for consolidation testing
const mixedXecUtxos = [
  {
    outpoint: {
      txid: '30707fffb9b295a06a68d217f49c198e9e1dbe1edc3874a0928ca1905f1709df',
      outIdx: 0
    },
    blockHeight: 639443,
    isCoinbase: false,
    sats: 60000n, // 600 XEC
    isFinal: true,
    script: '76a914...'
  },
  {
    outpoint: {
      txid: '8962566e413501224d178a02effc89be5ac0d8e4195f617415d443dc4c38fe50',
      outIdx: 1
    },
    blockHeight: 639443,
    isCoinbase: false,
    sats: 100n, // 1 XEC (minimum dust)
    isFinal: true,
    script: '76a914...'
  },
  {
    outpoint: {
      txid: 'f6a4df2f716b92e1c5a73db0a2e8e4b0f65a7e91a9a4e8c2e2a2e0b8e9e9e9e9',
      outIdx: 0
    },
    blockHeight: 640001,
    isCoinbase: false,
    sats: 500000n, // 5000 XEC
    isFinal: true,
    script: '76a914...'
  }
]

// Large UTXO set for performance testing
const largeXecUtxos = []
for (let i = 0; i < 100; i++) {
  largeXecUtxos.push({
    outpoint: {
      txid: `${'a'.repeat(63)}${i}`,
      outIdx: 0
    },
    blockHeight: 640000 + i,
    isCoinbase: false,
    sats: 10000n, // 100 XEC each
    isFinal: true,
    script: '76a914...'
  })
}

// Mixed confirmed and unconfirmed UTXOs for balance testing
const confirmedAndUnconfirmedUtxos = {
  success: true,
  utxos: [
    {
      outpoint: {
        txid: 'confirmed_tx_1',
        outIdx: 0
      },
      blockHeight: 640000, // Confirmed (has block height)
      isCoinbase: false,
      sats: 300000n, // 3000 XEC confirmed
      isFinal: true,
      script: '76a914...'
    },
    {
      outpoint: {
        txid: 'unconfirmed_tx_1',
        outIdx: 0
      },
      blockHeight: -1, // Unconfirmed (block height -1)
      isCoinbase: false,
      sats: 15000n, // 150 XEC unconfirmed
      isFinal: false,
      script: '76a914...'
    },
    {
      outpoint: {
        txid: 'confirmed_tx_2',
        outIdx: 1
      },
      blockHeight: 640001, // Confirmed
      isCoinbase: false,
      sats: 50000n, // 500 XEC confirmed
      isFinal: true,
      script: '76a914...'
    }
  ]
}

// Mock XEC balance response from Chronik
const mockXecBalance = {
  confirmed: 120000, // 1200 XEC in satoshis
  unconfirmed: 5000 // 50 XEC in satoshis
}

// Mock XEC transaction history
const mockXecTransactions = {
  transactions: [
    {
      txid: 'd5228d2cdc77fbe5a9aa79f19b0933b6802f9f0067f42847fc4fe343664723e5',
      version: 2,
      inputs: [
        {
          prevOut: {
            txid: 'prev_txid_1',
            outIdx: 0
          },
          value: 125000
        }
      ],
      outputs: [
        {
          value: 120000,
          script: '76a914...'
        }
      ],
      lockTime: 0,
      block: {
        height: 629922,
        hash: 'block_hash_1',
        timestamp: 1640995200
      }
    }
  ]
}

// Mock Chronik API responses
const mockChronikResponses = {
  utxos: simpleXecUtxos,
  balance: mockXecBalance,
  transactions: mockXecTransactions
}

module.exports = {
  simpleXecUtxos,
  mixedXecUtxos,
  largeXecUtxos,
  confirmedAndUnconfirmedUtxos,
  mockXecBalance,
  mockXecTransactions,
  mockChronikResponses
}
