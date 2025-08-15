/*
  Hybrid test: Use minimal example structure but with our real wallet data
  This will help isolate exactly what's causing the difference
*/

const {
  Ecc,
  P2PKHSignatory,
  Script,
  TxBuilder,
  fromHex,
  shaRmd160,
  toHex,
  ALL_BIP143
} = require('ecash-lib')

const WalletHelper = require('./utils/wallet-helper')

async function testHybrid () {
  try {
    console.log('🧪 Hybrid test: Real wallet data + minimal example structure...')

    // Load our real wallet
    const walletData = WalletHelper.loadWallet()
    if (!walletData) {
      console.log('❌ No wallet found')
      return
    }

    console.log('✅ Real wallet loaded')
    console.log(`Address: ${walletData.xecAddress}`)

    // Use our real private key
    const walletSk = fromHex(walletData.privateKey)
    const walletPk = new Ecc().derivePubkey(walletSk)
    const walletPkh = shaRmd160(walletPk)
    const walletP2pkh = Script.p2pkh(walletPkh)
    console.log('✅ Keys and script created from real wallet')

    // Use our real UTXO (from debug output)
    const walletUtxo = {
      txid: 'db59e755ddfe62152ba7ec44bdcaf94277d697e91c6ab8b2fe35b290521b5691',
      outIdx: 1
    }
    console.log('✅ Real UTXO defined')

    // Try the exact minimal example structure first
    console.log('\\n--- Test 1: Exact minimal example structure ---')
    try {
      const txBuild1 = new TxBuilder({
        inputs: [
          {
            input: {
              prevOut: walletUtxo,
              signData: {
                sats: 10000n, // Our real UTXO value
                outputScript: walletP2pkh
              }
            },
            signatory: P2PKHSignatory(walletSk, walletPk, ALL_BIP143)
          }
        ],
        outputs: [
          {
            sats: 0n, // OP_RETURN output
            script: new Script(fromHex('6a68656c6c6f'))
          },
          walletP2pkh // Change output (just script)
        ]
      })

      const tx1 = txBuild1.sign({ feePerKb: 1200n, dustSats: 546n })
      console.log('✅ Test 1 SUCCESS: Minimal structure with real data works!')
    } catch (err) {
      console.log('❌ Test 1 FAILED:', err.message)
    }

    // Try with proper output structure
    console.log('\\n--- Test 2: Proper send transaction structure ---')
    try {
      const txBuild2 = new TxBuilder({
        inputs: [
          {
            input: {
              prevOut: walletUtxo,
              signData: {
                sats: 10000n, // Our real UTXO value
                outputScript: walletP2pkh
              }
            },
            signatory: P2PKHSignatory(walletSk, walletPk, ALL_BIP143)
          }
        ],
        outputs: [
          {
            sats: 100n, // Send 1 XEC
            script: Script.p2pkh(Buffer.from('3c9e6c2b71ab3fe1b7fdf6b9b55bad7fbf92bb62', 'hex')) // Your address
          },
          {
            sats: 9628n, // Change (after 272 sats fee)
            script: walletP2pkh
          }
        ]
      })

      const tx2 = txBuild2.sign({ feePerKb: 1200n, dustSats: 546n })
      console.log('✅ Test 2 SUCCESS: Proper send structure works!')
      console.log('Transaction hex:', toHex(tx2.ser()))
    } catch (err) {
      console.log('❌ Test 2 FAILED:', err.message)
      console.log('Stack:', err.stack)
    }
  } catch (err) {
    console.error('❌ Hybrid test failed:', err.message)
    console.error('Stack:', err.stack)
  }
}

testHybrid()
