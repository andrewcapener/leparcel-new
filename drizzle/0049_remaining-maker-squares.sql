-- The rest of Hillary's squares.
--
-- Nine images in her folder had no maker on the roster snapshot 0048 was
-- built from. Drew, 25 Sept: "Chick ticks are now on the roster, it is true.
-- so just do your best here and the girls will swap them."
--
-- So these go in on a best guess at the shop name. That is safe to do
-- blindly, because the match happens against the live database when this
-- runs: a name that exists gets its square, a name that does not is a silent
-- no-op. Several spellings are offered per image for the same reason, since
-- offering one that matches nothing costs nothing.
--
-- Matched on the shop name with punctuation and spacing removed, so
-- "Sweet'n Cloud Co." and "Sweetn Cloud Co" are the same maker. 0048 matched
-- on the trimmed name; this is looser on purpose, because these are the ones
-- whose exact spelling nobody is sure of.
--
-- Still the staff override, so nothing a maker uploaded is touched, and any
-- of these that lands on the wrong maker is one press of "Use theirs" in
-- /admin/thumbnails to undo.
--
-- Idempotent. Forward-only (rule 11).

UPDATE applications AS a
   SET thumbnail_url = m.url
  FROM vendors AS v,
       (VALUES
  ('chickticks', '/makers/chickticks.jpg'),  -- Chickticks
    ('alohanaacai', '/makers/alohana-acai.jpg'),  -- Alohana Acai
    ('alohana', '/makers/alohana-acai.jpg'),  -- Alohana
    ('alohanaacaibowls', '/makers/alohana-acai.jpg'),  -- Alohana Acai Bowls
    ('jcbeanscoffee', '/makers/jc-beans-coffee.jpg'),  -- JC Beans Coffee
    ('jcbeans', '/makers/jc-beans-coffee.jpg'),  -- JC Beans
    ('jcbeancoffee', '/makers/jc-beans-coffee.jpg'),  -- JC Bean Coffee
    ('minivalley', '/makers/minivalley.jpg'),  -- MINIVALLEY
    ('ohhappydayhairlounge', '/makers/oh-happy-day-hair-lounge.jpg'),  -- Oh Happy Day Hair Lounge
    ('ohhappyday', '/makers/oh-happy-day-hair-lounge.jpg'),  -- Oh Happy Day
    ('stixcones', '/makers/stix-cones.jpg'),  -- Stix & Cones
    ('stixcone', '/makers/stix-cones.jpg'),  -- Stix & Cone
    ('stixandcones', '/makers/stix-cones.jpg'),  -- Stix and Cones
    ('sweetncloudco', '/makers/sweet-n-cloud-co.jpg'),  -- Sweet'n Cloud Co.
    ('sutterboutique', '/makers/sutter-boutique.jpg'),  -- Sutter Boutique
    ('thecharmbarboutique', '/makers/sutter-boutique.jpg'),  -- The Charm Bar & Boutique
    ('charmbarboutique', '/makers/sutter-boutique.jpg')  -- Charm Bar & Boutique
       ) AS m(key, url)
 WHERE a.vendor_id = v.id
   AND regexp_replace(lower(v.shop_name), '[^a-z0-9]', '', 'g') = m.key
   AND a.show_id = (SELECT id FROM shows WHERE is_active = true LIMIT 1);
