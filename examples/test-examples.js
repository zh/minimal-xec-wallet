/*
  End-to-end testing script for all wallet examples.
  This script handles the funding break workflow properly.
*/

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const WalletHelper = require('./utils/wallet-helper')

class ExampleTester {
  constructor () {
    this.testResults = []
    this.walletFunded = false
    this.minimumBalance = 15 // Minimum XEC needed for transaction tests (6 XEC send + fees + buffer)
    this.useExistingWallet = false
    this.walletChoice = null
  }

  async runCommand (command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`\n🔧 Running: ${command} ${args.join(' ')}`)

      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: options.cwd || __dirname,
        ...options
      })

      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        if (options.showOutput !== false) {
          process.stdout.write(output)
        }

        // Auto-confirm for transaction scripts
        if (options.autoConfirm && output.includes('Do you want to proceed? (yes/no):')) {
          console.log('\n[AUTO-CONFIRMING]: Sending "yes" to process')
          process.stdin.write('yes\n')
        }
      })

      process.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        if (options.showOutput !== false) {
          process.stderr.write(output)
        }
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code })
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`))
        }
      })

      process.on('error', (err) => {
        reject(err)
      })

      // Set a timeout for commands that might hang
      if (options.timeout) {
        setTimeout(() => {
          console.log(`⏰ Command timeout after ${options.timeout}ms`)
          process.kill('SIGTERM')
          reject(new Error(`Command timed out after ${options.timeout}ms`))
        }, options.timeout)
      }
    })
  }

  async waitForUserInput (message) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise((resolve) => {
      rl.question(message, (answer) => {
        rl.close()
        resolve(answer)
      })
    })
  }

  async checkWalletBalance () {
    try {
      const result = await this.runCommand('node', ['wallet-info/get-balance.js'], { showOutput: false })

      // Parse balance from output - handle both "Total Balance" and "Balance" formats
      const balanceMatch = result.stdout.match(/(?:Total Balance|Balance):\s*([\d,]+(?:\.\d+)?)\s*XEC/)
      if (balanceMatch) {
        const balance = parseFloat(balanceMatch[1].replace(/,/g, ''))
        return isNaN(balance) ? 0 : balance
      }
      return 0
    } catch (err) {
      console.log(`⚠️  Warning: Failed to check balance: ${err.message}`)
      return 0
    }
  }

  async selectWalletOption () {
    console.log('\n' + '🎯 WALLET SELECTION'.padEnd(70, '='))

    // Check if wallet exists
    const walletExists = WalletHelper.walletExists()

    if (!walletExists) {
      console.log('📍 No existing wallet found')
      console.log('   A new wallet will be created automatically')
      console.log('═'.repeat(70))
      this.useExistingWallet = false
      this.walletChoice = 'new'
      return 'new'
    }

    // Load existing wallet info
    let walletData
    try {
      walletData = WalletHelper.loadWallet()
    } catch (err) {
      console.log('⚠️  Error loading existing wallet:', err.message)
      console.log('   A new wallet will be created')
      this.useExistingWallet = false
      this.walletChoice = 'new'
      return 'new'
    }

    if (!walletData || !walletData.xecAddress) {
      console.log('⚠️  Existing wallet file is corrupted or missing address')
      console.log('   A new wallet will be created')
      this.useExistingWallet = false
      this.walletChoice = 'new'
      return 'new'
    }

    // Check balance of existing wallet
    console.log('📍 Found existing wallet:')
    console.log(`   Address: ${walletData.xecAddress}`)

    console.log('\n⏳ Checking wallet balance...')
    const balance = await this.checkWalletBalance()

    const sufficientFunds = balance >= this.minimumBalance
    console.log(`   Current balance: ${balance.toLocaleString()} XEC`)

    if (sufficientFunds) {
      console.log(`   ✅ Sufficient for testing (need ${this.minimumBalance} XEC)`)
      this.walletFunded = true
    } else {
      console.log(`   ❌ Needs funding (need ${this.minimumBalance} XEC total)`)
    }

    console.log('\n💡 Wallet Options:')
    console.log(`   [1] Use existing wallet ${sufficientFunds ? '(recommended - already funded)' : '(needs funding)'}`)
    console.log('   [2] Create new wallet (backup existing to wallet_backup.json)')
    console.log('   [3] Show wallet info and exit')
    console.log('   [q] Quit')
    console.log('═'.repeat(70))

    while (true) {
      const choice = await this.waitForUserInput('\nChoose option [1,2,3,q]: ')

      switch (choice.toLowerCase()) {
        case '1':
          console.log('✅ Using existing wallet')
          this.useExistingWallet = true
          this.walletChoice = 'existing'
          return 'existing'

        case '2':
          console.log('🔄 Creating new wallet (existing wallet will be backed up)')
          this.useExistingWallet = false
          this.walletChoice = 'new'
          return 'new'

        case '3':
          console.log('\n📊 Current Wallet Information:')
          console.log('═'.repeat(50))
          try {
            await this.runCommand('node', ['wallet-info/get-balance.js'])
          } catch (err) {
            console.log('❌ Failed to load wallet info:', err.message)
          }
          console.log('\n👋 Exiting as requested')
          process.exit(0)

        case 'q':
        case 'quit':
          console.log('👋 Exiting test suite')
          process.exit(0)

        default:
          console.log('❌ Invalid option. Please choose 1, 2, 3, or q')
          continue
      }
    }
  }

  async showFundingInstructions () {
    console.log('\n' + '═'.repeat(70))
    console.log('💰 WALLET FUNDING REQUIRED')
    console.log('═'.repeat(70))
    console.log('Your wallet needs XEC to test transaction examples.')
    console.log(`Minimum required: ${this.minimumBalance} XEC`)
    console.log('')
    console.log('💡 What the tests will do:')
    console.log('   • Send 6 XEC to test address (above 5.46 XEC dust limit)')
    console.log('   • Send OP_RETURN message (~0.01 XEC)')
    console.log('   • Transaction fees (~0.01 XEC per tx)')
    console.log('   • Buffer for multiple test runs')
    console.log('')
    console.log('💰 Suggested funding: 15-25 XEC (about $0.01 USD)')
    console.log('')

    // Load wallet to get address
    const walletData = WalletHelper.loadWallet()
    if (walletData) {
      console.log('📍 Your XEC Address:')
      console.log(walletData.xecAddress)
      console.log('')

      // Show compact QR code inline
      console.log('📱 QR Code (scan with mobile wallet):')
      try {
        const qrcode = require('qrcode-terminal')
        // Use errorLevel 'L' for more compact inline display
        qrcode.generate(walletData.xecAddress, {
          small: true,
          errorLevel: 'L'
        }, (qrString) => {
          // Use small size compression for inline display
          const lines = qrString.split('\n').filter(line => line.trim())
          const compactLines = lines.filter((_, index) => index % 2 === 0)
          console.log(compactLines.join('\n'))
        })
      } catch (err) {
        console.log('   (QR code generation failed - use address above)')
      }
    }

    console.log('\n💡 Fund from: CashTab (cashtab.com), exchanges, or other XEC wallets')
    console.log('⏳ After funding, come back and press Enter to continue')
    console.log('═'.repeat(70))
  }

  async waitForFunding () {
    // If already funded from wallet selection, skip funding
    if (this.walletFunded) {
      console.log('\n✅ Wallet already has sufficient funds!')
      const balance = await this.checkWalletBalance()
      console.log(`   Current balance: ${balance.toLocaleString()} XEC (required: ${this.minimumBalance} XEC)`)
      return true
    }

    while (!this.walletFunded) {
      console.log('\n⏳ Checking wallet balance...')
      const balance = await this.checkWalletBalance()

      console.log(`Current balance: ${balance.toLocaleString()} XEC`)

      if (balance >= this.minimumBalance) {
        this.walletFunded = true
        console.log('✅ Wallet is sufficiently funded!')
        console.log(`   Balance: ${balance.toLocaleString()} XEC (required: ${this.minimumBalance} XEC)`)
        break
      }

      console.log(`❌ Insufficient funds. Need ${(this.minimumBalance - balance).toFixed(2)} more XEC.`)
      console.log('   💡 Tip: Send 15-25 XEC (≈$0.01 USD) for safe testing')

      const action = await this.waitForUserInput('\nOptions: [c]heck again, [s]kip transaction tests, [q]uit: ')

      switch (action.toLowerCase()) {
        case 'c':
        case 'check':
          continue
        case 's':
        case 'skip':
          console.log('⏭️  Skipping transaction tests (wallet not funded)')
          return false
        case 'q':
        case 'quit':
          console.log('👋 Exiting test suite')
          process.exit(0)
        default:
          console.log('Invalid option. Checking balance again...')
          continue
      }
    }

    return true
  }

  async testWalletCreation () {
    console.log('\n' + '🚀 PHASE 1: WALLET SETUP TESTS'.padEnd(70, '='))

    if (this.walletChoice === 'new') {
      console.log('🔄 Setting up new wallet...')

      // Backup existing wallet if it exists
      if (WalletHelper.walletExists()) {
        try {
          console.log('💾 Backing up existing wallet to wallet_backup.json')
          WalletHelper.backupWallet()
          WalletHelper.deleteWallet()
          console.log('✅ Existing wallet backed up successfully')
        } catch (err) {
          console.log('⚠️  Warning: Failed to backup existing wallet:', err.message)
          console.log('   Proceeding anyway - existing wallet will be overwritten')
          WalletHelper.deleteWallet()
        }
      }

      const tests = [
        {
          name: 'Create New Wallet',
          command: 'node',
          args: ['wallet-creation/create-new-wallet.js'],
          required: true
        },
        {
          name: 'Verify New Wallet',
          command: 'node',
          args: ['wallet-info/get-balance.js'],
          required: true
        }
      ]

      for (const test of tests) {
        try {
          console.log(`\n📋 Testing: ${test.name}`)
          await this.runCommand(test.command, test.args)
          this.testResults.push({ name: test.name, status: 'PASS' })
          console.log(`✅ ${test.name}: PASSED`)
        } catch (err) {
          this.testResults.push({ name: test.name, status: 'FAIL', error: err.message })
          console.log(`❌ ${test.name}: FAILED - ${err.message}`)

          if (test.required) {
            throw new Error(`Required test failed: ${test.name}`)
          }
        }
      }
    } else {
      console.log('♻️  Using existing wallet...')

      // Test existing wallet functionality
      const tests = [
        {
          name: 'Verify Existing Wallet',
          command: 'node',
          args: ['wallet-info/get-balance.js'],
          required: true
        }
      ]

      for (const test of tests) {
        try {
          console.log(`\n📋 Testing: ${test.name}`)
          await this.runCommand(test.command, test.args)
          this.testResults.push({ name: test.name, status: 'PASS' })
          console.log(`✅ ${test.name}: PASSED`)
        } catch (err) {
          this.testResults.push({ name: test.name, status: 'FAIL', error: err.message })
          console.log(`❌ ${test.name}: FAILED - ${err.message}`)

          if (test.required) {
            throw new Error(`Required test failed: ${test.name}`)
          }
        }
      }
    }

    // Common tests for both scenarios
    const commonTests = [
      {
        name: 'Get UTXOs',
        command: 'node',
        args: ['wallet-info/get-utxos.js'],
        required: false
      },
      {
        name: 'Get Transactions',
        command: 'node',
        args: ['wallet-info/get-transactions.js'],
        required: false
      }
    ]

    console.log('\n📋 Running common wallet tests...')
    for (const test of commonTests) {
      try {
        console.log(`\n📋 Testing: ${test.name}`)
        await this.runCommand(test.command, test.args)
        this.testResults.push({ name: test.name, status: 'PASS' })
        console.log(`✅ ${test.name}: PASSED`)
      } catch (err) {
        this.testResults.push({ name: test.name, status: 'FAIL', error: err.message })
        console.log(`❌ ${test.name}: FAILED - ${err.message}`)

        if (test.required) {
          console.log(`⚠️  Required test failed, but continuing: ${test.name}`)
        }
      }
    }

    console.log('\n✅ Phase 1 completed successfully!')
  }

  async testUtilities () {
    console.log('\n' + '🔧 PHASE 2: UTILITY TESTS'.padEnd(70, '='))

    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      throw new Error('No wallet found for utility tests')
    }

    const tests = [
      {
        name: 'Address Validation',
        command: 'node',
        args: ['key-management/validate-address.js', walletData.xecAddress],
        required: true
      },
      {
        name: 'QR Code Generation',
        command: 'node',
        args: ['utils/show-qr.js', walletData.xecAddress],
        required: false
      },
      {
        name: 'Derive Addresses',
        command: 'node',
        args: ['key-management/derive-addresses.js', '3'],
        required: !!walletData.mnemonic
      },
      {
        name: 'Get XEC Price',
        command: 'node',
        args: ['advanced/get-xec-price.js'],
        required: false
      }
    ]

    for (const test of tests) {
      try {
        console.log(`\n📋 Testing: ${test.name}`)
        await this.runCommand(test.command, test.args)
        this.testResults.push({ name: test.name, status: 'PASS' })
        console.log(`✅ ${test.name}: PASSED`)
      } catch (err) {
        this.testResults.push({ name: test.name, status: 'FAIL', error: err.message })
        console.log(`❌ ${test.name}: FAILED - ${err.message}`)

        if (test.required) {
          console.log(`⚠️  Required test failed, but continuing: ${test.name}`)
        }
      }
    }

    console.log('\n✅ Phase 2 completed!')
  }

  async testTransactions () {
    console.log('\n' + '💸 PHASE 3: TRANSACTION TESTS'.padEnd(70, '='))
    console.log('⚠️  These tests require a funded wallet!')

    // Check if wallet is funded
    const funded = await this.waitForFunding()
    if (!funded) {
      console.log('⏭️  Skipping transaction tests')
      return
    }

    const walletData = WalletHelper.loadWallet()
    const testAddress = 'ecash:qpcskwl402g5stqxy26js0j3mx5v54xqtssp0v7kkr' // Your test wallet for funding tests

    const tests = [
      {
        name: 'Send Valid Amount',
        command: 'node',
        args: ['transactions/send-xec.js', testAddress, '6'],
        required: true,
        needsConfirmation: true
      },
      {
        name: 'Send OP_RETURN',
        command: 'node',
        args: ['advanced/send-op-return.js', 'Test message from examples'],
        required: false,
        needsConfirmation: true
      },
      {
        name: 'UTXO Optimization (dry run)',
        command: 'node',
        args: ['advanced/optimize-utxos.js', '--dry-run'],
        required: false,
        needsConfirmation: false
      }
    ]

    for (const test of tests) {
      try {
        console.log(`\n📋 Testing: ${test.name}`)

        if (test.needsConfirmation) {
          console.log('⚠️  This test will send real XEC!')
          const proceed = await this.waitForUserInput('Continue? (yes/no): ')
          if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
            console.log('⏭️  Skipped by user')
            this.testResults.push({ name: test.name, status: 'SKIP' })
            continue
          }
        }

        // Add auto-confirmation and timeout for transaction tests
        const commandOptions = test.needsConfirmation
          ? { autoConfirm: true, timeout: 60000 } // 60 second timeout
          : { timeout: 30000 } // 30 second timeout for other commands

        await this.runCommand(test.command, test.args, commandOptions)
        this.testResults.push({ name: test.name, status: 'PASS' })
        console.log(`✅ ${test.name}: PASSED`)
      } catch (err) {
        this.testResults.push({ name: test.name, status: 'FAIL', error: err.message })
        console.log(`❌ ${test.name}: FAILED - ${err.message}`)

        if (test.required) {
          console.log(`⚠️  Required test failed: ${test.name}`)
        }
      }
    }

    console.log('\n✅ Phase 3 completed!')
  }

  showTestSummary () {
    console.log('\n' + '📊 TEST SUMMARY'.padEnd(70, '='))

    const passed = this.testResults.filter(r => r.status === 'PASS').length
    const failed = this.testResults.filter(r => r.status === 'FAIL').length
    const skipped = this.testResults.filter(r => r.status === 'SKIP').length
    const total = this.testResults.length

    console.log(`Total Tests: ${total}`)
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${failed}`)
    console.log(`Skipped: ${skipped}`)
    console.log('')

    // Show detailed results
    console.log('📋 Detailed Results:')
    this.testResults.forEach(result => {
      const status = result.status === 'PASS'
        ? '✅'
        : result.status === 'FAIL' ? '❌' : '⏭️'
      console.log(`   ${status} ${result.name}`)
      if (result.error) {
        console.log(`      Error: ${result.error}`)
      }
    })

    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!')
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed`)
    }

    console.log('═'.repeat(70))
  }
}

async function runTests () {
  const tester = new ExampleTester()

  try {
    console.log('🧪 Minimal XEC Wallet - Example Test Suite')
    console.log('═'.repeat(70))
    console.log('This will test all wallet examples in sequence.')
    console.log('Some tests require wallet funding for transaction testing.')
    console.log('')

    const proceed = await tester.waitForUserInput('Start tests? (yes/no): ')
    if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
      console.log('👋 Test suite cancelled')
      process.exit(0)
    }

    // Select wallet option (existing vs new)
    await tester.selectWalletOption()

    // Run test phases
    await tester.testWalletCreation()

    // Show funding instructions only if wallet needs funding
    if (!tester.walletFunded) {
      await tester.showFundingInstructions()
    }

    await tester.testUtilities()
    await tester.testTransactions()

    // Show final summary
    tester.showTestSummary()

    console.log('\n💡 Next Steps:')
    console.log('• All examples are ready for manual testing')
    if (!tester.walletFunded) {
      console.log('• Fund with 15-25 XEC for transaction testing')
    }
    console.log('• Check wallet balance: node examples/wallet-info/get-balance.js')
    console.log('• Read documentation: examples/README.md')
    console.log('• Start building your XEC application!')
    
    // Ensure test script exits cleanly
    process.exit(0)
  } catch (err) {
    console.error('❌ Test suite failed:', err.message)
    tester.showTestSummary()
    process.exit(1)
  }
}

// Run the test suite
runTests()
