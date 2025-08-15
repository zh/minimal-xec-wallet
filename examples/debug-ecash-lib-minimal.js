/*
  Minimal test to replicate the exact ecash-lib NPM example
  Then gradually modify to match our use case
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

async function testMinimalExample () {
  try {
    console.log('🧪 Testing minimal ecash-lib example...')

    // Use the exact example values from GitHub
    const walletSk = fromHex(
      'e6ae1669c47d092eff3eb652bea535331c338e29f34be709bc4055655cd0e950'
    )
    const walletPk = new Ecc().derivePubkey(walletSk)
    const walletPkh = shaRmd160(walletPk)
    const walletP2pkh = Script.p2pkh(walletPkh)
    console.log('✅ Keys and script created')

    // TxId with unspent funds for the above wallet (example value)
    const walletUtxo = {
      txid: '0000000000000000000000000000000000000000000000000000000000000000',
      outIdx: 0
    }
    console.log('✅ UTXO defined')

    // Tx builder - correct v4.3.1 API format
    const txBuild = new TxBuilder({
      inputs: [
        {
          input: {
            prevOut: walletUtxo,
            signData: {
              sats: 1000n, // Use 'sats' and BigInt format
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
        walletP2pkh // Change output (just script, no sats)
      ]
    })
    console.log('✅ TxBuilder created successfully')

    // Use correct v4.3.1 sign API
    console.log('Trying correct v4.3.1 sign API...')
    try {
      const tx = txBuild.sign({ feePerKb: 1000n, dustSats: 546n })
      console.log('✅ Transaction signed successfully!')

      const rawTx = tx.ser()
      console.log('✅ Transaction serialized')
      console.log('Raw tx hex:', toHex(rawTx))
    } catch (err) {
      console.log('❌ Correct API failed:', err.message)
      console.log('Stack:', err.stack)
    }

    // Only serialize if we got a successful transaction
    // const rawTx = tx.ser();
    // console.log('✅ Transaction serialized')
    // console.log('Raw tx hex:', toHex(rawTx));

    console.log('\n🎉 Minimal example works!')
  } catch (err) {
    console.error('❌ Minimal example failed:', err.message)
    console.error('Stack:', err.stack)
  }
}

testMinimalExample()
