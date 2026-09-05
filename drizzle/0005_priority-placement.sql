-- Priority placement, applied by the deploy migrator.
--
-- 0004 added `capacity` in a file that only ever ran on a developer's machine,
-- because until now nothing applied migrations to the deployed database. The
-- column and the two rows are both restated here, idempotently, so that the
-- first automatic run brings production level whatever state it is already in.
--
-- Everything in this file is safe to run twice.

-- 1 · The cap becomes a number.
--    `is_limited` is a boolean: it can print the word "limited" on the form and
--    nothing else. Overselling the front of the room means refunding a maker
--    who was promised it, so the cap has to be countable. NULL is uncapped,
--    which is every add-on that came before this one.
ALTER TABLE add_ons ADD COLUMN IF NOT EXISTS capacity integer;

COMMENT ON COLUMN add_ons.capacity IS
  'How many of this add-on exist for the show. NULL means uncapped. For an outdoor add-on the cap is per day, because each outdoor day is its own space_type.';

-- 2 · The two add-ons, against every show that is still open for applications.
--    $100 each; five inside for the show, five outside per day (Drew, 5 Sep 2026).
INSERT INTO add_ons (id, show_id, track, code, name, description,
                     price_cents, max_qty, is_limited, capacity, sort_order, is_active)
SELECT gen_random_uuid()::text, s.id, 'indoor', 'PRIORITY-IN',
       'Priority placement, inside',
       'A spot on the busiest run of the room. Five of these exist.',
       10000, 1, true, 5,
       COALESCE((SELECT MAX(sort_order) + 1 FROM add_ons WHERE show_id = s.id), 0),
       true
FROM shows s
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
ON CONFLICT (show_id, code) DO UPDATE
  SET price_cents = EXCLUDED.price_cents,
      capacity    = EXCLUDED.capacity,
      is_limited  = EXCLUDED.is_limited,
      name        = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active   = true;

-- 3 · The space list as Drew settled it on 5 Sep 2026.
--     Space content lives in the database, so a seed run only ever fixed a
--     developer's machine. These are the same edits, applied where they count.
--
--     Labels spell out both dimensions. "3x6" read as three feet wide to
--     makers who then arrived with a table that did not fit; depth is the
--     number they misjudge, so both numbers are now words.
UPDATE space_types SET label = '4ft wide, 3ft deep',  description = '' WHERE code = 'IN-3x4';
UPDATE space_types SET label = '6ft wide, 3ft deep',  description = '' WHERE code = 'IN-3x6';
UPDATE space_types SET label = '8ft wide, 3ft deep',  description = '' WHERE code = 'IN-3x8';
UPDATE space_types SET label = '12ft wide, 3ft deep', description = '' WHERE code = 'IN-3x12';

--     Outdoor is a 10x10 tent and never said so anywhere on the form.
UPDATE space_types
   SET description = '10ft wide, 10ft deep. We provide the tent. You run your own payments and keep 100%.'
 WHERE code IN ('OUT-FRI', 'OUT-SAT', 'OUT-SUN');

-- 4 · The boutique space is withdrawn. It must not appear on a form that is
--     about to open. Deleted only where nothing points at it; where an
--     application or booking already chose one, the row stays so that record
--     still resolves, and staff retire it by hand.
DELETE FROM space_types
 WHERE code = 'IN-BTQ'
   AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.space_type_id = space_types.id)
   AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.space_type_id = space_types.id);

-- 5 · The Show record, as Drew corrected it on 5 Sep 2026.
--
--     These three fields are editable at /admin/show, so a blind UPDATE would
--     overwrite whatever staff had typed. Each one is guarded on the value the
--     seed wrote: if it has been edited since, the edit is the newer fact and
--     this migration leaves it alone.

--     Doors: Friday 9-6, Saturday 9-5, Sunday 9-5. The seeded times were an
--     evening Friday preview and later mornings, which is not this show.
UPDATE shows
   SET hours_note = 'Friday 13 November, 9am-6pm · Saturday 14th, 9am-5pm · Sunday 15th, 9am-5pm'
 WHERE hours_note = 'Friday 13 November, 5-9pm · Saturday 14th, 10am-5pm · Sunday 15th, 10am-4pm';

--     Take-down follows Sunday's close, which moved with the hours.
UPDATE shows
   SET takedown_note = 'Sunday 15 November at 5pm sharp'
 WHERE takedown_note = 'Sunday 15 November at 4pm sharp';

--     The application window is 14 full days, not 12. The FAQ counts the days
--     between these two timestamps, so moving the close moves the sentence.
UPDATE shows
   SET applications_close_at = '2026-09-20T23:59:00-07:00'
 WHERE applications_close_at = '2026-09-18T23:59:00-07:00';
