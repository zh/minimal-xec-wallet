/*
  Unit test mocks for XEC wallet operations.
  These mocks simulate wallet creation and key management using real key generation.
*/

const KeyDerivation = require('../../../lib/key-derivation')

// Generate real keys using the library's own methods
const keyDerivation = new KeyDerivation()

// Generate a consistent test mnemonic
const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// Derive real keys from the test mnemonic
const realKeyData = keyDerivation.deriveFromMnemonic(testMnemonic, "m/44'/899'/0'/0/0")

// Mock wallet info for testing with real keys
const mockXecWalletInfo = {
  mnemonic: testMnemonic,
  privateKey: realKeyData.privateKey,
  publicKey: realKeyData.publicKey,
  xecAddress: realKeyData.address,
  hdPath: "m/44'/899'/0'/0/0",
  fee: 1.2,
  enableDonations: false
}

// Mock encrypted mnemonic
const mockEncryptedMnemonic = '{"salt":"deadbeef","iv":"cafebabe","encrypted":"encrypted_data_here"}'

// Mock key derivation results with real keys
const mockKeyDerivation = {
  hdIndex: 0,
  wif: realKeyData.privateKey,
  publicKey: realKeyData.publicKey,
  xecAddress: realKeyData.address
}

// Generate additional real addresses for testing
const realKeyData2 = keyDerivation.deriveFromMnemonic(testMnemonic, "m/44'/899'/0'/0/1")
const realKeyData3 = keyDerivation.deriveFromMnemonic(testMnemonic, "m/44'/899'/0'/0/2")

// Mock XEC addresses for testing - use hardcoded addresses to avoid derivation issues in test environment
const mockXecAddresses = {
  valid: [
    'ecash:qrdczda80g7red03zqd02uuxjhfqxrthdywrq8cx3a', // Primary test address
    'ecash:qqzrk6z7p8qp29fw5wunw7ak865y2jewjs99gt9chw', // Secondary test address
    'ecash:qzj28m9sjvumvu3y0xgprp4vdep8wjazuu4je3jl5t' // Tertiary test address
  ],
  invalid: [
    'bitcoincash:qp1234567890abcdef1234567890abcdef1234567890', // Wrong prefix
    'ecash:invalid_address_format',
    'not_an_address',
    '',
    null,
    undefined
  ],
  test: [
    'test-address-1',
    'test-address-2'
  ]
}

// Mock transaction outputs for testing
const mockXecOutputs = [
  {
    address: realKeyData.address, // Use real derived address
    amountSat: 100000 // 1000 XEC
  }
]

const mockMultipleXecOutputs = [
  {
    address: realKeyData.address, // Use real derived address
    amountSat: 50000 // 500 XEC
  },
  {
    address: realKeyData2.address, // Use second real derived address
    amountSat: 30000 // 300 XEC
  }
]

// Mock transaction hex for broadcasting
const mockTransactionHex = '0200000001...' // Would be full hex in real scenario

module.exports = {
  mockXecWalletInfo,
  mockEncryptedMnemonic,
  mockKeyDerivation,
  mockXecAddresses,
  mockXecOutputs,
  mockMultipleXecOutputs,
  mockTransactionHex,
  // Export additional real key data for tests that need different keys
  realKeyData,
  realKeyData2,
  realKeyData3
}
