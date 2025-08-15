/*
  Unit tests for TokenProtocolDetector - the core component for hybrid SLP/ALP protocol detection.
  Tests protocol detection, UTXO categorization, and token inventory management.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Test data
const tokenMocks = require('./mocks/token-mocks')

// Unit under test
const TokenProtocolDetector = require('../../lib/token-protocol-detector')

describe('#TokenProtocolDetector', () => {
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('#detectProtocol', () => {
    it('should detect XEC protocol for UTXOs without token data', () => {
      const xecUtxo = tokenMocks.xecOnlyUtxo
      const result = TokenProtocolDetector.detectProtocol(xecUtxo)
      assert.equal(result, 'XEC')
    })

    it('should detect SLP protocol for SLP token UTXOs', () => {
      const slpUtxo = tokenMocks.flctTokenUtxo
      const result = TokenProtocolDetector.detectProtocol(slpUtxo)
      assert.equal(result, 'SLP')
    })

    it('should detect ALP protocol for ALP token UTXOs', () => {
      const alpUtxo = tokenMocks.tgrTokenUtxo
      const result = TokenProtocolDetector.detectProtocol(alpUtxo)
      assert.equal(result, 'ALP')
    })

    it('should return XEC for null/undefined UTXOs', () => {
      assert.equal(TokenProtocolDetector.detectProtocol(null), 'XEC')
      assert.equal(TokenProtocolDetector.detectProtocol(undefined), 'XEC')
    })

    it('should throw error for unknown token protocols', () => {
      const unknownProtocolUtxo = {
        ...tokenMocks.flctTokenUtxo,
        token: {
          ...tokenMocks.flctTokenUtxo.token,
          tokenType: {
            protocol: 'UNKNOWN_PROTOCOL',
            type: 'UNKNOWN_TYPE'
          }
        }
      }

      assert.throws(() => {
        TokenProtocolDetector.detectProtocol(unknownProtocolUtxo)
      }, /Unknown token protocol: UNKNOWN_PROTOCOL/)
    })

    it('should handle malformed token data gracefully', () => {
      const malformedUtxo = tokenMocks.malformedTokenUtxo

      assert.throws(() => {
        TokenProtocolDetector.detectProtocol(malformedUtxo)
      }, /Unknown token protocol/)
    })
  })

  describe('#detectProtocolFromMetadata', () => {
    it('should detect SLP from token metadata', () => {
      const slpMetadata = tokenMocks.flctTokenMetadata
      const result = TokenProtocolDetector.detectProtocolFromMetadata(slpMetadata)
      assert.equal(result, 'SLP')
    })

    it('should detect ALP from token metadata', () => {
      const alpMetadata = tokenMocks.tgrTokenMetadata
      const result = TokenProtocolDetector.detectProtocolFromMetadata(alpMetadata)
      assert.equal(result, 'ALP')
    })

    it('should throw error for invalid metadata', () => {
      const invalidMetadata = { invalidField: 'test' }

      assert.throws(() => {
        TokenProtocolDetector.detectProtocolFromMetadata(invalidMetadata)
      }, /Invalid token metadata/)
    })
  })

  describe('#categorizeUtxos', () => {
    it('should categorize mixed UTXOs correctly', () => {
      const mixedUtxos = tokenMocks.mixedTokenUtxos
      const result = TokenProtocolDetector.categorizeUtxos(mixedUtxos)

      assert.isObject(result)
      assert.property(result, 'xecUtxos')
      assert.property(result, 'slpUtxos')
      assert.property(result, 'alpUtxos')

      assert.isArray(result.xecUtxos)
      assert.isArray(result.slpUtxos)
      assert.isArray(result.alpUtxos)

      assert.equal(result.xecUtxos.length, 1)
      assert.equal(result.slpUtxos.length, 1)
      assert.equal(result.alpUtxos.length, 1)

      // Verify XEC UTXO
      assert.equal(result.xecUtxos[0].outpoint.txid, tokenMocks.xecOnlyUtxo.outpoint.txid)

      // Verify SLP UTXO
      assert.equal(result.slpUtxos[0].token.tokenType.protocol, 'SLP')
      assert.equal(result.slpUtxos[0].token.tokenId, tokenMocks.FLCT_TOKEN_ID)

      // Verify ALP UTXO
      assert.equal(result.alpUtxos[0].token.tokenType.protocol, 'ALP')
      assert.equal(result.alpUtxos[0].token.tokenId, tokenMocks.TGR_TOKEN_ID)
    })

    it('should handle empty UTXO array', () => {
      const result = TokenProtocolDetector.categorizeUtxos([])

      assert.deepEqual(result.xecUtxos, [])
      assert.deepEqual(result.slpUtxos, [])
      assert.deepEqual(result.alpUtxos, [])
    })

    it('should handle XEC-only UTXOs', () => {
      const xecOnlyUtxos = tokenMocks.xecOnlyUtxos
      const result = TokenProtocolDetector.categorizeUtxos(xecOnlyUtxos)

      assert.equal(result.xecUtxos.length, 2)
      assert.equal(result.slpUtxos.length, 0)
      assert.equal(result.alpUtxos.length, 0)
    })
  })

  describe('#filterUtxosForToken', () => {
    it('should filter UTXOs for specific SLP token', () => {
      const mixedUtxos = tokenMocks.mixedTokenUtxos
      const result = TokenProtocolDetector.filterUtxosForToken(mixedUtxos, tokenMocks.FLCT_TOKEN_ID)

      assert.isObject(result)
      assert.property(result, 'tokenUtxos')
      assert.property(result, 'otherUtxos')
      assert.property(result, 'protocol')
      assert.property(result, 'tokenSummary')

      assert.equal(result.protocol, 'SLP')
      assert.equal(result.tokenUtxos.length, 1)
      assert.equal(result.otherUtxos.length, 2) // 1 ALP + 1 XEC

      // Verify token summary
      assert.property(result.tokenSummary, 'totalAtoms')
      assert.property(result.tokenSummary, 'utxoCount')
      assert.equal(result.tokenSummary.totalAtoms, 6n) // FLCT has 6 atoms
      assert.equal(result.tokenSummary.utxoCount, 1)
    })

    it('should filter UTXOs for specific ALP token', () => {
      const mixedUtxos = tokenMocks.mixedTokenUtxos
      const result = TokenProtocolDetector.filterUtxosForToken(mixedUtxos, tokenMocks.TGR_TOKEN_ID)

      assert.equal(result.protocol, 'ALP')
      assert.equal(result.tokenUtxos.length, 1)
      assert.equal(result.otherUtxos.length, 2) // 1 SLP + 1 XEC
      assert.equal(result.tokenSummary.totalAtoms, 7n) // TGR has 7 atoms
    })

    it('should handle non-existent token ID', () => {
      const mixedUtxos = tokenMocks.mixedTokenUtxos
      const result = TokenProtocolDetector.filterUtxosForToken(mixedUtxos, 'non_existent_token_id')

      assert.equal(result.tokenUtxos.length, 0)
      assert.equal(result.otherUtxos.length, 3) // All UTXOs are "other"
      assert.equal(result.tokenSummary.totalAtoms, 0n)
      assert.equal(result.tokenSummary.utxoCount, 0)
    })

    it('should aggregate multiple UTXOs for same token', () => {
      const multipleSlpUtxos = [
        ...tokenMocks.multipleSLPUtxos,
        tokenMocks.xecOnlyUtxo
      ]

      const result = TokenProtocolDetector.filterUtxosForToken(multipleSlpUtxos, tokenMocks.FLCT_TOKEN_ID)

      assert.equal(result.tokenUtxos.length, 3)
      assert.equal(result.otherUtxos.length, 1) // Only XEC UTXO
      assert.equal(result.tokenSummary.totalAtoms, 18n) // 10 + 5 + 3 = 18
      assert.equal(result.tokenSummary.utxoCount, 3)
    })
  })

  describe('#getTokenInventory', () => {
    it('should create inventory for mixed token UTXOs', () => {
      const mixedUtxos = tokenMocks.mixedTokenUtxos
      const inventory = TokenProtocolDetector.getTokenInventory(mixedUtxos)

      assert.isArray(inventory)
      assert.equal(inventory.length, 2) // FLCT + TGR

      // Check for FLCT (SLP)
      const flctEntry = inventory.find(entry => entry.tokenId === tokenMocks.FLCT_TOKEN_ID)
      assert.isObject(flctEntry)
      assert.equal(flctEntry.protocol, 'SLP')
      assert.equal(flctEntry.utxoCount, 1)
      assert.equal(flctEntry.totalAtoms, 6n)

      // Check for TGR (ALP)
      const tgrEntry = inventory.find(entry => entry.tokenId === tokenMocks.TGR_TOKEN_ID)
      assert.isObject(tgrEntry)
      assert.equal(tgrEntry.protocol, 'ALP')
      assert.equal(tgrEntry.utxoCount, 1)
      assert.equal(tgrEntry.totalAtoms, 7n)
    })

    it('should handle empty UTXO array', () => {
      const inventory = TokenProtocolDetector.getTokenInventory([])
      assert.isArray(inventory)
      assert.equal(inventory.length, 0)
    })

    it('should handle XEC-only UTXOs', () => {
      const inventory = TokenProtocolDetector.getTokenInventory(tokenMocks.xecOnlyUtxos)
      assert.isArray(inventory)
      assert.equal(inventory.length, 0)
    })

    it('should aggregate multiple UTXOs for same token type', () => {
      const multipleTokenUtxos = [
        ...tokenMocks.multipleSLPUtxos,
        tokenMocks.tgrTokenUtxo
      ]

      const inventory = TokenProtocolDetector.getTokenInventory(multipleTokenUtxos)

      assert.equal(inventory.length, 2) // FLCT + TGR

      const flctEntry = inventory.find(entry => entry.tokenId === tokenMocks.FLCT_TOKEN_ID)
      assert.equal(flctEntry.utxoCount, 3) // 3 FLCT UTXOs
      assert.equal(flctEntry.totalAtoms, 18n) // 10 + 5 + 3 = 18
    })
  })

  describe('#getProtocolStats', () => {
    it('should calculate correct protocol statistics', () => {
      const mixedUtxos = tokenMocks.mixedTokenUtxos
      const stats = TokenProtocolDetector.getProtocolStats(mixedUtxos)

      assert.isObject(stats)
      assert.property(stats, 'totalUtxos')
      assert.property(stats, 'xecUtxos')
      assert.property(stats, 'slpUtxos')
      assert.property(stats, 'alpUtxos')
      assert.property(stats, 'totalXecSats')
      assert.property(stats, 'hasTokens')
      assert.property(stats, 'protocols')

      assert.equal(stats.totalUtxos, 3)
      assert.equal(stats.xecUtxos, 1)
      assert.equal(stats.slpUtxos, 1)
      assert.equal(stats.alpUtxos, 1)
      assert.equal(stats.totalXecSats, 3599 + 546 + 546) // XEC + 2 dust amounts
      assert.equal(stats.hasTokens, true)
      assert.deepEqual(stats.protocols, ['SLP', 'ALP'])
    })

    it('should handle XEC-only wallet stats', () => {
      const xecOnlyUtxos = tokenMocks.xecOnlyUtxos
      const stats = TokenProtocolDetector.getProtocolStats(xecOnlyUtxos)

      assert.equal(stats.totalUtxos, 2)
      assert.equal(stats.xecUtxos, 2)
      assert.equal(stats.slpUtxos, 0)
      assert.equal(stats.alpUtxos, 0)
      assert.equal(stats.hasTokens, false)
      assert.deepEqual(stats.protocols, [])
    })

    it('should handle empty UTXO array', () => {
      const stats = TokenProtocolDetector.getProtocolStats([])

      assert.equal(stats.totalUtxos, 0)
      assert.equal(stats.xecUtxos, 0)
      assert.equal(stats.slpUtxos, 0)
      assert.equal(stats.alpUtxos, 0)
      assert.equal(stats.totalXecSats, 0)
      assert.equal(stats.hasTokens, false)
      assert.deepEqual(stats.protocols, [])
    })
  })

  describe('#hasTokens', () => {
    it('should return true for UTXOs with tokens', () => {
      const hasTokens = TokenProtocolDetector.hasTokens(tokenMocks.mixedTokenUtxos)
      assert.equal(hasTokens, true)
    })

    it('should return false for XEC-only UTXOs', () => {
      const hasTokens = TokenProtocolDetector.hasTokens(tokenMocks.xecOnlyUtxos)
      assert.equal(hasTokens, false)
    })

    it('should return false for empty array', () => {
      const hasTokens = TokenProtocolDetector.hasTokens([])
      assert.equal(hasTokens, false)
    })
  })

  describe('#hasProtocolTokens', () => {
    it('should return true for SLP tokens when checking SLP', () => {
      const hasSlpTokens = TokenProtocolDetector.hasProtocolTokens(tokenMocks.mixedTokenUtxos, 'SLP')
      assert.equal(hasSlpTokens, true)
    })

    it('should return true for ALP tokens when checking ALP', () => {
      const hasAlpTokens = TokenProtocolDetector.hasProtocolTokens(tokenMocks.mixedTokenUtxos, 'ALP')
      assert.equal(hasAlpTokens, true)
    })

    it('should return false when checking for non-existent protocol', () => {
      const hasOtherTokens = TokenProtocolDetector.hasProtocolTokens(tokenMocks.mixedTokenUtxos, 'OTHER')
      assert.equal(hasOtherTokens, false)
    })

    it('should return false for XEC-only UTXOs', () => {
      const hasSlpTokens = TokenProtocolDetector.hasProtocolTokens(tokenMocks.xecOnlyUtxos, 'SLP')
      const hasAlpTokens = TokenProtocolDetector.hasProtocolTokens(tokenMocks.xecOnlyUtxos, 'ALP')

      assert.equal(hasSlpTokens, false)
      assert.equal(hasAlpTokens, false)
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large UTXO sets efficiently', () => {
      // Create a large UTXO set
      const largeUtxoSet = []
      for (let i = 0; i < 1000; i++) {
        largeUtxoSet.push({
          ...tokenMocks.xecOnlyUtxo,
          outpoint: { txid: `large_utxo_${i}`, outIdx: 0 }
        })
      }

      const startTime = Date.now()
      const stats = TokenProtocolDetector.getProtocolStats(largeUtxoSet)
      const endTime = Date.now()

      assert.equal(stats.totalUtxos, 1000)
      assert.equal(stats.xecUtxos, 1000)

      // Should complete within reasonable time (< 100ms)
      assert.isBelow(endTime - startTime, 100)
    })

    it('should handle malformed UTXO data gracefully', () => {
      const malformedUtxos = [
        null,
        undefined,
        {},
        { invalidField: 'test' },
        tokenMocks.xecOnlyUtxo // Valid UTXO for comparison
      ]

      // Should not throw errors, but handle gracefully
      assert.doesNotThrow(() => {
        const stats = TokenProtocolDetector.getProtocolStats(malformedUtxos)
        assert.isObject(stats)
      })
    })
  })
})
