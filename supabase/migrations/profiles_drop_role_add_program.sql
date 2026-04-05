-- Run if `profiles` still has legacy `role` / `program_id` (uuid) from an older schema.
-- Safe to run once after errors like: column "role" does not exist / invalid program_id type.

alter table public.profiles drop column if exists role;

alter table public.profiles add column if not exists program text;

-- Drop uuid program_id if present (program name is free text in the UI)
alter table public.profiles drop column if exists program_id;
