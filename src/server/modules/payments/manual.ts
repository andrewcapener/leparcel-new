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
  /** The name Zelle has registered against that contact, which is not the
   *  market's own name: theirs reads "MERMADE MARKET LLC Accounts". Only
   *  needed to draw the code; without it the contact still shows. */
  zelleName?: string
}

export type ManualOption =
  | { kind: 'venmo'; handle: string; url: string; note: string }
  | { kind: 'zelle'; contact: string; note: string; url: string | null }

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
  if (zelle) {
    out.push({
      kind: 'zelle', contact: zelle, note,
      url: zelleQrUrl(zelle, cfg.zelleName ?? ''),
    })
  }
  return out
}

/**
 * The Zelle token, as their bank writes it.
 *
 * A phone number is digits only: the code their bank generated carried
 * "9496728019", not "949-672-8019", and the separators a person types into an
 * admin box must not end up in the payload. An email is left alone.
 */
export function zelleToken(contact: string): string {
  const c = contact.trim()
  return c.includes('@') ? c : c.replace(/\D/g, '')
}

/**
 * The Zelle code's url.
 *
 * Decoded from the code Mermade's own bank produced, which turned out to be a
 * documented format rather than anything bank specific: a base64 payload of
 * exactly two fields behind enroll.zellepay.com.
 *
 * Exactly two, deliberately. Zelle carries no amount and no note the way Venmo
 * does, and inventing a third field to try would risk a code that does not
 * scan at all. The maker types the amount, which the page already asks for.
 */
export function zelleQrUrl(contact: string, name: string): string | null {
  const token = zelleToken(contact)
  const who = name.trim()
  if (!token || !who) return null
  const data = Buffer.from(JSON.stringify({ token, name: who }), 'utf8').toString('base64')
  return `https://enroll.zellepay.com/qr-codes?data=${data}`
}

/**
 * The same link, as a scannable code.
 *
 * Worth generating rather than using the market's own Venmo QR, because that
 * one encodes the PROFILE and nothing else: scanning it opens a blank payment
 * with no amount and no MM code, which throws away the one thing that makes
 * these reconcilable. This encodes the prefilled link instead.
 *
 * Returned as a data URI so the page renders one <img> and nothing is written
 * to disk, fetched, or injected as raw markup.
 *
 * Only useful on a screen the maker is NOT holding: you cannot scan your own
 * phone. The page hides it below tablet width and shows the button instead.
 */
export async function qrDataUri(url: string): Promise<string | null> {
  try {
    const { toString } = await import('qrcode')
    const svg = await toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
  } catch {
    /* A missing code is a missing convenience, never a missing payment: the
       handle, the amount and the note are all written out beside it. */
    return null
  }
}

/** Whether to show the section at all. */
export function offersManualPay(cfg: ManualPayConfig): boolean {
  return Boolean(venmoUser(cfg.venmoHandle) || cfg.zelleContact.trim())
}
