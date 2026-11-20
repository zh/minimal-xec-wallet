/*
  Partial token burns must declare the burn explicitly: Chronik refuses to broadcast
  burn-by-omission ("unexpected burn"). Checks the real tx structure, so it runs in a
  child process with the real ecash-lib (test/setup.js mocks it for the rest of the suite).
*/

const assert = require('chai').assert
const { execFileSync } = require('child_process')
const path = require('path')

const lib = path.resolve(__dirname, '../../lib')
const mocks = path.resolve(__dirname, 'mocks/token-mocks')

function run (body) {
  const script = `
    const { Tx, parseSlp, parseAlp, parseEmppScript, toHexRev } = require('ecash-lib')
    const m = require('${mocks}')
    const handler = (H, meta) => new H({ chronik: { token: async () => meta }, ar: {}, dustLimit: 546 })
    const SLP = handler(require('${lib}/slp-token-handler'), m.flctTokenMetadata)
    const ALP = handler(require('${lib}/alp-token-handler'), m.tgrTokenMetadata)
    ;(async () => { console.log(JSON.stringify(await (async () => { ${body} })())) })()
  `
  return JSON.parse(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }))
}

describe('#token burns (real ecash-lib)', function () {
  this.timeout(20000)

  it('ALP partial burn is one tx with SEND change + BURN sections', () => {
    // TGR UTXO holds 7 atoms; burn 2, keep 5
    const out = run(`
      const hex = await ALP.createBurnTransaction(m.TGR_TOKEN_ID, 2, m.testWalletInfo, m.mixedTokenUtxos, 1.2)
      return parseEmppScript(Tx.fromHex(hex).outputs[0].script).map(parseAlp)
        .map(s => [s.txType, String(s.sendAtomsArray || s.burnAtoms)])
    `)
    assert.deepEqual(out, [['SEND', '5'], ['BURN', '2']])
  })

  it('SLP partial burn is a split SEND chained into a BURN of the split output', () => {
    // FLCT UTXO holds 6 atoms; split [2, 4], then burn the 2
    const out = run(`
      const [splitHex, burnHex] = await SLP.createBurnTransaction(m.FLCT_TOKEN_ID, 2, m.testWalletInfo, m.mixedTokenUtxos, 1.2)
      const split = Tx.fromHex(splitHex)
      const burn = Tx.fromHex(burnHex)
      const msg = parseSlp(burn.outputs[0].script)
      return {
        split: String(parseSlp(split.outputs[0].script).sendAtomsArray),
        burn: [msg.txType, String(msg.burnAtoms)],
        inputs: burn.inputs.map(i => [toHexRev(i.prevOut.txid), i.prevOut.outIdx]),
        splitTxid: split.txid()
      }
    `)
    assert.equal(out.split, '2,4')
    assert.deepEqual(out.burn, ['BURN', '2'])
    assert.deepEqual(out.inputs, [[out.splitTxid, 1]])
  })
})
