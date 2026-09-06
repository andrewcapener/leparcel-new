/**
 * The vendor agreement, as structured content.
 *
 * Same shape as src/lib/page-html.ts: the prose lives here, everything
 * dated, priced, counted or rated is a `{{token}}` filled from the Show
 * record at render time (CLAUDE.md rule 6), and the page component
 * (src/app/agreement/page.tsx) is thin.
 *
 * Unlike page-html.ts this is not one HTML blob. A contract is a numbered
 * tree and a maker has to be able to jump to a clause, cite it, and read one
 * schedule without the other, so it is modelled as parts → sections →
 * clauses. That also means no `dangerouslySetInnerHTML` on a legal page: the
 * only markup is the markup the renderer chooses.
 *
 * ─────────────────────────── read this before editing ───────────────────────
 *
 * docs/10-VENDOR-AGREEMENT.md is the source and the working document. It
 * carries the reasoning, the comparative research, the ⟨DECISION⟩ markers and
 * the ⟨COUNSEL⟩ markers. THIS FILE IS THE PUBLISHED TEXT, so it carries
 * neither: an applicant signs it.
 *
 * That difference has one hard rule. Where a decision is still open in the
 * doc, this file must NOT invent a policy to fill the gap. It does one of
 * three things instead, and each one is noted at the clause:
 *
 *   1. reads the number off the Show record (payment window, commission),
 *   2. defers to the acceptance email or the load-in instructions, which is
 *      where the market already puts venue-specific numbers, or
 *   3. states the market's own published position, quoted from the live
 *      pages vendored in src/lib/page-html.ts, in preference to a drafted
 *      position that contradicts it.
 *
 * Every clause where (3) applied is listed in docs/10-VENDOR-AGREEMENT.md
 * under "Where the agreement and the code disagree".
 *
 * NOT REVIEWED BY AN ATTORNEY. Neither is the doc. That is a launch blocker
 * the owner has to clear, not something this file can fix.
 */
import type { Show } from '@/db/schema'
import { fill, type PageVars } from './page-html'
import { fmtDate, fmtRange } from './dates'

/** Matches `applications.terms_version` in src/db/schema.ts. Bump both together. */
export const TERMS_VERSION = '2026.1'

/** The address the agreement tells makers to write to. Same default as CONTACT_TO. */
export const CONTACT_EMAIL = 'hello@mermademarket.com'

/**
 * Policy numbers that are NOT on the Show record.
 *
 * Every one of these should end up as a column on `shows` so staff can edit
 * it at /admin/show, the way the payment window and the commission rate
 * already are (CLAUDE.md rule 6). Until that migration exists they live here,
 * in one place, named, so there is exactly one number to change and no
 * hunting through prose.
 *
 * Where a number came from is recorded next to it. Nothing here was invented.
 */
export const POLICY = {
  /** Statement and payment, as a window rather than a single number.
   *
   *  CONFIRMED by Drew, 5 Sep 2026: pay within 10 days. Elise reported that
   *  payment really goes out 7 to 10 days after the show; the contract had
   *  said 7, because the old Shopify page promised "pay within 1 week" and the
   *  contract must not promise slower than the page a maker read. But a
   *  contract promising 7 when the work takes 10 is breached on day 8, every
   *  season, by a business doing nothing wrong. The outer bound is what is
   *  promised; the page quotes the window. docs/10 drafted 30 days. */
  payoutDaysMin: 7,
  payoutDays: 10,
  /** Window to query a statement, from the draft. */
  disputeDays: 14,
  /** Window to collect unsold goods before they may be donated. From the draft. */
  abandonDays: 14,
  /** Window to decline a rescheduled date, or a carried-forward outdoor day. */
  electionDays: 7,
  /** How long a credit stays live, whatever created it. One instrument now:
   *  a postponement (4.2), an outright cancellation (4.3) and a called
   *  outdoor day (B6.2) all produce the same 18 month credit. The 30%
   *  weather reimbursement that used to live here was retired on 6 Sep 2026
   *  by Drew's refund audit; nothing pays cash any more. */
  creditMonths: 18,
  /** CDTFA Publication 111 operator penalty, per seller, in dollars. Statutory. */
  pub111PenaltyUsd: 1_000,
} as const

/* ─────────────────────────── shape ─────────────────────────── */

export type Clause = {
  /** "3.2", "A6.1". Rendered as the clause number and used as the anchor. */
  n: string
  /** Bold lead-in. The rest of `text` continues the same sentence. */
  lead?: string
  /** Body. One string per paragraph. */
  text: string[]
  /** Sub-points, rendered as a list under the body. */
  list?: string[]
}

export type Section = {
  /** Anchor id, also the contents-list target. */
  id: string
  /** "3", "A6", "B2". */
  n: string
  title: string
  clauses: Clause[]
}

export type Part = {
  id: string
  title: string
  /** One line under the part heading saying who it applies to. */
  scope?: string
  sections: Section[]
}

/* ─────────────────────── PART I — common terms ─────────────────────── */

const partOne: Part = {
  id: 'part-1',
  title: 'Part I. Terms for every maker',
  scope: 'These terms apply to you whether you are inside, outside, or both.',
  sections: [
    {
      id: 's1', n: '1', title: 'Who this is between, and which show it covers',
      clauses: [
        /* The contracting party is the company, not a person. Naming the LLC
           is the whole point of having one: an agreement signed by "Mermade
           Market" with no entity behind it invites the argument that the
           owner contracted personally, which is exactly the exposure the LLC
           exists to prevent. ⟨COUNSEL⟩ confirm the formation state and add it
           here ("a California limited liability company"). */
        { n: '1.1', text: ['This agreement is between Mermade Market LLC ("Mermade", "we", "us") and the maker named in the signed application ("you").'] },
        {
          n: '1.2',
          text: [
            'It covers one show: {{showName}}, {{showDates}}, at the Dana Point {{venueName}}, {{venueAddress}}.',
            'Your acceptance email and the show record on this site carry the hours, the booth fee, the commission rate, the load-in times and the payment window for your show. They are part of this agreement. Selling at one show gives you no claim on the next one.',
          ],
        },
        {
          n: '1.3', lead: 'Version.',
          text: ['This is version {{version}}. When you sign, we record the name you typed, the version you signed, and the date and time. That version governs your show even if we publish a later one.'],
        },
      ],
    },
    {
      id: 's2', n: '2', title: 'Applying, jurying and acceptance',
      clauses: [
        { n: '2.1', text: ['Applications are juried and the curation is our judgment. We take one to three makers per category, so a strong application can be declined because the category is full. We read every application and answer either way.'] },
        { n: '2.2', lead: 'There is no application fee.', text: ['There is no charge to be looked at, and no charge to be declined.'] },
        {
          n: '2.3', lead: 'An acceptance is an offer, not a booking.',
          text: ['Your space is confirmed when the booth fee is paid in full. You have {{paymentWindow}} hours from your acceptance to pay. After that the offer lapses, the space goes back into inventory, and it is offered to the next maker waitlisted in your category.'],
        },
        { n: '2.4', text: ['Applications for {{showName}} close {{applicationsClose}}. The roster is announced {{rosterAnnounced}}.'] },
      ],
    },
    {
      id: 's3', n: '3', title: 'Fees, cancelling and transferring',
      clauses: [
        { n: '3.1', text: ['Your booth fee is on your acceptance, with any add-on you asked for and we granted: a shared space, a corner or endcap, one of our tents. Add-ons are part of the fee and are due with it. This show’s prices are in the fee schedule at the end of this page.'] },
        {
          n: '3.2', lead: 'Cancelling.',
          text: ['All spaces are non-refundable. If you cancel, for any reason, at any time, the fee is not returned. Cancel in writing to {{contactEmail}}. It takes effect when we receive it, and your space is released to another maker.'],
        },
        {
          /* ⟨COUNSEL⟩ Added 6 Sep 2026 on Drew's decision. The agreement said
             the fee was due and never said how it was paid, which is the one
             question a maker has at the moment they read the acceptance. */
          n: '3.3', lead: 'How you pay it.',
          text: ['Your acceptance carries a payment link. Pay by card or by bank transfer, whichever suits you, and the space is held the moment it goes through. We do not take payment by any other route: nobody from Mermade will ever ask you to send money by Zelle, Venmo, a wire, or a link that did not come from us.'],
        },
        { n: '3.4', lead: 'Transfer.', text: ['Your fee is not transferable to another maker or another person. Section 4 and section B6 are the only places it moves to another show.'] },
        {
          n: '3.5', lead: 'Your sales are not our promise.',
          /* Elise, 5 Sep 2026. Her wording ended "you will find success"; a
             sentence like that in a contract is a representation about results,
             and it is the one sentence a maker who had a bad day would quote.
             The rule is kept, the promise is not. ⟨COUNSEL⟩ */
          text: ['The fee buys you the space, not a level of sales. We do not refund a booth fee because you broke even or lost money. What sells is down to your product, your prices and your display, and the guidance on the maker pages is there to help you with all three.'],
        },
      ],
    },
    {
      id: 's4', n: '4', title: 'Weather, postponement and cancellation',
      clauses: [
        { n: '4.1', text: ['The show runs in ordinary bad weather. Rain, wind or cold on their own are not grounds for a refund, and the floor inside runs in almost any weather.'] },
        {
          n: '4.2', lead: 'If we postpone.',
          text: ['We may move the show to later dates if, in our reasonable judgment, weather or another condition outside our control makes it unsafe, unworkable, or seriously damaging to attendance. If we do:'],
          list: [
            'your fee moves to the new dates at no extra cost;',
            'if you cannot make the new dates, tell us in writing within {{electionDays}} days of the announcement and we will credit the full fee against any Mermade show within {{creditMonths}} months;',
            'we announce a postponement as early as we reasonably can.',
          ],
        },
        {
          /* ⟨COUNSEL⟩ Rewritten 6 Sep 2026 on the recommendation of Drew's
             refund audit. This clause used to promise a cash refund, which is
             the single largest cash exposure in the agreement: an outright
             cancellation makes every booth fee for the season fall due at
             once, at the moment the venue and the advertising are already paid
             for and no sales have come in. A credit keeps the maker whole and
             keeps the business alive to honour it. */
          n: '4.3', lead: 'If we cancel outright.',
          text: ['If we cancel the show and do not reschedule it, your fee becomes a credit against any Mermade show within {{creditMonths}} months. Ask for it when you apply and we apply it to that booking. We are not liable for anything else: travel, lodging, stock you made, or sales you expected.'],
        },
        { n: '4.4', text: ['An outdoor day cancelled for weather is covered by section B6, which is more specific and governs.'] },
        {
          n: '4.5', lead: 'Force majeure.',
          text: ['Neither of us is liable for failing to perform because of something beyond our reasonable control: fire, flood, earthquake, severe weather, a public health order, an epidemic, an act of government, civil unrest, terrorism, war, a utility or transport failure, a labour dispute, or loss of the venue. Our liability in any of those is limited to section 4.3.'],
        },
      ],
    },
    {
      id: 's5', n: '5', title: 'What you may sell',
      clauses: [
        {
          n: '5.1', lead: 'The person who made it is the person who applied.',
          text: ['You may sell the goods described in your accepted application: goods you make yourself, goods made under your direct supervision in small batches, and, where we accepted you on that basis, goods you have sourced or curated and described to us honestly. What we do not allow is a maker selling someone else’s work as their own.'],
        },
        { n: '5.2', text: ['You may sell only the categories and product lines in your accepted application. A materially different line needs our written approval before the show.'] },
        {
          n: '5.3', lead: 'Not permitted:',
          text: [''],
          list: [
            'goods presented as your own that you did not make, or did not source and describe the way your application said;',
            'mass-produced or imported merchandise passed off as handmade;',
            'multi-level-marketing and direct-sales lines, unless we accepted you for a product you make yourself using those materials and your shop name does not carry the company’s name;',
            'artwork or product imagery generated by AI.',
          ],
        },
        {
          n: '5.4', lead: 'Verification.',
          text: ['We may ask you at any time for reasonable evidence that your goods are made the way you described: process photographs, studio images, where your materials come from. Misrepresenting it is a material breach under section 12.'],
        },
      ],
    },
    {
      id: 's6', n: '6', title: 'Permits, tax and licences',
      clauses: [
        {
        /* ⟨COUNSEL⟩ Rewritten 5 Sep 2026 on Drew's research, which is right and
           worth keeping: section 6073's verb is "obtain". Verify, confirm and
           accuracy appear nowhere in it. 6073.1 deems an operator compliant on
           obtaining the permit or a non-taxable certificate, B&P 21663(c) puts
           accuracy outside the operator's responsibility, and Publication 111
           has CDTFA doing the checking and attaches the penalty to "each seller
           for which you did not keep records", not to a record that turned out
           wrong. Collect it, keep it, do not investigate it.

           That is now said out loud rather than left implied, because it is the
           difference between a job we can do and one we cannot: nobody here can
           tell a real permit number from an invented one, and this says we are
           not expected to.

           One dependency for counsel: 21663 sits in the swap meet article, so
           it applies if Mermade is a swap meet operator within B&P 21661. The
           R&T hook is safer, since 6073 covers special events by its terms. */
          n: '6.1', lead: 'Outside makers: seller’s permit.',
          text: [
            'You sell for your own account, so you must hold a valid California seller’s permit, or qualify as an occasional seller and give us a completed CDTFA-410-D. We ask for the number, or the declaration, on your application or once you are accepted, and we need it before load-in. Applying requires neither.',
            'Our part is to obtain that record and keep it. Revenue and Taxation Code section 6073 asks us to obtain it, not to check it, and section 6073.1 treats an operator who obtains it as having complied. We do not verify your permit and, under Business and Professions Code section 21663(c), we are not responsible for the accuracy of what you give us. CDTFA checks the numbers itself and tells us if one of them is wrong. What you give us has to be true and yours to give.',
            'The penalty falls on a record we did not keep, up to ${{pub111Penalty}} for each seller we cannot produce one for, which is why this is the one piece of paperwork we will chase you for. We keep these records for four years.',
          ],
        },
        {
          n: '6.2', lead: 'Inside makers: seller’s permit.',
          text: ['We take possession of your goods and sell them in our own name, so Mermade is the retailer of record for those sales under California Code of Regulations title 18 section 1569 and CDTFA Publication 114. We collect and remit California sales tax on the full retail price. You do not need a seller’s permit for the sales we make for you. Your own business stays your own responsibility.'],
        },
        { n: '6.3', lead: 'Food and treats.', text: ['Food makers hold the Orange County health permit that applies to them. Cottage food operators hold their CDPH registration. Treat makers on the shelf by the register need a Temporary Food Facility permit. Send it to us before load-in.'] },
        { n: '6.4', lead: 'Business licence.', text: ['Any city business licence the venue’s jurisdiction requires of you is yours to hold.'] },
      ],
    },
    {
      id: 's7', n: '7', title: 'Insurance',
      clauses: [
        { n: '7.1', text: ['Mermade carries its own policy for the event. It covers Mermade. It does not cover you, your goods, or a claim brought against you.'] },
        { n: '7.2', text: ['We recommend you carry commercial general liability insurance of your own. If the venue or your acceptance requires a certificate for your show, we will tell you, and you send it before load-in naming Mermade Market LLC and the show venue as additional insureds.'] },
        { n: '7.3', text: ['Insurance on your own goods, equipment and display is yours to arrange. Section A8 is how loss is handled on the floor inside.'] },
      ],
    },
    {
      id: 's8', n: '8', title: 'Liability',
      clauses: [
        { n: '8.1', text: ['Except as section A8 provides for consigned goods, we are not responsible for loss of, damage to, or theft of your property, or for injury to you or anyone working with you, however caused. You take part at your own risk.'] },
        { n: '8.2', text: ['Our total liability to you arising out of this agreement, on any theory, will not be more than the fees you paid us for the show, plus, for inside makers, any consignment proceeds properly owed to you and not yet paid.'] },
        { n: '8.3', text: ['Neither of us is liable to the other for indirect, incidental, special, consequential or punitive damages, or for lost profits or lost sales.'] },
        { n: '8.4', text: ['Nothing here limits liability that cannot be limited under California law, including liability for gross negligence, wilful misconduct or fraud.'] },
      ],
    },
    {
      id: 's9', n: '9', title: 'Indemnity',
      clauses: [
        {
          n: '9.1',
          text: ['You will indemnify, defend and hold harmless Mermade, its owners, staff, volunteers and contractors, and the show venue and its owners, against any claim, loss, liability, damage, cost or expense, including reasonable legal fees, arising out of:'],
          list: [
            'your goods;',
            'your acts or omissions, or those of anyone working with you;',
            'your breach of this agreement;',
            'your failure to meet any law, permit or tax obligation;',
            'a claim that your goods infringe someone else’s intellectual property.',
          ],
        },
        { n: '9.2', lead: 'Product liability sits with you.', text: ['You are the maker. Nothing in this agreement makes Mermade the manufacturer of your goods.'] },
      ],
    },
    {
      id: 's10', n: '10', title: 'Photographs, film and your name',
      clauses: [
        { n: '10.1', text: ['We photograph and film our shows and we will keep doing it. You agree that we may use photographs and video taken at the show that include you, your space, your goods, your business name or your marks, to promote Mermade Market: on this site, in print, in email, in press, and on social media, now and later, without payment.'] },
        { n: '10.2', text: ['Where we post an image of your work and you have given us your handle, we will make reasonable efforts to tag and credit you.'] },
        { n: '10.3', text: ['You confirm that our use of these images will not infringe anyone’s rights, and that you have permission from anyone identifiable in material you give us.'] },
        { n: '10.4', text: ['You keep every right in your own work and your own marks. This is a licence for show promotion, not an assignment of anything.'] },
        { n: '10.5', text: ['What we do with the information and the photographs you send with an application is set out on the privacy page.'] },
      ],
    },
    {
      id: 's11', n: '11', title: 'Conduct, display and removal',
      clauses: [
        { n: '11.1', text: ['Your display has to be presentable from every angle a shopper can see it, including the back. Your business name has to be visible. Tables are covered to the floor.'] },
        { n: '11.2', text: ['We may ask you to change, cover or remove any display element, sign or product that in our reasonable judgment is unsafe, misrepresents your goods, breaches this agreement, or is out of keeping with the show.'] },
        { n: '11.3', text: ['We may refuse entry to, or remove, anyone whose conduct is unsafe, abusive or seriously disruptive. Removal for breach is without a refund.'] },
      ],
    },
    {
      id: 's12', n: '12', title: 'Breach, removal and future shows',
      clauses: [
        {
          n: '12.1',
          text: ['Material breach includes: misrepresenting who made your goods; selling something section 5.3 prohibits; failing to give us a permit or certificate we asked for; abandoning your space; not appearing after confirming; and conduct under section 11.3.'],
        },
        { n: '12.2', text: ['On material breach we may remove you from the show without a refund, and may decline your future applications. We tell you the reason in writing.'] },
        {
          n: '12.3', lead: 'No-show.',
          text: ['A confirmed maker who neither appears nor cancels forfeits the fee, is recorded as a no-show on their vendor record, and may be declined or asked to prepay in a future season.'],
        },
      ],
    },
    {
      id: 's13', n: '13', title: 'Sharing and assignment',
      clauses: [
        /* ⟨COUNSEL⟩ Rewritten 5 Sep 2026. The last sentence used to read "Only
           the accepted maker sells in the space", which banned the commonest
           thing outdoor makers actually do: a cousin, a friend or an employee
           works the booth for a day they cannot make. Elise raised it. A rule
           that forbids what nearly everyone does is not enforced, it is just
           quoted back at us when we want to enforce something else.

           Three situations were being treated as one. Someone helping you sell
           your own goods is fine and always was. Handing your space to a
           different shop is subletting and is not. Selling someone else's work
           as your own is section 5. They are separated here. */
        { n: '13.1', text: ['You may not assign this agreement, or sublet, share or transfer your space, without our written consent.'] },
        {
          n: '13.2', lead: 'Someone working your space for you.',
          text: ['A friend, a family member or someone who works for you may run your space on a day you cannot be there, selling your goods under your shop name at your prices. Tell us who to expect. You stay responsible for the space, for everything sold in it, and for everything in this agreement. What you may not do is hand the space to a different shop selling its own goods.'],
        },
        { n: '13.3', text: ['A shared space is available as an add-on. Both makers apply together, are juried together as a pair, and both sign this agreement. That is two shops in one space, which is a different thing from someone working your space for you.'] },
      ],
    },
    {
      id: 's14', n: '14', title: 'General',
      clauses: [
        { n: '14.1', lead: 'Independent contractor.', text: ['Nothing here creates employment, partnership, joint venture or franchise. Except as section A1 provides for consignment, neither of us is the other’s agent.'] },
        { n: '14.2', lead: 'Governing law.', text: ['California law governs this agreement. The state and federal courts in Orange County, California have jurisdiction.'] },
        { n: '14.3', lead: 'Notices.', text: ['Notices go to the email addresses on the vendor record. Ours is {{contactEmail}}.'] },
        { n: '14.4', lead: 'Entire agreement.', text: ['This agreement, your accepted application, and the show record are the whole agreement between us. They replace what the rest of this site says and anything said in email.'] },
        { n: '14.5', lead: 'Severability.', text: ['If a provision cannot be enforced, the rest of the agreement survives.'] },
        { n: '14.6', lead: 'Survival.', text: ['Sections 8, 9, 10, A6, A8 and 14 survive the show.'] },
      ],
    },
  ],
}

/* ───────────────── SCHEDULE A — indoor consignment ───────────────── */

const scheduleA: Part = {
  id: 'schedule-a',
  title: 'Schedule A. Inside makers, on consignment',
  scope: 'This schedule applies to you if you have a space inside. If you have a space inside and a tent outside, both schedules apply, each to its own goods.',
  sections: [
    {
      id: 'a1', n: 'A1', title: 'What this relationship is',
      clauses: [
        { n: 'A1.1', text: ['You deliver goods to us. We merchandise them, sell them at the register in our own name, keep a commission, and pay you the rest. You are the consignor and we are the consignee. You do not need to be at the show.'] },
        { n: 'A1.2', text: ['For the purpose of selling your goods at the show, we act as your agent. We hold your goods, and the money they make, in trust for you.'] },
      ],
    },
    {
      id: 'a2', n: 'A2', title: 'Delivery, inventory and tagging',
      clauses: [
        { n: 'A2.1', text: ['You send us your inventory list with prices at least two weeks before the show, and you deliver the goods at your load-in slot. Load-in for {{showName}} is {{loadIn}}. We count your goods in against your list, and the counted list is the record we settle against.'] },
        {
          n: 'A2.2', lead: 'Tagging.',
          text: ['Every item for sale carries your maker code and its price, like MM7 $18. There is no barcode or SKU for us to scan, so that tag is the whole of what the register reads. Printed tags are always better than handwritten. Do not make a tag larger than the item it is on.'],
        },
        {
          n: 'A2.3', lead: 'Prices, and changing them.',
          text: ['The prices on your inventory list are the prices we enter into the register. We will not discount, mark down or bundle your goods without your say so. If a price changes, or you add a new item, hand a written note to Elise, Cambi or Hillary, or to whoever is running the register, and we will try to change it that same selling day.'],
        },
        {
          n: 'A2.4', lead: 'Marking down.',
          /* The register is keyed off the tag, so "20% off everything" is a sum
             our staff would have to do a hundred times at the till, which is
             where the errors come from. */
          text: ['Same goes for marking prices down. If you want to take 20% off, do the maths, change the tags yourself, and give us a new list. Not "20% off everything": we enter your prices by hand, and a blanket instruction is a hundred chances for one of us to get it wrong.'],
        },
        { n: 'A2.5', text: ['We may decline to display an item that is unsafe, materially different from your application, or unsaleable as it arrives, and we will tell you which and why.'] },
        {
          n: 'A2.6', lead: 'Deductions.',
          text: ['The only amounts we take off your settlement are our commission and anything we supplied on your behalf, charged at what it cost us and itemised on your statement with its reason. An item that arrives untagged is tagged by a member of staff, not charged for.'],
        },
        {
          n: 'A2.7', lead: 'Display items.',
          /* Our staff sell what carries a tag. A prop with no tag reads as
             untagged stock, which A2.6 says we tag for you: the two rules
             collide unless the prop says what it is. */
          text: ['Put a sticker reading "display use only" on anything at your space that is not for sale. Our staff sell what is tagged, and an untagged item is treated as stock we need to tag. We are not responsible for a display item that sells because it was not marked.'],
        },
      ],
    },
    {
      id: 'a3', n: 'A3', title: 'Display and restocking',
      clauses: [
        /* A3.1 used to say you set the price and mark it on the item, and that
           we will not discount without your authorisation. Elise pointed out
           that A2 says both, now at more length: tagging is A2.2 and prices are
           A2.3. So A3 is what we do rather than what you do, which is the line
           the two sections were blurring. */
        { n: 'A3.1', text: ['Merchandising is ours: where your goods sit on the floor, how they are grouped and staged. That is the service you are buying. What each item costs is yours, and A2.3 is how it is set and changed.'] },
        { n: 'A3.2', text: ['You are welcome to restock during the show, in the slower hours. Everything you bring is priced and tagged before it goes out, the same as everything you delivered at load-in.'] },
      ],
    },
    {
      id: 'a4', n: 'A4', title: 'Sales tax',
      clauses: [
        { n: 'A4.1', text: ['Mermade is the retailer of record for these sales under California Code of Regulations title 18 section 1569 and CDTFA Publication 114, holds the seller’s permit, and collects and remits California sales tax on the full retail price.'] },
        { n: 'A4.2', text: ['Sales tax is not taken out of your proceeds. Commission is calculated on the pre-tax retail price.'] },
      ],
    },
    {
      id: 'a5', n: 'A5', title: 'Commission',
      clauses: [
        { n: 'A5.1', text: ['We keep {{commissionPct}}% of the pre-tax retail price of each item sold. The rate for your show is stated in your acceptance.'] },
        { n: 'A5.2', text: ['The rate is fixed when you book and cannot change for that show. If we change the rate for a later show, yours still settles at the rate you were accepted at.'] },
        { n: 'A5.3', text: ['Outdoor sales carry no commission.'] },
      ],
    },
    {
      id: 'a6', n: 'A6', title: 'Settlement and getting paid',
      clauses: [
        { n: 'A6.1', text: ['Money from the sale of your goods is held by us in trust for you until it is paid, less commission and anything agreed under A2.5.'] },
        {
          n: 'A6.2',
          text: ['Within {{payoutDays}} days of the show closing we send you a statement showing units sold, retail price, sales tax collected, commission kept, any deduction with its reason, and the net owed. We pay the net into your own bank account in the same window.'],
        },
        {
          /* ⟨COUNSEL⟩ Added 6 Sep 2026 on Drew's decision to move payouts onto
             Stripe. Mermade used to hold Zelle and Venmo handles on a
             spreadsheet, which meant the market kept payment details it had no
             business keeping and paid people by hand. Stripe holds the bank
             details instead; Mermade never sees an account number.

             The clause deliberately does NOT forfeit money over unfinished
             paperwork. What is owed is owed: it waits. */
          n: 'A6.3', lead: 'Setting up your payout, once.',
          text: ['Before we can pay you, set up your payout account with Stripe, who handle the money. It asks who you are and where the money goes, takes about ten minutes, and you only do it once: it carries to every show after this one. Your bank details go to Stripe and not to us, and we never see them. If your account is not ready when statements go out, your money waits for you rather than going anywhere else.'],
        },
        { n: 'A6.4', lead: 'If a statement looks wrong.', text: ['Tell us in writing within {{disputeDays}} days of the statement and we will reconcile it against the counted inventory list and the register record. After that the statement is final except for a manifest error.'] },
        { n: 'A6.5', text: ['A statement is never deleted. A correction is issued as a new statement that supersedes the old one, and both stay on your record.'] },
      ],
    },
    {
      id: 'a7', n: 'A7', title: 'Returns',
      clauses: [
        /* Rewritten 5 Sep 2026: Elise said A7 read as though anything could
           come back at any time, which is not the policy. The policy is the
           first sentence; the old text only ever covered what happens after a
           statement, which is the rarer half. */
        { n: 'A7.1', text: ['A customer may return an item during show hours only, and only with the electronic receipt from our register. Nothing comes back once the show has closed for the day it was bought.'] },
        { n: 'A7.2', text: ['We set that policy and we apply it. A return inside those limits comes off your sales for the show in the ordinary way.'] },
        { n: 'A7.3', text: ['If a customer returns one of your items after your statement has been issued, we absorb it. We do not take money back from you after we have paid you.'] },
      ],
    },
    {
      id: 'a8', n: 'A8', title: 'Risk of loss',
      clauses: [
        { n: 'A8.1', text: ['Title to your goods stays with you until we sell them to a customer.'] },
        /* ⟨COUNSEL⟩ Narrowed 5 Sep 2026 at Drew's direction: "there's room for
           them to charge us for missing goods, we do not want that".

           The money was never in this clause, it was in A8.4, which promised a
           credit at retail for anything unaccounted for. That is gone.

           This one is narrowed rather than deleted, and deliberately. Taking
           possession of someone's goods to sell them is a bailment for mutual
           benefit, and a bailee who disclaims all care is the case California
           courts like least. Civil Code section 1668 voids an exemption from
           your own fraud, wilful injury or violation of law outright, and
           section 8.4 of Part I already says so. A clause promising nothing at
           all would not survive being tested, and losing it would take the
           narrower protection with it. What is left is the standard a court
           would apply anyway, with the open-ended negligence exposure removed. */
        { n: 'A8.2', text: ['We take reasonable care of your goods while they are in our possession. The room is staffed during open hours and there is security between show days. Beyond that care, and except where section 8.4 of Part I applies, we are not responsible for loss of or damage to your goods.'] },
        {
          n: 'A8.3', lead: 'We are not responsible for:',
          text: [''],
          list: [
            'shoplifting, and stock unaccounted for at the end of the show;',
            'damage from customers handling goods normally;',
            'damage in transit to or from the show;',
            'a defect or fragility in the item itself;',
            'loss caused by fire, flood, earthquake or anything else beyond our reasonable control.',
          ],
        },
        {
          n: 'A8.4', lead: 'Stock that cannot be accounted for.',
          text: ['A show of this size loses a little stock, and we do not credit it. Your statement pays you for what the register recorded as sold. If a count comes up short we will tell you and show you what we know, but the shortfall is not a credit and not a deduction either: it is simply not a sale.'],
        },
        { n: 'A8.5', text: ['Our liability under this schedule is subject to the cap in section 8.2.'] },
        { n: 'A8.6', text: ['Insure your own goods if their value would hurt to lose. Our policy covers Mermade and does not cover your stock, and nothing here obliges us to insure it for you.'] },
      ],
    },
    {
      id: 'a9', n: 'A9', title: 'Unsold goods',
      clauses: [
        { n: 'A9.1', text: ['Unsold goods are yours. Collect them at take-down, {{takedown}}, or arrange something with us in advance.'] },
        { n: 'A9.2', text: ['Goods not collected within {{abandonDays}} days of the show, after at least two documented attempts to reach you, may be treated as abandoned and given to a charity of our choosing. We will not sell abandoned goods for our own account, and we will not carry them to another show without your written agreement.'] },
      ],
    },
    {
      id: 'a10', n: 'A10', title: 'Tax reporting and makers under 18',
      clauses: [
        { n: 'A10.1', text: ['You are responsible for your own income tax on what we pay you. If we are required to report a payment to you, we will ask you for a W-9 first.'] },
        {
          n: 'A10.2', lead: 'Makers under 18.',
          text: ['A JR space is for makers 14 and under. A parent or guardian applies, signs this agreement, and is the person we pay. A maker between 15 and 17 applies for an ordinary space, and a parent or guardian signs.'],
        },
      ],
    },
  ],
}

/* ───────────────── SCHEDULE B — outdoor booth licence ───────────────── */

const scheduleB: Part = {
  id: 'schedule-b',
  title: 'Schedule B. Outside makers, in a tent',
  scope: 'This schedule applies to you if you have a tent outside, for the day or days on your acceptance.',
  sections: [
    {
      id: 'b1', n: 'B1', title: 'What this relationship is',
      clauses: [
        { n: 'B1.1', text: ['We grant you a revocable licence to occupy the space assigned to you, for the days and hours stated in your acceptance. It is a licence, not a lease, and it gives you no interest in the venue.'] },
        { n: 'B1.2', lead: 'You are the retailer.', text: ['You sell your own goods for your own account, take your own payments, and keep 100% of your sales. We take no commission outside.'] },
        { n: 'B1.3', text: ['Because you sell for your own account at our event, CDTFA Publication 111 applies to us as the operator. That is why section 6.1 needs your permit or your 410-D before load-in, and it is not negotiable.'] },
      ],
    },
    {
      id: 'b2', n: 'B2', title: 'Space, days and hours',
      clauses: [
        { n: 'B2.1', text: ['Your space is the tent we put up for you, in the size stated on your acceptance. Dimensions are on the outdoor maker page. Everything you bring stays inside your space and out of the aisles: tables, racks, signage, stock, your chair. Nothing goes in front of the tent, because that space belongs to shoppers and to getting out in a hurry.'] },
        { n: 'B2.2', text: ['You are set up before doors open and staffed by someone over 18 during all published hours. Hours for {{showName}} are {{hours}}.'] },
        { n: 'B2.3', lead: 'No early take-down.', text: ['You may not start breaking down before the show closes on your last contracted day. It is the most-broken rule at every outdoor market and the one shoppers see most.'] },
        { n: 'B2.4', text: ['You may not sell an inside maker’s goods from your tent, and you may not add goods to an inside maker’s space, whatever the two of you have agreed between yourselves.'] },
      ],
    },
    {
      id: 'b3', n: 'B3', title: 'Tents, weights and safety',
      clauses: [
        { n: 'B3.1', text: ['Tents are weighted at every leg, to the weight stated in your load-in instructions. Stakes are not permitted unless those instructions say otherwise.'] },
        { n: 'B3.2', text: ['You must have a backdrop. Your space has to look finished from every side a shopper can see.'] },
        { n: 'B3.3', text: ['Open flame, generators, propane and anything that produces heat need our written approval in advance, and may need the fire marshal’s.'] },
        { n: 'B3.4', text: ['The tent is ours to put up and yours to look after while you have it. We may ask you to lower or remove a tent that has become unsafe in wind.'] },
      ],
    },
    {
      id: 'b4', n: 'B4', title: 'Load-in, load-out and vehicles',
      clauses: [
        { n: 'B4.1', text: ['Load-in and load-out happen at the times you are assigned. Vehicles move to vendor parking before doors open.'] },
        { n: 'B4.2', text: ['Leave your space the way you found it and take your rubbish with you.'] },
      ],
    },
    {
      id: 'b5', n: 'B5', title: 'Rentals and power',
      clauses: [
        { n: 'B5.1', text: ['Tents, tables and chairs you rent from us stay ours. You are responsible for damage beyond normal wear.'] },
        { n: 'B5.2', text: ['There is power at each space. Bring your own extension cord with your shop name on it.'] },
      ],
    },
    {
      id: 'b6', n: 'B6', title: 'Weather outside',
      clauses: [
        /* ⟨COUNSEL⟩ Rewritten 5 Sep 2026. Drew: "perhaps you can specify better
           what poor weather means here". The honest answer is that no rainfall
           figure decides it, so B6.4 does not try to name one. What decides it
           is whether we called the day off, and that is a fact neither side can
           argue about afterwards. B6.1 now says who decides and on what, and
           B6.4 turns on the day having run rather than on how bad it was. */
        {
          n: 'B6.1', lead: 'When we call a day off.',
          text: ['The call is ours and we make it as early as we can. We call a day off when conditions or the forecast make it unsafe to put tents up or to have shoppers among them, or when the venue, the city or the county closes the site. Rain, wind or cold on their own do not stop an outdoor day: section 4.1 says the show runs in ordinary bad weather, and it does.'],
        },
        /* ⟨COUNSEL⟩ Rewritten 6 Sep 2026. These were two clauses: the fee
           carried to the same day at the next show, or the maker took 30% back
           in cash. Drew's refund audit replaced both with one credit, and Drew
           settled the shape of it: an outdoor day we call off becomes a credit
           for an outdoor day, good for 18 months, with no indoor
           element and no cash. It is simpler to read, it is more use to the
           maker than the same weekday at one particular show, and it is the
           end of the 30% reimbursement the old Shopify page promised. */
        { n: 'B6.2', text: ['If we call a day off, your fee for that day becomes a credit towards an outdoor day at any Mermade show within {{creditMonths}} months. It is not refunded in cash.'] },
        { n: 'B6.3', text: ['Ask for the credit when you apply and we apply it to that booking. If the day you want costs more than the day you lost, you pay the difference; if it costs less, the balance stays on the credit until it runs out.'] },
        { n: 'B6.4', text: ['If we run the day and you decide not to come, there is no refund and no day at a later show, whatever the weather was doing. A day we have not called off is a day that is going ahead.'] },
        /* ⟨COUNSEL⟩ Reworded 5 Sep 2026: "wording is weird". It was, and the
           reason is that it said what does not happen before what does. This
           says the offer first and the condition second, which is the order a
           maker reads it in. The policy is unchanged, and Drew's refund audit
           may change it again. */
        {
          /* ⟨COUNSEL⟩ Rewritten 6 Sep 2026. This used to carry a cancelling
             maker's fee to the next show for free, which section 3.2 flatly
             contradicts: 3.2 says a cancelled fee is never returned, for any
             reason, at any time. Two clauses, opposite answers, in one signed
             document, and a maker would quote whichever helped them. The
             refund audit resolved it towards 3.2. Nothing stops Mermade
             carrying a fee as a goodwill gesture; it is no longer a term a
             maker can hold them to. */
          n: 'B6.5', lead: 'If you cancel a day yourself.',
          text: ['Section 3.2 governs: the fee is not returned and it does not carry to another show, whatever notice you give us. A day we are still running is a day that is going ahead, and section B6.4 covers deciding not to come to it.'],
        },
      ],
    },
  ],
}

export const PARTS: Part[] = [partOne, scheduleA, scheduleB]

/* ─────────────────────────── rendering ─────────────────────────── */

/**
 * The token values, off the Show record. Nothing dated, priced or rated is
 * written into the clause text (CLAUDE.md rule 6), so this is the only place
 * a number enters the agreement.
 */
export function agreementVars(show: Show): PageVars {
  return {
    version: TERMS_VERSION,
    contactEmail: CONTACT_EMAIL,
    showName: show.name,
    showDates: fmtRange(show.startsOn, show.endsOn),
    venueName: show.venueName,
    venueAddress: show.venueAddress,
    hours: show.hoursNote,
    loadIn: show.loadInNote || 'stated in your acceptance',
    takedown: show.takedownNote || 'stated in your acceptance',
    applicationsClose: fmtDate(show.applicationsCloseAt),
    rosterAnnounced: fmtDate(show.rosterAnnouncedOn),
    paymentWindow: show.paymentWindowHours,
    commissionPct: show.commissionBps / 100,
    payoutDays: POLICY.payoutDays,
    payoutDaysMin: POLICY.payoutDaysMin,
    disputeDays: POLICY.disputeDays,
    abandonDays: POLICY.abandonDays,
    electionDays: POLICY.electionDays,
    creditMonths: POLICY.creditMonths,
    pub111Penalty: POLICY.pub111PenaltyUsd.toLocaleString('en-US'),
  }
}

/** `fill` over one clause, so the page never touches a raw token. */
export function fillClause(clause: Clause, vars: PageVars): Clause {
  return {
    ...clause,
    ...(clause.lead ? { lead: fill(clause.lead, vars) } : {}),
    text: clause.text.map((t) => fill(t, vars)),
    ...(clause.list ? { list: clause.list.map((t) => fill(t, vars)) } : {}),
  }
}
