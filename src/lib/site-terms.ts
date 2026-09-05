/**
 * The two site-level legal pages: terms of use, and privacy.
 *
 * Same pattern as src/lib/agreement.ts and src/lib/page-html.ts. Prose here,
 * `{{token}}` for anything off the Show record, a thin page component.
 *
 * ─────────────────────────── the rule for this file ─────────────────────────
 *
 * Every factual claim about data has to be true of THIS codebase as written,
 * not of a generic Next.js site. Each section below names the file it was
 * written from. If one of those files changes, this page is part of the
 * change. The claims and where they come from:
 *
 *   what the application collects   src/app/actions.ts ApplicationSchema
 *                                   src/db/schema.ts applications, vendors
 *   photographs, and the public
 *   bucket they go in               src/server/modules/uploads/config.ts
 *   what leaves for the Sheet       src/server/modules/sheets/row.ts
 *   what the newsletter stores      src/db/schema.ts subscribers
 *                                   src/app/actions.ts subscribe
 *   what the contact form does      src/app/actions.ts sendMessage
 *   every email we send, recorded   src/db/schema.ts email_outbox
 *   who appears on the roster       src/app/merchants/page.tsx
 *   cookies                         src/lib/adminAuth.ts, src/lib/preview.ts
 *   local storage                   src/components/theme/NewsletterPopup.tsx
 *   embedded video                  src/components/theme/BackgroundVideo.tsx
 *
 * There is no analytics script, no advertising pixel and no third-party
 * tag manager anywhere in this repo, the fonts are served from our own
 * origin (src/app/layout.tsx), and the map is an image and not an embed
 * (src/components/theme/Sections.tsx). If any of that changes, so does the
 * cookies section.
 *
 * NOT REVIEWED BY AN ATTORNEY.
 */
import type { Show } from '@/db/schema'
import { fill, type PageVars } from './page-html'
import { CONTACT_EMAIL } from './agreement'

/** Bump when the substance changes, and say so on the page. */
export const LEGAL_VERSION = '2026.1'
export const LEGAL_UPDATED = '2026-09-05'

export type LegalSection = {
  id: string
  title: string
  /** Paragraphs, and lists. A string is a paragraph; an array is a list. */
  body: Array<string | string[]>
}

/* ─────────────────────────── terms of use ─────────────────────────── */

export const TERMS: LegalSection[] = [
  {
    id: 'who',
    title: 'Who runs this site',
    body: [
      'Mermade Market LLC runs mermademarket.com. We are a juried market for independent makers, held twice a year at the Dana Point {{venueName}}, {{venueAddress}}.',
      'Write to us at {{contactEmail}}. A person reads every message, usually within a day or two.',
    ],
  },
  {
    id: 'what',
    title: 'What this site is for',
    body: [
      'This site tells you when the show is, who is in it, and how to apply. There is no shop and no checkout here. Nothing is sold on this site, and we do not take card details anywhere on it.',
      'Booth fees are invoiced after acceptance and paid separately. If that ever moves onto this site, this page changes first.',
    ],
  },
  {
    id: 'apply',
    title: 'Applying to sell',
    body: [
      'The application is at /apply, and it is free. What you agree to when you sign it is the vendor agreement, which is published in full at /agreement. That agreement, your accepted application and the show record are what govern selling with us. These terms cover the site itself.',
      'One application per shop per show. We read every application and answer either way.',
    ],
  },
  {
    id: 'accuracy',
    title: 'Dates, prices and what is on the page',
    body: [
      'Dates, hours, prices, capacities and the commission rate on this site are read from the show record, and they can change while a show is being planned. Your acceptance email is the version that binds. If the two disagree, tell us and we will fix the page.',
      'The journal is written by us and is dated. Old posts stay up as they were written, which means an old post can describe a venue or a rule we no longer use.',
    ],
  },
  {
    id: 'yours',
    title: 'What you send us stays yours',
    body: [
      'The photographs, descriptions and shop names you send with an application stay yours. You give us permission to use them to jury your application, to run the show, and to promote the show, and nothing more. We do not sell them and we do not license them on.',
      'Section 10 of the vendor agreement covers photographs taken at the show itself.',
    ],
  },
  {
    id: 'use',
    title: 'Using the site',
    body: [
      'Read it, apply, tell your friends. What we ask you not to do:',
      [
        'scrape the roster or the journal to build a list;',
        'submit an application for a shop that is not yours;',
        'try to reach parts of the site that are not yours to reach, or interfere with how it runs for other people.',
      ],
      'We can decline an application, and remove access, from anyone doing those things.',
    ],
  },
  {
    id: 'links',
    title: 'Links away from here',
    body: [
      'We link out to makers, to our Instagram and Facebook, to a Pinterest board of display ideas, and to video on YouTube. What happens on those sites is theirs, not ours, and their terms and their privacy policies apply once you are there.',
    ],
  },
  {
    id: 'liability',
    title: 'What we do not promise',
    body: [
      'We keep this site accurate and we keep it up, and we do not promise it is faultless or always reachable. Nothing on it is legal, tax or business advice.',
      'To the extent California law allows it, we are not liable for indirect or consequential loss arising from your use of this site. Nothing here limits liability that cannot be limited, including for fraud.',
    ],
  },
  {
    id: 'law',
    title: 'California law',
    body: [
      'California law governs these terms, and the state and federal courts in Orange County, California have jurisdiction.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes',
    body: [
      'These terms are version {{legalVersion}}, last updated {{legalUpdated}}. When we change something that matters we change the version and the date. The vendor agreement is versioned separately, and the version you signed is the one that governs your show.',
    ],
  },
]

/* ─────────────────────────── privacy ─────────────────────────── */

export const PRIVACY: LegalSection[] = [
  {
    id: 'short',
    title: 'The short version',
    body: [
      'We collect what we need to run a market and nothing else: an email address if you join the list, a message if you write to us, and an application if you want to sell. There is no analytics script on this site, no advertising pixel, and no tracking cookie. We do not sell your information and we never will.',
      'One thing is worth knowing before you upload anything: the photographs you attach to an application are stored so that anyone with the link can open them. More on that below.',
    ],
  },
  {
    id: 'newsletter',
    title: 'If you join the mailing list',
    body: [
      'We store your email address, which form you used, and the date. That is the whole record.',
      'We send about six emails a year: show dates, when applications open, and the roster. To come off the list, write to {{contactEmail}} and you are off it the same day. There is no self-service unsubscribe page yet.',
    ],
  },
  {
    id: 'contact',
    title: 'If you write to us',
    body: [
      'The contact form and the collaborate form take your name, your email address and your message. All three are emailed to us and stored, so that a message is never lost to a delivery failure. Staff can read them in the admin.',
    ],
  },
  {
    id: 'apply',
    title: 'If you apply to sell',
    body: [
      'This is the longest list on the page, because an application is the one place we ask for real detail. We store:',
      [
        'your shop name, your name, your email address and your phone number;',
        'your Instagram handle, your website, and your city and state;',
        'which track and which spaces you asked for, and any add-ons;',
        'your category, your description of your work, and your price range;',
        'your answers on who makes your goods, on AI-generated artwork, and on multi-level marketing;',
        'your seller’s permit number if you gave one, or that you told us you are an occasional seller;',
        'whether you told us you carry liability insurance;',
        'any photographs you attached;',
        'the name you typed to sign the vendor agreement, the version you signed, and the date and time.',
      ],
      'Phone numbers are for load-in day, which runs on text messages. The permit number is a compliance record we are required to keep: CDTFA Publication 111 makes an event operator keep it for four years.',
      'If you are accepted and you pay, your shop name and your public handles appear on the roster page. Your email address, your phone number and your permit number do not, and never will.',
    ],
  },
  {
    id: 'photos',
    title: 'Photographs, and the one thing to know about them',
    body: [
      'Photographs attached to an application are stored in a bucket that is readable by anyone who has the exact link. There is no login in front of them. We do it that way because the jury looks at hundreds of images in one sitting and a private bucket makes that slow enough that a juror stops using it.',
      'The links themselves are random, and they carry no name, no email address and no filename of yours, so there is nothing in the address to guess and no listing to browse. Even so: treat an application photograph as public, and send us work, not anything you would not put on your own feed.',
      'Identity documents are a different thing and are handled differently. Permits, W-9s and anything similar are never put in that bucket.',
    ],
  },
  {
    id: 'where',
    title: 'Who else touches it',
    body: [
      'Only the companies that run the plumbing, and only for what they are for:',
      [
        'Supabase, which hosts the database and the photograph storage;',
        'Vercel, which serves the site and keeps ordinary server logs;',
        'Resend, which delivers the email we send;',
        'Google Sheets, where the team reads new applications;',
        'YouTube, on the pages that carry a film.',
      ],
      'The Google Sheet gets less than the admin does, on purpose, because a spreadsheet link gets forwarded. It carries your shop, contact name, email, phone, Instagram, website, city, state, category, track, the spaces and add-ons you asked for, your price range, your three yes-or-no answers and your description. It does not carry your seller’s permit number, the name you signed with, or anything the jury wrote about you.',
      'We do not sell personal information, we do not share it for anyone else’s advertising, and there is no third party on this site collecting anything of its own.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies and what is stored in your browser',
    body: [
      'There is no analytics, no advertising and no tracking cookie on this site. The fonts and the images come from our own server, not from someone else’s.',
      'What is actually stored:',
      [
        'two cookies for staff who are signed in to the admin, one for the session and one that turns on a launch preview. Neither is set for anyone else;',
        'one item in your browser’s local storage, so that the newsletter popup you dismissed stays dismissed for a while;',
        'anything YouTube stores if you play a film. Those are embedded through youtube-nocookie.com, which holds off until you press play.',
      ],
      'Do Not Track: we do not track you across sites, so there is nothing here for that signal to change.',
    ],
  },
  {
    id: 'keeping',
    title: 'How long we keep it',
    body: [
      'Applications and vendor records are the market’s own history and we keep them: who applied, who was accepted, who sold, at which show. Permit records are kept four years, which is what CDTFA Publication 111 requires. Mailing list entries stay until you ask to come off. Messages sent through the contact form stay in the admin so an old thread can be found again.',
    ],
  },
  {
    id: 'rights',
    title: 'What you can ask us for',
    body: [
      'Write to {{contactEmail}} and we will tell you what we hold about you, correct it if it is wrong, and delete what we are not required to keep. We will not ask you to explain why.',
      'Two California notes. We do not disclose personal information to third parties for their own direct marketing, so a Shine the Light request has nothing to return. And we are a small business, well under the thresholds that trigger the CCPA, but we answer requests the same way regardless of whether a statute makes us.',
    ],
  },
  {
    id: 'children',
    title: 'Children',
    body: [
      'This site is not aimed at children and we do not knowingly collect anything from one. Junior maker spaces are real, and the application for one comes from a parent or guardian, who is also the person who signs the vendor agreement.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes',
    body: [
      'This page is version {{legalVersion}}, last updated {{legalUpdated}}. If we change what we collect or where it goes, we change this page and the date on it before the change ships.',
    ],
  },
]

/** Token values for both pages. Same contract as agreementVars. */
export function legalVars(show: Show): PageVars {
  return {
    contactEmail: CONTACT_EMAIL,
    venueName: show.venueName,
    venueAddress: show.venueAddress,
    showName: show.name,
    legalVersion: LEGAL_VERSION,
    legalUpdated: new Date(`${LEGAL_UPDATED}T12:00:00-07:00`).toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric',
    }),
  }
}

/** `fill` over one section's body. */
export function fillSection(section: LegalSection, vars: PageVars): LegalSection {
  return {
    ...section,
    body: section.body.map((b) =>
      Array.isArray(b) ? b.map((i) => fill(i, vars)) : fill(b, vars)),
  }
}
