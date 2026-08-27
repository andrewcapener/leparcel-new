/**
 * Money is integer cents. Never a float. (CLAUDE.md rule 1)
 * All arithmetic goes through here.
 */
export function usd(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const a = Math.abs(cents)
  return `${sign}$${(a / 100).toLocaleString('en-US', {
    minimumFractionDigits: a % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Split a gross amount into commission and net at a basis-point rate.
 * Rounding goes to the house, never against the vendor (CLAUDE.md rule 2).
 * Invariant: commission + net === gross, exactly, for every input.
 */
export function splitCommission(grossCents: number, bps: number) {
  if (!Number.isInteger(grossCents)) throw new Error('gross must be integer cents')
  if (!Number.isInteger(bps)) throw new Error('bps must be an integer')
  const commission = Math.round((grossCents * bps) / 10_000)
  const net = grossCents - commission
  return { grossCents, commissionCents: commission, netCents: net }
}

export function bpsLabel(bps: number): string {
  return `${bps / 100}%`
}
