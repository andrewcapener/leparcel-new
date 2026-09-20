-- Manual acceptance: staff choose the space, staff write the email.
--
-- Drew, 20 Sept 2026, relaying the team: "no automation yet on
-- accepted/declined emails ... they wanna manually accept people and they do
-- not want any automated emails to be triggered from our dashboard."
--
-- Three things follow from that, and all three need columns.
--
-- 1. shows.decision_emails
--    The four emails the dashboard sends on a jury decision (accepted,
--    declined, waitlisted, space released) become opt-in. A setting rather
--    than deleted code: the team may want them back next season, and a
--    setting is visible on /admin/show, so nobody has to wonder why nothing
--    sent. Default 'off' so that turning automation ON is always a deliberate
--    act by a person; the reverse default would mean one forgotten checkbox
--    mails eighty makers.
--
--    Note this is narrower than "no email at all". The application receipt
--    and the sign-in link still send, because neither is triggered from the
--    dashboard: one answers a maker pressing Submit, the other answers a
--    maker asking to sign in. Switching those off would silently break the
--    maker portal, which is where the invoice lives.
--
-- 2. bookings.pay_token
--    With no automated email, staff need a link to paste into one they write
--    themselves. It is NOT the sign-in link: that grants the whole account
--    and expires in twenty minutes, which is wrong for something pasted into
--    a message sent an hour later. This token addresses one booking and opens
--    one page, the invoice and a Pay button.
--
--    Anyone holding the link can pay that invoice. That is the accepted
--    trade: the money still lands on the right booking, and it is a far
--    better failure than a forwarded sign-in link handing over somebody's
--    application, address and phone number.
--
-- 3. bookings.link_sent_at / link_sent_by
--    The acceptance email used to be the only thing that told a maker their
--    deadline, and the forfeit path releases unpaid spaces when the window
--    runs out. Manual sending without a record means a maker can be accepted,
--    never contacted, and lose the space anyway. These two columns are what
--    the roster reads to show who has been accepted but never told.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS decision_emails text NOT NULL DEFAULT 'off';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pay_token    text,
  ADD COLUMN IF NOT EXISTS link_sent_at text,
  ADD COLUMN IF NOT EXISTS link_sent_by text;

-- One token, one booking. Partial, because every booking made before this
-- migration has NULL here and NULLs must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_pay_token_key
  ON bookings (pay_token) WHERE pay_token IS NOT NULL;
