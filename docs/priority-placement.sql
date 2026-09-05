-- Priority placement, for the production database.
--
-- Run this once in the Supabase SQL Editor. It is idempotent: running it
-- twice changes nothing the second time.
--
-- Why it is needed: add-ons live in the database, not in code, so seeding a
-- local machine does nothing for the deployed site. This is the same content
-- as drizzle/0004_addon-capacity.sql plus the two rows.

-- 1 · The cap becomes a number.
--    `is_limited` is a boolean and can only print the word "limited" on the
--    form. Overselling a spot at the front of the room means refunding a
--    maker who was promised one, so the cap has to be countable.
--    NULL means uncapped, which is every add-on that came before this one.
ALTER TABLE add_ons ADD COLUMN IF NOT EXISTS capacity integer;

COMMENT ON COLUMN add_ons.capacity IS
  'How many of this add-on exist for the show. NULL means uncapped. For an outdoor add-on the cap is per day, because each outdoor day is its own space_type.';

-- 2 · The two add-ons, against whichever show is active.
--    $100 each, five inside for the show, five outside PER DAY.
INSERT INTO add_ons (id, show_id, track, code, name, description,
                     price_cents, max_qty, is_limited, capacity, sort_order, is_active)
SELECT gen_random_uuid()::text, s.id, 'indoor', 'PRIORITY-IN',
       'Priority placement, inside',
       'A spot on the busiest run of the room. Five of these exist.',
       10000, 1, true, 5,
       COALESCE((SELECT MAX(sort_order) + 1 FROM add_ons WHERE show_id = s.id), 0),
       true
FROM shows s
WHERE s.is_active
ON CONFLICT (show_id, code) DO UPDATE
  SET price_cents = EXCLUDED.price_cents,
      capacity    = EXCLUDED.capacity,
      is_limited  = EXCLUDED.is_limited,
      name        = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active   = true;

INSERT INTO add_ons (id, show_id, track, code, name, description,
                     price_cents, max_qty, is_limited, capacity, sort_order, is_active)
SELECT gen_random_uuid()::text, s.id, 'outdoor', 'PRIORITY-OUT',
       'Priority placement, outside',
       'A tent near the entrance. Five of these exist each day.',
       10000, 1, true, 5,
       COALESCE((SELECT MAX(sort_order) + 1 FROM add_ons WHERE show_id = s.id), 0),
       true
FROM shows s
WHERE s.is_active
ON CONFLICT (show_id, code) DO UPDATE
  SET price_cents = EXCLUDED.price_cents,
      capacity    = EXCLUDED.capacity,
      is_limited  = EXCLUDED.is_limited,
      name        = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active   = true;

-- 3 · Check it.
SELECT code, track, price_cents, is_limited, capacity, is_active
FROM add_ons
WHERE show_id = (SELECT id FROM shows WHERE is_active)
ORDER BY sort_order;
