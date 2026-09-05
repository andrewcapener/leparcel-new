/**
 * Application → one flat spreadsheet row.
 *
 * Pure. No database handle, no network, no clock: everything it needs is an
 * argument, so the mapping is unit-testable (src/server/modules/sheets/row.test.ts)
 * and the same function serves the live sync and the backfill script.
 *
 * Money is formatted through src/lib/money.ts and never touched as a float
 * (CLAUDE.md rule 1). The timestamp renders America/Los_Angeles through
 * src/lib/dates.ts (rule 8).
 *
 * On PII (CLAUDE.md rule 9). A Google Sheet is shared more widely than the
 * admin, so only the fields the team genuinely works from are sent:
 *   · email    — the only way to answer a maker, and the key staff sort by.
 *   · phone    — load-in day runs on text messages.
 *   · instagram / website — public handles; they are how the work is judged.
 * Deliberately NOT sent, and they must stay that way: seller's permit numbers,
 * the signed agreement name, uploaded documents, jury scores and notes. Those
 * are compliance and curation records, they live behind the admin login, and a
 * spreadsheet link forwarded to a volunteer must not carry them.
 */
import { usd } from '@/lib/money'
import { isoToLaWall } from '@/lib/dates'

/** Column order is the sheet's column order. Changing it changes the sheet,
 *  so append rather than reorder once the owner has data he cares about. */
export const SHEET_COLUMNS = [
  { key: 'submittedAt', header: 'Submitted (PT)' },
  { key: 'shopName', header: 'Shop' },
  { key: 'contactName', header: 'Contact' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'instagram', header: 'Instagram' },
  { key: 'website', header: 'Website' },
  { key: 'city', header: 'City' },
  { key: 'state', header: 'State' },
  { key: 'category', header: 'Category' },
  { key: 'track', header: 'Track' },
  { key: 'spaces', header: 'Spaces requested' },
  { key: 'addons', header: 'Add-ons requested' },
  { key: 'loadInSlots', header: 'Set-up times' },
  { key: 'onboardingCall', header: 'Wants Zoom call' },
  { key: 'permitStatus', header: 'Seller permit' },
  { key: 'priceLow', header: 'Price low' },
  { key: 'priceHigh', header: 'Price high' },
  { key: 'madeByYou', header: 'Made by them' },
  { key: 'usesAiArtwork', header: 'AI artwork' },
  { key: 'isMlm', header: 'MLM' },
  { key: 'description', header: 'Description' },
  { key: 'adminLink', header: 'Open in admin' },
  // Last, and the reason the sync is safe to replay: the Apps Script keys on
  // this column, so re-sending an application updates its row instead of
  // appending a second one.
  { key: 'applicationId', header: 'Application ID' },
] as const

export type SheetColumnKey = (typeof SHEET_COLUMNS)[number]['key']
export type SheetRow = Record<SheetColumnKey, string>

export const SHEET_HEADERS: string[] = SHEET_COLUMNS.map((c) => c.header)

/** The row as a plain array, in column order. What the webhook posts. */
export function sheetValues(row: SheetRow): string[] {
  return SHEET_COLUMNS.map((c) => row[c.key])
}

/* ── the shapes the mapper needs, kept narrow so a caller can hand it a
 *    partial select and TypeScript still checks the fields that matter ── */

export type RowApplication = {
  id: string
  track: string
  category: string
  description: string
  priceLowCents: number
  priceHighCents: number
  madeByYou: string
  usesAiArtwork: boolean
  isMlm: boolean
  requestedSpaceIds: string
  requestedAddons: string
  loadInSlots: string
  wantsOnboardingCall: boolean
  permitStatus: string | null
  submittedAt: string
}

export type RowVendor = {
  shopName: string
  contactName: string
  email: string
  phone: string
  instagram: string
  website: string | null
  city: string
  state: string
}

export type RowCatalog = {
  /** Every space type for the show, so ids become labels a person can read. */
  spaces: Array<{ id: string; label: string }>
  /** Every add-on for the show, so codes become names. */
  addons: Array<{ code: string; name: string }>
}

export type RowInput = {
  application: RowApplication
  vendor: RowVendor
  catalog: RowCatalog
  /** Origin for the admin deep link, e.g. https://mermademarket.com. */
  siteUrl: string
}

/** Reads the same as the jury card, so the sheet and the admin agree. */
/** Blank for an indoor maker, who is never asked. */
const PERMIT: Record<string, string> = {
  have: 'Has one',
  occasional: 'Occasional seller',
  unsure: 'Not sure, wants help',
}

const MADE_BY: Record<string, string> = {
  all: 'Makes everything',
  mostly_sourced_components: 'Mostly, with sourced components',
  curate_resell: 'Curates and resells',
}

const TRACK: Record<string, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  both: 'Indoor and outdoor',
}

const yesNo = (v: boolean) => (v ? 'Yes' : 'No')

/** JSON text columns hold arrays. A malformed one must not lose the row. */
function parseList(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

/**
 * Postgres hands timestamptz back as "2026-09-05 01:38:42.09+00". Date parses
 * that, but the space is not ISO-8601, so normalize before anything downstream
 * assumes a T.
 */
function toIso(stamp: string): string {
  const t = stamp.includes('T') ? stamp : stamp.replace(' ', 'T')
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? stamp : d.toISOString()
}

/** "2026-09-04 18:38 PT" — Pacific, and it sorts as a string. */
export function ptStamp(stamp: string): string {
  const iso = toIso(stamp)
  if (iso === stamp && Number.isNaN(new Date(stamp).getTime())) return stamp
  return `${isoToLaWall(iso).replace('T', ' ')} PT`
}

export function applicationRow(input: RowInput): SheetRow {
  const { application: a, vendor: v, catalog, siteUrl } = input

  const spaceLabel = new Map(catalog.spaces.map((s) => [s.id, s.label]))
  const addonName = new Map(catalog.addons.map((x) => [x.code, x.name]))

  // Ids and codes are for machines. The sheet gets labels, in the order the
  // maker checked them, and falls back to the raw value rather than dropping a
  // request the catalog no longer offers.
  const spaces = parseList(a.requestedSpaceIds).map((id) => spaceLabel.get(id) ?? id)
  const addons = parseList(a.requestedAddons).map((code) => addonName.get(code) ?? code)

  return {
    submittedAt: ptStamp(a.submittedAt),
    shopName: v.shopName,
    contactName: v.contactName,
    email: v.email,
    phone: v.phone,
    instagram: v.instagram,
    website: v.website ?? '',
    city: v.city,
    state: v.state,
    category: a.category,
    track: TRACK[a.track] ?? a.track,
    spaces: spaces.join(', '),
    addons: addons.join(', '),
    // Already labels, not ids, so they go straight through. Empty for an
    // outdoor maker, who is never asked.
    loadInSlots: parseList(a.loadInSlots).join(', '),
    onboardingCall: yesNo(a.wantsOnboardingCall),
    permitStatus: PERMIT[a.permitStatus ?? ''] ?? '',
    priceLow: usd(a.priceLowCents),
    priceHigh: usd(a.priceHighCents),
    madeByYou: MADE_BY[a.madeByYou] ?? a.madeByYou,
    usesAiArtwork: yesNo(a.usesAiArtwork),
    isMlm: yesNo(a.isMlm),
    description: a.description,
    adminLink: `${siteUrl.replace(/\/$/, '')}/admin/applications/${a.id}`,
    applicationId: a.id,
  }
}
