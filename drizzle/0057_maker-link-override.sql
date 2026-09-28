-- Where a maker's tile sends a shopper, when staff need it to be somewhere
-- else.
--
-- Drew, 28 Sept: "Elise is trying to change the links on the maker images."
-- She could not. The link was derived from the maker's own application, her
-- website if she gave one and her Instagram handle otherwise, and nothing
-- could override it. A dead site, a handle that has changed, a maker who
-- would rather be sent to a Linktree: all of it was unreachable.
--
-- An OVERRIDE, exactly like thumbnail_url beside it, and for the same reason:
-- what the maker told us stays untouched on the vendor row, so clearing this
-- hands her own answer back rather than restoring nothing.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE applications ADD COLUMN IF NOT EXISTS link_url text;
