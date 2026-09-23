-- Where the live payment tabs are written.
--
-- Drew, 23 Sept: "a live sheet of who has paid and who hasn't." The two tabs
-- existed already but were a snapshot: somebody had to remember to press Send,
-- and a tracking tab nobody refreshes is worse than no tracking tab, because
-- it looks current.
--
-- Remembering the sheet is what makes the difference. Once this column holds
-- an id, every event that changes what a maker owes or has paid can push the
-- tabs on its way past, with nobody in the loop.
--
-- On the Show record rather than in an environment variable, because it is a
-- per-season fact that staff set and change (CLAUDE.md rule 6), and because
-- setting an env var means a redeploy and a person who can reach Vercel.
--
-- Nullable, and empty means the feature is simply off: no sheet configured,
-- nothing pushed, no errors anywhere. The button on /admin/sheet fills it.
--
-- Not a URL. The id is the stable part; a share link carries a query string
-- that changes and would then not match the sheet somebody thinks it names.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS payment_sheet_id text;
