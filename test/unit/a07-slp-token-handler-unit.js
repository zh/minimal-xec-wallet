/*
  Unit tests for SLPTokenHandler - handles SLP token transaction building and validation.
  Tests transaction construction, UTXO selection, fee calculation, and error handling.
*/

// npm libraries
const assert = require('chai').assert
const sinon = require('sinon')

// Test data
const tokenMocks = require('./mocks/token-mocks')

// Unit under test
const SLPTokenHandler = require('../../lib/slp-token-handler')

describe('#SLPTokenHandler', () => {
  let sandbox, uut, mockChronik, mockAr

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    // Create mock chronik client
    mockChronik = {
      token: sandbox.stub().resolves(tokenMocks.flctTokenMetadata)
    }

    // Create mock adapter router
    mockAr = {
      sendTx: sandbox.stub().resolves('mock_transaction_id')
    }

    // Initialize handler with mocks
    uut = new SLPTokenHandler({
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
      assert.equal(uut.dustLimit, tokenMocks.DUST_LIMIT)
    })

    it('should throw error without chronik client', () => {
      assert.throws(() => {
        const handler = new SLPTokenHandler({ ar: mockAr })
        return handler
      }, /Chronik client required/)
    })

    it('should throw error without adapter router', () => {
      assert.throws(() => {
        const handler = new SLPTokenHandler({ chronik: mockChronik })
        return handler
      }, /AdapterRouter required/)
    })
  })

  describe('#sendTokens', () => {
    it('should send SLP tokens successfully', async () => {
      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 2
      }]

      const result = await uut.sendTokens(
        tokenMocks.FLCT_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos,
        1.2
      )

      assert.equal(result, 'mock_transaction_id')
      assert.isTrue(mockAr.sendTx.calledOnce)
      assert.isString(mockAr.sendTx.firstCall.args[0]) // Transaction hex
    })

    it('should handle transaction creation errors', async () => {
      // Mock chronik to return error
      mockChronik.token.rejects(new Error('Token not found'))

      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 1
      }]

      try {
        await uut.sendTokens(
          'invalid_token_id',
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'SLP token send failed')
        assert.include(err.message, 'Token not found')
      }
    })
  })

  describe('#burnTokens', () => {
    it('should burn SLP tokens successfully', async () => {
      const burnAmount = 1

      const result = await uut.burnTokens(
        tokenMocks.FLCT_TOKEN_ID,
        burnAmount,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos
      )

      assert.equal(result, 'mock_transaction_id')
      assert.isTrue(mockAr.sendTx.calledOnce)
    })
  })

  describe('#createSendTransaction', () => {
    it('should create valid SLP send transaction', async () => {
      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 2
      }]

      const txHex = await uut.createSendTransaction(
        tokenMocks.FLCT_TOKEN_ID,
        outputs,
        tokenMocks.testWalletInfo,
        tokenMocks.mixedTokenUtxos,
        1.2
      )

      assert.isString(txHex)
      assert.isAbove(txHex.length, 0)

      // Verify chronik.token was called
      assert.isTrue(mockChronik.token.calledOnce)
      assert.equal(mockChronik.token.firstCall.args[0], tokenMocks.FLCT_TOKEN_ID)
    })

    it('should validate wallet info', async () => {
      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]
      const invalidWalletInfo = null

      try {
        await uut.createSendTransaction(
          tokenMocks.FLCT_TOKEN_ID,
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
          tokenMocks.FLCT_TOKEN_ID,
          [], // Empty outputs
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Valid outputs array required')
      }
    })

    it('should enforce SLP recipient limit', async () => {
      // Create more than 19 outputs (SLP limit)
      const tooManyOutputs = []
      for (let i = 0; i < 20; i++) {
        tooManyOutputs.push({
          address: tokenMocks.testAddresses.validRecipient,
          amount: 1
        })
      }

      try {
        await uut.createSendTransaction(
          tokenMocks.FLCT_TOKEN_ID,
          tooManyOutputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Too many outputs - SLP limit is 19')
      }
    })

    it('should reject non-SLP tokens', async () => {
      // Mock chronik to return ALP token metadata
      mockChronik.token.resolves(tokenMocks.tgrTokenMetadata)

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
        assert.include(err.message, 'Token is not an SLP token')
      }
    })

    it('should handle insufficient token balance', async () => {
      const outputs = [{
        address: tokenMocks.testAddresses.validRecipient,
        amount: 100 // More than available (6 FLCT)
      }]

      try {
        await uut.createSendTransaction(
          tokenMocks.FLCT_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Insufficient FLCT tokens')
      }
    })

    it('should handle insufficient XEC for fees', async () => {
      // Use UTXOs with very low XEC amount
      const lowXecUtxos = [
        tokenMocks.flctTokenUtxo, // Has tokens but only dust
        {
          ...tokenMocks.xecOnlyUtxo,
          sats: 100 // Very low amount, insufficient for fees
        }
      ]

      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.createSendTransaction(
          tokenMocks.FLCT_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          lowXecUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Insufficient XEC for transaction fees')
      }
    })
  })

  describe('#createBurnTransaction', () => {
    it('should create valid SLP burn transaction', async () => {
      const burnAmount = 2

      const txHex = await uut.createBurnTransaction(
        tokenMocks.FLCT_TOKEN_ID,
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
          tokenMocks.FLCT_TOKEN_ID,
          burnAmount,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'Insufficient FLCT tokens')
      }
    })
  })

  describe('#_categorizeUtxos', () => {
    it('should categorize UTXOs by type', () => {
      const result = uut._categorizeUtxos(tokenMocks.mixedTokenUtxos, tokenMocks.FLCT_TOKEN_ID)

      assert.property(result, 'slpUtxos')
      assert.property(result, 'xecUtxos')
      assert.isArray(result.slpUtxos)
      assert.isArray(result.xecUtxos)

      assert.equal(result.slpUtxos.length, 1)
      assert.equal(result.xecUtxos.length, 1)

      // Verify SLP UTXO has correct token ID
      assert.equal(result.slpUtxos[0].token.tokenId, tokenMocks.FLCT_TOKEN_ID)
    })

    it('should handle empty UTXO array', () => {
      const result = uut._categorizeUtxos([], tokenMocks.FLCT_TOKEN_ID)

      assert.deepEqual(result.slpUtxos, [])
      assert.deepEqual(result.xecUtxos, [])
    })
  })

  describe('#_selectTokenUtxos', () => {
    it('should select sufficient token UTXOs', () => {
      const slpUtxos = tokenMocks.multipleSLPUtxos // Has 10+5+3=18 atoms total
      const requiredAtoms = 15n

      const result = uut._selectTokenUtxos(slpUtxos, requiredAtoms, tokenMocks.flctTokenMetadata)

      assert.property(result, 'selectedUtxos')
      assert.property(result, 'totalSelected')
      assert.isArray(result.selectedUtxos)
      assert.isTrue(result.totalSelected >= requiredAtoms)

      // Should select largest UTXOs first
      assert.equal(result.selectedUtxos[0].token.atoms, '10') // Largest first
    })

    it('should throw error for insufficient tokens', () => {
      const slpUtxos = tokenMocks.multipleSLPUtxos // Has 18 atoms total
      const requiredAtoms = 25n // More than available

      assert.throws(() => {
        uut._selectTokenUtxos(slpUtxos, requiredAtoms, tokenMocks.flctTokenMetadata)
      }, /Insufficient FLCT tokens/)
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

    it('should handle empty XEC UTXOs', () => {
      const xecUtxos = []
      const requiredSats = 1000

      assert.throws(() => {
        uut._selectXecUtxos(xecUtxos, requiredSats)
      }, /Insufficient XEC for transaction fees/)
    })
  })

  describe('#_displayToAtoms', () => {
    it('should convert display amount to atoms (0 decimals)', () => {
      const result = uut._displayToAtoms(5.0, 0)
      assert.equal(result, 5n)
    })

    it('should handle fractional display amounts', () => {
      const result = uut._displayToAtoms(5.7, 0) // Should floor
      assert.equal(result, 5n)
    })

    it('should handle decimals correctly', () => {
      const result = uut._displayToAtoms(1.5, 2) // 1.5 with 2 decimals = 150 atoms
      assert.equal(result, 150n)
    })
  })

  describe('#_atomsToDisplay', () => {
    it('should convert atoms to display amount (0 decimals)', () => {
      const result = uut._atomsToDisplay(5n, 0)
      assert.equal(result, 5)
    })

    it('should handle decimals correctly', () => {
      const result = uut._atomsToDisplay(150n, 2) // 150 atoms with 2 decimals = 1.5
      assert.equal(result, 1.5)
    })
  })

  describe('#_estimateTransactionFee', () => {
    it('should estimate transaction fee', () => {
      const fee = uut._estimateTransactionFee(2, 4, 1.2) // 2 inputs, 4 outputs, 1.2 sats/byte

      assert.isNumber(fee)
      assert.isAbove(fee, 0)

      // Basic sanity check: should be reasonable fee
      assert.isBelow(fee, 10000) // Less than 100 XEC
    })

    it('should scale with input/output count', () => {
      const smallFee = uut._estimateTransactionFee(1, 2, 1.0)
      const largeFee = uut._estimateTransactionFee(5, 10, 1.0)

      assert.isAbove(largeFee, smallFee)
    })
  })

  describe('#_getUtxoValue', () => {
    it('should extract UTXO value as number', () => {
      const utxo = { sats: 150000 }
      const result = uut._getUtxoValue(utxo)

      assert.equal(result, 150000)
      assert.isNumber(result)
    })

    it('should handle BigInt sats', () => {
      const utxo = { sats: 150000n }
      const result = uut._getUtxoValue(utxo)

      assert.equal(result, 150000)
      assert.isNumber(result)
    })

    it('should handle string sats', () => {
      const utxo = { sats: '150000' }
      const result = uut._getUtxoValue(utxo)

      assert.equal(result, 150000)
      assert.isNumber(result)
    })

    it('should return 0 for missing sats', () => {
      const utxo = {}
      const result = uut._getUtxoValue(utxo)

      assert.equal(result, 0)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockChronik.token.rejects(new Error('Network timeout'))

      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.sendTokens(
          tokenMocks.FLCT_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          tokenMocks.mixedTokenUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'SLP token send failed')
        assert.include(err.message, 'Network timeout')
      }
    })

    it('should handle malformed UTXO data', async () => {
      const malformedUtxos = [null, undefined, {}]
      const outputs = [{ address: tokenMocks.testAddresses.validRecipient, amount: 1 }]

      try {
        await uut.createSendTransaction(
          tokenMocks.FLCT_TOKEN_ID,
          outputs,
          tokenMocks.testWalletInfo,
          malformedUtxos
        )
        assert.fail('Should have thrown error')
      } catch (err) {
        assert.include(err.message, 'No FLCT tokens found')
      }
    })
  })
})
