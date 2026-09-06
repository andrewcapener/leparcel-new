-- The roster date, in a migration where it should have been.
--
-- Drew confirmed 28 September on 5 Sep 2026 and it went into the seed, but the
-- only thing that carried it to a running database was a consolidated script
-- pasted into the Supabase editor by hand. Production is right because of that
-- paste. Every other database is not: a local copy, a restore from a snapshot,
-- or a staging clone all still say 5 October, and the acceptance email, the
-- application page and the FAQ all read that date.
--
-- That is exactly the drift the build-time migrator exists to stop, so this is
-- the correction and the lesson: a change that has to reach a database belongs
-- in drizzle/, not in a message.
--
-- Guarded on the old value, so a later edit at /admin/show is left alone, and a
-- no-op against production, which already has it.
UPDATE shows SET roster_announced_on = '2026-09-28T12:00:00-07:00'
 WHERE roster_announced_on = '2026-10-05T12:00:00-07:00';
