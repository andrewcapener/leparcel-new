-- The squares Hillary shot for this show.
--
-- Drew, 25 Sept: "this link is to replace the current thumbnails on the page."
-- Ninety one images in a Drive folder, one per maker, grouped by the day they
-- are outside and one folder for inside. Sixty six of them matched a booked
-- maker by shop name; the rest are either makers not on this roster or names
-- too different to match without guessing, and guessing puts the wrong
-- photograph on a real person.
--
-- They are set as thumbnail_url, which is the staff override, so nothing a
-- maker uploaded themselves is touched. Clearing one in /admin/thumbnails
-- still hands their own photograph back, exactly as before.
--
-- Matched on shop name rather than on an id, because the ids that exist here
-- are this deployment's and the file names are Hillary's. Scoped to the
-- active show so a future show's makers are never caught by it.
--
-- Idempotent: running it again sets the same values. Forward-only (rule 11).

UPDATE applications AS a
   SET thumbnail_url = m.url
  FROM vendors AS v,
       (VALUES
  ('All The Wild Ceramics', '/makers/all-the-wild-ceramics.jpg'),
  ('Awe collective jewelry', '/makers/awe-collective-jewelry.jpg'),
  ('Azure Crafts', '/makers/azure-crafts.jpg'),
  ('Bare Simplicity', '/makers/bare-simplicity.jpg'),
  ('Beach Heads Apparel', '/makers/beach-heads-apparel.jpg'),
  ('Beso del Sol Boutique', '/makers/beso-del-sol-boutique.jpg'),
  ('Blue Fish Bakery', '/makers/blue-fish-bakery.jpg'),
  ('Bread By Anna', '/makers/bread-by-anna.jpg'),
  ('Caitie Velasco Ceramics', '/makers/caitie-velasco-ceramics.jpg'),
  ('ChillCliff Inc.', '/makers/chillcliff-inc.jpg'),
  ('DAĀS Jewelry', '/makers/daas-jewelry.jpg'),
  ('Driftwood Blue Designs', '/makers/driftwood-blue-designs.jpg'),
  ('East Coastal Designs', '/makers/east-coastal-designs.jpg'),
  ('Emily Davis Ceramics', '/makers/emily-davis-ceramics.jpg'),
  ('FKN Bread', '/makers/fkn-bread.jpg'),
  ('Five sisters make', '/makers/five-sisters-make.jpg'),
  ('Gilded Ora', '/makers/gilded-ora.jpg'),
  ('Gilly Louise Designs', '/makers/gilly-louise-designs.jpg'),
  ('Golden Meadow Glow', '/makers/golden-meadow-glow.jpg'),
  ('Hammade banners', '/makers/hammade-banners.jpg'),
  ('Happy House of Bows', '/makers/happy-house-of-bows.jpg'),
  ('Happy Jellies', '/makers/happy-jellies.jpg'),
  ('InBloom Hat Studio', '/makers/inbloom-hat-studio.jpg'),
  ('Ivory Tides', '/makers/ivory-tides.jpg'),
  ('Just Embrace It', '/makers/just-embrace-it.jpg'),
  ('KALEIDOSTONE', '/makers/kaleidostone.jpg'),
  ('La Sirena Del Sol Jewelry', '/makers/la-sirena-del-sol-jewelry.jpg'),
  ('Larrea Cove', '/makers/larrea-cove.jpg'),
  ('Little Paper Prince', '/makers/little-paper-prince.jpg'),
  ('Little Sluggers', '/makers/little-sluggers.jpg'),
  ('Little Yoked Creations', '/makers/little-yoked-creations.jpg'),
  ('Little loom & co.', '/makers/little-loom-co.jpg'),
  ('Lucky 22 Spice Co', '/makers/lucky-22-spice-co.jpg'),
  ('Ludvika Resin', '/makers/ludvika-resin.jpg'),
  ('Madey Made Pottery Co.', '/makers/madey-made-pottery-co.jpg'),
  ('Matty Miller Studio', '/makers/matty-miller-studio.jpg'),
  ('Mertastic Jewelry Co.', '/makers/mertastic-jewelry-co.jpg'),
  ('Mudworks Creative Studio', '/makers/mudworks-creative-studio.jpg'),
  ('Musea Jewelry', '/makers/musea-jewelry.jpg'),
  ('Olive St Studio', '/makers/olive-st-studio.jpg'),
  ('On Board Organics', '/makers/on-board-organics.jpg'),
  ('One Cool Customer', '/makers/one-cool-customer.jpg'),
  ('Organic salts and soaks', '/makers/organic-salts-and-soaks.jpg'),
  ('Panache', '/makers/panache.jpg'),
  ('Paradigm Design', '/makers/paradigm-design.jpg'),
  ('Renewed Sewing', '/makers/renewed-sewing.jpg'),
  ('Roca Ceramics', '/makers/roca-ceramics.jpg'),
  ('SAGE + SEA', '/makers/sage-sea.jpg'),
  ('Sammy''s Ceramics', '/makers/sammy-s-ceramics.jpg'),
  ('Sensory Wonder', '/makers/sensory-wonder.jpg'),
  ('Silver Gypsea Studio', '/makers/silver-gypsea-studio.jpg'),
  ('Spurs & Saddles Co', '/makers/spurs-saddles-co.jpg'),
  ('SunWrapped', '/makers/sunwrapped.jpg'),
  ('Suttersisters charm bar, the charm bar & boutique', '/makers/suttersisters-charm-bar-the-charm-bar-boutique.jpg'),
  ('Tamra Copper LA', '/makers/tamra-copper-la.jpg'),
  ('The Felt Alchemy', '/makers/the-felt-alchemy.jpg'),
  ('The Flaky Apple Pie Co.', '/makers/the-flaky-apple-pie-co.jpg'),
  ('Think Play Magic', '/makers/think-play-magic.jpg'),
  ('Timka jewelry', '/makers/timka-jewelry.jpg'),
  ('Tiny Story Press', '/makers/tiny-story-press.jpg'),
  ('Toradi', '/makers/toradi.jpg'),
  ('Trophy Goods', '/makers/trophy-goods.jpg'),
  ('Wheelhouse Wood Works', '/makers/wheelhouse-wood-works.jpg'),
  ('Yoked Creations', '/makers/yoked-creations.jpg'),
  ('ocloveletters', '/makers/ocloveletters.jpg'),
  ('tash terra jewelry', '/makers/tash-terra-jewelry.jpg')
       ) AS m(shop, url)
 WHERE a.vendor_id = v.id
   AND lower(btrim(v.shop_name)) = lower(btrim(m.shop))
   AND a.show_id = (SELECT id FROM shows WHERE is_active = true LIMIT 1);
