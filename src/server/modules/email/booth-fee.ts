import {
  shell, button, paragraphs, fieldRows, rule, esc, BODY_FONT, MUTED, type Field,
} from './shell'

/**
 * The booth fee, and a button that pays it.
 *
 * Deliberately NOT an acceptance email. Drew's team write their own welcome,
 * in their own voice, on their own timing, and this must not stand on it: no
 * "you're in", no congratulations, nothing about the jury. It is the receipt
 * half of the pair, and it says so by being short.
 *
 * The link carries the booking's own token, so there is no sign-in between a
 * maker and their invoice. That is a real trade and worth naming: anybody
 * holding this link can pay this fee. The money still lands on the right
 * booking, and the page it opens shows an invoice and nothing else, so a
 * forward exposes no application, address or phone number. Against that: the
 * alternative is a magic link, and every step between an email and a paid
 * invoice is a step where somebody gives up.
 */
export function boothFeeHtml({
  url, shopName, showName, lines, totalLabel, deadline, startOnly, vendorCode,
}: {
  url: string
  shopName: string
  showName: string
  /** The invoice, already priced by the caller. Never recomputed here. */
  lines: Field[]
  totalLabel: string
  deadline: string
  /** Bank only: the date is when to START a transfer, not when to have paid. */
  startOnly: boolean
  vendorCode: string
}): string {
  return shell({
    webFonts: true,
    eyebrow: `${showName} · ${shopName}`,
    heading: 'Your booth fee',
    sub: startOnly ? `Start your transfer by ${deadline}.` : `Due ${deadline}.`,
    inner:
      fieldRows([
        ...lines,
        { label: 'Total', value: totalLabel, strong: true },
        { label: 'Your Mermade ID', value: vendorCode },
      ])
      + rule()
      + paragraphs([
        startOnly
          ? `Pay by bank transfer. You will link your bank on the next screen, and your space is held from the moment you start. Transfers take about four business days to arrive, so start yours by <strong style="color:#171717;">${esc(deadline)}</strong>. You do not have to wait for it to land.`
          : `Pay to confirm your space by <strong style="color:#171717;">${esc(deadline)}</strong>.`,
      ])
      + button({ href: url, label: 'Pay your booth fee' })
      + `<tr><td style="padding:14px 24px 4px;">
        <div style="font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">${esc(url)}</div>
      </td></tr>`
      + paragraphs([
        'We never ask for money by Zelle, Venmo, a wire, or any link that did not come from us.',
      ]),
    footer: 'Mermade Market · Dana Point, California',
  })
}

/** The same, for clients that will not render HTML at all. */
export function boothFeeText({
  url, showName, lines, totalLabel, deadline, startOnly, vendorCode,
}: {
  url: string
  showName: string
  lines: Field[]
  totalLabel: string
  deadline: string
  startOnly: boolean
  vendorCode: string
}): string {
  return `Your booth fee for ${showName}.\n\n`
    + lines.map((l) => `${l.label}: ${l.value}`).join('\n') + '\n'
    + `Total: ${totalLabel}\n`
    + `Your Mermade ID: ${vendorCode}\n\n`
    + (startOnly
      ? `Pay by bank transfer. Start yours by ${deadline} and your space is held from the moment you do. Transfers take about four business days to arrive, so you do not have to wait for it to land.\n\n`
      : `Pay to confirm your space by ${deadline}.\n\n`)
    + `${url}\n\n`
    + `We never ask for money by Zelle, Venmo, a wire, or any link that did not come from us.\n\n`
    + `Mermade Market`
}
