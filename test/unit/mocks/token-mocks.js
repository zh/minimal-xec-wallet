/*
  Token-specific mocks for testing hybrid SLP/ALP functionality.
  Uses real UTXO and metadata structures from our actual testing.
*/

// Real FLCT (SLP) token UTXO from our testing
const flctTokenUtxo = {
  outpoint: {
    txid: '5e1eae3c886f6a05ce9c0b8b88a5427940859da285946d4182c0ebb180c7ea0d',
    outIdx: 2
  },
  blockHeight: 910091,
  isCoinbase: false,
  sats: 546, // Dust amount
  isFinal: true,
  token: {
    tokenId: '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135',
    tokenType: {
      protocol: 'SLP',
      type: 'SLP_TOKEN_TYPE_FUNGIBLE',
      number: 1
    },
    atoms: '6'
  }
}

// Real TGR (ALP) token UTXO from our testing
const tgrTokenUtxo = {
  outpoint: {
    txid: '271e5633e77b8d6811cf47d4f20692caea72f1e39d544d1809f64491e9aa3035',
    outIdx: 2
  },
  blockHeight: 910092,
  isCoinbase: false,
  sats: 546, // Dust amount
  isFinal: true,
  token: {
    tokenId: '6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801',
    tokenType: {
      protocol: 'ALP',
      type: 'ALP_TOKEN_TYPE_STANDARD',
      number: 0
    },
    atoms: '7'
  }
}

// XEC-only UTXO for fees
const xecOnlyUtxo = {
  outpoint: {
    txid: '89989e087b6ca10c0bfef2d4a263f160ee841e3f03d698eae364981fe94ed2a6',
    outIdx: 1
  },
  blockHeight: 910082,
  isCoinbase: false,
  sats: 3599, // Sufficient for fees
  isFinal: true
  // No token property = XEC-only
}

// Mixed UTXO set (both protocols + XEC)
const mixedTokenUtxos = [
  flctTokenUtxo,
  tgrTokenUtxo,
  xecOnlyUtxo
]

// Real FLCT token metadata from chronik
const flctTokenMetadata = {
  tokenId: '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135',
  tokenType: {
    protocol: 'SLP',
    type: 'SLP_TOKEN_TYPE_FUNGIBLE',
    number: 1
  },
  timeFirstSeen: 1691234567,
  genesisInfo: {
    tokenTicker: 'FLCT',
    tokenName: 'Falcon Token',
    url: 'ipfs://QmSzJtStHGm3W1p4ALJcPutwYyaLQHpi2mSQ9mHDH37xry',
    decimals: 0,
    hash: '',
    data: '',
    authPubkey: '',
    mintBatonOutIdx: null
  },
  block: {
    height: 800123,
    hash: 'mock_block_hash_flct',
    timestamp: 1691234567
  }
}

// Real TGR token metadata from chronik
const tgrTokenMetadata = {
  tokenId: '6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801',
  tokenType: {
    protocol: 'ALP',
    type: 'ALP_TOKEN_TYPE_STANDARD',
    number: 0
  },
  timeFirstSeen: 1691345678,
  genesisInfo: {
    tokenTicker: 'TGR',
    tokenName: 'Tiger Cub',
    url: 'cashtab.com',
    decimals: 0,
    hash: '',
    data: '',
    authPubkey: '',
    mintBatonOutIdx: null
  },
  block: {
    height: 800456,
    hash: 'mock_block_hash_tgr',
    timestamp: 1691345678
  }
}

// Empty UTXO set for testing edge cases
const emptyUtxos = []

// XEC-only UTXOs (no tokens)
const xecOnlyUtxos = [
  {
    outpoint: {
      txid: 'xec_only_txid_1',
      outIdx: 0
    },
    blockHeight: 910000,
    isCoinbase: false,
    sats: 100000,
    isFinal: true
  },
  {
    outpoint: {
      txid: 'xec_only_txid_2',
      outIdx: 1
    },
    blockHeight: 910001,
    isCoinbase: false,
    sats: 50000,
    isFinal: true
  }
]

// Multiple SLP token UTXOs for selection testing
const multipleSLPUtxos = [
  {
    ...flctTokenUtxo,
    outpoint: { txid: 'slp_multi_1', outIdx: 0 },
    token: { ...flctTokenUtxo.token, atoms: '10' }
  },
  {
    ...flctTokenUtxo,
    outpoint: { txid: 'slp_multi_2', outIdx: 0 },
    token: { ...flctTokenUtxo.token, atoms: '5' }
  },
  {
    ...flctTokenUtxo,
    outpoint: { txid: 'slp_multi_3', outIdx: 0 },
    token: { ...flctTokenUtxo.token, atoms: '3' }
  }
]

// Malformed token UTXO for error testing
const malformedTokenUtxo = {
  outpoint: {
    txid: 'malformed_token_utxo',
    outIdx: 0
  },
  blockHeight: 910000,
  isCoinbase: false,
  sats: 546,
  isFinal: true,
  token: {
    // Missing tokenId and tokenType
    atoms: '100'
  }
}

// Test addresses
const testAddresses = {
  validSender: 'ecash:qpg562clu3350dnk3z3lenvxgyexyt7j6vnz4qg606',
  validRecipient: 'ecash:qpcskwl402g5stqxy26js0j3mx5v54xqtssp0v7kkr',
  invalidAddress: 'invalid_address_format',
  etokenRecipient: 'etoken:qpcskwl402g5stqxy26js0j3mx5v54xqtssp0v7kkr'
}

// Test wallet info
const testWalletInfo = {
  mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  xecAddress: testAddresses.validSender,
  hdPath: "m/44'/899'/0'/0/0",
  privateKey: 'KwGgVjJTwTKZppFgAqTKFgj5s7z9U9jSp4BG8Tdd2UjYCkqHy7hr'
}

// Expected transaction outputs structure
const expectedSLPTransactionOutputs = [
  {
    sats: 0n,
    script: 'mock_slp_op_return_script' // OP_RETURN with SLP data
  },
  {
    sats: 546n,
    script: 'mock_recipient_script' // Token to recipient (dust only)
  },
  {
    sats: 546n,
    script: 'mock_sender_script' // Token change (dust only)
  },
  {
    sats: 3000n, // Remaining XEC back to sender
    script: 'mock_sender_script'
  }
]

module.exports = {
  // Individual UTXOs
  flctTokenUtxo,
  tgrTokenUtxo,
  xecOnlyUtxo,
  malformedTokenUtxo,

  // UTXO sets
  mixedTokenUtxos,
  emptyUtxos,
  xecOnlyUtxos,
  multipleSLPUtxos,

  // Token metadata
  flctTokenMetadata,
  tgrTokenMetadata,

  // Test data
  testAddresses,
  testWalletInfo,
  expectedSLPTransactionOutputs,

  // Helper constants
  DUST_LIMIT: 546,
  DEFAULT_SATS_PER_BYTE: 1.2,

  // Token IDs for easy reference
  FLCT_TOKEN_ID: '5e40dda12765d0b3819286f4bd50ec58a4bf8d7dbfd277152693ad9d34912135',
  TGR_TOKEN_ID: '6887ab3749e0d5168a04838216895c95fce61f99237626b08d50db804fcb1801'
}
