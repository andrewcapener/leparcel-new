/**
 * Venmo and Zelle: paying a person rather than a processor.
 *
 * Drew's call, 21 September 2026, with the trade laid out first. The girls
 * find it convenient for makers and they are right that it is: three taps in
 * an app most people already have.
 *
 * What this file exists to contain is the cost of that convenience, which is
 * that NOTHING here is automatic. A Stripe payment confirms its own booking
 * through a signed webhook (rule 5). One of these arrives as a notification on
 * somebody's phone, and a person has to match it to a booking and press Mark
 * paid. So the one job of this module is to make that matching as close to
 * mechanical as it can be: the maker's MM code travels in the payment note,
 * so staff are reading a code rather than guessing which of two Sarahs sent
 * $280.
 *
 * Pure, and tested, because a deep link that drops the amount or mangles the
 * note quietly turns a one-second match into a phone call.
 */

/** Where the handles live. Blank means the Show has not set one, and a blank
 *  option is never offered: better no section than a QR code pointing nowhere. */
export type ManualPayConfig = {
  venmoHandle: string
  zelleContact: string
}

export type ManualOption =
  | { kind: 'venmo'; handle: string; url: string; note: string }
  | { kind: 'zelle'; contact: string; note: string }

/** The handle as Venmo wants it in a url: no leading @, no stray spaces. */
export function venmoUser(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/\s+/g, '')
}

/**
 * What the maker should write on the payment, and what staff will read.
 *
 * The MM code first and alone at the front, because it is the only part that
 * matters and payment apps truncate. The show name follows for the human
 * reading a statement in February.
 */
export function payNote(vendorCode: string, showName: string): string {
  return `${vendorCode} booth fee ${showName}`.trim()
}

/**
 * A Venmo link that opens the app with the amount and the note already in it.
 *
 * The amount is dollars with two decimals, because Venmo's parameter is a
 * dollar figure and not cents, and this is the one place in the codebase that
 * converts out of integer cents on purpose (rule 1 is about arithmetic, and
 * none happens after this).
 *
 * Deliberately paired with the handle shown in plain text wherever this is
 * rendered. Deep-link parameters are not a contract Venmo publishes, and if a
 * future app build ignores them the maker must still be able to see who to pay
 * and what to write.
 */
export function venmoUrl(handle: string, amountCents: number, note: string): string {
  const user = venmoUser(handle)
  const amount = (amountCents / 100).toFixed(2)
  const q = new URLSearchParams({
    txn: 'pay',
    recipients: user,
    amount,
    note,
  })
  return `https://venmo.com/?${q.toString()}`
}

/**
 * The manual options this Show actually offers, in order, or none.
 *
 * Order is not arbitrary: Venmo carries a working link and Zelle cannot, since
 * Zelle lives inside each bank's own app and has no universal deep link. So
 * the one that can be tapped comes first.
 */
export function manualOptions(
  cfg: ManualPayConfig, amountCents: number, vendorCode: string, showName: string,
): ManualOption[] {
  const note = payNote(vendorCode, showName)
  const out: ManualOption[] = []
  const venmo = venmoUser(cfg.venmoHandle)
  if (venmo) {
    out.push({ kind: 'venmo', handle: `@${venmo}`, url: venmoUrl(venmo, amountCents, note), note })
  }
  const zelle = cfg.zelleContact.trim()
  if (zelle) out.push({ kind: 'zelle', contact: zelle, note })
  return out
}

/** Whether to show the section at all. */
export function offersManualPay(cfg: ManualPayConfig): boolean {
  return Boolean(venmoUser(cfg.venmoHandle) || cfg.zelleContact.trim())
}
