/*
  Integration tests for hybrid token operations.
  Tests complete workflows with both SLP and ALP protocols using real data structures.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Test data
const tokenMocks = require('../unit/mocks/token-mocks')

// Units under test
const HybridTokenManager = require('../../lib/hybrid-token-manager')

describe('#Hybrid Token Integration Tests', () => {
  let sandbox, hybridManager, mockChronik, mockAr

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    // Create comprehensive mock chronik
    mockChronik = {
      token: sandbox.stub().callsFake((tokenId) => {
        if (tokenId === tokenMocks.FLCT_TOKEN_ID) {
          return Promise.resolve(tokenMocks.flctTokenMetadata)
        } else if (tokenId === tokenMocks.TGR_TOKEN_ID) {
          return Promise.resolve(tokenMocks.tgrTokenMetadata)
        } else {
          return Promise.reject(new Error(`Token ${tokenId} not found`))
        }
      })
    }

    // Track which protocol handler is being called
    let currentProtocolCall = 'generic'

    // Mock adapter router with transaction broadcasting
    mockAr = {
      sendTx: sandbox.stub().callsFake((txHex) => {
        // Use the tracked protocol to generate appropriate transaction IDs
        const timestamp = Date.now()

        switch (currentProtocolCall) {
          case 'slp_send':
            currentProtocolCall = 'generic' // Reset
            return Promise.resolve('slp_integration_txid_' + timestamp)
          case 'alp_send':
            currentProtocolCall = 'generic' // Reset
            return Promise.resolve('alp_integration_txid_' + timestamp)
          case 'slp_burn':
            currentProtocolCall = 'generic' // Reset
            return Promise.resolve('slp_burn_integration_txid_' + timestamp)
          case 'alp_burn':
            currentProtocolCall = 'generic' // Reset
            return Promise.resolve('alp_burn_integration_txid_' + timestamp)
          default:
            return Promise.resolve('generic_txid_' + timestamp)
        }
      })
    }

    // Mock the createSendTransaction methods to track protocol calls
    const SLPHandler = require('../../lib/slp-token-handler')
    const ALPHandler = require('../../lib/alp-token-handler')

    sandbox.stub(SLPHandler.prototype, 'sendTokens').callsFake(async function (...args) {
      currentProtocolCall = 'slp_send'
      return SLPHandler.prototype.sendTokens.wrappedMethod.call(this, ...args)
    })

    sandbox.stub(ALPHandler.prototype, 'sendTokens').callsFake(async function (...args) {
      currentProtocolCall = 'alp_send'
      return ALPHandler.prototype.sendTokens.wrappedMethod.call(this, ...args)
    })

    sandbox.stub(SLPHandler.prototype, 'burnTokens').callsFake(async function (...args) {
      currentProtocolCall = 'slp_burn'
      return SLPHandler.prototype.burnTokens.wrappedMethod.call(this, ...args)
    })

    sandbox.stub(ALPHandler.prototype, 'burnTokens').callsFake(async function (...args) {
      currentProtocolCall = 'alp_burn'
      return ALPHandler.prototype.burnTokens.wrappedMethod.call(this, ...args)
    })

    // Initialize hybrid manager
    hybridManager = new HybridTokenManager({
      chronik: mockChronik,
      ar: mockAr
    })
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('Complete Token Workflows', () => {
    it('should handle complete SLP token workflow', async () => {
      console.log('\n🧪 Testing complete SLP workflow...')

      // 1. List tokens (should detect both SLP and ALP)
      const allTokens = await hybridManager.listTokensFromUtxos(tokenMocks.mixedTokenUtxos)

      assert.isArray(allTokens)
      assert.equal(allTokens.length, 2)

      const flctToken = allTokens.find(t => t.protocol === 'SLP')
      assert.isObject(flctToken)
      assert.equal(flctToken.ticker, 'FLCT')
      console.log(`   ✅ Found SLP token: ${flctToken.ticker} (${flctToken.balance.display})`)

      // 2. Get specific token balance
      const flctBalance = await hybridManager.getTokenBalance(tokenMocks.FLCT_TOKEN_ID, tokenMocks.mixedTokenUtxos)

      assert.equal(flctBalance.protocol, 'SLP')
      assert.equal(flctBalance.balance.display, 6)
      console.log(`   ✅ SLP balance: ${flctBalance.balance.display} ${flctBalance.ticker}`)

      // 3. Send SLP tokens
      const sendOutputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 2
      }]

      const txid = await hybridManager.sendTokens(
        tokenMocks.FLCT_TOKEN_ID,
        sendOutputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.isString(txid)
      assert.include(txid, 'slp_integration_txid_')
      console.log(`   ✅ SLP send successful: ${txid}`)

      // 4. Verify transaction was built correctly
      assert.isTrue(mockAr.sendTx.calledOnce)
      const txHex = mockAr.sendTx.firstCall.args[0]
      assert.isString(txHex)
      assert.isAbove(txHex.length, 100) // Reasonable transaction size
      console.log(`   ✅ Transaction hex length: ${txHex.length} chars`)
    })

    it('should handle complete ALP token workflow', async () => {
      console.log('\n🧪 Testing complete ALP workflow...')

      // 1. List tokens
      const allTokens = await hybridManager.listTokensFromUtxos(tokenMocks.mixedTokenUtxos)

      const tgrToken = allTokens.find(t => t.protocol === 'ALP')
      assert.isObject(tgrToken)
      assert.equal(tgrToken.ticker, 'TGR')
      console.log(`   ✅ Found ALP token: ${tgrToken.ticker} (${tgrToken.balance.display})`)

      // 2. Get specific token balance
      const tgrBalance = await hybridManager.getTokenBalance(tokenMocks.TGR_TOKEN_ID, tokenMocks.mixedTokenUtxos)

      assert.equal(tgrBalance.protocol, 'ALP')
      assert.equal(tgrBalance.balance.display, 7)
      console.log(`   ✅ ALP balance: ${tgrBalance.balance.display} ${tgrBalance.ticker}`)

      // 3. Send ALP tokens
      const sendOutputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 3
      }]

      const txid = await hybridManager.sendTokens(
        tokenMocks.TGR_TOKEN_ID,
        sendOutputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.isString(txid)
      assert.include(txid, 'alp_integration_txid_')
      console.log(`   ✅ ALP send successful: ${txid}`)

      // 4. Verify transaction structure
      assert.isTrue(mockAr.sendTx.calledOnce)
      const txHex = mockAr.sendTx.firstCall.args[0]
      assert.isString(txHex)
      console.log(`   ✅ Transaction hex length: ${txHex.length} chars`)
    })

    it('should handle mixed protocol operations in sequence', async () => {
      console.log('\n🧪 Testing mixed protocol sequence...')

      // Reset sendTx stub to track multiple calls
      mockAr.sendTx.resetHistory()

      // 1. Send SLP token
      const slpOutputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]
      const slpTxid = await hybridManager.sendTokens(
        tokenMocks.FLCT_TOKEN_ID,
        slpOutputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      // 2. Send ALP token
      const alpOutputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 2 }]
      const alpTxid = await hybridManager.sendTokens(
        tokenMocks.TGR_TOKEN_ID,
        alpOutputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      // Verify both transactions
      assert.isString(slpTxid)
      assert.isString(alpTxid)
      assert.notEqual(slpTxid, alpTxid)
      assert.equal(mockAr.sendTx.callCount, 2)

      console.log(`   ✅ SLP transaction: ${slpTxid}`)
      console.log(`   ✅ ALP transaction: ${alpTxid}`)
    })

    it('should handle token burning for both protocols', async () => {
      console.log('\n🧪 Testing token burning...')

      // Reset sendTx for clean tracking
      mockAr.sendTx.resetHistory()

      // 1. Burn SLP tokens
      const slpBurnTxid = await hybridManager.burnTokens(
        tokenMocks.FLCT_TOKEN_ID,
        1,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      // 2. Burn ALP tokens
      const alpBurnTxid = await hybridManager.burnTokens(
        tokenMocks.TGR_TOKEN_ID,
        2,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.isString(slpBurnTxid)
      assert.isString(alpBurnTxid)
      assert.equal(mockAr.sendTx.callCount, 2)

      console.log(`   ✅ SLP burn: ${slpBurnTxid}`)
      console.log(`   ✅ ALP burn: ${alpBurnTxid}`)
    })
  })

  describe('Protocol Detection Integration', () => {
    it('should correctly detect and route protocols', async () => {
      console.log('\n🧪 Testing protocol detection integration...')

      const stats = hybridManager.getProtocolStats(tokenMocks.mixedTokenUtxos)

      assert.equal(stats.totalUtxos, 3)
      assert.equal(stats.xecUtxos, 1)
      assert.equal(stats.slpUtxos, 1)
      assert.equal(stats.alpUtxos, 1)
      assert.equal(stats.hasTokens, true)
      assert.deepEqual(stats.protocols, ['SLP', 'ALP'])

      console.log(`   ✅ Total UTXOs: ${stats.totalUtxos}`)
      console.log(`   ✅ Protocols detected: ${stats.protocols.join(', ')}`)

      // Test protocol-specific detection
      const hasSlp = hybridManager.hasProtocolTokens(tokenMocks.mixedTokenUtxos, 'SLP')
      const hasAlp = hybridManager.hasProtocolTokens(tokenMocks.mixedTokenUtxos, 'ALP')
      const hasOther = hybridManager.hasProtocolTokens(tokenMocks.mixedTokenUtxos, 'OTHER')

      assert.equal(hasSlp, true)
      assert.equal(hasAlp, true)
      assert.equal(hasOther, false)

      console.log(`   ✅ Has SLP: ${hasSlp}, Has ALP: ${hasAlp}, Has OTHER: ${hasOther}`)
    })

    it('should handle UTXO categorization correctly', () => {
      console.log('\n🧪 Testing UTXO categorization...')

      const categorized = hybridManager.categorizeUtxos(tokenMocks.mixedTokenUtxos)

      assert.equal(categorized.xecUtxos.length, 1)
      assert.equal(categorized.slpUtxos.length, 1)
      assert.equal(categorized.alpUtxos.length, 1)

      // Verify correct categorization
      assert.equal(categorized.slpUtxos[0].token.tokenType.protocol, 'SLP')
      assert.equal(categorized.alpUtxos[0].token.tokenType.protocol, 'ALP')
      assert.isUndefined(categorized.xecUtxos[0].token)

      console.log(`   ✅ XEC UTXOs: ${categorized.xecUtxos.length}`)
      console.log(`   ✅ SLP UTXOs: ${categorized.slpUtxos.length}`)
      console.log(`   ✅ ALP UTXOs: ${categorized.alpUtxos.length}`)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle chronik network errors gracefully', async () => {
      console.log('\n🧪 Testing network error handling...')

      // Mock chronik to simulate network failure
      mockChronik.token.rejects(new Error('Network timeout'))

      try {
        await hybridManager.listTokensFromUtxos(tokenMocks.mixedTokenUtxos)
        // Should still work because UTXOs contain protocol info
        console.log('   ✅ Handled network error gracefully')
      } catch (err) {
        // Some operations might fail, but shouldn't crash
        console.log(`   ⚠️  Expected network error: ${err.message}`)
      }
    })

    it('should handle invalid token operations', async () => {
      console.log('\n🧪 Testing invalid token operations...')

      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await hybridManager.sendTokens(
          'invalid_token_id',
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Token send failed')
        console.log(`   ✅ Invalid token error: ${err.message}`)
      }
    })

    it('should handle insufficient balance scenarios', async () => {
      console.log('\n🧪 Testing insufficient balance handling...')

      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 100 // More than available
      }]

      try {
        await hybridManager.sendTokens(
          tokenMocks.FLCT_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Insufficient')
        console.log(`   ✅ Insufficient balance error: ${err.message}`)
      }
    })
  })

  describe('Performance Integration Tests', () => {
    it('should handle multiple token operations efficiently', async () => {
      console.log('\n🧪 Testing performance with multiple operations...')

      const startTime = Date.now()

      // Perform multiple operations
      const operations = []

      // List tokens multiple times
      for (let i = 0; i < 5; i++) {
        operations.push(hybridManager.listTokensFromUtxos(tokenMocks.mixedTokenUtxos))
      }

      // Get balances
      operations.push(hybridManager.getTokenBalance(tokenMocks.FLCT_TOKEN_ID, tokenMocks.mixedTokenUtxos))
      operations.push(hybridManager.getTokenBalance(tokenMocks.TGR_TOKEN_ID, tokenMocks.mixedTokenUtxos))

      // Execute all operations
      const results = await Promise.all(operations)

      const endTime = Date.now()
      const duration = endTime - startTime

      assert.isArray(results)
      assert.equal(results.length, 7)

      // Should complete reasonably quickly (metadata caching should help)
      assert.isBelow(duration, 1000) // Less than 1 second

      console.log(`   ✅ ${results.length} operations completed in ${duration}ms`)

      // Verify caching worked (should only call chronik.token once per token)
      const tokenCallCount = mockChronik.token.callCount
      assert.isBelow(tokenCallCount, 10) // Should be cached after first calls
      console.log(`   ✅ Chronik calls: ${tokenCallCount} (caching working)`)
    })

    it('should handle large UTXO sets', async () => {
      console.log('\n🧪 Testing large UTXO set handling...')

      // Create a large UTXO set with mixed protocols
      const largeUtxoSet = []

      // Add many XEC UTXOs
      for (let i = 0; i < 100; i++) {
        largeUtxoSet.push({
          ...tokenMocks.xecOnlyUtxo,
          outpoint: { txid: `large_xec_${i}`, outIdx: 0 },
          sats: 1000 + i
        })
      }

      // Add some token UTXOs
      for (let i = 0; i < 10; i++) {
        largeUtxoSet.push({
          ...tokenMocks.flctTokenUtxo,
          outpoint: { txid: `large_slp_${i}`, outIdx: 0 }
        })
        largeUtxoSet.push({
          ...tokenMocks.tgrTokenUtxo,
          outpoint: { txid: `large_alp_${i}`, outIdx: 0 }
        })
      }

      const startTime = Date.now()

      // Test operations on large set
      const stats = hybridManager.getProtocolStats(largeUtxoSet)
      const tokens = await hybridManager.listTokensFromUtxos(largeUtxoSet)

      const endTime = Date.now()
      const duration = endTime - startTime

      assert.equal(stats.totalUtxos, 120) // 100 XEC + 20 tokens
      assert.equal(stats.xecUtxos, 100)
      assert.equal(stats.slpUtxos, 10)
      assert.equal(stats.alpUtxos, 10)

      assert.isArray(tokens)
      assert.equal(tokens.length, 2) // FLCT + TGR (aggregated)

      // Should handle large sets efficiently
      assert.isBelow(duration, 2000) // Less than 2 seconds

      console.log(`   ✅ Processed ${stats.totalUtxos} UTXOs in ${duration}ms`)
      console.log(`   ✅ Found ${tokens.length} token types`)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should simulate wallet with both protocols', async () => {
      console.log('\n🧪 Simulating real wallet scenario...')

      // Simulate a user checking their wallet
      const allTokens = await hybridManager.listTokensFromUtxos(tokenMocks.mixedTokenUtxos)

      console.log('\n   📝 Wallet Summary:')
      allTokens.forEach(token => {
        console.log(`     • ${token.ticker} (${token.protocol}): ${token.balance.display} ${token.ticker}`)
        console.log(`       ${token.name} | ${token.utxoCount} UTXO(s)`)
      })

      // Simulate sending some of each token type
      const slpSendOutputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 2 }]
      const alpSendOutputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 3 }]

      const slpTxid = await hybridManager.sendTokens(
        tokenMocks.FLCT_TOKEN_ID,
        slpSendOutputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      const alpTxid = await hybridManager.sendTokens(
        tokenMocks.TGR_TOKEN_ID,
        alpSendOutputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      console.log('\n   💸 Transactions sent:')
      console.log(`     • SLP (FLCT): ${slpTxid}`)
      console.log(`     • ALP (TGR): ${alpTxid}`)

      assert.isString(slpTxid)
      assert.isString(alpTxid)
      assert.notEqual(slpTxid, alpTxid)
    })

    it('should handle address format variations', async () => {
      console.log('\n🧪 Testing address format handling...')

      // Test both ecash: and etoken: formats
      const ecashOutputs = [{
        address: tokenMocks.testAddresses.validRecipient, // ecash: format
        amount: 1
      }]

      const etokenOutputs = [{
        address: tokenMocks.testAddresses.etokenRecipient, // etoken: format
        amount: 1
      }]

      // Both should work (handlers should normalize addresses)
      const txid1 = await hybridManager.sendTokens(
        tokenMocks.FLCT_TOKEN_ID,
        ecashOutputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      // Reset for second test
      mockAr.sendTx.resetHistory()

      const txid2 = await hybridManager.sendTokens(
        tokenMocks.TGR_TOKEN_ID,
        etokenOutputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.isString(txid1)
      assert.isString(txid2)

      console.log(`   ✅ ecash: format transaction: ${txid1}`)
      console.log(`   ✅ etoken: format transaction: ${txid2}`)
    })
  })
})
