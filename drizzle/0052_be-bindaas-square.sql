-- Be Bindaas, the last one.
--
-- Hillary, 25 Sept: "I have one last vendor! Be Bindaas finally paid, Friday.
-- I added her link and also the picture to the Friday straggler folder."
--
-- Same rules as 0048, 0049 and 0051: set as thumbnail_url, the staff
-- override, so nothing she uploaded herself is written over. Matched on the
-- normalised shop name and scoped to the active show.
--
-- Idempotent. Forward-only (rule 11).

UPDATE applications AS a
   SET thumbnail_url = m.url
  FROM vendors AS v,
       (VALUES
         ('bebindaas', '/makers/be-bindaas.jpg')   -- Be bindaas
       ) AS m(key, url)
 WHERE a.vendor_id = v.id
   AND regexp_replace(lower(v.shop_name), '[^a-z0-9]', '', 'g') = m.key
   AND a.show_id = (SELECT id FROM shows WHERE is_active = true LIMIT 1);
