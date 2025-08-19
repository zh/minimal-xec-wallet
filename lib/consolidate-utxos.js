/*
  This library optimizes wallet performance by consolidating UTXOs.
  It combines multiple small UTXOs into fewer, larger UTXOs to improve
  transaction efficiency and reduce fees.
*/

class ConsolidateUtxos {
  constructor (wallet) {
    this.wallet = wallet
    this.ar = wallet.ar
    this.sendXecLib = wallet.sendXecLib
    this.utxos = wallet.utxos

    // Configuration
    this.dustLimit = 200 // XEC dust limit in satoshis (2 XEC)
    this.maxInputsPerTx = 200 // Maximum inputs per consolidation transaction
    this.minUtxosForConsolidation = 5 // Minimum UTXOs needed to trigger consolidation
    this.consolidationThreshold = 100000 // Threshold in satoshis below which UTXOs should be consolidated
    this.defaultSatsPerByte = 1.2
  }

  async start (opts = {}) {
    try {
      const options = {
        dryRun: opts.dryRun || false,
        satsPerByte: opts.satsPerByte || this.defaultSatsPerByte,
        maxInputs: opts.maxInputs || this.maxInputsPerTx,
        consolidationThreshold: opts.consolidationThreshold || this.consolidationThreshold
      }

      // Wait for wallet to be initialized
      await this.wallet.walletInfoPromise

      if (!this.wallet.isInitialized) {
        await this.wallet.initialize()
      }

      // Analyze current UTXOs
      const analysis = await this.analyzeUtxos(options)

      if (!analysis.shouldConsolidate) {
        return {
          success: true,
          message: analysis.reason,
          analysis,
          transactions: []
        }
      }

      if (options.dryRun) {
        return {
          success: true,
          message: 'Dry run completed - no transactions broadcast',
          analysis,
          transactions: analysis.consolidationPlans
        }
      }

      // Execute consolidation
      const results = await this.executeConsolidation(analysis.consolidationPlans, options)

      return {
        success: true,
        message: `Successfully consolidated ${analysis.totalUtxos} UTXOs into ${analysis.outputUtxos} UTXOs`,
        analysis,
        transactions: results
      }
    } catch (err) {
      throw new Error(`UTXO consolidation failed: ${err.message}`)
    }
  }

  async analyzeUtxos (options = {}) {
    try {
      const allUtxos = this.utxos.getSpendableXecUtxos()

      // CRITICAL: Filter out token UTXOs to prevent token burning
      const pureXecUtxos = allUtxos.filter(utxo => !utxo.token)
      const tokenUtxos = allUtxos.filter(utxo => utxo.token)

      if (pureXecUtxos.length < this.minUtxosForConsolidation) {
        return {
          shouldConsolidate: false,
          reason: `Not enough pure XEC UTXOs for consolidation (${pureXecUtxos.length} < ${this.minUtxosForConsolidation})`,
          totalUtxos: pureXecUtxos.length,
          totalValue: this._calculateTotalValue(pureXecUtxos),
          tokenUtxos: tokenUtxos.length,
          tokenUtxosSkipped: tokenUtxos.length > 0
        }
      }

      // Filter UTXOs that should be consolidated (smaller ones first)
      const utxosToConsolidate = pureXecUtxos
        .filter(utxo => utxo.value <= options.consolidationThreshold)
        .sort((a, b) => a.value - b.value) // Sort by value ascending

      if (utxosToConsolidate.length < this.minUtxosForConsolidation) {
        return {
          shouldConsolidate: false,
          reason: `Not enough small pure XEC UTXOs to consolidate (${utxosToConsolidate.length} below ${options.consolidationThreshold} satoshis)`,
          totalUtxos: pureXecUtxos.length,
          totalValue: this._calculateTotalValue(pureXecUtxos),
          smallUtxos: utxosToConsolidate.length,
          tokenUtxos: tokenUtxos.length,
          tokenUtxosSkipped: tokenUtxos.length > 0
        }
      }

      // Calculate optimal consolidation strategy
      const consolidationPlans = this.calculateOptimalConsolidation(utxosToConsolidate, options)

      // Calculate savings
      const currentFeeForSpending = this._estimateCurrentSpendingFee(utxosToConsolidate, options.satsPerByte)
      const consolidationFee = consolidationPlans.reduce((total, plan) => total + plan.estimatedFee, 0)
      const futureSpendingFee = this._estimateFutureSpendingFee(consolidationPlans.length, options.satsPerByte)
      const totalSavings = currentFeeForSpending - consolidationFee - futureSpendingFee

      return {
        shouldConsolidate: totalSavings > 0,
        reason: totalSavings > 0
          ? `Consolidation will save ${totalSavings} satoshis in future transaction fees`
          : `Consolidation would cost ${Math.abs(totalSavings)} satoshis more than current setup`,
        totalUtxos: utxosToConsolidate.length,
        outputUtxos: consolidationPlans.length,
        totalValue: this._calculateTotalValue(utxosToConsolidate),
        consolidationFee,
        potentialSavings: totalSavings,
        tokenUtxos: tokenUtxos.length,
        tokenUtxosSkipped: tokenUtxos.length > 0,
        consolidationPlans
      }
    } catch (err) {
      throw new Error(`UTXO analysis failed: ${err.message}`)
    }
  }

  calculateOptimalConsolidation (utxos, options = {}) {
    try {
      const maxInputs = options.maxInputs || this.maxInputsPerTx
      const satsPerByte = options.satsPerByte || this.defaultSatsPerByte
      const plans = []

      // Split UTXOs into batches that can be processed in single transactions
      for (let i = 0; i < utxos.length; i += maxInputs) {
        const batch = utxos.slice(i, i + maxInputs)
        const totalValue = this._calculateTotalValue(batch)

        // Calculate estimated fee for this consolidation transaction
        const estimatedFee = this._calculateConsolidationFee(batch.length, 1, satsPerByte)
        const outputValue = totalValue - estimatedFee

        if (outputValue <= this.dustLimit) {
          // Skip batches that would result in dust
          continue
        }

        plans.push({
          inputUtxos: batch,
          inputCount: batch.length,
          totalInputValue: totalValue,
          estimatedFee,
          outputValue,
          outputCount: 1, // Consolidate into single output
          savings: this._calculateBatchSavings(batch, satsPerByte)
        })
      }

      return plans
    } catch (err) {
      throw new Error(`Consolidation calculation failed: ${err.message}`)
    }
  }

  async executeConsolidation (consolidationPlans, options = {}) {
    try {
      const results = []

      for (const plan of consolidationPlans) {
        try {
          // CRITICAL SAFETY CHECK: Ensure no token UTXOs are being consolidated
          const tokenUtxosInPlan = plan.inputUtxos.filter(utxo => utxo.token)
          if (tokenUtxosInPlan.length > 0) {
            throw new Error(`SAFETY ABORT: Plan contains ${tokenUtxosInPlan.length} token UTXOs. Consolidation would burn tokens!`)
          }

          // Create consolidation transaction - send all value to same address
          const outputs = [{
            address: this.wallet.walletInfo.xecAddress,
            amountSat: plan.outputValue
          }]

          const txid = await this.sendXecLib.sendXec(
            outputs,
            this.wallet.walletInfo,
            plan.inputUtxos
          )

          results.push({
            txid,
            inputCount: plan.inputCount,
            inputValue: plan.totalInputValue,
            outputValue: plan.outputValue,
            fee: plan.estimatedFee,
            success: true
          })

          // Brief delay between transactions to avoid overwhelming the network
          if (consolidationPlans.indexOf(plan) < consolidationPlans.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } catch (err) {
          results.push({
            inputCount: plan.inputCount,
            inputValue: plan.totalInputValue,
            error: err.message,
            success: false
          })
        }
      }

      // Refresh UTXO cache after consolidation
      await this.utxos.refreshCache(this.wallet.walletInfo.xecAddress)

      return results
    } catch (err) {
      throw new Error(`Consolidation execution failed: ${err.message}`)
    }
  }

  async createConsolidationTx (utxosToConsolidate, options = {}) {
    try {
      const satsPerByte = options.satsPerByte || this.defaultSatsPerByte
      const totalValue = this._calculateTotalValue(utxosToConsolidate)
      const estimatedFee = this._calculateConsolidationFee(utxosToConsolidate.length, 1, satsPerByte)
      const outputValue = totalValue - estimatedFee

      if (outputValue <= this.dustLimit) {
        throw new Error('Consolidation would result in dust output')
      }

      // Create single output to same address
      const outputs = [{
        address: this.wallet.walletInfo.xecAddress,
        amountSat: outputValue
      }]

      // Create transaction hex
      const txHex = await this.sendXecLib.createTransaction(
        outputs,
        this.wallet.walletInfo,
        utxosToConsolidate,
        satsPerByte
      )

      return {
        txHex,
        inputCount: utxosToConsolidate.length,
        totalInputValue: totalValue,
        outputValue,
        estimatedFee
      }
    } catch (err) {
      throw new Error(`Consolidation transaction creation failed: ${err.message}`)
    }
  }

  // Helper methods

  _calculateTotalValue (utxos) {
    return utxos.reduce((total, utxo) => total + utxo.value, 0)
  }

  _calculateConsolidationFee (numInputs, numOutputs, satsPerByte) {
    // Estimate transaction size: inputs (~148 bytes) + outputs (~34 bytes) + overhead (~10 bytes)
    const estimatedSize = (numInputs * 148) + (numOutputs * 34) + 10
    return Math.ceil(estimatedSize * satsPerByte)
  }

  _estimateCurrentSpendingFee (utxos, satsPerByte) {
    // Estimate what it would cost to spend all these UTXOs in future transactions
    // Assume average transaction uses 2 outputs
    return this._calculateConsolidationFee(utxos.length, 2, satsPerByte)
  }

  _estimateFutureSpendingFee (numConsolidatedOutputs, satsPerByte) {
    // Estimate cost to spend the consolidated UTXOs in the future
    return this._calculateConsolidationFee(numConsolidatedOutputs, 2, satsPerByte)
  }

  _calculateBatchSavings (batch, satsPerByte) {
    const currentCost = this._estimateCurrentSpendingFee(batch, satsPerByte)
    const consolidationCost = this._calculateConsolidationFee(batch.length, 1, satsPerByte)
    const futureCost = this._estimateFutureSpendingFee(1, satsPerByte)

    return currentCost - consolidationCost - futureCost
  }

  // Analysis methods for wallet optimization

  getUtxoDistribution () {
    try {
      const allUtxos = this.utxos.getSpendableXecUtxos()

      // Separate pure XEC from token UTXOs
      const pureXecUtxos = allUtxos.filter(utxo => !utxo.token)
      const tokenUtxos = allUtxos.filter(utxo => utxo.token)

      const distribution = {
        dust: 0, // < 1000 sats
        small: 0, // 1000 - 10000 sats
        medium: 0, // 10000 - 100000 sats
        large: 0, // > 100000 sats
        total: pureXecUtxos.length,
        tokenUtxos: tokenUtxos.length,
        tokenUtxosSkipped: tokenUtxos.length > 0
      }

      // Only analyze pure XEC UTXOs for consolidation
      for (const utxo of pureXecUtxos) {
        if (utxo.value < 1000) {
          distribution.dust++
        } else if (utxo.value < 10000) {
          distribution.small++
        } else if (utxo.value < 100000) {
          distribution.medium++
        } else {
          distribution.large++
        }
      }

      return distribution
    } catch (err) {
      throw new Error(`UTXO distribution analysis failed: ${err.message}`)
    }
  }

  estimateOptimizationSavings () {
    try {
      const allUtxos = this.utxos.getSpendableXecUtxos()

      // Only analyze pure XEC UTXOs (tokens are preserved separately)
      const pureXecUtxos = allUtxos.filter(utxo => !utxo.token)
      const tokenUtxos = allUtxos.filter(utxo => utxo.token)

      if (pureXecUtxos.length < 2) {
        return {
          savings: 0,
          reason: 'No optimization needed for pure XEC UTXOs',
          currentUtxos: pureXecUtxos.length,
          tokenUtxos: tokenUtxos.length
        }
      }

      const currentFee = this._estimateCurrentSpendingFee(pureXecUtxos, this.defaultSatsPerByte)
      const optimalUtxoCount = Math.max(1, Math.ceil(pureXecUtxos.length / 50)) // Optimal: ~50 UTXOs max
      const optimizedFee = this._estimateFutureSpendingFee(optimalUtxoCount, this.defaultSatsPerByte)

      return {
        savings: currentFee - optimizedFee,
        currentUtxos: pureXecUtxos.length,
        optimalUtxos: optimalUtxoCount,
        currentEstimatedFee: currentFee,
        optimizedEstimatedFee: optimizedFee,
        tokenUtxos: tokenUtxos.length,
        tokenUtxosPreserved: tokenUtxos.length
      }
    } catch (err) {
      throw new Error(`Optimization savings estimation failed: ${err.message}`)
    }
  }
}

module.exports = ConsolidateUtxos
