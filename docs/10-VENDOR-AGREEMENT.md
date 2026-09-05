# Mermade Market — Vendor Agreement

**Draft v2026.1 · August 25, 2026 · NOT YET REVIEWED BY COUNSEL**

> **Read this first.** I am not a lawyer and this is not legal advice. This is a
> drafted starting point, built from the published agreements of comparable
> markets and from the California statutes and CDTFA guidance cited throughout,
> so that the hour you buy from an actual attorney is spent on judgment calls
> rather than on typing. Every place the draft makes a real decision on your
> behalf is marked **⟨DECISION⟩**, and every place the law is genuinely
> unsettled is marked **⟨COUNSEL⟩**. Both are collected in §"What to put in
> front of a lawyer" at the end.
>
> Companion research: `11-AGREEMENT-RESEARCH.md`.
>
> **Published, September 2026.** This draft now renders as a public page at
> `/agreement`, from `src/lib/agreement.ts`, with every date, price, rate and
> window read off the Show record. The published text carries **no** ⟨DECISION⟩
> or ⟨COUNSEL⟩ markers, because an applicant signs it. That makes one rule
> load-bearing: where a decision below is still open, the published clause does
> not invent a policy to fill the gap. It reads the number off the Show record,
> defers to the acceptance email or the load-in instructions, or states the
> market's own published position from the live pages in `src/lib/page-html.ts`.
> Every clause where the last of those applied is listed under
> "Where the agreement and the code disagree" at the end of this document.

---

## Why this is two agreements wearing one cover

Your two tracks are not two flavours of the same deal. They are different legal
instruments and they fail in different ways.

**Outdoor** is a *licence to occupy space*. The vendor is the retailer, holds
their own permit, takes their own money, and keeps 100%. Your exposure is
premises liability and CDTFA Publication 111 record-keeping. This is the
ordinary craft-fair contract, and every market I looked at has one.

**Indoor** is a *consignment*. You take possession of a stranger's property,
price it, sell it in your own name, hold their money, and pay it out weeks
later. Your exposure is bailment, title, risk of loss, trust over proceeds, and
being the retailer of record for sales tax. **No major US craft fair publishes
terms for this model** — I looked at Renegade, West Coast Craft, Patchwork, One
of a Kind, Crafty Wonderland, Urban Craft Uprising, ACC, Rose Bowl, Junk
Bonanza, Field + Supply, Unique Markets and three Junior League markets, and
every one of them is booth-rental. The Smithsonian Craft Show advertises *"does
not charge sales commissions"* as a selling point.

So the outdoor half of this draft has a hundred peers to borrow from. The indoor
half has none, and is built instead from consignment law, retail consignment
practice, and CDTFA regulation. **That asymmetry is the single most important
thing to tell your lawyer.** It is also, incidentally, a moat: the indoor model
is the hard part of your business and nobody else is doing it.

---

## The finding that changes your tax answer

`00-BUSINESS-AUDIT.md` §1.2 and `04-PAYMENTS-AND-POS.md` §6 both flagged "is
Mermade the retailer of record on the indoor floor?" as an open question for a
CPA. **It is not as open as I thought.** California Code of Regulations title 18
§1569 is directly on point:

> "A person who has possession of property owned by another, and also the power
> to cause title to that property to be transferred to a third person without any
> further action on the part of its owner, and who exercises such power, **is a
> retailer** when the party to whom title is transferred is a consumer."

CDTFA **Publication 114 (Consignment Sales)** restates it as a two-part test —
you are the retailer when you *"have possession or control of the item you are
selling"* **and** *"can transfer ownership or use of the item to the buyer
without further action on the part of the owner"* — and gives a jewelry store
selling consigned jewelry as its worked example.

Indoor Mermade satisfies both prongs on its face. You hold the goods, you ring
the sale, the maker isn't even in the building. That means:

1. **Mermade collects and remits sales tax on the full retail price** of indoor
   sales — not on the 20% commission.
2. **Indoor makers do not need their own seller's permit for sales you make.**
   You are the seller. Their permit obligation, if any, comes from their own
   separate business, not from consigning to you.
3. **Publication 111's operator duty is an outdoor-track problem**, because
   outdoor vendors are the ones selling for themselves at your event.

This refines the correction we made to the platform yesterday. The permit gate
belongs on the **outdoor** roster, not on every booking. ⟨COUNSEL⟩ Confirm the
Reg. 1569 characterisation and its consequences for the 1099 question below.

---

# PART I — TERMS COMMON TO BOTH TRACKS

## 1. Parties and the Show

**1.1** This Agreement is between **Mermade Market** ("Mermade," "we," "us") and
the applicant identified in the signed application ("you," "Vendor").

**1.2** It governs your participation in the single show identified in your
acceptance (the "Show"). The Show's dates, venue, hours, booth fees, commission
rate, load-in times, payment window and application window are set out in your
acceptance email and in the Show record on mermademarket.com, and are
incorporated here by reference. Participating in one Show gives you no right to
any future Show.

**1.3** This Agreement is versioned. The version you signed is recorded against
your vendor record with the date and time of signature, and governs your
participation in that Show even if a later version is published.

> ⟨COUNSEL — **the draft promised more than the code records**⟩ This clause used
> to say "date, time and IP address". The platform records
> `applications.signed_name`, `applications.terms_version` and
> `applications.submitted_at`, and **no IP address**. A clause that describes a
> record you do not keep is worse than a thinner clause, because the first thing
> anyone asks for in a dispute is the record the contract says exists. The
> published page states exactly what is captured.
>
> That leaves the question live rather than answered: lawyer question 9 below asks
> whether name plus timestamp plus version is enough under UETA and ESIGN. If
> counsel says an IP and a user agent should be captured, that is a schema change
> and a line in `submitAcceptance`, not a redraft, and this clause goes back to
> describing all four.

## 2. Application, jury and acceptance

**2.1** Applications are juried. Curation is Mermade's sole judgment. We take
between one and three makers per category, so a strong application can be
declined because the category is full. We read every application and answer
either way.

**2.2 There is no application fee.** ✅ **Settled Aug 25** — confirmed against the
live application page, which states "No Application Fee!" as a headline promise.

> Every comparable market charges one (Renegade $35, Unique Markets $30, West
> Coast Craft $25, Crafty Wonderland $10 credited against the booth fee), and
> `00-BUSINESS-AUDIT.md` §3.1 puts the foregone margin at roughly $12,000 a year
> on ~600 applications. Staying free is a defensible brand position and it is now
> the drafted position. Revisit it as a business question in a future season, not
> as a legal one — and if you ever do introduce one, every peer treats it as
> non-refundable regardless of outcome.

**2.3** Acceptance is an offer, not a booking. **A space is confirmed only when
the booth fee is paid in full. You have `shows.payment_window_hours`** from your
acceptance to pay.
If payment is not received in that window, the offer lapses, the space returns to
inventory, and it is offered to the next waitlisted maker in your category.

> ⟨DECISION — **resolved from the repo, September 2026**⟩ The number is no longer
> in the prose. It is `shows.payment_window_hours`, edited at `/admin/show`, and
> the published clause renders whatever it says. **It currently says 48**, moved
> from 36 by Drew (the change is recorded in `src/db/seed.ts`), which also matches
> `06-OPEN-QUESTIONS.md` §8 and West Coast Craft. The 36 that used to be in this
> paragraph was the last hardcoded copy of it and it was already wrong.
>
> Still worth revisiting after one season with real lapse data, but that is now a
> field edit and not a redraft.

## 3. Booth fees, cancellation and refunds

**3.1** Booth fees are stated in your acceptance and are due in full within the
payment window.

**3.2 Cancellation by you.** ✅ **Settled Aug 25 — all spaces are non-refundable.**
Booth fees are not refunded if you cancel, for any reason, at any time.
Cancellation must be in writing to hello@mermademarket.com and is effective on our
receipt. Your space is released and may be offered to another maker.

> This is Drew's call and it is now the drafted position. Two notes for the file,
> neither of which changes the answer:
>
> **It is an outlier regionally.** Patchwork Show and West Coast Craft — your two
> closest peers by size and audience — both refund in full outside 30 days. Urban
> Craft Uprising refunds at six weeks. Rose Bowl matches you (*"NO REFUNDS, CREDITS
> OR EXCHANGES"*) but it is a flea market with thousands of resellers, not a juried
> maker community. Terms like this travel between makers.
>
> **It is now worth more than it used to be.** Outdoor days are $400–500 each, so a
> forfeited Saturday tent is a real number to a maker, not a rounding error. If you
> ever want to soften it without giving up the money, the cheapest version is a
> *transfer* right rather than a refund: let a cancelling vendor's fee move to the
> next show once, at your discretion. Costs you nothing in cash and removes most of
> the sting. Not drafted — flagging it as the option you'd reach for first.

**3.3 Transfer.** Booth fees are not transferable to another maker, another
Show, or another person, except as §4 and §B6 provide.

> ⟨DECISION — **found in the live copy, and it changes §3.2**⟩ The transfer right
> this document floated as an option you might reach for one day **is already a
> published promise**, on the outdoor maker page, in their words:
>
> > "We do however, offer up your fee to carry through to the next show with no
> > extra charge. It's up to you to contact us during the application period to
> > make sure everything still applies. If you don't reach out to us, it's on you."
>
> So "all spaces are non-refundable" is true about *cash* and has never been the
> whole policy. The published agreement now carries the carry-forward at **§B6.4**,
> in the market's own shape: not refunded, carried once, only if the maker asks
> inside the next application window, never automatic.
>
> **What you have to decide: does it apply inside as well?** The promise appears
> only on the outdoor page, so that is where it has been drafted. Indoor spaces run
> $60 to $450 and the work you have already done for an indoor maker who cancels is
> merchandising planning, not advertising, so there is an argument either way.
> Extending it costs you nothing in cash and removes most of the sting from a
> policy that is a regional outlier. Leaving it outdoor-only keeps a promise you
> have already made and adds nothing.

## 4. Weather, postponement and cancellation of the Show

> **This clause matters more for you than for anyone else in the field, and you
> cannot copy the industry language.** Renegade says *"The Event(s) will proceed
> regardless of the weather"*; Patchwork says *"a rain or shine event and we do
> not refund vendors due to unseasonable weather"*; Rose Bowl says *"EVENT GOES
> ON RAIN OR SHINE."* **You postponed Fall 2025 from mid-November to December 5–7
> for rain.** A rain-or-shine clause would be a term you have already broken. It
> would also be the first thing a vendor pointed at if they were annoyed.

**4.1 The Show proceeds in ordinary bad weather.** Rain, wind or cold alone are
not grounds for a refund, and the indoor track proceeds in essentially all
weather.

**4.2 ⟨DECISION⟩ Postponement.** Mermade may postpone the Show to a later date
if, in our reasonable judgment, weather or another condition outside our control
makes proceeding unsafe, materially unworkable, or seriously damaging to
attendance. If we postpone:

- (a) your booth fee transfers to the rescheduled dates at no additional cost;
- (b) if you cannot attend the rescheduled dates, tell us in writing within 7
  days of the announcement and we will issue **a credit for the full booth fee
  against your next Show within 18 months**, or, at our option, a refund;
- (c) we will announce a postponement as early as we reasonably can.

⟨DECISION — **still open, and it is yours**⟩ (b) offers a credit rather than cash.
Cash is more generous and a better vendor story; credit protects your working
capital in exactly the season where a postponement has already hurt revenue.
Nothing in the repo answers it, because you have postponed but never had to
settle up afterwards. What each costs, at your numbers: a postponed November with
~100 makers and a mixed indoor/outdoor book is roughly **$30,000 to $40,000 of
booth fees**. Under the credit version you keep the cash and owe the space next
season. Under the refund version you write the cheques in the month the revenue
did not arrive. The draft, and the published page, take the credit, with the
refund at your option, which is the middle. Overrule it if you would rather be
able to say "we refund".

**4.3 Cancellation by Mermade.** If we cancel the Show outright and do not
reschedule it, we will refund the booth fee. We are not liable for any other
loss — travel, lodging, inventory produced, lost sales, or anything else.

**4.4 Outdoor weather reimbursement.** ⟨DECISION — **resolved from the live copy,
and it was never as undefined as it looked**⟩ I said this clause was undefined.
It is not. The outdoor maker page defines it, and the definition is a good deal
tighter than "30% of something":

> "If it rains the week leading up to the show, we will use our best judgement as
> to whether the outside show will go on each day. […] If we cancel the show
> because it will be too stormy […] we will give you the opportunity to
> automatically participate in the next show, on the same day you purchased. If
> you decide to not do the next show, we will reimburse you for 30% of your shop
> fee. We cannot fully reimburse you because of the marketing efforts […] If the
> show is still happening despite less-than-perfect weather and *you choose not to
> come*, *we will not give you another day in a future show*."

So the trigger is **Mermade cancelling an outdoor day**, not a rainfall reading;
the 30% is **of that day's booth fee**; and it is only paid to a maker who
declines the rolled-forward day. That is a rule you can apply without arguing,
which is what I wanted from a measurement, and it is already what makers have
been told. It is drafted at **§B6** and the published page carries it there.

**The one piece still open** is who decides and on what: "our best judgement"
about the week ahead is a judgment call in a clause otherwise made of facts. A
rainfall or wind trigger would remove the argument but would also stop you
cancelling on Wednesday for a Saturday forecast, which is the call you actually
have to make. My read: keep the judgment, keep the announcement obligation, and
write down the *deadline* instead of the *measurement*, i.e. we decide by a stated
hour the day before. That is a decision, so it is not drafted.

**4.5 Force majeure.** Neither party is liable for failure to perform caused by
events beyond its reasonable control, including fire, flood, earthquake, severe
weather, public health orders, epidemic or pandemic, acts of government, civil
unrest, terrorism, war, utility or transport failure, labour dispute, or loss of
the venue. Mermade's liability in any such event is limited to §4.3.

## 5. What you may sell

**5.1 The rule that has survived every venue change: the person who made it is
the person who applied.** You may sell only goods you designed and made
yourself, or made under your direct supervision in small batches.

**5.2** You may sell only the categories and product lines described in your
accepted application. Materially different product lines need our written
approval before the Show.

**5.3 Not permitted:** resold or wholesale goods presented as your own;
mass-produced or imported merchandise; multi-level-marketing or direct-sales
lines; and ⟨DECISION⟩ **artwork or product imagery generated by AI.** The AI ban
is a genuinely new clause spreading fast through the field — Crafty Wonderland
(*"WE DO NOT ALLOW ANY AI GENERATED ART TO BE SOLD AT OUR MARKETS!"*) and
Patchwork Show (*"Products with AI generated images are also prohibited"*) both
added it, in near-identical language, independently. Your application already
asks the question; this is the clause that gives the answer teeth.

> ⟨DECISION — **new, and it is a real contradiction, not a wording problem**⟩
> §5.1 as originally drafted said you may sell "only goods you designed and made
> yourself", and §5.3 banned "resold or wholesale goods". **Your own application
> invites the opposite.** `src/app/actions.ts` asks `madeByYou` with three
> answers, one of which is `curate_resell`; the FAQ says *"If you have a curated
> shop where you wholesale items from a factory (like clothing) or wholesale from
> other shops, it's all good"*; and `Vintage` is a seeded category with a seeded
> price range. An agreement that bans what the form invites is the first thing a
> declined maker would point at.
>
> The published clause therefore reads on the misrepresentation, not on the making:
> goods you make, goods made under your supervision, **and goods you sourced or
> curated and described to us honestly**. What stays banned is selling someone
> else's work as your own.
>
> **Confirm this is what you mean.** If the real rule is "handmade only, and the
> FAQ is out of date", then the FAQ, the application's third answer and the Vintage
> category all have to go, and that is a bigger change than a clause.
>
> The same evidence softened the MLM ban. The FAQ carves out an MLM-derived product
> the maker actually makes, as long as the shop name does not carry the company's
> name, so §5.3 carries that carve-out rather than a flat prohibition.

**5.4 Verification.** We may ask you at any time for reasonable evidence that
your goods are made as represented — process photos, studio images, material
sourcing. This follows the American Craft Council, which reserves *"the right to
require authentication of the production process at any time by requesting
documentary evidence."* Misrepresentation is a material breach under §12.

## 6. Compliance and permits

**6.1 Seller's permit — outdoor vendors.** Outdoor vendors sell for their own
account and must hold a valid California seller's permit, or qualify as an
occasional seller and provide a completed **CDTFA-410-D**. You must give us the
permit number or the 410-D **before load-in**. We are required to keep this
record: CDTFA Publication 111 provides that an operator *"may not rent space to
sellers unless they give you the written documentation described in this
publication,"* and that the operator *"may be required to pay a penalty of up to
$1,000 for each seller for which you did not keep records if that person is
required to hold a seller's permit and does not hold a valid permit."* We retain
these records for four years.

**6.2 Seller's permit — indoor vendors.** Because Mermade takes possession of
your goods and sells them in its own name, **Mermade is the retailer of record**
for those sales under Cal. Code Regs. tit. 18 §1569 and CDTFA Publication 114.
Mermade collects and remits California sales tax on the full retail price. You
do not need a seller's permit *for sales Mermade makes on your behalf*. You
remain responsible for your own tax obligations on your own separate business.

**6.3 Food vendors** must hold the applicable Orange County health permit and
provide it before load-in. Cottage-food operators must provide their CDPH
registration or permit.

**6.4 Business licences.** You are responsible for any city business licence the
venue's jurisdiction requires of you.

## 7. Insurance

**7.1 ⟨DECISION — leaning settled, but one question first⟩** Drew confirms Mermade
**carries its own policy covering the whole event.** That points at Option B below,
and you are most of the way there. Before it can be drafted, one thing has to be
checked, because it is the difference between being covered and believing you are:

> ### Your policy covering the event is not the same as your vendors being covered.
>
> A commercial general liability policy in Mermade's name responds to claims
> against **Mermade**. If a shopper trips over a vendor's display rack and sues
> **that vendor**, the vendor has no coverage — and because Mermade is the entity
> with a policy and a bank account, Mermade becomes the defendant worth naming.
>
> `00-BUSINESS-AUDIT.md` §1.3 records that the River Street asset manager asked you
> directly: *"Does your policy cover all participating vendors? If so, please have
> that language added."* **That question strongly implies it did not.** Being asked
> to add language is what a broker says when the language isn't there yet.
>
> **One call to your broker settles it.** Ask exactly: *can participating vendors be
> added as additional insureds under our existing event policy, and what is the
> premium delta?* Three possible answers:
>
> - **Yes, small delta** → Option B is real. Bake it into the booth fee, advertise
>   it ("coverage included"), and delete this clause entirely. Best outcome, and a
>   genuine differentiator — Junk Bonanza does exactly this.
> - **Yes, large delta** → price it as an optional add-on line, or fall back to A.
> - **No** → Option A. Vendors bring their own COI.
>
> Until that call happens, the draft keeps Option A, because Option A is the version
> that needs contract language and Option B mostly needs a line item.

> **Option A — each vendor brings a COI.** The standard approach at larger shows.
> West Coast Craft requires General Liability $1M per occurrence / $2M aggregate,
> $2M products-completed operations, $100K damage to rented premises, $5K medical.
> One of a Kind requires $5M with 30 days' notice of cancellation. Naming Mermade
> and the venue as additional insureds is universal where a COI is required at all.
>
> **Option B — Mermade carries a blanket policy and bakes it into the booth fee.**
> `00-BUSINESS-AUDIT.md` §1.3 records that the River Street asset manager asked you
> directly whether your policy covers participating vendors and invited you to add
> that language. Junk Bonanza bundles coverage into the booth fee. This is a
> materially nicer vendor story, removes ~100 COI chases per show, and is a
> differentiator you can advertise. Ask your broker for the premium delta first.

The draft below assumes **Option A**, because it is the version that needs
contract language. Option B replaces this section with a single sentence and a
line item in the fee.

> ⟨DECISION — **the published page could not carry Option A, and here is why**⟩
> The application form, three fields above the signature, says: *"I carry my own
> liability insurance (**recommended, not required**)"*
> (`src/app/apply/ApplyForm.tsx`). A maker cannot tick that box and sign a §7.2
> that requires $1M/$2M and a certificate before load-in in the same submission.
> One of the two has to move, and choosing which one is choosing an insurance
> policy, which is your call and the broker's.
>
> So the published §7 states what is true today and leaves the door open: we carry
> our own policy, it covers us and not you, we recommend you carry your own, and
> **if the venue or your acceptance requires a certificate we will tell you and you
> send it before load-in**, naming Mermade and the venue. That is enforceable if
> you switch to requiring COIs mid-season, and it does not contradict the form.
>
> Make the broker call. It is still the highest-value hour in this section: yes
> with a small delta and you can advertise "coverage included" and delete a hundred
> certificate chases a show; no and §7.2 becomes a hard requirement and the form
> checkbox becomes a required field.

**7.2** You must maintain commercial general liability insurance of not less than
**$1,000,000 per occurrence and $2,000,000 aggregate**, naming **Mermade Market
and the Show venue as additional insureds**, in force for the full Show period
including load-in and load-out. You must upload the certificate before load-in.

**7.3** Insurance on your own goods, equipment and display is your
responsibility. Ours does not cover it. See §A8 for how loss is handled on the
indoor track.

## 8. Liability

**8.1** Except as §A8 provides for consigned goods, Mermade is not responsible
for loss of, damage to, or theft of your property, or for injury to you or
anyone working with you, however caused. You participate at your own risk.

**8.2** Mermade's total liability to you arising out of or relating to this
Agreement, on any theory, **will not exceed the total fees you paid us for the
Show** — plus, for indoor vendors, any consignment proceeds properly owed to you
and not yet paid.

**8.3** Neither party is liable for indirect, incidental, special, consequential
or punitive damages, or for lost profits or lost sales.

**8.4** Nothing in this Agreement limits liability that cannot be limited under
California law, including liability for gross negligence, wilful misconduct or
fraud. ⟨COUNSEL⟩ California scrutinises exculpatory clauses closely (the *Tunkl*
line), and a disclaimer that reaches too far can be struck in its entirety rather
than trimmed. Ask counsel to set the ceiling here deliberately.

## 9. Indemnity

**9.1** You will indemnify, defend and hold harmless Mermade, its owners, staff,
volunteers and contractors, and the Show venue and its owners, against any claim,
loss, liability, damage, cost or expense (including reasonable legal fees)
arising out of: your goods; your acts or omissions or those of anyone working
with you; your breach of this Agreement; your failure to comply with any law,
permit or tax obligation; or any claim that your goods infringe a third party's
intellectual property.

> This is the single most universal clause in the field. Every market I examined
> that publishes any terms at all has one, and every one of them runs in one
> direction only — vendor indemnifies organiser, never the reverse. Urban Craft
> Uprising, which publishes almost nothing else, still tells applicants *"you will
> also be required to sign a hold harmless agreement."*

**9.2 Product liability sits with you.** You are the maker. Nothing in this
Agreement makes Mermade the manufacturer of your goods.

## 10. Photographs, film and your name

**10.1** We photograph and film our Shows and we will keep doing it. You agree
that Mermade may use photographs and video taken at the Show that include you,
your booth, your goods, your business name or your marks, to promote Mermade
Market — on our website, in print, in email, in press, and on social media, now
and in the future, without payment.

**10.2** Where we post an image of your work on social media and you have given
us your handle, **we will make reasonable efforts to tag and credit you.**

**10.3** You confirm that our use of these images will not infringe anyone's
rights, and that you have permission from anyone identifiable in material you
give us.

**10.4** You keep every right in your own work and your own marks. This clause is
a licence for Show-related promotion, not an assignment of anything.

> Modelled on Renegade's photography clause, which is the best-drafted one in the
> field and the only one that promises to try to credit the maker. Deliberately
> *not* modelled on Informa/One of a Kind, whose version claims to be *"the
> exclusive owner of all rights in the Content,"* worldwide and perpetual and
> unpaid, while simultaneously banning vendors from filming anything themselves.
> That is a fine clause for a trade-show conglomerate and a terrible one for a
> market whose whole proposition is that it is on the maker's side.

## 11. Conduct, display and removal

**11.1** Your display must be presentable from every angle a shopper can see it,
including the back. Your business name must be visible. Tables must be covered to
the floor.

**11.2** We may require you to change, cover or remove any display element, sign
or product that, in our reasonable judgment, is unsafe, misrepresents your goods,
breaches this Agreement, or is out of keeping with the character of the Show.

**11.3** We may refuse entry to, or remove, any person whose conduct is unsafe,
abusive or seriously disruptive. Removal for breach is without refund.

## 12. Breach, termination and future shows

**12.1** Material breach includes: misrepresenting who made your goods; selling
prohibited goods under §5.3; failing to provide required permits or insurance;
abandoning your space; failing to appear after confirming; and conduct under
§11.3.

**12.2** On material breach we may remove you from the Show without refund, and
may decline your future applications. We will tell you the reason in writing.

**12.3 ⟨DECISION — resolved from the schema⟩ No-show.** A confirmed vendor who neither appears nor cancels
forfeits the booth fee and — the part worth writing down — **is recorded as a
no-show on their vendor record and may be declined or required to prepay in
future seasons.** You already carry at least one vendor flagged for exactly this.
One of a Kind is the only market I found that names an unattended booth as a
contract breach in terms; everyone else leaves it to general forfeiture, which
means in practice nothing happens.

> The platform already has the field this clause needs: `vendors.is_flagged` and
> `vendors.flag_reason`, persistent across shows, which is what makes "recorded on
> their vendor record" a true statement rather than an intention. Drafted and
> published as written. What is not built is the prepay path, so "may be required
> to prepay" is a promise about a future season.

## 13. Assignment and sharing

**13.1** You may not assign this Agreement, or sublet, share or transfer your
space, without our written consent. Only the accepted maker may sell in the
space.

**13.2** Shared spaces are permitted only where both makers applied together and
were juried together, and both sign this Agreement. ⟨DECISION — **answered as a
pair, and the platform cannot yet do it**⟩ Crafty Wonderland juries shared booths
*as a pair*; Urban Craft Uprising juries the two makers *separately*. Drafted and
published as a pair, because the $100 share is a single add-on on a single
application and that is how it already works.

> **The gap is operational, not contractual.** `applications` is unique on
> `(show_id, vendor_id)` and a vendor is unique on email, so a shared pair submits
> **one** application under **one** email today, and "both sign this Agreement" is
> not something the form can currently record: there is one `signed_name` field.
> `06-OPEN-QUESTIONS.md` §19 wants two vendor records, two statements and one
> shared space, which is the right end state. Until then, either collect the second
> maker's signature by email before load-in, or take the second name and email on
> the application. This is the shortest path from "the clause is true" to "the
> clause is true of the code".

## 14. General

**14.1 Independent contractor.** Nothing here creates employment, partnership,
joint venture or franchise. Except as §A1 provides for consignment, neither party
is the other's agent.

**14.2 Governing law and venue.** California law governs. The parties submit to
the state and federal courts in Orange County, California. ⟨DECISION — **still
open, and deliberately not drafted**⟩ A mandatory mediation step, or a
small-claims carve-out, is worth considering: most disputes here are worth a few
hundred dollars, which is exactly where a litigation clause is theatre. It is not
in the published page, because adding a mandatory step is adding a hurdle in front
of a maker's own remedy and that is a decision, not a tidy-up. What each costs: a
mediation step costs a few hundred dollars in mediator fees and a month, and it is
the clause that most reliably stops a $400 argument becoming a filing; a
small-claims carve-out costs nothing and keeps the cheap forum open. ⟨COUNSEL⟩
Ask whether an arbitration clause is worth having at all at these amounts. My
read is no, and that a small-claims carve-out plus a talk-first sentence is the
whole of what is useful here.

**14.3 Notices** go to the email addresses on the vendor record.

**14.4 Entire agreement.** This Agreement, the accepted application, and the Show
record together are the whole agreement, and supersede the pages on
mermademarket.com and anything said in email.

**14.5 Severability.** If a provision is unenforceable, the rest survives.

**14.6 Survival.** §§8, 9, 10, A6, A8 and 14 survive the Show.

---

# SCHEDULE A — INDOOR CONSIGNMENT TERMS

*Applies only to indoor vendors. If you have both an indoor space and an outdoor
tent, both schedules apply to their respective goods.*

## A1. What this relationship is

**A1.1** You deliver goods to Mermade. Mermade merchandises them, sells them at a
central register in Mermade's name, retains a commission, and pays you the
balance. You are the **consignor**; Mermade is the **consignee**. You need not be
present at the Show.

**A1.2** For the purpose of selling your goods at the Show, Mermade acts as your
agent and holds your goods in trust for you.

> ⟨COUNSEL⟩ California Civil Code §1738 *et seq.* imposes exactly this structure —
> agency, goods held in trust and exempt from the consignee's creditors, proceeds
> held in trust, and a non-waivable duty of care — but only for *"fine art,"* which
> the statute defines as *"a painting, sculpture, drawing, work of graphic art
> (including an etching, lithograph, offset print, silk screen, or a work of
> graphic art of like nature), a work of calligraphy, or a work in mixed media."*
> Most of your floor — jewelry, textiles, candles, leather, functional ceramics —
> almost certainly falls outside that list. A hand-pulled print or a sculptural
> ceramic piece plausibly falls inside, and §1738.8 makes the statute
> non-waivable where it applies.
>
> This draft adopts trust language **voluntarily for all goods**, on the reasoning
> that (a) it may apply to some pieces by operation of law whatever the contract
> says, (b) contractually replicating it costs Mermade nothing it should not
> already be doing, and (c) it is a genuinely good thing to be able to tell a maker.
> Ask counsel whether adopting it wholesale creates any exposure you would not
> otherwise have, and whether being characterised as an "art dealer" is something
> to seek or avoid.

## A2. Delivery and inventory

**A2.1** You deliver goods at your assigned load-in slot with a written inventory
list. Mermade counts in against that list; the countersigned list is the baseline
record for settlement.

**A2.2 Tagging.** Every item must carry your **vendor code and price** — e.g.
`MM07 $18`. That is all the register needs and all you have to do. There is no
barcode, no SKU, and nothing to print.

**A2.3 ⟨DECISION — my read stands, and the site now argues with it⟩ The $100
label-noncompliance deduction is not in this draft.**
`00-BUSINESS-AUDIT.md` §2.1 puts it plainly: the penalty exists because the old
manual tally could not function without perfect vendor compliance, which
converted an engineering problem into a penalty pointed at your own vendors. The
new register reads vendor code plus price directly. If an item arrives untagged,
the fix is a staff member writing a tag, not a hundred-dollar charge. If you keep
any deduction, make it cost-based and small.

> **September 2026, and this is now urgent rather than academic.** `/makers/indoor`
> publishes all three penalties in a block headed *"Rules that cost money"*: $100
> for arriving after 6pm on set-up night, $100 for bad labels or none, $20 for
> jewelry with no bags. The published agreement says the opposite at **§A2.5**:
> deductions are our commission plus anything we supplied on your behalf at cost,
> itemised with a reason, and an untagged item is tagged by staff and not charged
> for.
>
> **Both pages are live and one of them is wrong.** §14.4 says the agreement wins,
> which means as it stands a maker can be told $100 on the rules page and $0 in the
> contract they signed. Pick one before applications open:
>
> - **Drop the penalties** (my read, and the audit's): the agreement is already
>   drafted for it, and `/makers/indoor` loses six lines.
> - **Keep them**: then they belong in §A2.5 as named amounts, they need to be
>   Show-record fields rather than constants in a page component, and the $20
>   packaging charge should be renamed to what it is, "packaging supplied", and
>   billed at cost.
>
> The $100 late-arrival charge is a third thing again: it is a load-in charge, not
> a settlement deduction, it is not modelled anywhere, and the published agreement
> does not carry it. If you want it, it needs drafting.

**A2.4** Mermade may decline to display any item that is unsafe, materially
different from your application, or unsaleable as delivered, and will tell you.

## A3. Price, display and markdowns

**A3.1 You set the retail price** and mark it on the item. Mermade will not
discount, mark down or bundle your goods without your prior written
authorisation.

**A3.2** ⟨DECISION — **answered by default, and nothing needs building**⟩ There is
no markdown field on the application, so for Fall 2026 the answer is the drafted
one: no markdown without written authorisation, which is what §A3.1 says and what
the published page carries. If you want the opt-in for a later show it is one
checkbox on the form and one column. If you want end-of-show markdown authority,
it belongs here as
an **opt-in** on the application ("I authorise Mermade to discount my unsold
goods by up to X% during the final N hours"), never as a default. Retail
consignment shops take automatic markdown authority because they hold goods for
months; you hold them for a weekend, and taking it by default would be reaching.

**A3.3** Merchandising — where your goods sit on the floor, how they are grouped
and staged — is Mermade's call. That is the service you are buying.

## A4. Sales tax

**A4.1** Mermade is the retailer of record for these sales under Cal. Code Regs.
tit. 18 §1569 and CDTFA Publication 114, holds the seller's permit, and collects
and remits California sales tax on the full retail price.

**A4.2** Sales tax is not deducted from your proceeds. Commission is calculated on
the pre-tax retail price.

## A5. Commission

**A5.1** Mermade retains a commission on the pre-tax retail price of each item
sold. The rate for your Show is stated in your acceptance — currently **20%**.

**A5.2 The rate is fixed at booking and cannot change for that Show.** If Mermade
changes its rate for later shows, your Show settles at the rate you were accepted
at. (This is why the platform snapshots `commission_bps` onto the booking and
makes it immutable.)

**A5.3** Outdoor sales carry no commission.

## A6. Proceeds, settlement and payout

**A6.1 Proceeds from the sale of your goods are held by Mermade in trust for you**
until paid, less commission and any deduction you have agreed to in writing.

**A6.2** Within **14 days** of the Show closing, Mermade will give you a written
settlement statement showing units sold, retail price, sales tax collected,
commission retained, any deductions with their reason, and the net amount due.

**A6.3 ⟨DECISION — 30 days was wrong the day I wrote it. It is now 7, and you
should confirm that.⟩** Thirty days is the benchmark in gallery and event
consignment, and it is also **three times slower than what you already publish**.
`/makers/indoor` says, in the market's own words, *"We carefully track each sale
using unique IDs per maker & pay within 1 week of the market's last day."* A
contract that promises slower than the page the maker read before signing is the
worst of the three options.

So the published clause pays and sends the statement together, **within
`POLICY.payoutDays` days of the Show closing, currently 7**, and the dispute
window runs 14 days from the statement. Two things follow, and both are yours to
confirm:

1. **It only works because §A7.1 says Mermade absorbs post-settlement returns.**
   `06-OPEN-QUESTIONS.md` §9 argues for 10 business days precisely so the money is
   still in your balance through the return window. Absorbing returns removes that
   objection. Keep the two answers together: if you decide returns come off the
   maker's next statement, the payout window has to grow again.
2. **Seven days is a promise about operations, not about software.** Payouts are
   manual until Stripe Connect lands. If seven days is not what actually happens,
   change the number here *and* on `/makers/indoor` in the same edit, because the
   pair of them is what a maker reads.

The number lives in `POLICY` in `src/lib/agreement.ts` with the rest of the
windows, and it should become a Show-record column the next time the schema moves.

**A6.4 Disputes.** Tell us in writing within **14 days** of the settlement
statement if you think it is wrong, and we will reconcile against the
countersigned inventory list and the register record. After that the statement is
final except for manifest error.

**A6.5 ⟨COUNSEL⟩ Creditor exposure — disclose or fix, but do not ignore.** Under
UCC Article 9 as adopted in California, an unperfected consignment leaves consigned
goods and un-remitted proceeds exposed to the *consignee's* general creditors:
Cal. Com. Code §9319(a) deems the consignee to have *"rights and title to the goods
identical to those the consignor had."* Where Article 9's consignment definition
does not reach (§9-102(a)(20) excludes, among others, a consignee *"generally
known by its creditors to be substantially engaged in selling the goods of
others"* — which an established market may well be), Cal. Com. Code §2326(2) gets
to the same place: goods held on sale or return *"are subject to such claims while
in the buyer's possession."*
>
> In plain terms: if Mermade were sued, levied on, or went under while holding a
> weekend's inventory and the till, makers could be unsecured creditors for their
> own goods and their own money. No maker is going to file an individual UCC-1 for
> a weekend. Ask counsel about **an operator-level UCC-1 filing** covering consigned
> vendor goods, and about segregating proceeds. This is the highest-value structural
> fix in this document and no contract clause alone accomplishes it.

## A7. Returns and exchanges

**A7.1** Mermade sets the customer returns policy for the Show. If a customer
returns an item of yours after settlement, ⟨DECISION — **answered, and now load
bearing**⟩ Mermade absorbs it. Simplest and cheapest at your volume, and clawing
money back from a maker after you have paid them is a bad look for a few dollars.
It is also what makes the 7-day payout in §A6.3 safe, so the two answers move
together. What is still open is the customer-facing policy itself
(`06-OPEN-QUESTIONS.md` §15): is it all sales final, or is there a window? The
agreement does not need to know, but the register does.

## A8. Risk of loss

> This is the clause your lawyer should spend the most time on, and the one where
> copying a consignment-shop template would be a mistake.

**A8.1** Title to your goods stays with you until Mermade sells them to a
customer.

**A8.2 ⟨DECISION⟩ Mermade will take reasonable care of your goods while they are
in our possession, and is responsible for loss or damage caused by our
negligence.** This is stricter than the retail-consignment norm — Consignment
Classics tells consignors *"Fire and theft insurance is the responsibility of the
consignor"*; Modo Boutique disclaims *"theft or damage... customer handling, fire,
flood, earthquakes, stains, tears, missing parts."* Those shops hold goods for
months in an unstaffed showroom. You hold them for a weekend, in a room you staff,
having chosen to take possession because it is your service. Disclaiming
everything would be both a worse vendor story and a weaker legal position.

**A8.3 Mermade is not responsible** for: ordinary shoplifting and shrinkage
despite reasonable care; damage by customers handling goods normally; damage in
transit to or from the Show; inherent defects or fragility; or loss caused by
fire, flood, earthquake or other event beyond our reasonable control.

**A8.4 ⟨DECISION — answered, overrule if you disagree⟩ Shrinkage.** Where an item cannot be accounted for at
reconciliation and §A8.3 does not explain it, the draft proposes Mermade credits
you **the item's retail price less commission** — the same net you would have
received had it sold. The alternative is a stated per-vendor cap. Decide which,
and say it out loud, because right now it is decided ad hoc each show and that is
exactly the kind of thing that turns into a story.

**A8.5** Mermade's liability under this Schedule is subject to the cap in §8.2.
⟨COUNSEL⟩ Check that §8.2's cap and §A8.2's undertaking are consistent, and that
neither is undercut by §8.1.

**A8.6** You are encouraged to insure your own goods. Nothing here obliges us to
insure them for you.

## A9. Unsold goods

**A9.1** Unsold goods are yours. Collect them at breakdown, at the time stated in
your load-out instructions, or make arrangements with us in advance.

**A9.2 ⟨DECISION — answered, overrule if you disagree⟩** Goods not collected
within **14 days** of the Show, after we
have made at least two documented attempts to reach you, may be treated as
abandoned and donated to a charity of our choosing. **We will not sell abandoned
goods for our own account, and we will not carry them to a future Show without
your written agreement.** Retail consignment templates routinely convert
uncollected goods into shop property — 120 days at Modo Boutique, 90 at
Consignment Classics. Converting a maker's unsold work into your inventory is a
different thing from a thrift shop doing it, and it invites a conversion claim
you do not need.

## A10. Tax reporting

**A10.1 ⟨COUNSEL — unchanged, and deliberately not published⟩** Payments to you
are payments for merchandise, not for services. The IRS instructions for Forms 1099-MISC and 1099-NEC exclude
*"[p]ayments for merchandise, telegrams, telephone, freight, storage, and similar
items,"* which is why consignment shops generally do not issue 1099s to
consignors. That reasoning appears to fit Mermade's structure, and it follows
naturally from Mermade being the retailer under §A4.

The published page does **not** say "we do not issue 1099s", because that is a
CPA's answer and not a drafter's. It says you are responsible for your own income
tax and that we will ask for a W-9 first if we are required to report a payment,
which is true whichever way the CPA answers.

Confirm it with your CPA against the actual payout mechanics, and note that the
thresholds moved for 2026 — 1099-NEC/MISC to **$2,000** (from $600) for payments
after 31 December 2025, and 1099-K back to **$20,000 and 200 transactions**. This
also resolves `00-BUSINESS-AUDIT.md` §1.5, which flagged the form type as an open
fork.

**A10.2** You are responsible for your own income tax on amounts we pay you.

**A10.3 ⟨COUNSEL — new, and nothing in this document had noticed it⟩ Makers under
18.** The JR Space is seeded at $60 and is described on the live page as
*"Junior Makers, 14 + under"*. **A minor cannot be bound by this contract**, and
under California law a minor can generally disaffirm one. Today the application
takes a typed name and a checkbox with no guardian field, which means a
twelve-year-old can sign an indemnity, a liability cap and a photography licence,
and none of it holds. `06-OPEN-QUESTIONS.md` §18 spotted the payment half of this
(a minor cannot hold a seller's permit or clear Stripe KYC and is presumably paid
through a parent) without spotting the signature half.

The published page therefore says the parent or guardian applies, signs, and is
the person we pay, and extends it to 15-to-17-year-olds who apply for an ordinary
space. That is the only lawful shape I can see, but the drafting of it, and
whether a guardian signature also has to carry the indemnity, is a question for
counsel. The application form needs a guardian name and email before this clause
is true of the code.

---

# SCHEDULE B — OUTDOOR BOOTH LICENCE TERMS

*Applies only to outdoor vendors.*

## B1. What this relationship is

**B1.1** Mermade grants you a **revocable licence to occupy** the assigned space
for the days and hours stated in your acceptance. This is a licence, not a lease,
and gives you no interest in the venue.

**B1.2 You are the retailer.** You sell your own goods for your own account, take
your own payments, and keep 100% of your sales. Mermade takes no commission on
outdoor sales.

**B1.3** Because you sell for your own account at our event, CDTFA Publication 111
applies to us as operator. §6.1 is why we need your permit or 410-D before
load-in, and it is not negotiable.

## B2. Space, days and hours

**B2.1** Spaces are 10' × 10' unless your acceptance says otherwise. Everything —
tent, tables, racks, signage, stock, your chair — stays inside your space and out
of the aisles.

**B2.2** You must be set up before doors open and staffed by someone over 18
during all published hours.

**B2.3 No early teardown.** You may not begin breaking down before the Show closes
on your last contracted day. This is the most-broken rule at every outdoor market
and the one most visible to shoppers.

## B3. Tents, weights and safety

**B3.1** Tents must be weighted at every leg. ⟨DECISION — **still open, one
email**⟩ Set a number. 25 lb per leg is the common minimum and some venues require
40. Stakes are usually prohibited on pavement. Confirm with the Community House
and put the actual figure in the load-in instructions, which is where the
published clause points, so that a venue change moves one field rather than the
contract.

> **And a related error worth fixing here.** §B2.1 below says outdoor spaces are
> 10' x 10'. **They are not.** The outdoor maker page says the Mermade tents are
> *"6.5 feet x 6.5 feet + 7.5 tall"* and that *"a few 10x10's will be offered"*,
> and the 10 x 10 is a priced add-on in the platform (`TENT_10X10`, $100). The
> published clause says the space is the tent we put up, in the size on your
> acceptance, and points at the outdoor page for dimensions, so there is one place
> the number lives. A maker who plans a display for 100 square feet and arrives to
> 42 has a real complaint, and this document was about to give them one.

**B3.2** You must have a backdrop. Your space must look finished from every side a
shopper can see.

**B3.3** Open flame, generators, propane and heat-producing equipment need our
written approval in advance and may need the fire marshal's.

**B3.4** You are responsible for your own tent in wind. Mermade may require you to
lower or remove a tent that has become unsafe.

## B4. Load-in, load-out and vehicles

**B4.1** Load-in and load-out happen at assigned times. Vehicles must be moved to
vendor parking before doors open.

**B4.2** Leave your space as you found it. Take your rubbish with you.
⟨DECISION — **still open, small, and cheap to answer**⟩ A stated cleanup charge is
the only lever that reliably works, and there is no evidence in the repo that you
have ever charged one. Two options and what they cost: **name a figure** (a
disposal run and an hour of staff time, so something like $75 to $150) and it
belongs in §B4.2 and on the load-in instructions, or **say nothing** and keep
absorbing it, which is what happens today. The published page carries the duty
without a charge, because inventing a penalty pointed at your own makers is
exactly what §A2.3 argues against.

## B5. Rentals

**B5.1** Tents, tables and chairs rented from Mermade are ours. You are
responsible for damage beyond normal wear.

---

# What to put in front of a lawyer

An hour or two of an attorney's time, focused here. In priority order.

| # | Question | Why it matters | Where |
|---|---|---|---|
| 1 | **Confirm Mermade is the retailer of record for indoor consignment** under Reg. 1569 / Pub. 114, and that indoor makers need no permit for our sales | Determines the tax base, who registers with CDTFA, and the 1099 answer. The regulation looks squarely on point but this is the load-bearing assumption of the whole indoor schedule | §6.2, A4, A10 |
| 2 | **Creditor exposure on consigned goods and proceeds.** Should Mermade file an operator-level UCC-1? Should proceeds be segregated? | Makers' goods and money are legally exposed to Mermade's creditors. Highest-value structural fix in this document; no clause alone solves it | §A6.5 |
| 3 | **How far can the liability disclaimer and cap go** under California exculpatory-clause law before a court strikes it? | An over-reaching disclaimer can fail entirely rather than be trimmed | §8.2, 8.4, A8 |
| 4 | **Does Civ. Code §1738 (fine art consignment) reach any of our product lines** — sculptural ceramics, hand-pulled prints? Is voluntarily adopting trust language for everything wise? | Where it applies it is non-waivable, and it imposes near-strict liability for loss | §A1.2 |
| 5 | **Risk-of-loss allocation and the shrinkage rule** — is §A8 the right split, and is it enforceable? | This is the clause that will actually get argued about, in the room, at breakdown | §A8 |
| 6 | **Postponement mechanics** — is a credit rather than a refund defensible, and does §4.2 hold up given you have already postponed once? | Weather is your uninsured single point of failure | §4 |
| 7 | **Blanket vendor insurance vs. individual COIs** — and if blanket, what the policy must say | Changes ~100 COI chases per show into a line item, and is a real differentiator | §7 |
| 8 | Does the indemnity survive an incident involving a **food vendor**, and does §9 need a food-specific rider? | Highest-severity plausible incident on the floor | §9 |
| 9 | E-signature sufficiency: is capturing **name + timestamp + terms version** enough under **UETA / ESIGN**? Note the platform does **not** capture an IP address, and the clause no longer claims one | Everything above is worthless if the signature doesn't hold | §1.3 |
| 10 | **Minors.** A JR maker is 14 or under and cannot be bound. Is a guardian signature on the same form enough, and does the guardian carry the indemnity? | Today a child can tick the box and none of the agreement holds. There is no guardian field on the form | §A10.3 |
| 11 | Does the **carry-forward** in §B6.4, published on the outdoor page for years, sit consistently with "all spaces are non-refundable" in §3.2? | Two published promises that a maker will read together | §3.2, §B6.4 |

## Business decisions — where each one now stands

Settled on 25 August, and the rest answered with my best read so you have a
position to accept or overrule rather than a blank.

| # | Decision | Status |
|---|---|---|
| 1 | **Application fee** | ✅ **None.** Confirmed against the live page. §2.2 |
| 2 | **Cancellation** | ✅ **All spaces non-refundable.** §3.2 — with a transfer-right option noted if you ever want to soften it without losing the cash |
| 3 | **Insurance** | 🟡 **Option B, pending one broker call.** You carry event coverage; confirm whether *vendors* can be added as additional insureds, and at what delta. §7.1 |
| 4 | **Applications open** | ✅ **Monday 7 September 2026.** Close date drafted as Friday 18 September, mirroring the Spring window's shape — confirm |
| 5 | **Payment window** | ⚪ **36 hours**, matching your real policy. Revisit after a season of lapse data. §2.3 |
| 6 | **Outdoor weather reimbursement** | 🔴 **Define it or delete it.** My read: *define it.* At $400–500 a day a rained-out Saturday is real money, and an undefined discretionary refund gets argued every time. Proposed trigger: *if NWS-recorded rainfall at the venue exceeds 0.25″ during published Show hours on a vendor's contracted day, that day's booth fee is reimbursed 30%.* Pick something you can look up afterwards rather than something you have to judge. §4.4 |
| 7 | **$100 label deduction** | 🔴 **Drop it.** My read, strongly. It existed because the manual tally needed perfect vendor compliance; the register now reads `MM07 $18` directly. §A2.3 |
| 8 | **$20 jewelry-box deduction** | 🟡 **Keep it, but make it cost-based.** If you supply boxes because a vendor didn't, charging what they cost is fair. Charging a round $20 as a penalty is not. Rename it on the statement to "packaging supplied." §A2.3 |
| 9 | **Markdown authority** | ⚪ **Opt-in only**, never default. You hold goods for a weekend, not a season — taking automatic markdown authority would be reaching. §A3.2 |
| 10 | **Shrinkage credit** | ⚪ **Full net** — retail less commission, the same the maker would have received had it sold. Simple, generous, ends the argument. §A8.4 |
| 11 | **Payout timing** | ⚪ **30 days**, moving faster once payouts are automatic. Say the number out loud either way; the current silence is what generates the chasing. §A6.3 |
| 12 | **Shared booths** | ⚪ **Juried as a pair.** You already sell a $100 share add-on and ask for both businesses on one application, so this writes down what you do. §13.2 |
| 13 | **Tent weights** | 🔴 **Confirm with the Community House.** 25 lb per leg is the common minimum, some venues require 40, and stakes are usually banned on pavement. One email. §B3.1 |
| 14 | **Returns after settlement** | ⚪ **Mermade absorbs them.** Cheapest and simplest at your volume; clawing money back from a maker after you've paid them is a bad look for a few dollars. §A7.1 |

🔴 needs an answer from you · 🟡 one call or email · ⚪ answered — overrule if you disagree · ✅ settled

---

## The fee schedule this draft assumes

Taken from `mermademarket.com/pages/merchant-application` on 25 August 2026, and
now seeded into the platform so the apply page renders it off the show record
instead of a hardcoded table.

| Indoor | Fee | | Outdoor | Fee |
|---|---|---|---|---|
| JR Space | $60 | | Friday · 9am–6pm | $400 |
| Treats on a Shelf | $100 | | Saturday · 9am–5pm | $500 |
| BTQ Space | $150 | | Sunday · 9am–5pm | $450 |
| 3′ × 4′ | $260 | | 10 × 10 tent rental | +$100 |
| 3′ × 6′ | $280 | | Endcap request | +$60 |
| 3′ × 8′ | $340 | | Share outside | +$100 |
| 3′ × 12′ | $450 | | | |
| Corner/endcap | +$40 | | | |
| Share inside | +$100 | | | |

**Indoor commission 20%. Outdoor 0%.** Outdoor is priced *per day*, so a full
weekend tent is **$1,350** before rentals — which is why §4.4's weather clause
matters more than it looks, and why "non-refundable" now carries more weight than
it did when I first drafted it.

~~⟨COUNSEL⟩ Add-ons are not yet modelled in the platform or drafted in the
agreement.~~ **Closed, September 2026.** Add-ons are modelled: `add_ons`,
`applications.requested_addons`, `booking_addons` and `bookings.addons_cents`,
seeded at share $100, endcap $40 inside and $60 outside, and a Mermade 10 x 10
tent $100. The agreement covers them at §3.1, and the fee schedule on `/agreement`
is rendered from `space_types` and `add_ons` rather than from the table above, so
this table is now a historical record of what the prices were on 25 August 2026
and the live page cannot go stale.

Two mismatches between this table and the platform are worth knowing about. The
table's outdoor hours (*Friday 9am-6pm, Saturday 9am-5pm, Sunday 9am-5pm*) are
**not** the Show record's hours (*Friday 5-9pm, Saturday 10am-5pm, Sunday
10am-4pm*), and the outdoor maker page still carries the 9am version in its
schedule block. And the table's "Endcap request +$60" is the outdoor endcap; the
indoor one is $40. The published agreement reads all of it off the database, so
only the maker pages need the fix.

---

*Sources for the comparative claims in this draft are collected in
`11-AGREEMENT-RESEARCH.md`, with URLs and quoted language.*
