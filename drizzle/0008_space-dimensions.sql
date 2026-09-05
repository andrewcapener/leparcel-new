-- Size and advice, told apart.
--
-- `description` was carrying the size ("4ft wide, 3ft deep") because the size
-- was the only thing we were allowed to say. Elise wants both: the size as a
-- subheading under the space name, and a line about what the space is for.
-- They are different kinds of statement and they render differently, so they
-- are different columns.
--
-- Safe to run twice.
ALTER TABLE space_types ADD COLUMN IF NOT EXISTS dimensions text NOT NULL DEFAULT '';

COMMENT ON COLUMN space_types.dimensions IS
  'The measured size, e.g. "6ft wide, 3ft deep". Shown under the space name. A fact; `description` is the advice.';

-- The sizes move out of description and into their own column.
UPDATE space_types SET dimensions = '4ft wide, 3ft deep'  WHERE code = 'IN-3x4';
UPDATE space_types SET dimensions = '6ft wide, 3ft deep'  WHERE code = 'IN-3x6';
UPDATE space_types SET dimensions = '8ft wide, 3ft deep'  WHERE code = 'IN-3x8';
UPDATE space_types SET dimensions = '12ft wide, 3ft deep' WHERE code = 'IN-3x12';
UPDATE space_types SET dimensions = '2ft wide, 3ft deep'  WHERE code = 'IN-JR';
UPDATE space_types SET dimensions = '10ft wide, 10ft deep' WHERE code IN ('OUT-FRI','OUT-SAT','OUT-SUN');

-- Elise's descriptions, 5 Sep 2026. These reverse the earlier instruction to
-- carry no suitability advice; that instruction came before the team saw the
-- page, and this is the newer word.
UPDATE space_types SET description = 'For our makers 14 and under, to get them excited about being an entrepreneur. We provide the shelving. Only 6 chosen.'
 WHERE code = 'IN-JR';
UPDATE space_types SET description = '5 shelves given to each maker, a sliver of one big shelf you share. Suggested $12 and under.'
 WHERE code = 'IN-TREAT';
UPDATE space_types SET description = 'Our smallest option. Not used for apparel or art.'
 WHERE code = 'IN-3x4';
UPDATE space_types SET description = 'Our best seller. Not suggested for apparel unless you have great vertical space.'
 WHERE code = 'IN-3x6';
UPDATE space_types SET description = 'Our other best seller, and only a few are chosen. Great for apparel and end caps.'
 WHERE code = 'IN-3x8';
UPDATE space_types SET description = 'Limited, and best used for apparel.'
 WHERE code = 'IN-3x12';
UPDATE space_types SET description = 'We provide the tent. You run your own payments and keep 100%.'
 WHERE code IN ('OUT-FRI','OUT-SAT','OUT-SUN');

-- "Only 6 chosen" is an inventory statement, not just copy: the JR capacity
-- was 2, and the page would have advertised six spaces that could not be sold.
-- Spring 2026 ran eight of these (MM21 to MM28 in the team's sheet), so six is
-- a deliberate reduction rather than a correction. ⟨DECISION⟩ confirm with Drew.
UPDATE space_types SET capacity = 6 WHERE code = 'IN-JR' AND capacity <> 6;
