/**
 * The brand files, for linking to from an email.
 *
 * Why a page and not just a folder: an email is written somewhere else, by a
 * person who needs the absolute url and needs to see which file is which
 * before they paste it. A directory listing does neither, and guessing a
 * filename from memory at 11pm is how a broken image ends up in a send.
 *
 * On "hidden": this is unlisted, not private, and the difference matters here
 * more than anywhere else on the site. An email client fetches an image
 * anonymously, with no cookie and no session, so anything an email can show
 * MUST be reachable by anyone with the url. What unlisted buys is that it is
 * in no nav and no sitemap and carries noindex, so it will not turn up in a
 * search. It does not and cannot mean secret. Nothing confidential goes here.
 *
 * Formats: PNG for anything an email will show. A good number of clients,
 * Outlook among them, will not render an SVG at all, and Gmail strips it. The
 * SVG is listed where one exists because it is the better file for print and
 * for anyone rebuilding artwork, and is labelled so nobody mails it.
 */
export type BrandAsset = {
  file: string
  name: string
  /** What it is for, in a sentence a person can act on. */
  use: string
  /** Renders on a dark ground, so the page has to show it on one. */
  onDark?: boolean
  /** Vector: right for print, wrong for email. */
  vector?: boolean
}

export const brandAssets: BrandAsset[] = [
  // Filled in as the files land in public/brand/. Everything here must exist:
  // a row pointing at a missing file is a broken image in somebody's email.
]
