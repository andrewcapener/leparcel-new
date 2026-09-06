/**
 * Property test for the commission split. CLAUDE.md rule 2:
 * "Property-test that commission + net === gross, exactly, for randomized
 *  inputs. Rounding goes to the house, never against the vendor."
 *
 * Run with `npm test`. Deliberately dependency-free so it runs anywhere.
 */
import { splitCommission, usd } from './money'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) { failures++; console.error(`  ✗ ${name} ${detail}`) }
}

// 1 · exact conservation over 200k randomized inputs
for (let i = 0; i < 200_000; i++) {
  const gross = Math.floor(Math.random() * 5_000_00)     // $0 – $5,000
  const bps = Math.floor(Math.random() * 10_001)         // 0 – 100%
  const r = splitCommission(gross, bps)
  check('conservation', r.commissionCents + r.netCents === gross,
    `gross=${gross} bps=${bps} -> ${r.commissionCents}+${r.netCents}`)
  check('no negative net', r.netCents >= 0 || bps > 10_000, `gross=${gross} bps=${bps}`)
  check('integers', Number.isInteger(r.commissionCents) && Number.isInteger(r.netCents))
}

// 2 · the real rate, on the amounts this business actually sees
for (const gross of [1_00, 18_00, 2_450, 412_00, 8_420_00, 120_000_00]) {
  const r = splitCommission(gross, 2000)
  check('20% conserves', r.commissionCents + r.netCents === gross, String(gross))
  check('20% is 20%', r.commissionCents === Math.round(gross * 0.2), String(gross))
}

// 3 · the half-cent case: rounding must favour the house, not the maker
//    $0.025 commission on a 5¢ sale at 50% -> 3¢ house, 2¢ maker
{
  const r = splitCommission(5, 5000)
  check('rounds to the house', r.commissionCents === 3 && r.netCents === 2,
    `${r.commissionCents}/${r.netCents}`)
}

// 4 · floats are rejected outright — money is never a float
try { splitCommission(10.5, 2000); check('rejects float gross', false) }
catch { /* expected */ }

// 5 · formatting
check('usd whole', usd(28_000) === '$280', usd(28_000))
check('usd cents', usd(1_234) === '$12.34', usd(1_234))
check('usd negative', usd(-1_684_00) === '-$1,684', usd(-1_684_00))

if (failures) { console.error(`\n${failures} failing assertions`); process.exit(1) }
console.log('money: all invariants hold (200,000 randomized cases + edge cases)')
