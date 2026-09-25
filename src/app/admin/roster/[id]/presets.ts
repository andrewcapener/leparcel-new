/**
 * Quick fills for the add-a-line form on one maker's page.
 *
 * Drew's complaint about the roster was that adding a fee is work: find the
 * row, open a disclosure, type a description, type an amount. Most of what
 * gets added is not custom at all. It is the four extras the market already
 * sells, and their prices are already on the Show record as add_ons rows
 * (CLAUDE.md rule 6), so nothing here invents a number: the presets are
 * whatever that show is currently offering on this maker's track.
 *
 * Pure, so the rule is testable without a database and without a screen
 * (rule 10). A preset only ever fills the form. Nothing is charged until a
 * person presses Add line, which is deliberate: a one-click $100 sitting
 * beside a maker's name is a fee added by a stray press, and a voided line
 * is still a line somebody has to explain in December.
 */

export type ChargePreset = {
  /** The add-on's own code, which is what the link carries. */
  code: string
  /** What the button says, and what lands in the description box. */
  label: string
  amountCents: number
  /** The same figure as the dollars field wants it: "100.00", "-40.00". */
  dollars: string
}

/**
 * Cents as the dollars box wants them.
 *
 * Integer arithmetic only (rule 1). `(cents / 100).toFixed(2)` is a float
 * divide, and while it happens to be right for every amount a booth fee can
 * be, a money field is not the place to rely on happening to be right.
 */
export function dollarsField(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error('cents must be an integer')
  const sign = cents < 0 ? '-' : ''
  const a = Math.abs(cents)
  return `${sign}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`
}

export type AddOnRow = {
  code: string
  name: string
  /** Null means the add-on is offered to both tracks. */
  track: string | null
  priceCents: number
}

/**
 * The presets to offer one booking.
 *
 * Filtered on the booked space's track, not the application's: an application
 * can say "both" and only the space knows where the maker ended up. An indoor
 * maker is never offered the outdoor endcap, which is a different price, or a
 * tent, which is not a thing that exists inside.
 *
 * A zero-priced or negative add-on is dropped. `chargeProblem` refuses a line
 * for nothing, so a button that cannot produce a valid line should not be on
 * the screen.
 */
export function chargePresets(addons: AddOnRow[], track: string): ChargePreset[] {
  return addons
    .filter((a) => a.track === null || a.track === track)
    .filter((a) => Number.isInteger(a.priceCents) && a.priceCents > 0)
    .map((a) => ({
      code: a.code,
      label: a.name,
      amountCents: a.priceCents,
      dollars: dollarsField(a.priceCents),
    }))
}

/**
 * What the form should start with, given whichever preset was pressed.
 *
 * The code arrives in the URL, so it is whatever somebody typed there.
 * An unknown one fills nothing rather than half-filling something.
 */
export function presetFill(
  presets: ChargePreset[], code: string | undefined | null,
): { description: string; dollars: string } {
  const hit = presets.find((p) => p.code === (code ?? '').trim())
  return hit ? { description: hit.label, dollars: hit.dollars } : { description: '', dollars: '' }
}
