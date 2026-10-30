-- More than one multi-buy on a line.
--
-- Drew, 30 October: "people on their multi-buy kind of bundle stuff
-- sometimes they wanna offer like one for $10, two for $15, three for $20...
-- it's essentially just a different SKU, but if it's the same product that's
-- available as a multi I think it should live under one thing, one product,
-- like in a register you click into it and it's got three variants."
--
-- That is the model. The ITEM is the product and carries the single price;
-- each multi-buy is a variant of it. 0058 could hold exactly one, as two
-- columns on the item row, so "2 for $15" and "3 for $20" had nowhere to
-- both live and the second one would have been dropped on the floor.
--
-- A child table rather than more columns, for two reasons. Columns cap it at
-- whatever number we guessed today, and the register needs these as ROWS:
-- one per price point, because that is what gets keyed in and what a sale is
-- eventually attributed to.
--
-- Three breaks is the practical ceiling and the form offers three, so with
-- the single price a product shows up to four variants. Drew: "I don't think
-- people are gonna get past three to be honest." Nothing here enforces that;
-- it is a decision the form makes, so raising it later is a form change and
-- not a migration.
--
-- Money is integer cents (rule 1). Forward-only and idempotent (rule 11).

CREATE TABLE IF NOT EXISTS inventory_breaks (
  id text PRIMARY KEY,
  item_id text NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- How many, and what the lot costs. 2 and 1500 is "buy 2/$15".
  qty integer NOT NULL,
  price_cents integer NOT NULL,

  -- The maker's own order, which is cheapest-first once validated.
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS inventory_breaks_item ON inventory_breaks (item_id);

-- A line may not offer the same quantity twice: two prices for "buy 3" is a
-- question the register cannot answer.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_breaks_item_qty
  ON inventory_breaks (item_id, qty);

-- Everything already typed, moved across. The old columns stay where they
-- are, unread from here on: a shipped migration is never edited (rule 11)
-- and dropping a column that holds a maker's real price is not a thing to do
-- in the same breath as adding the table meant to replace it.
INSERT INTO inventory_breaks (id, item_id, qty, price_cents, sort_order)
SELECT
  i.id || ':b1',
  i.id,
  i.bundle_qty,
  i.bundle_cents,
  0
FROM inventory_items i
WHERE i.bundle_qty IS NOT NULL
  AND i.bundle_cents IS NOT NULL
ON CONFLICT DO NOTHING;
