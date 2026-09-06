/**
 * The chrome every Mermade email shares, and the rules that make an email
 * arrive looking the way it left.
 *
 * Written by hand in tables and inline styles because email is not the web:
 * Gmail, Outlook and Apple Mail between them strip <style> blocks, ignore
 * flexbox and grid, drop external stylesheets, and Outlook renders through
 * Word. Tables and inline styles are not old-fashioned here, they are the only
 * thing that survives.
 *
 * One image only: the Mermade wordmark in the header. Everything else is text,
 * so a maker's details never travel anywhere to render, there is no web font,
 * and there is no tracking pixel. The mark is the one thing worth a request,
 * because set in a fallback face the name is just grey Helvetica and the email
 * arrives looking like nobody's. It carries real alt text, so a client that
 * blocks images still reads "Mermade Market" where the mark would be.
 */

import { siteUrl } from '@/lib/site-url'

/* The theme's own values, per docs/08-DESIGN-SYSTEM.md §2. An email that
   invents its own greys is an email that looks like somebody else's. */
export const GOLD = '#bc9658'   // --accent
export const INK = '#171717'    // --ink
export const BODY = '#5c5c5c'   // --ink-2
export const RULE = '#dfe3e8'   // --line
export const PAPER = '#ffffff'  // --bone
export const SHELL = '#f6f7f7'  // --shell, the ground the paper sits on
/* Small print only. 4.6:1 on white, because 11px at 3:1 is decoration. */
export const MUTED = '#767676'

/** Oswald and Figtree are not installed on a phone, so both stacks end in
 *  something every device has. The look survives; the exact face need not. */
/** @deprecated the ground is SHELL now. */
export const CREAM = SHELL

export const HEAD_FONT = "Oswald, 'Helvetica Neue', Helvetica, Arial, sans-serif"
export const BODY_FONT = "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** The header mark, drawn at 2x and served from our own origin. */
const MARK_W = 140
const MARK_H = 70

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A value that is a link becomes one; everything else stays text. */
export function linkify(value: string): string {
  const v = esc(value)
  if (/^https?:\/\//.test(value)) return `<a href="${v}" style="color:${GOLD};text-decoration:underline;">${v}</a>`
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return `<a href="mailto:${v}" style="color:${GOLD};text-decoration:underline;">${v}</a>`
  return v
}

export type Field = { label: string; value: string; strong?: boolean }

export function fieldRows(fields: Field[]): string {
  return fields.map((f, i) => {
    const border = i === fields.length - 1 ? '' : `border-bottom:1px solid ${RULE};`
    return `
    <tr><td class="mm-pad" style="padding:12px 32px 3px;">
      <div style="font-family:${HEAD_FONT};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};">${esc(f.label)}</div>
    </td></tr>
    <tr><td class="mm-pad" style="padding:0 32px 12px;${border}">
      <div style="font-family:${BODY_FONT};font-size:16px;line-height:1.45;font-weight:${f.strong ? '600' : '400'};color:${f.strong ? INK : BODY};">${linkify(f.value) || `<span style="color:#b5aea5;">not given</span>`}</div>
    </td></tr>`
  }).join('')
}

/**
 * A small gold label with a hairline, to break a long record into blocks.
 *
 * Twenty-three fields in one undifferentiated column is a scroll, not a
 * record. Three or four named groups is the same information and half the
 * reading, because you stop at the group you came for.
 */
export function sectionHead(label: string): string {
  return `<tr><td class="mm-pad" style="padding:26px 32px 10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="1" style="padding-right:9px;white-space:nowrap;font-family:${HEAD_FONT};font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};">${esc(label)}</td>
      <td><div style="height:1px;background:${RULE};line-height:1px;font-size:0;">&nbsp;</div></td>
    </tr></table>
  </td></tr>`
}

/**
 * The long tail of a record, two fields to a row.
 *
 * `fieldRows` gives a field the full width, which is right for the six that
 * decide anything and wasteful for the seventeen that do not: at one per row
 * the internal notice ran past three screens. Two columns halves it without
 * dropping a single field, which matters because this message is a backup.
 *
 * A plain two-cell table rather than anything clever, because it has to
 * survive Outlook's Word renderer, which ignores inline-block on a cell. At
 * the shell's 560px it lands around 250px a column, which is comfortable on a
 * phone and does not need to stack.
 */
export function compactRows(fields: Field[]): string {
  const cell = (f: Field | undefined, side: 'l' | 'r', last: boolean) => {
    const pad = side === 'l' ? 'padding:9px 12px 9px 0;' : 'padding:9px 0 9px 12px;'
    const border = last ? '' : `border-bottom:1px solid ${RULE};`
    if (!f) return `<td width="50%" valign="top" style="${pad}${border}">&nbsp;</td>`
    return `<td width="50%" valign="top" style="${pad}${border}">
      <div style="font-family:${HEAD_FONT};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};padding-bottom:3px;">${esc(f.label)}</div>
      <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.45;color:${BODY};word-break:break-word;">${linkify(f.value) || `<span style="color:#b5aea5;">not given</span>`}</div>
    </td>`
  }
  const rows: string[] = []
  for (let i = 0; i < fields.length; i += 2) {
    const last = i + 2 >= fields.length
    rows.push(`<tr>${cell(fields[i], 'l', last)}${cell(fields[i + 1], 'r', last)}</tr>`)
  }
  return `<tr><td class="mm-pad" style="padding:0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>
  </td></tr>`
}

/**
 * The maker's own photographs, three across, each linking to the full size.
 *
 * The only remote content any of these emails loads, and it is deliberate:
 * this one goes to Mermade's own inbox, and the jury's actual question is
 * "what does the work look like". A row of thumbnails answers it before
 * anybody opens the admin.
 *
 * Two rules hold even so. The urls come from our own storage bucket and are
 * checked by the caller, never from anything a maker typed; and a client that
 * blocks remote images loses the pictures and nothing else, because every
 * field is still in the record below and in the plain-text part.
 *
 * Width as an attribute as well as a style, because Outlook's Word renderer
 * ignores CSS width on an image.
 */
export function photoStrip(urls: string[]): string {
  if (urls.length === 0) return ''
  const W = 160
  const cells = urls.slice(0, 6).map((u) => `
    <td width="${W}" valign="top" style="padding:0 8px 8px 0;">
      <a href="${esc(u)}" style="text-decoration:none;">
        <img src="${esc(u)}" width="${W}" alt="" style="display:block;width:${W}px;height:${W}px;object-fit:cover;border:1px solid ${RULE};" />
      </a>
    </td>`)
  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 3) {
    rows.push(`<tr>${cells.slice(i, i + 3).join('')}</tr>`)
  }
  return `<tr><td class="mm-pad" style="padding:4px 32px 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>
  </td></tr>`
}

export function paragraphs(text: string[]): string {
  return text.map((t) => `
    <tr><td class="mm-pad" style="padding:0 32px 16px;">
      <div style="font-family:${BODY_FONT};font-size:16px;line-height:1.65;color:${BODY};">${t}</div>
    </td></tr>`).join('')
}

/**
 * A photograph, edge to edge.
 *
 * §4 of the design system: "Full-bleed imagery is encouraged; text never is."
 * An email that keeps its one photograph inside the same 32px margin as the
 * body copy has turned it into an illustration. Running it to the paper's
 * edges is the difference between a picture in a document and a picture you
 * are looking at.
 *
 * Width as an attribute as well as a style, because Outlook's Word renderer
 * ignores CSS width on an image, and a fixed height so the layout does not
 * jump while it loads.
 */
export function plate(src: string, alt: string, height = 340): string {
  return `<tr><td style="padding:0;font-size:0;line-height:0;">
    <img src="${esc(src)}" width="600" height="${height}" alt="${esc(alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;">
  </td></tr>`
}

/**
 * One fact, given the room a fact deserves: the label small and tracked, the
 * value large enough to be the thing you came for. Used for a date somebody
 * is going to put in a calendar.
 */
export function standfirst(label: string, value: string): string {
  return `<tr><td class="mm-pad" style="padding:4px 32px 0;">
    <div style="font-family:${HEAD_FONT};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};padding-bottom:6px;">${esc(label)}</div>
    <div style="font-family:${HEAD_FONT};font-size:26px;line-height:1.1;font-weight:600;text-transform:uppercase;color:${INK};">${esc(value)}</div>
  </td></tr>`
}

export function button(cta: { href: string; label: string }): string {
  return `<tr><td class="mm-pad" style="padding:20px 32px 6px;">
    <a href="${esc(cta.href)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${HEAD_FONT};font-size:15px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:17px 34px;">${esc(cta.label)}</a>
  </td></tr>`
}

export function rule(): string {
  return `<tr><td class="mm-pad" style="padding:22px 32px 0;"><div style="height:1px;background:${RULE};line-height:1px;font-size:0;">&nbsp;</div></td></tr>`
}

/**
 * The page these emails are printed on.
 *
 * It used to be a bordered white card floating on cream, which is the shape
 * every transactional email has, which is exactly why it read as one. The
 * design system says something different and says it plainly: rules, not
 * boxes; imagery full bleed and dominant; and, in §1, "the dynamic range is
 * the point. 13px to 148px on one page. When the range flattens, the page
 * reads underwhelming no matter how good the palette is." The card was
 * flattening it. A 30px heading over 15px body is a 2:1 range.
 *
 * So: no border and no card. White paper on the shell grey, the photograph
 * running to the paper's edges, a 2px ink rule under the masthead, hairlines
 * for interior structure, and a display line big enough to be a display line.
 * The eyebrow carries what the header chip used to say, in the gold tracked
 * caps this brand uses for that job on every page of the site.
 *
 * @param eyebrow what happened, in gold tracked caps over the heading
 * @param heading the thing the reader is looking for, set large
 * @param sub     one line under it, and the preview line in the inbox list
 * @param inner   the body, built from the helpers above
 * @param footer  the colophon at the end
 * @param display `wide` for a short headline that can afford to be enormous
 * @param webFonts load Oswald and Figtree. Outward mail only: it is a request
 *   to a third party, which the internal notice deliberately never makes.
 */
export function shell({
  eyebrow, heading, sub, inner, footer, display = 'normal', webFonts = false,
}: {
  eyebrow: string
  heading: string
  sub: string
  inner: string
  footer: string
  display?: 'normal' | 'wide'
  webFonts?: boolean
}): string {
  const origin = siteUrl()
  /* Oswald and Figtree render in Apple Mail, iOS Mail and Samsung Mail, which
     is most of a phone-first audience. Gmail ignores the link and falls back,
     so nothing below depends on the face: the sizes are chosen to hold in
     Arial Narrow and Helvetica too. */
  const fonts = webFonts
    ? `<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Figtree:wght@400;500;600&display=swap" rel="stylesheet">`
    : ''
  /* 52px for a headline that is four words, 38px for one carrying a shop name
     somebody else chose. Both are a long way from the body, which is the
     point: §1 of the design system calls the dynamic range the whole game. */
  const HEAD_PX = display === 'wide' ? 52 : 38
  const HEAD_LH = display === 'wide' ? '0.92' : '0.98'

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(heading)}</title>${fonts}
<style>
  /* Phones only, and only in the clients that read a media query. Everything
     is legible without it; this stops the display line from taking four
     lines of a 320px screen. */
  @media only screen and (max-width:480px) {
    .mm-display { font-size:${display === 'wide' ? 38 : 30}px !important; }
    .mm-pad { padding-left:22px !important; padding-right:22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${SHELL};">
<!-- The line a phone shows under the subject, then enough blanks that it does
     not go on to read the first row out loud. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(sub)}${'&#8203;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SHELL};">
  <tr><td align="center" style="padding:28px 0;">
    <!-- No border and no card. The paper is the paper; the rules do the
         structure, which is what §4 asks for. -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${PAPER};">

      <!-- Masthead. The mark, and the one heavy rule in the system. -->
      <tr><td class="mm-pad" style="padding:24px 32px 20px;border-bottom:2px solid ${INK};">
        <img src="${esc(origin)}/email/wordmark.png" width="${MARK_W}" height="${MARK_H}" alt="Mermade Market" style="display:block;width:${MARK_W}px;height:${MARK_H}px;border:0;outline:none;text-decoration:none;">
      </td></tr>

      <!-- Eyebrow, display line, lede. The gold tracked caps are what the
           site uses to name a section; the chip that used to sit up in the
           masthead was a interface convention borrowed from software. -->
      <tr><td class="mm-pad" style="padding:34px 32px 0;">
        <div style="font-family:${HEAD_FONT};font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD};padding-bottom:14px;">${esc(eyebrow)}</div>
        <div class="mm-display" style="font-family:${HEAD_FONT};font-size:${HEAD_PX}px;line-height:${HEAD_LH};font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;color:${INK};">${esc(heading)}</div>
        <div style="font-family:${BODY_FONT};font-size:17px;line-height:1.5;color:${BODY};padding-top:14px;">${esc(sub)}</div>
      </td></tr>

      <tr><td style="height:26px;line-height:26px;font-size:0;">&nbsp;</td></tr>
      ${inner}

      <!-- Colophon. Quiet, on the shell grey, under a hairline. -->
      <tr><td class="mm-pad" style="padding:22px 32px 26px;border-top:1px solid ${RULE};background:${SHELL};">
        <div style="font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:${MUTED};">${footer}</div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}
