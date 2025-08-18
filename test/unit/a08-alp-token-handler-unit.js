/*
  Unit tests for ALPTokenHandler - handles ALP token transaction building and validation.
  Tests ALP-specific eMPP script generation and transaction construction.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Test data
const tokenMocks = require('./mocks/token-mocks')

// Unit under test
const ALPTokenHandler = require('../../lib/alp-token-handler')

describe('#ALPTokenHandler', () => {
  let sandbox, uut, mockChronik, mockAr

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    // Create mock chronik client
    mockChronik = {
      token: sandbox.stub().resolves(tokenMocks.tgrTokenMetadata)
    }

    // Create mock adapter router
    mockAr = {
      sendTx: sandbox.stub().resolves('mock_alp_transaction_id')
    }

    // Initialize handler with mocks
    uut = new ALPTokenHandler({
      chronik: mockChronik,
      ar: mockAr,
      dustLimit: tokenMocks.DUST_LIMIT,
      defaultSatsPerByte: tokenMocks.DEFAULT_SATS_PER_BYTE
    })
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('#constructor', () => {
    it('should instantiate with required dependencies', () => {
      assert.property(uut, 'chronik')
      assert.property(uut, 'ar')
      assert.property(uut, 'dustLimit')
      assert.property(uut, 'defaultSatsPerByte')
      assert.property(uut, 'ecc')
      assert.property(uut, 'ALP_STANDARD')
      assert.equal(uut.dustLimit, tokenMocks.DUST_LIMIT)
      assert.equal(uut.ALP_STANDARD, 0)
    })

    it('should throw error without chronik client', () => {
      assert.throws(() => {
        const handler = new ALPTokenHandler({ ar: mockAr })
        return handler
      }, /Chronik client required/)
    })

    it('should throw error without adapter router', () => {
      assert.throws(() => {
        const handler = new ALPTokenHandler({ chronik: mockChronik })
        return handler
      }, /AdapterRouter required/)
    })
  })

  describe('#sendTokens', () => {
    it('should send ALP tokens successfully', async () => {
      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 3
      }]

      const result = await uut.sendTokens(
        tokenMocks.TGR_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos,
        1.2
      )

      assert.equal(result, 'mock_alp_transaction_id')
      assert.isTrue(mockAr.sendTx.calledOnce)
      assert.isString(mockAr.sendTx.firstCall.args[0]) // Transaction hex
    })

    it('should handle transaction creation errors', async () => {
      // Mock chronik to return error
      mockChronik.token.rejects(new Error('ALP token not found'))

      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 1
      }]

      try {
        await uut.sendTokens(
          'invalid_alp_token_id',
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'ALP token send failed')
        assert.include(err.message, 'ALP token not found')
      }
    })
  })

  describe('#burnTokens', () => {
    it('should burn ALP tokens successfully', async () => {
      const burnAmount = 2

      const result = await uut.burnTokens(
        tokenMocks.TGR_TOKEN_ID,
        burnAmount,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.equal(result, 'mock_alp_transaction_id')
      assert.isTrue(mockAr.sendTx.calledOnce)
    })
  })

  describe('#createSendTransaction', () => {
    it('should create valid ALP send transaction', async () => {
      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 3
      }]

      const txHex = await uut.createSendTransaction(
        tokenMocks.TGR_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos,
        1.2
      )

      assert.isString(txHex)
      assert.isAbove(txHex.length, 0)

      // Verify chronik.token was called
      assert.isTrue(mockChronik.token.calledOnce)
      assert.equal(mockChronik.token.firstCall.args[0], tokenMocks.TGR_TOKEN_ID)
    })

    it('should validate wallet info', async () => {
      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]
      const invalidWalletInfo = null

      try {
        await uut.createSendTransaction(
          tokenMocks.TGR_TOKEN_ID,
          outputs,
          invalidWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Valid wallet info required')
      }
    })

    it('should validate token ID', async () => {
      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.createSendTransaction(
          null,
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Valid token ID required')
      }
    })

    it('should validate outputs array', async () => {
      try {
        await uut.createSendTransaction(
          tokenMocks.TGR_TOKEN_ID,
          [], // Empty outputs
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Valid outputs array required')
      }
    })

    it('should enforce ALP recipient limit', async () => {
      // Create more than 19 outputs (ALP limit)
      const tooManyOutputs = []
      for (let i = 0; i < 20; i++) {
        tooManyOutputs.push({
          address: tokenMocks.testAddresses.validRecipient,
          amount: 1
        })
      }

      try {
        await uut.createSendTransaction(
          tokenMocks.TGR_TOKEN_ID,
          tooManyOutputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Too many outputs - ALP limit is 19')
      }
    })

    it('should reject non-ALP tokens', async () => {
      // Mock chronik to return SLP token metadata
      mockChronik.token.resolves(tokenMocks.flctTokenMetadata)

      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.createSendTransaction(
          tokenMocks.FLCT_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Token is not an ALP token')
      }
    })

    it('should handle insufficient token balance', async () => {
      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 100 // More than available (7 TGR)
      }]

      try {
        await uut.createSendTransaction(
          tokenMocks.TGR_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Insufficient TGR tokens')
      }
    })

    it('should handle insufficient XEC for fees', async () => {
      // Use UTXOs with very low XEC amount - even combined should be insufficient
      const lowXecUtxos = [
        {
          ...tokenMocks.tgrTokenUtxo,
          sats: 200 // Very low for token UTXO
        },
        {
          ...tokenMocks.xecOnlyUtxo,
          sats: 50 // Very low amount, total 250 sats insufficient for fees
        }
      ]

      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.createSendTransaction(
          tokenMocks.TGR_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          lowXecUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Insufficient XEC for transaction fees')
      }
    })

    it('should calculate atoms correctly for ALP amounts', async () => {
      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 3.5 // Test decimal handling (should floor to 3 for 0 decimals)
      }]

      const txHex = await uut.createSendTransaction(
        tokenMocks.TGR_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos,
        1.2
      )

      assert.isString(txHex)
      // Transaction should be created (3.5 floors to 3, which is valid)
    })
  })

  describe('#createBurnTransaction', () => {
    it('should create valid ALP burn transaction', async () => {
      const burnAmount = 2

      const txHex = await uut.createBurnTransaction(
        tokenMocks.TGR_TOKEN_ID,
        burnAmount,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos,
        1.2
      )

      assert.isString(txHex)
      assert.isAbove(txHex.length, 0)
    })

    it('should handle insufficient tokens to burn', async () => {
      const burnAmount = 100 // More than available

      try {
        await uut.createBurnTransaction(
          tokenMocks.TGR_TOKEN_ID,
          burnAmount,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Insufficient TGR tokens')
      }
    })

    it('should reject non-ALP tokens for burning', async () => {
      // Mock chronik to return SLP token metadata
      mockChronik.token.resolves(tokenMocks.flctTokenMetadata)

      try {
        await uut.createBurnTransaction(
          tokenMocks.FLCT_TOKEN_ID,
          1,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Token is not an ALP token')
      }
    })
  })

  describe('#_categorizeUtxos', () => {
    it('should categorize UTXOs by type for ALP', () => {
      const result = uut._categorizeUtxos(tokenMocks.mixedTokenUtxos, tokenMocks.TGR_TOKEN_ID)

      assert.property(result, 'alpUtxos')
      assert.property(result, 'xecUtxos')
      assert.isArray(result.alpUtxos)
      assert.isArray(result.xecUtxos)

      assert.equal(result.alpUtxos.length, 1)
      assert.equal(result.xecUtxos.length, 2) // 1 pure XEC + 1 other token UTXO

      // Verify ALP UTXO has correct token ID
      assert.equal(result.alpUtxos[0].token.tokenId, tokenMocks.TGR_TOKEN_ID)
      assert.equal(result.alpUtxos[0].token.tokenType.protocol, 'ALP')
    })

    it('should handle empty UTXO array', () => {
      const result = uut._categorizeUtxos([], tokenMocks.TGR_TOKEN_ID)

      assert.deepEqual(result.alpUtxos, [])
      assert.deepEqual(result.xecUtxos, [])
    })

    it('should exclude SLP UTXOs when looking for ALP', () => {
      const result = uut._categorizeUtxos(tokenMocks.mixedTokenUtxos, tokenMocks.TGR_TOKEN_ID)

      // Should not include FLCT (SLP) tokens in ALP results
      assert.equal(result.alpUtxos.length, 1)
      assert.notEqual(result.alpUtxos[0].token.tokenId, tokenMocks.FLCT_TOKEN_ID)
    })
  })

  describe('#_selectTokenUtxos', () => {
    it('should select sufficient ALP token UTXOs', () => {
      const alpUtxos = [tokenMocks.tgrTokenUtxo] // Has 7 atoms
      const requiredAtoms = 5n

      const result = uut._selectTokenUtxos(alpUtxos, requiredAtoms, tokenMocks.tgrTokenMetadata)

      assert.property(result, 'selectedUtxos')
      assert.property(result, 'totalSelected')
      assert.isArray(result.selectedUtxos)
      assert.isTrue(result.totalSelected >= requiredAtoms)
      assert.equal(result.totalSelected, 7n)
    })

    it('should throw error for insufficient ALP tokens', () => {
      const alpUtxos = [tokenMocks.tgrTokenUtxo] // Has 7 atoms
      const requiredAtoms = 10n // More than available

      assert.throws(() => {
        uut._selectTokenUtxos(alpUtxos, requiredAtoms, tokenMocks.tgrTokenMetadata)
      }, /Insufficient TGR tokens/)
    })

    it('should sort UTXOs by amount (largest first)', () => {
      // Create multiple ALP UTXOs with different amounts
      const multipleAlpUtxos = [
        {
          ...tokenMocks.tgrTokenUtxo,
          outpoint: { txid: 'alp_small', outIdx: 0 },
          token: { ...tokenMocks.tgrTokenUtxo.token, atoms: '3' }
        },
        {
          ...tokenMocks.tgrTokenUtxo,
          outpoint: { txid: 'alp_large', outIdx: 0 },
          token: { ...tokenMocks.tgrTokenUtxo.token, atoms: '10' }
        },
        {
          ...tokenMocks.tgrTokenUtxo,
          outpoint: { txid: 'alp_medium', outIdx: 0 },
          token: { ...tokenMocks.tgrTokenUtxo.token, atoms: '7' }
        }
      ]

      const result = uut._selectTokenUtxos(multipleAlpUtxos, 5n, tokenMocks.tgrTokenMetadata)

      // Should select largest first
      assert.equal(result.selectedUtxos[0].token.atoms, '10')
      assert.equal(result.selectedUtxos[0].outpoint.txid, 'alp_large')
    })
  })

  describe('#_selectXecUtxos', () => {
    it('should select sufficient XEC UTXO for fees', () => {
      const xecUtxos = tokenMocks.xecOnlyUtxos
      const requiredSats = 1000

      const result = uut._selectXecUtxos(xecUtxos, requiredSats)

      assert.property(result, 'selectedUtxos')
      assert.isArray(result.selectedUtxos)
      assert.equal(result.selectedUtxos.length, 1)

      // Should select largest UTXO
      assert.equal(result.selectedUtxos[0].sats, 100000) // Largest available
    })

    it('should throw error for insufficient XEC', () => {
      const xecUtxos = tokenMocks.xecOnlyUtxos
      const requiredSats = 200000 // More than largest UTXO

      assert.throws(() => {
        uut._selectXecUtxos(xecUtxos, requiredSats)
      }, /Insufficient XEC for transaction fees/)
    })
  })

  describe('#_displayToAtoms', () => {
    it('should convert display amount to atoms for ALP (0 decimals)', () => {
      const result = uut._displayToAtoms(5.0, 0)
      assert.equal(result, 5n)
    })

    it('should handle fractional amounts (floor)', () => {
      const result = uut._displayToAtoms(5.7, 0) // Should floor
      assert.equal(result, 5n)
    })

    it('should handle decimals if ALP token has them', () => {
      const result = uut._displayToAtoms(1.5, 2) // 1.5 with 2 decimals = 150 atoms
      assert.equal(result, 150n)
    })
  })

  describe('#_atomsToDisplay', () => {
    it('should convert atoms to display amount for ALP (0 decimals)', () => {
      const result = uut._atomsToDisplay(7n, 0)
      assert.equal(result, 7)
    })

    it('should handle decimals correctly', () => {
      const result = uut._atomsToDisplay(150n, 2) // 150 atoms with 2 decimals = 1.5
      assert.equal(result, 1.5)
    })
  })

  describe('#_estimateTransactionFee', () => {
    it('should estimate ALP transaction fee with eMPP overhead', () => {
      const fee = uut._estimateTransactionFee(2, 4, 1.2) // 2 inputs, 4 outputs, 1.2 sats/byte

      assert.isNumber(fee)
      assert.isAbove(fee, 0)

      // Should be slightly higher than basic transaction due to eMPP script overhead
      const basicFee = (2 * 148) + (4 * 34) + 10 // Basic calculation

      assert.isAbove(fee, basicFee * 1.2) // Should account for eMPP overhead
    })
  })

  describe('ALP-Specific Features', () => {
    it('should use ALP_STANDARD token type constant', () => {
      assert.equal(uut.ALP_STANDARD, 0)
      assert.isNumber(uut.ALP_STANDARD)
    })

    it('should handle ALP-specific validation', async () => {
      // Test that ALP handler correctly validates ALP protocol
      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      // Use UTXO set with plenty of XEC for fees
      const utxosWithMoreXec = [
        tokenMocks.tgrTokenUtxo,
        {
          outpoint: {
            txid: 'fee_utxo_txid_123',
            outIdx: 0
          },
          blockHeight: 910000,
          isCoinbase: false,
          sats: 100000, // Plenty of XEC for fees
          isFinal: true
          // No token property = XEC-only
        }
      ]

      const txHex = await uut.createSendTransaction(
        tokenMocks.TGR_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        utxosWithMoreXec
      )

      assert.isString(txHex)
      // Should successfully create transaction for ALP token
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockChronik.token.rejects(new Error('ALP network timeout'))

      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.sendTokens(
          tokenMocks.TGR_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'ALP token send failed')
        assert.include(err.message, 'ALP network timeout')
      }
    })

    it('should handle malformed ALP UTXO data', async () => {
      const malformedUtxos = [null, undefined, {}]
      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.createSendTransaction(
          tokenMocks.TGR_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          malformedUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'No TGR tokens found')
      }
    })

    it('should handle invalid ALP token metadata', async () => {
      mockChronik.token.resolves({
        tokenId: tokenMocks.TGR_TOKEN_ID,
        tokenType: { protocol: 'INVALID', type: 'UNKNOWN' },
        genesisInfo: { tokenTicker: 'INVALID' }
      })

      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.createSendTransaction(
          tokenMocks.TGR_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Token is not an ALP token')
      }
    })
  })
})
