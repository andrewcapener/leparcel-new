-- The outdoor tent is 6.5ft square, not 10ft.

-- Hillary caught this on the live site on opening day, in the price table on
-- /makers/outdoor and in the fee schedule on /agreement. All three outdoor days
-- carried "10ft wide, 10ft deep".
--
-- It is wrong twice over. The market's own prose two sections further down the
-- same page has always said "Our provided tents are 6.5 feet x 6.5 feet + 7.5
-- tall. A few 10x10's will be offered", and there is a $100 add-on, TENT_10X10,
-- whose whole purpose is to sell an upgrade to a 10 x 10. So the table was
-- promising, as standard, the thing the row underneath it charges to provide,
-- and an outdoor maker planning a display had the footprint more than twice
-- too large in both directions.
--
-- Height stays out of this column, as it does for every indoor space: the
-- column is a footprint, and 7.5ft tall is on the page and in the fact table.
--
-- Guarded on the wrong value, so a dimension corrected by hand at
-- /admin/shows is left alone.
UPDATE space_types SET dimensions = '6.5ft wide, 6.5ft deep'
 WHERE track = 'outdoor' AND dimensions = '10ft wide, 10ft deep';
