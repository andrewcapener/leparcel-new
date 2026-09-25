-- Hillary's stragglers: six more squares, from the Stragglers folder.
--
-- Hillary, 25 Sept: "I added my stragglers to the Google Drive (4 of them)."
-- It turned out to be six makers across seven files, grouped by day the same
-- way the first folder was. All six were showing initials on /makers.
--
-- Kelly's Coastal Creations is in both the Friday and the Saturday folder,
-- with a different photograph in each. Both are her own work, so this takes
-- the sharper of the two rather than guessing which Hillary meant.
--
-- Set as thumbnail_url, the staff override, so nothing a maker uploaded
-- herself is written over. Clearing one in /admin/thumbnails hands her own
-- photograph back, exactly as before.
--
-- Matched on shop name rather than an id, because the ids here are this
-- deployment's and the file names are Hillary's. Scoped to the active show so
-- a future show's makers are never caught by it.
--
-- Idempotent: running it again sets the same values. Forward-only (rule 11).

UPDATE applications AS a
   SET thumbnail_url = m.url
  FROM vendors AS v,
       (VALUES
         ('demacollective',          '/makers/dema-collective.jpg'),          -- Dema Collective
         ('ranch52',                 '/makers/ranch52.jpg'),                  -- Ranch52
         ('kellyscoastalcreations',  '/makers/kellys-coastal-creations.jpg'), -- Kelly's Coastal Creations
         ('sunseacandles',           '/makers/sunsea-candles.jpg'),           -- sunsea candles
         ('naviksupply',             '/makers/navik-supply.jpg'),             -- Navik supply
         ('sundayathome',            '/makers/sunday-at-home.jpg')            -- Sunday at Home
       ) AS m(key, url)
 WHERE a.vendor_id = v.id
   AND regexp_replace(lower(v.shop_name), '[^a-z0-9]', '', 'g') = m.key
   AND a.show_id = (SELECT id FROM shows WHERE is_active = true LIMIT 1);
