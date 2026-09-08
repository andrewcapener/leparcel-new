-- Row Level Security on every table. CLAUDE.md rule 12, finally.
--
-- Supabase flagged this the day after applications opened: "Anyone with your
-- project URL can read, edit, and delete all data in this table." That wording
-- assumes the usual arrangement, where the anon key ships to the browser
-- because the front end talks to PostgREST. This app does not: it connects
-- straight to Postgres over DATABASE_URL, the anon key appears nowhere in any
-- page, and an unauthenticated GET to /rest/v1/applications returns 401. So
-- nothing was exposed.
--
-- It was one leaked key away from everything, though. Every application, with
-- a name, an email, a phone number and an address, readable AND deletable by
-- whoever held it. The project ref is discoverable from the photo urls on the
-- site, so an attacker already knows the address to knock on.
--
-- **Why this is safe to run against a live application window.** Enabling RLS
-- with NO policies denies everything through PostgREST and changes nothing for
-- this app, because the app connects as `postgres`, which has BYPASSRLS.
-- Verified before writing this, not assumed:
--     SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user;
--     -> postgres, true
--
-- If a maker-facing login is ever built on Supabase Auth, this file is the
-- floor to add real per-vendor policies to. Until then, deny by default is the
-- correct policy, and it is the one that has been missing.
--
-- Idempotent and forward-only (CLAUDE.md rule 11).

-- 1 · Take the grants away first. This is the belt: it works whatever RLS
--     does, and it is what actually stops PostgREST, which checks grants
--     before it ever reaches a row policy. Guarded because the anon and
--     authenticated roles are a Supabase thing and do not exist locally.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END $$;

-- 2 · And braces: RLS on, no policies, so any role that is not BYPASSRLS sees
--     nothing at all. Every table in the schema rather than a list, so a table
--     added later cannot be quietly left out.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename <> '__migrations'   -- the runner's own ledger
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
