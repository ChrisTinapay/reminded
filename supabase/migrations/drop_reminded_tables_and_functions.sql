-- =============================================================================
-- DESTRUCTIVE: removes Reminded app data + RPCs from public schema.
-- =============================================================================
-- - Does NOT touch auth.users or other auth.* objects.
-- - Run in Supabase SQL Editor, then run supabase/schema.sql to recreate.
-- - All application data in these tables will be permanently deleted.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Drop RPCs defined in supabase/schema.sql (signatures must match Postgres)
-- -----------------------------------------------------------------------------
drop function if exists public.get_due_questions(uuid, bigint, bigint, date, integer) cascade;
drop function if exists public.get_new_questions(uuid, bigint, bigint, integer) cascade;
drop function if exists public.get_global_due_questions(uuid, date, integer) cascade;
drop function if exists public.get_global_new_questions(uuid, integer) cascade;
drop function if exists public.count_new_questions_for_course(uuid, bigint) cascade;
drop function if exists public.topic_due_counts(uuid, bigint, date) cascade;
drop function if exists public.topic_new_counts(uuid, bigint) cascade;
drop function if exists public.topic_has_progress(bigint, uuid) cascade;
drop function if exists public.dashboard_scheduled_counts(uuid) cascade;
drop function if exists public.dashboard_new_counts(uuid) cascade;
drop function if exists public.dashboard_due_by_course(uuid, date) cascade;

-- -----------------------------------------------------------------------------
-- 2) Drop application tables (FK-safe order; CASCADE handles stragglers)
-- -----------------------------------------------------------------------------
drop table if exists public.student_progress cascade;
drop table if exists public.questions cascade;
drop table if exists public.learning_materials cascade;
drop table if exists public.courses cascade;

-- profiles often referenced by courses; drop after dependents
drop table if exists public.profiles cascade;

-- Optional legacy lookup tables from earlier Reminded / Supabase setups
drop table if exists public.academic_levels cascade;
drop table if exists public.programs cascade;

-- -----------------------------------------------------------------------------
-- 3) If you added other public tables for this app, drop them here before
--    running schema.sql, e.g.:
-- drop table if exists public.my_other_table cascade;
-- -----------------------------------------------------------------------------
