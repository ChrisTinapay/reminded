-- Run this if you already applied an older supabase/schema.sql without `academic_levels`
-- (e.g. student-setup dropdown is empty). Safe to run multiple times.

create table if not exists public.academic_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (name)
);

insert into public.academic_levels (name) values
  ('Senior High School'),
  ('College - Undergraduate'),
  ('College - Graduate'),
  ('Other')
on conflict (name) do nothing;

alter table public.academic_levels enable row level security;

drop policy if exists "Anyone can read academic_levels" on public.academic_levels;
create policy "Anyone can read academic_levels"
  on public.academic_levels
  for select
  to anon, authenticated
  using (true);

-- Optional FK (skip if it errors due to orphan academic_level_id values)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_academic_level_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_academic_level_id_fkey
      foreign key (academic_level_id) references public.academic_levels(id) on delete set null;
  end if;
exception
  when others then
    raise notice 'Could not add FK profiles.academic_level_id -> academic_levels: %', sqlerrm;
end $$;
