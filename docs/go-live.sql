-- ─────────────────────────────────────────────────────────────────────────────
-- Mermade Market · production go-live, before applications open 7 Sept 2026
--
-- Run in the Supabase SQL editor. Sections 1 and 2 only READ; nothing is
-- deleted until you run section 3, and section 3 shows you the count first.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 ·  Is the database on the current schema?
--      Every row should say 'yes'. A 'no' means migration 0002 has not run.
select 'add_ons table'            as thing,
       case when to_regclass('public.add_ons')        is null then 'no' else 'yes' end as present
union all
select 'booking_addons table',
       case when to_regclass('public.booking_addons') is null then 'no' else 'yes' end
union all
select 'shows.load_in_note',
       case when exists (select 1 from information_schema.columns
                         where table_name='shows' and column_name='load_in_note')
            then 'yes' else 'no' end
union all
select 'shows.takedown_note',
       case when exists (select 1 from information_schema.columns
                         where table_name='shows' and column_name='takedown_note')
            then 'yes' else 'no' end
union all
select 'bookings.addons_cents',
       case when exists (select 1 from information_schema.columns
                         where table_name='bookings' and column_name='addons_cents')
            then 'yes' else 'no' end
union all
select 'applications.requested_addons',
       case when exists (select 1 from information_schema.columns
                         where table_name='applications' and column_name='requested_addons')
            then 'yes' else 'no' end;


-- 2 ·  What is the active show promising the public right now?
select name, venue_name,
       applications_open_at, applications_close_at, roster_announced_on,
       hours_note, load_in_note, takedown_note,
       commission_bps / 100 as commission_pct, payment_window_hours,
       indoor_capacity, outdoor_capacity
from shows where is_active;

--      The spaces and add-ons the application form will offer.
select code, track, label, price_cents / 100 as price, capacity
from space_types
where show_id = (select id from shows where is_active)
order by sort_order;

select code, track, name, price_cents / 100 as price, is_limited
from add_ons
where show_id = (select id from shows where is_active)
order by sort_order;


-- 3 ·  Clear the test data.
--
--      Everything seeded or submitted during the build used an @example.com
--      address. Real applicants will not. Look at the counts first; if they
--      match what you expect, run the delete block below them.

select 'vendors'      as tbl, count(*) from vendors      where email like '%@example.com'
union all
select 'applications',        count(*) from applications
  where vendor_id in (select id from vendors where email like '%@example.com')
union all
select 'bookings',            count(*) from bookings
  where vendor_id in (select id from vendors where email like '%@example.com')
union all
select 'subscribers',         count(*) from subscribers  where email like '%@example.com'
union all
select 'email_outbox',        count(*) from email_outbox where to_email like '%@example.com';

--      ↓ uncomment and run once the counts above look right ↓
-- begin;
--   delete from booking_addons where booking_id in (
--     select id from bookings where vendor_id in (
--       select id from vendors where email like '%@example.com'));
--   delete from bookings     where vendor_id in (
--     select id from vendors where email like '%@example.com');
--   delete from audit_log    where entity = 'application' and entity_id in (
--     select id from applications where vendor_id in (
--       select id from vendors where email like '%@example.com'));
--   delete from applications where vendor_id in (
--     select id from vendors where email like '%@example.com');
--   delete from vendors      where email like '%@example.com';
--   delete from subscribers  where email like '%@example.com';
--   delete from email_outbox where to_email like '%@example.com';
-- commit;


-- 3b · One content fix that lives in data, not code.
--      Their price list qualifies the largest indoor space; ours seeded a
--      paraphrase. Bring production in line (or edit it at /admin/show).
update space_types
   set description = '1-2 makers will get this, apparel is great for this.'
 where code = 'IN-3x12'
   and show_id = (select id from shows where is_active);


-- 4 ·  After the delete, these should all be zero.
select 'vendors left'      as thing, count(*) from vendors      where email like '%@example.com'
union all
select 'applications left',          count(*) from applications
union all
select 'bookings left',              count(*) from bookings;
