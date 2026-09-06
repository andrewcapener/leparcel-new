/**
 * "Here is your way in", to a maker who asked to sign in.
 *
 * One job, one button, and nothing else to read. A sign-in email that also
 * carries news is a sign-in email somebody scrolls, and this one arrives while
 * they are staring at a screen waiting for it.
 *
 * The link is printed underneath as plain text as well as wrapped in the
 * button, because a mail client that strips the button leaves a maker with no
 * way in, and because a link somebody can see before they click is a link they
 * can decide about.
 */
import { esc, paragraphs, button, rule, shell, MUTED, BODY_FONT } from './shell'

export function signInLinkHtml({
  url, shopName, minutes,
}: {
  url: string
  /** Their shop, when we know it, so the email is plainly theirs. */
  shopName?: string
  minutes: number
}): string {
  return shell({
    pill: 'Sign in',
    heading: 'Your way in',
    sub: shopName ? `${shopName} · Mermade Market` : 'Mermade Market',
    inner:
      paragraphs([
        'Tap the button and you are in. No password, and nothing to remember.',
      ])
      + button({ href: url, label: 'Sign in to Mermade' })
      + paragraphs([
        `The link works for <strong style="color:#171717;">${minutes} minutes</strong>, then it stops. Ask for another any time.`,
      ])
      + rule()
      + `<tr><td style="padding:14px 24px 4px;">
        <div style="font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">${esc(url)}</div>
      </td></tr>`
      + paragraphs([
        'If you did not ask for this, nothing has happened and you can ignore it. The link only reaches this address.',
      ]),
    footer: 'Mermade Market · Dana Point, California',
  })
}

/** The plain-text part, which is also what the outbox stores. */
export function signInLinkText({ url, minutes }: { url: string; minutes: number }): string {
  return [
    'Here is your way in to Mermade Market.',
    '',
    url,
    '',
    `The link works for ${minutes} minutes, then it stops. Ask for another any time.`,
    'If you did not ask for this, nothing has happened and you can ignore it.',
    '',
    'Mermade Market',
  ].join('\n')
}
