/**
 * Every email we send, rendered against the live Show record, for /admin/emails.
 *
 * The point is that the team can read what a maker gets before a maker gets it.
 * So the dates, the rate and the venue are the real ones off the Show record
 * (CLAUDE.md rule 6): a preview built from invented values would go out of date
 * the moment somebody edited /admin/show, which is exactly when you would want
 * to look at it.
 *
 * The maker in them is invented, and obviously so. A preview that borrowed a
 * real applicant would put somebody's phone number on a page for no reason.
 */
import type { Show } from '@/db/schema'
import { fmtDate, fmtDeadline, fmtRange } from '@/lib/dates'
import { usd } from '@/lib/money'
import { CONTACT_EMAIL } from '@/lib/agreement'
import { SHEET_HEADERS } from '@/server/modules/sheets/row'
import { staffNoticeHtml } from './staff-notice'
import { applicationReceivedHtml } from './application-received'
import { saveTheDateHtml, saveTheDateText, type SaveTheDateInput } from './save-the-date'

export type Preview = {
  id: string
  /** What the team calls it. */
  name: string
  /** Who receives it, and when. */
  who: string
  when: string
  subject: string
  html: string
  text: string
}

/** An invented maker, named so nobody mistakes it for a real one. */
const SHOP = 'Sample Ceramics Co'
const CONTACT = 'A Maker'
const SAMPLE_EMAIL = 'maker@example.com'

const SAMPLE_VALUES: Record<string, string> = {
  'Submitted (PT)': '2026-09-07 09:14 PT',
  Shop: SHOP,
  Contact: CONTACT,
  Email: SAMPLE_EMAIL,
  Phone: '(949) 555-0100',
  Instagram: '@sampleceramics',
  Website: 'https://example.com',
  City: 'Dana Point',
  State: 'CA',
  Category: 'Ceramics',
  Track: 'Indoor',
  'Spaces requested': '3x6, 3x8',
  'Add-ons requested': 'Priority placement, inside',
  'Set-up times': '1-3pm, 5-7pm',
  'Wants Zoom call': 'Yes',
  'Seller permit': '',
  'Price low': '$18',
  'Price high': '$185',
  'Made by them': 'Makes everything',
  'AI artwork': 'No',
  MLM: 'No',
  Description: 'Wheel-thrown stoneware fired in small batches, glazed in a palette pulled from the tidepools.',
  'Application ID': '00000000-0000-0000-0000-000000000000',
}

export function previews(show: Show, siteUrl: string): Preview[] {
  const roster = fmtDate(show.rosterAnnouncedOn)

  /* The broadcast. Everything it prints comes off the record below. */
  const saveTheDate: SaveTheDateInput = {
    showName: show.name,
    season: show.season,
    dateRange: fmtRange(show.startsOn, show.endsOn),
    venueName: show.venueName,
    venueAddress: show.venueAddress,
    hoursNote: show.hoursNote,
    applicationsClose: fmtDeadline(show.applicationsCloseAt),
    applicationsCloseDay: fmtDate(show.applicationsCloseAt, { year: undefined }),
    rosterDate: fmtDate(show.rosterAnnouncedOn, { year: undefined }),
    commissionBps: show.commissionBps,
    siteUrl,
    // A real send carries the list's own unsubscribe url, which the sending
    // tool mints per subscriber. The preview has no subscriber, so it shows
    // the shape of the line rather than a link that would work.
    unsubscribeUrl: `${siteUrl}/unsubscribe?token=sample`,
  }
  // "November 13-15". The heading wants the year and a phone's subject line
  // does not: forty characters in and it is truncated either way.
  const shortRange = saveTheDate.dateRange.replace(/,\s*\d{4}$/, '')

  const receiptFields = [
    { label: 'Shop', value: SHOP, strong: true },
    { label: 'Category', value: 'Ceramics' },
    { label: 'Spaces you asked for', value: `3x6 ${usd(28_000)} · 3x8 ${usd(34_000)}` },
  ]

  const staffFields = SHEET_HEADERS
    .filter((h) => h !== 'Open in admin')
    .map((h) => ({ label: h, value: SAMPLE_VALUES[h] ?? '' }))

  return [
    {
      id: 'save_the_date',
      name: 'Save the date, applications open',
      who: 'The whole list. Past makers, people we said no to, and shoppers, all in one send',
      when: 'Once a show, the morning applications open',
      subject: `${shortRange}. Applications are open.`,
      text: saveTheDateText(saveTheDate),
      html: saveTheDateHtml(saveTheDate),
    },
    {
      id: 'application_received',
      name: 'Application received',
      who: 'The maker who applied',
      when: 'The moment they press submit',
      subject: `We have your ${show.name} application`,
      text: `Your ${show.name} application is in.\n\n`
        + receiptFields.map((f) => `${f.label}: ${f.value}`).join('\n')
        + `\n\nWe read every application and answer either way. The roster is announced ${roster}.\n\nMermade Market`,
      html: applicationReceivedHtml({
        shopName: SHOP, showName: show.name, fields: receiptFields,
        rosterDate: roster, contactEmail: CONTACT_EMAIL, siteUrl,
      }),
    },
    {
      id: 'application_staff_notice',
      name: 'New application (internal)',
      who: 'Mermade',
      when: 'The moment a maker presses submit',
      subject: `New application: ${SHOP} (Ceramics)`,
      text: `${SHOP} applied for ${show.name}.\n\n`
        + staffFields.map((f) => `${f.label}: ${f.value}`).join('\n')
        + `\n\nThis message is also the backup copy. Every field is above.`,
      html: staffNoticeHtml({
        heading: SHOP,
        sub: `Ceramics · indoor · applied for ${show.name}`,
        fields: staffFields,
        cta: { href: `${siteUrl}/admin/jury`, label: 'Open in admin' },
        // Two of the market's own photographs, so the preview shows the strip
        // a real notice carries rather than describing it.
        photos: [`${siteUrl}/photos/ceramics.jpg`, `${siteUrl}/photos/racks.jpg`],
      }),
    },
  ]
}

/** The show line the previews describe, for the page to state plainly. */
export function previewContext(show: Show): string {
  return `${show.name}, ${fmtRange(show.startsOn, show.endsOn)}, roster announced ${fmtDate(show.rosterAnnouncedOn)}`
}
