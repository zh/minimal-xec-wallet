/*
  Unit tests for HybridTokenManager - the main orchestrator for SLP/ALP token operations.
  Tests protocol routing, token listing, and unified interface functionality.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Test data
const tokenMocks = require('./mocks/token-mocks')

// Unit under test
const HybridTokenManager = require('../../lib/hybrid-token-manager')

describe('#HybridTokenManager', () => {
  let sandbox, uut, mockChronik, mockAr

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    // Create mock chronik client with both token types
    mockChronik = {
      token: sandbox.stub().callsFake((tokenId) => {
        if (tokenId === tokenMocks.FLCT_TOKEN_ID) {
          return Promise.resolve(tokenMocks.flctTokenMetadata)
        } else if (tokenId === tokenMocks.TGR_TOKEN_ID) {
          return Promise.resolve(tokenMocks.tgrTokenMetadata)
        } else {
          return Promise.reject(new Error('Token not found'))
        }
      })
    }

    // Create mock adapter router
    mockAr = {
      sendTx: sandbox.stub().resolves('mock_hybrid_transaction_id')
    }

    // Initialize manager with mocks
    uut = new HybridTokenManager({
      chronik: mockChronik,
      ar: mockAr
    })
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('#constructor', () => {
    it('should instantiate with required dependencies', () => {
      assert.property(uut, 'chronik')
      assert.property(uut, 'ar')
      assert.property(uut, 'slpHandler')
      assert.property(uut, 'alpHandler')
      assert.property(uut, 'tokenMetadataCache')
      assert.instanceOf(uut.tokenMetadataCache, Map)
    })

    it('should throw error without chronik client', () => {
      assert.throws(() => {
        const manager = new HybridTokenManager({ ar: mockAr })
        return manager
      }, /Chronik client required/)
    })

    it('should throw error without adapter router', () => {
      assert.throws(() => {
        const manager = new HybridTokenManager({ chronik: mockChronik })
        return manager
      }, /AdapterRouter required/)
    })

    it('should initialize protocol handlers', () => {
      assert.isObject(uut.slpHandler)
      assert.isObject(uut.alpHandler)
      assert.property(uut.slpHandler, 'sendTokens')
      assert.property(uut.alpHandler, 'sendTokens')
    })
  })

  describe('#sendTokens', () => {
    it('should route SLP tokens to SLP handler', async () => {
      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 2
      }]

      // Mock SLP handler
      const slpSendStub = sandbox.stub(uut.slpHandler, 'sendTokens').resolves('slp_transaction_id')
      const alpSendStub = sandbox.stub(uut.alpHandler, 'sendTokens').resolves('alp_transaction_id')

      const result = await uut.sendTokens(
        tokenMocks.FLCT_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.equal(result, 'slp_transaction_id')
      assert.isTrue(slpSendStub.calledOnce)
      assert.isFalse(alpSendStub.called)
    })

    it('should route ALP tokens to ALP handler', async () => {
      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 3
      }]

      // Mock handlers
      const slpSendStub = sandbox.stub(uut.slpHandler, 'sendTokens').resolves('slp_transaction_id')
      const alpSendStub = sandbox.stub(uut.alpHandler, 'sendTokens').resolves('alp_transaction_id')

      const result = await uut.sendTokens(
        tokenMocks.TGR_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.equal(result, 'alp_transaction_id')
      assert.isTrue(alpSendStub.calledOnce)
      assert.isFalse(slpSendStub.called)
    })

    it('should detect protocol from UTXOs when metadata lookup fails', async () => {
      // Mock chronik to fail for token metadata
      mockChronik.token.rejects(new Error('Network error'))

      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 1
      }]

      // Mock SLP handler since FLCT is in the UTXOs as SLP
      const slpSendStub = sandbox.stub(uut.slpHandler, 'sendTokens').resolves('slp_utxo_detected')

      const result = await uut.sendTokens(
        tokenMocks.FLCT_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.equal(result, 'slp_utxo_detected')
      assert.isTrue(slpSendStub.calledOnce)
    })

    it('should handle unknown protocols', async () => {
      // Mock chronik to return unknown protocol
      mockChronik.token.resolves({
        tokenId: 'unknown_token',
        tokenType: { protocol: 'UNKNOWN_PROTOCOL' }
      })

      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.sendTokens(
          'unknown_token',
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Cannot determine protocol for token unknown_token')
      }
    })

    it('should propagate handler errors', async () => {
      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      // Mock SLP handler to throw error
      sandbox.stub(uut.slpHandler, 'sendTokens').rejects(new Error('SLP handler error'))

      try {
        await uut.sendTokens(
          tokenMocks.FLCT_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Token send failed')
        assert.include(err.message, 'SLP handler error')
      }
    })
  })

  describe('#burnTokens', () => {
    it('should route SLP token burns to SLP handler', async () => {
      const burnAmount = 2

      // Mock SLP handler
      const slpBurnStub = sandbox.stub(uut.slpHandler, 'burnTokens').resolves('slp_burn_txid')
      const alpBurnStub = sandbox.stub(uut.alpHandler, 'burnTokens').resolves('alp_burn_txid')

      const result = await uut.burnTokens(
        tokenMocks.FLCT_TOKEN_ID,
        burnAmount,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.equal(result, 'slp_burn_txid')
      assert.isTrue(slpBurnStub.calledOnce)
      assert.isFalse(alpBurnStub.called)
    })

    it('should route ALP token burns to ALP handler', async () => {
      const burnAmount = 3

      // Mock handlers
      const slpBurnStub = sandbox.stub(uut.slpHandler, 'burnTokens').resolves('slp_burn_txid')
      const alpBurnStub = sandbox.stub(uut.alpHandler, 'burnTokens').resolves('alp_burn_txid')

      const result = await uut.burnTokens(
        tokenMocks.TGR_TOKEN_ID,
        burnAmount,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.equal(result, 'alp_burn_txid')
      assert.isTrue(alpBurnStub.calledOnce)
      assert.isFalse(slpBurnStub.called)
    })

    it('should handle burn errors', async () => {
      // Mock ALP handler to throw error
      sandbox.stub(uut.alpHandler, 'burnTokens').rejects(new Error('ALP burn error'))

      try {
        await uut.burnTokens(
          tokenMocks.TGR_TOKEN_ID,
          1,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Token burn failed')
        assert.include(err.message, 'ALP burn error')
      }
    })
  })

  describe('#listTokensFromUtxos', () => {
    it('should list both SLP and ALP tokens', async () => {
      const tokens = await uut.listTokensFromUtxos(tokenMocks.mixedTokenUtxos)

      assert.isArray(tokens)
      assert.equal(tokens.length, 2)

      // Find FLCT (SLP) token
      const flctToken = tokens.find(t => t.tokenId === tokenMocks.FLCT_TOKEN_ID)
      assert.isObject(flctToken)
      assert.equal(flctToken.protocol, 'SLP')
      assert.equal(flctToken.ticker, 'FLCT')
      assert.equal(flctToken.name, 'Falcon Token')
      assert.equal(flctToken.balance.display, 6)
      assert.equal(flctToken.balance.atoms, 6n)

      // Find TGR (ALP) token
      const tgrToken = tokens.find(t => t.tokenId === tokenMocks.TGR_TOKEN_ID)
      assert.isObject(tgrToken)
      assert.equal(tgrToken.protocol, 'ALP')
      assert.equal(tgrToken.ticker, 'TGR')
      assert.equal(tgrToken.name, 'Tiger Cub')
      assert.equal(tgrToken.balance.display, 7)
      assert.equal(tgrToken.balance.atoms, 7n)
    })

    it('should handle empty UTXO array', async () => {
      const tokens = await uut.listTokensFromUtxos([])

      assert.isArray(tokens)
      assert.equal(tokens.length, 0)
    })

    it('should handle XEC-only UTXOs', async () => {
      const tokens = await uut.listTokensFromUtxos(tokenMocks.xecOnlyUtxos)

      assert.isArray(tokens)
      assert.equal(tokens.length, 0)
    })

    it('should handle token metadata errors gracefully', async () => {
      // Mock chronik to fail for one token
      mockChronik.token.callsFake((tokenId) => {
        if (tokenId === tokenMocks.FLCT_TOKEN_ID) {
          return Promise.reject(new Error('FLCT metadata error'))
        } else if (tokenId === tokenMocks.TGR_TOKEN_ID) {
          return Promise.resolve(tokenMocks.tgrTokenMetadata)
        }
        return Promise.reject(new Error('Token not found'))
      })

      // Should still return TGR token even if FLCT fails
      const tokens = await uut.listTokensFromUtxos(tokenMocks.mixedTokenUtxos)

      assert.isArray(tokens)
      assert.equal(tokens.length, 1)
      assert.equal(tokens[0].ticker, 'TGR')
    })

    it('should include all required token properties', async () => {
      const tokens = await uut.listTokensFromUtxos(tokenMocks.mixedTokenUtxos)
      const token = tokens[0]

      // Verify all expected properties are present
      assert.property(token, 'tokenId')
      assert.property(token, 'protocol')
      assert.property(token, 'ticker')
      assert.property(token, 'name')
      assert.property(token, 'decimals')
      assert.property(token, 'url')
      assert.property(token, 'balance')
      assert.property(token, 'utxoCount')
      assert.property(token, 'utxos')

      // Verify balance structure
      assert.property(token.balance, 'display')
      assert.property(token.balance, 'atoms')
      assert.isNumber(token.balance.display)
      assert.equal(typeof token.balance.atoms, 'bigint')
    })
  })

  describe('#getTokenBalance', () => {
    it('should get SLP token balance', async () => {
      const balance = await uut.getTokenBalance(tokenMocks.FLCT_TOKEN_ID, tokenMocks.mixedTokenUtxos)

      assert.isObject(balance)
      assert.equal(balance.tokenId, tokenMocks.FLCT_TOKEN_ID)
      assert.equal(balance.protocol, 'SLP')
      assert.equal(balance.ticker, 'FLCT')
      assert.equal(balance.balance.display, 6)
      assert.equal(balance.balance.atoms, 6n)
      assert.equal(balance.utxoCount, 1)
    })

    it('should get ALP token balance', async () => {
      const balance = await uut.getTokenBalance(tokenMocks.TGR_TOKEN_ID, tokenMocks.mixedTokenUtxos)

      assert.isObject(balance)
      assert.equal(balance.tokenId, tokenMocks.TGR_TOKEN_ID)
      assert.equal(balance.protocol, 'ALP')
      assert.equal(balance.ticker, 'TGR')
      assert.equal(balance.balance.display, 7)
      assert.equal(balance.balance.atoms, 7n)
    })

    it('should return zero balance for non-existent tokens', async () => {
      const balance = await uut.getTokenBalance('non_existent_token', tokenMocks.mixedTokenUtxos)

      assert.equal(balance.balance.display, 0)
      assert.equal(balance.balance.atoms, 0n)
      assert.equal(balance.utxoCount, 0)
    })
  })

  describe('#getTokenData', () => {
    it('should get comprehensive token data', async () => {
      const tokenData = await uut.getTokenData(tokenMocks.FLCT_TOKEN_ID)

      assert.isObject(tokenData)
      assert.equal(tokenData.tokenId, tokenMocks.FLCT_TOKEN_ID)
      assert.equal(tokenData.protocol, 'SLP')
      assert.equal(tokenData.ticker, 'FLCT')
      assert.equal(tokenData.name, 'Falcon Token')
      assert.equal(tokenData.decimals, 0)
      assert.property(tokenData, 'url')
      assert.property(tokenData, 'timeFirstSeen')
    })

    it('should handle transaction history flag', async () => {
      const tokenData = await uut.getTokenData(tokenMocks.FLCT_TOKEN_ID, true)

      assert.property(tokenData, 'txHistory')
      // Currently returns placeholder, but property should exist
    })
  })

  describe('#_detectTokenProtocol', () => {
    it('should detect protocol from UTXOs first', async () => {
      const protocol = await uut._detectTokenProtocol(tokenMocks.FLCT_TOKEN_ID, tokenMocks.mixedTokenUtxos)

      assert.equal(protocol, 'SLP')
      // Should not call chronik.token since UTXO detection worked
      assert.equal(mockChronik.token.callCount, 0)
    })

    it('should fallback to metadata lookup', async () => {
      // Use UTXOs without the target token
      const protocol = await uut._detectTokenProtocol(tokenMocks.FLCT_TOKEN_ID, tokenMocks.xecOnlyUtxos)

      assert.equal(protocol, 'SLP')
      // Should call chronik.token for fallback
      assert.isTrue(mockChronik.token.calledOnce)
    })

    it('should handle detection failure', async () => {
      // Mock chronik to fail
      mockChronik.token.rejects(new Error('Token not found'))

      try {
        await uut._detectTokenProtocol('unknown_token', tokenMocks.xecOnlyUtxos)
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Cannot determine protocol')
      }
    })
  })

  describe('#_getTokenInfo (caching)', () => {
    it('should cache token metadata', async () => {
      // First call
      const info1 = await uut._getTokenInfo(tokenMocks.FLCT_TOKEN_ID)

      // Second call
      const info2 = await uut._getTokenInfo(tokenMocks.FLCT_TOKEN_ID)

      assert.deepEqual(info1, info2)
      // Should only call chronik once due to caching
      assert.equal(mockChronik.token.callCount, 1)
    })

    it('should handle metadata fetch errors', async () => {
      mockChronik.token.rejects(new Error('Metadata fetch failed'))

      try {
        await uut._getTokenInfo('invalid_token')
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Failed to fetch token metadata')
      }
    })
  })

  describe('Utility Methods', () => {
    it('should expose protocol detector methods', () => {
      const stats = uut.getProtocolStats(tokenMocks.mixedTokenUtxos)
      assert.isObject(stats)
      assert.property(stats, 'totalUtxos')
      assert.property(stats, 'hasTokens')

      const hasTokens = uut.hasTokens(tokenMocks.mixedTokenUtxos)
      assert.equal(hasTokens, true)

      const hasSlp = uut.hasProtocolTokens(tokenMocks.mixedTokenUtxos, 'SLP')
      assert.equal(hasSlp, true)

      const categorized = uut.categorizeUtxos(tokenMocks.mixedTokenUtxos)
      assert.property(categorized, 'xecUtxos')
      assert.property(categorized, 'slpUtxos')
      assert.property(categorized, 'alpUtxos')
    })
  })

  describe('Cache Management', () => {
    it('should clear cache', () => {
      // Add something to cache
      uut.tokenMetadataCache.set('test_token', { data: 'test' })
      assert.equal(uut.tokenMetadataCache.size, 1)

      uut.clearCache()
      assert.equal(uut.tokenMetadataCache.size, 0)
    })

    it('should provide cache statistics', async () => {
      // Add some tokens to cache
      await uut._getTokenInfo(tokenMocks.FLCT_TOKEN_ID)
      await uut._getTokenInfo(tokenMocks.TGR_TOKEN_ID)

      const stats = uut.getCacheStats()
      assert.property(stats, 'cachedTokens')
      assert.property(stats, 'tokenIds')
      assert.equal(stats.cachedTokens, 2)
      assert.isArray(stats.tokenIds)
      assert.include(stats.tokenIds, tokenMocks.FLCT_TOKEN_ID)
      assert.include(stats.tokenIds, tokenMocks.TGR_TOKEN_ID)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle mixed protocol operations', async () => {
      // Send different protocols in sequence
      const slpStub = sandbox.stub(uut.slpHandler, 'sendTokens').resolves('slp_txid')
      const alpStub = sandbox.stub(uut.alpHandler, 'sendTokens').resolves('alp_txid')

      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      // Send SLP token
      const slpResult = await uut.sendTokens(
        tokenMocks.FLCT_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      // Send ALP token
      const alpResult = await uut.sendTokens(
        tokenMocks.TGR_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.equal(slpResult, 'slp_txid')
      assert.equal(alpResult, 'alp_txid')
      assert.isTrue(slpStub.calledOnce)
      assert.isTrue(alpStub.calledOnce)
    })

    it('should handle large token lists efficiently', async () => {
      // Create many token UTXOs
      const manyTokenUtxos = []
      for (let i = 0; i < 100; i++) {
        manyTokenUtxos.push({
          ...tokenMocks.flctTokenUtxo,
          outpoint: { txid: `many_tokens_${i}`, outIdx: 0 }
        })
      }

      const startTime = Date.now()
      const tokens = await uut.listTokensFromUtxos(manyTokenUtxos)
      const endTime = Date.now()

      assert.isArray(tokens)
      assert.equal(tokens.length, 1) // All same token ID, so should be aggregated

      // Should complete in reasonable time
      assert.isBelow(endTime - startTime, 1000) // Less than 1 second
    })

    it('should handle invalid wallet configurations', () => {
      assert.throws(() => {
        const manager = new HybridTokenManager({})
        return manager
      }, /Chronik client required/)

      assert.throws(() => {
        const manager = new HybridTokenManager({ chronik: mockChronik })
        return manager
      }, /AdapterRouter required/)
    })
  })
})
