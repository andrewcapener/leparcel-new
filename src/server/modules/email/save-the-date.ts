/**
 * The one broadcast of the year: the dates, and the fact that applications are
 * open. Sent to the whole list on the morning applications open.
 *
 * The list is not segmented. A past maker, an applicant we said no to, and a
 * shopper who came once in 2019 all get the same message, so the design problem
 * is not "write a marketing email", it is "answer two people with one page".
 * The answer here is order: the dates and the venue come first because everyone
 * wants those, the apply button sits directly under them with a shopper's exit
 * line beside it, and the two halves then get one block each. Nobody has to
 * read the other person's half to reach their own.
 *
 * What the archive sends did and this does not. The 2025 send was five stacked
 * images and no live text at all: a blocked-image client showed an empty white
 * page, a screen reader got nothing (every alt was empty), and the only link on
 * it went to the home page rather than to the application. The 2024 send had
 * real text but spent a paragraph asking the reader to go and re-tag themselves
 * as a shopper so they would stop getting maker email. Both are fixed below:
 * every fact is live text, every image carries alt and a width attribute, and
 * the split is handled by layout rather than by asking the reader to do admin.
 *
 * Nothing here is typed. Dates, venue, rate and both deadlines come off the
 * Show record (CLAUDE.md rule 6), so moving the show at /admin/show moves the
 * email with it. No attendance figure appears anywhere: we cannot source one
 * (docs/09-CONTENT-AUDIT.md §5).
 */
import { bpsLabel } from '@/lib/money'
import {
  BODY, BODY_FONT, CREAM, GOLD, HEAD_FONT, INK, MUTED, RULE,
  esc, paragraphs, rule, sectionHead, shell,
} from './shell'

/**
 * THE PHOTOGRAPHS. Drew is uploading a new batch, so these will be swapped.
 * Change the three filenames here and nothing else in the file moves. They are
 * files in `public/photos/`, and the caller turns them into absolute
 * https://mermademarket.com/... urls, which is the only kind a mail client can
 * load.
 */
const PHOTOS = {
  /** The room. Arched roof, balloons, an aisle with people in it. */
  floor: { file: 'floor.jpg', alt: 'The floor at the Community House, balloons strung under the arched roof and shoppers along the aisle' },
  /** Inside: our staff tagging a maker’s piece for the register. */
  indoor: { file: 'register.jpg', alt: 'A Mermade staffer writing a price tag while a shopper holds up a jacket' },
  /** Outside: a maker under a Mermade tent, running her own table. */
  outdoor: { file: 'lot.jpg', alt: 'A maker at her own table under a white Mermade Market tent, with shoppers stopped in front of it' },
} as const

type Track = {
  label: string
  photo: { file: string; alt: string }
  line: string
  href: string
  linkLabel: string
}

/** One full-width plate. Width as an attribute as well as a style, because
 *  Outlook's Word renderer ignores CSS width on an image. */
function plate(src: string, alt: string): string {
  return `<tr><td style="padding:0;background:${CREAM};">
    <img src="${esc(src)}" width="558" alt="${esc(alt)}" style="display:block;width:100%;max-width:558px;height:auto;border:0;" />
  </td></tr>`
}

/**
 * Inside and outside, side by side.
 *
 * They are two different businesses that share a form, and a maker reading
 * this already knows which one is theirs. Two columns says that in one glance
 * where two stacked paragraphs would read as one offer with a caveat. A plain
 * two-cell table, no inline-block and no float, because Outlook renders
 * through Word and ignores both.
 */
function tracks(a: Track, b: Track, base: string): string {
  const cell = (t: Track, side: 'l' | 'r') => `
    <td width="50%" valign="top" style="${side === 'l' ? 'padding:0 8px 0 0;' : 'padding:0 0 0 8px;'}">
      <img src="${esc(`${base}/photos/${t.photo.file}`)}" width="248" alt="${esc(t.photo.alt)}" style="display:block;width:100%;max-width:248px;height:auto;border:0;background:${CREAM};" />
      <div style="font-family:${HEAD_FONT};font-size:13px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${INK};padding:12px 0 5px;">${esc(t.label)}</div>
      <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.55;color:${BODY};">${t.line}</div>
      <div style="padding-top:7px;"><a href="${esc(t.href)}" style="font-family:${BODY_FONT};font-size:14px;color:${GOLD};text-decoration:underline;">${esc(t.linkLabel)}</a></div>
    </td>`
  return `<tr><td style="padding:6px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cell(a, 'l')}${cell(b, 'r')}</tr></table>
  </td></tr>`
}

/**
 * The one action, and the way out for somebody who does not want it.
 *
 * The button is full width rather than half of a pair. Two buttons of equal
 * weight would make the shopper decide which of them is for her before she has
 * read anything, and the answer for most of this list is neither. So the maker
 * gets the button and the shopper gets a plain sentence under it, which is
 * what she came for anyway.
 */
function actions(applyHref: string, visitHref: string): string {
  return `<tr><td style="padding:20px 24px 0;">
    <a href="${esc(applyHref)}" style="display:block;background:${INK};color:#ffffff;font-family:${HEAD_FONT};font-size:14px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;text-align:center;padding:16px 20px;">Apply to sell</a>
  </td></tr>
  <tr><td align="center" style="padding:12px 24px 0;">
    <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:${BODY};">Coming to shop instead? <a href="${esc(visitHref)}" style="color:${GOLD};text-decoration:underline;">Hours, parking and the map.</a></div>
  </td></tr>`
}

/** The three days, one to a line, straight off the Show record. */
function hours(hoursNote: string): string {
  const days = hoursNote.split(' · ').filter(Boolean)
  if (days.length === 0) return ''
  return `<tr><td style="padding:4px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${days.map((d, i) => `<tr><td style="padding:9px 0;${i === days.length - 1 ? '' : `border-bottom:1px solid ${RULE};`}">
        <div style="font-family:${BODY_FONT};font-size:15px;line-height:1.4;color:${INK};">${esc(d)}</div>
      </td></tr>`).join('')}
    </table>
  </td></tr>`
}

/** Two facts, side by side, for the pair of deadlines that decide anything. */
function deadlines(pairs: Array<[string, string]>): string {
  return `<tr><td style="padding:20px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${RULE};"><tr>
      ${pairs.map(([label, value], i) => `<td width="50%" valign="top" style="${i === 0 ? 'padding:14px 10px 0 0;' : 'padding:14px 0 0 10px;'}">
        <div style="font-family:${HEAD_FONT};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};padding-bottom:3px;">${esc(label)}</div>
        <div style="font-family:${BODY_FONT};font-size:15px;line-height:1.4;font-weight:600;color:${INK};">${esc(value)}</div>
      </td>`).join('')}
    </tr></table>
  </td></tr>`
}

export type SaveTheDateInput = {
  /** show.name, e.g. "Fall 2026". It rides in the header chip, which is the
   *  only place the email names the show: short enough that the wordmark
   *  beside it stays on one line on a 375px phone. */
  showName: string
  /** show.season, "fall" or "spring". The opening line names it, and naming
   *  it in code would be one more thing to remember every March. */
  season: string
  /** "November 13-15", already formatted Pacific by the caller. */
  dateRange: string
  venueName: string
  venueAddress: string
  /** show.hoursNote, the three days separated by " · ". */
  hoursNote: string
  /** "September 20, 11:59pm PT", formatted by the caller. */
  applicationsClose: string
  /** The same deadline without its time, for the preview line. The minute
   *  matters in the body and is noise in an inbox list. */
  applicationsCloseDay: string
  /** "September 25", formatted by the caller. */
  rosterDate: string
  /** show.commissionBps. The indoor line reads the rate off it. */
  commissionBps: number
  /** Absolute site origin, e.g. https://mermademarket.com. Every image and
   *  link below is built from it: a relative path is a broken image in every
   *  mail client. */
  siteUrl: string
  /** The list's unsubscribe url. Omitted only in the preview, which has no
   *  subscriber to unsubscribe. A broadcast must carry one. */
  unsubscribeUrl?: string
}

export function saveTheDateHtml({
  showName, season, dateRange, venueName, venueAddress, hoursNote, applicationsClose,
  applicationsCloseDay, rosterDate, commissionBps, siteUrl, unsubscribeUrl,
}: SaveTheDateInput): string {
  const url = (path: string) => `${siteUrl}${path}`

  return shell({
    pill: showName,
    heading: dateRange,
    sub: `Dana Point ${venueName}. Free to attend, all three days. Makers have until ${applicationsCloseDay}.`,
    inner:
      plate(url(`/photos/${PHOTOS.floor.file}`), PHOTOS.floor.alt)
      + `<tr><td style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>`
      + paragraphs([
        `The ${esc(season)} dates are set. Three days at the ${esc(venueName)} on San Juan Avenue, indoors and out, and free to walk in.`,
        `Applications open this morning and close ${esc(applicationsClose)}. We read every one and we answer either way, on ${esc(rosterDate)}.`,
      ])
      + actions(url('/apply'), url('/schedule'))

      + rule()
      + sectionHead('Two ways in')
      + tracks(
        {
          label: 'Inside',
          photo: PHOTOS.indoor,
          line: `We merchandise your work in the room and sell it at one register out front. You do not stand a booth. We keep ${bpsLabel(commissionBps)}.`,
          href: url('/makers/indoor'),
          linkLabel: 'The indoor deal',
        },
        {
          label: 'Outside',
          photo: PHOTOS.outdoor,
          line: 'You book a tent for the day and run your own register. We put the tent up, and we take nothing on your sales.',
          href: url('/makers/outdoor'),
          linkLabel: 'The outdoor deal',
        },
        siteUrl,
      )
      + deadlines([
        ['Applications close', applicationsClose],
        ['Roster announced', rosterDate],
      ])

      + rule()
      + sectionHead('The weekend')
      + hours(hoursNote)
      + paragraphs([
        `${esc(venueAddress)}. The lot on site is free and it fills by 11am on Saturday, so Friday is the calm one.`,
      ]),
    footer: [
      `Mermade Market · Dana Point, California`,
      unsubscribeUrl
        ? `<a href="${esc(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>`
        : '',
    ].filter(Boolean).join(' · '),
  })
}

/** The plain-text part, which is also what /admin/outbox stores. */
export function saveTheDateText(i: SaveTheDateInput): string {
  return [
    `Mermade Market ${i.showName}, ${i.dateRange}.`,
    `Dana Point ${i.venueName}, ${i.venueAddress}. Free to attend.`,
    '',
    `The ${i.season} dates are set. Three days at the ${i.venueName} on San Juan Avenue, indoors and out, and free to walk in.`,
    `Applications open this morning and close ${i.applicationsClose}. We read every one and we answer either way, on ${i.rosterDate}.`,
    '',
    `Apply: ${i.siteUrl}/apply`,
    `Coming to shop instead, hours and parking: ${i.siteUrl}/schedule`,
    '',
    'TWO WAYS IN',
    `Inside. We merchandise your work in the room and sell it at one register out front. You do not stand a booth. We keep ${bpsLabel(i.commissionBps)}. ${i.siteUrl}/makers/indoor`,
    `Outside. You book a tent for the day and run your own register. We put the tent up, and we take nothing on your sales. ${i.siteUrl}/makers/outdoor`,
    '',
    `Applications close: ${i.applicationsClose}`,
    `Roster announced: ${i.rosterDate}`,
    '',
    'THE WEEKEND',
    ...i.hoursNote.split(' · ').filter(Boolean),
    `${i.venueAddress}. The lot on site is free and it fills by 11am on Saturday, so Friday is the calm one.`,
    '',
    'Mermade Market',
    ...(i.unsubscribeUrl ? ['', `Unsubscribe: ${i.unsubscribeUrl}`] : []),
  ].join('\n')
}
