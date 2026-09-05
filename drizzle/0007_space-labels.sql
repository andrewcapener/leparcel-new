-- Space names: short on the left, dimensions in the caption.
--
-- 0005 spelled both dimensions into the label, which fixed the ambiguity and
-- lost the shorthand staff and returning makers actually use. The team asked
-- for both: "3x4" as the name, "4ft wide, 3ft deep" as the line beside it.
--
-- Safe to run twice.
UPDATE space_types SET label = '3x4',  description = '4ft wide, 3ft deep'  WHERE code = 'IN-3x4';
UPDATE space_types SET label = '3x6',  description = '6ft wide, 3ft deep'  WHERE code = 'IN-3x6';
UPDATE space_types SET label = '3x8',  description = '8ft wide, 3ft deep'  WHERE code = 'IN-3x8';
UPDATE space_types SET label = '3x12', description = '12ft wide, 3ft deep' WHERE code = 'IN-3x12';

-- The JR space still carried prime marks, which is the notation the rest of
-- this list just stopped using.
UPDATE space_types
   SET description = 'For makers 14 and under. 2ft wide, 3ft deep, shelf provided.'
 WHERE code = 'IN-JR'
   AND description = 'For makers 14 and under. 2'' wide, 3'' deep, shelf provided.';
