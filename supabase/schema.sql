-- Core schema for Reminded (Supabase Postgres)
-- Apply in Supabase SQL editor. This creates tables compatible with the current app.
--
-- Fresh reset (delete app data + RPCs, then recreate): run first
--   supabase/migrations/drop_reminded_tables_and_functions.sql
--
-- Existing project: if `courses` was created earlier without `user_id`, run first:
--   supabase/migrations/align_courses_user_id.sql

-- Lookup for student-setup + profile UI (client reads via anon/authenticated)
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

create table if not exists public.profiles (
  id uuid primary key,
  full_name text not null,
  email text unique not null,
  academic_level_id uuid null references public.academic_levels(id) on delete set null,
  program text null,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id bigserial primary key,
  course_name text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_materials (
  id bigserial primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  topic_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id bigserial primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  material_id bigint null references public.learning_materials(id) on delete set null,
  question_text text not null,
  choices jsonb not null,
  correct_answer text not null,
  bloom_level text null,
  created_at timestamptz not null default now()
);

create table if not exists public.student_progress (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id bigint not null references public.courses(id) on delete cascade,
  question_id bigint not null references public.questions(id) on delete cascade,
  interval integer not null default 0,
  ease_factor double precision not null default 2.5,
  next_review_date date null,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists idx_q_course on public.questions(course_id);
create index if not exists idx_q_material on public.questions(material_id);
create index if not exists idx_sp_user_course on public.student_progress(user_id, course_id);
create index if not exists idx_sp_user_review on public.student_progress(user_id, next_review_date);
create index if not exists idx_sp_user_course_review on public.student_progress(user_id, course_id, next_review_date);
create index if not exists idx_sp_question on public.student_progress(question_id);
create index if not exists idx_courses_user on public.courses(user_id);
create index if not exists idx_lm_course on public.learning_materials(course_id);

-- RPC helpers used by SupabaseQuizRepository

create or replace function public.get_due_questions(
  p_user_id uuid,
  p_course_id bigint,
  p_material_id bigint,
  p_today date,
  p_limit integer
)
returns table (
  id bigint,
  course_id bigint,
  material_id bigint,
  question_text text,
  choices jsonb,
  correct_answer text
)
language sql
stable
as $$
  select q.id, q.course_id, q.material_id, q.question_text, q.choices, q.correct_answer
  from public.student_progress sp
  join public.questions q on q.id = sp.question_id
  where sp.user_id = p_user_id
    and sp.course_id = p_course_id
    and sp.next_review_date is not null
    and sp.next_review_date <= p_today
    and (p_material_id is null or q.material_id = p_material_id)
  limit p_limit;
$$;

create or replace function public.get_new_questions(
  p_user_id uuid,
  p_course_id bigint,
  p_material_id bigint,
  p_limit integer
)
returns table (
  id bigint,
  course_id bigint,
  material_id bigint,
  question_text text,
  choices jsonb,
  correct_answer text
)
language sql
stable
as $$
  select q.id, q.course_id, q.material_id, q.question_text, q.choices, q.correct_answer
  from public.questions q
  where q.course_id = p_course_id
    and (p_material_id is null or q.material_id = p_material_id)
    and not exists (
      select 1
      from public.student_progress sp
      where sp.user_id = p_user_id and sp.question_id = q.id
    )
  limit p_limit;
$$;

create or replace function public.get_global_due_questions(
  p_user_id uuid,
  p_today date,
  p_limit integer
)
returns table (
  id bigint,
  course_id bigint,
  material_id bigint,
  question_text text,
  choices jsonb,
  correct_answer text,
  course_name text,
  topic_name text
)
language sql
stable
as $$
  select q.id,
         q.course_id,
         q.material_id,
         q.question_text,
         q.choices,
         q.correct_answer,
         c.course_name as course_name,
         coalesce(lm.topic_name, lm.file_name, 'Unknown') as topic_name
  from public.student_progress sp
  join public.questions q on q.id = sp.question_id
  join public.courses c on c.id = sp.course_id
  left join public.learning_materials lm on lm.id = q.material_id
  where sp.user_id = p_user_id
    and sp.next_review_date is not null
    and sp.next_review_date <= p_today
  order by sp.next_review_date asc
  limit p_limit;
$$;

create or replace function public.get_global_new_questions(
  p_user_id uuid,
  p_limit integer
)
returns table (
  id bigint,
  course_id bigint,
  material_id bigint,
  question_text text,
  choices jsonb,
  correct_answer text,
  course_name text,
  topic_name text
)
language sql
stable
as $$
  select q.id,
         q.course_id,
         q.material_id,
         q.question_text,
         q.choices,
         q.correct_answer,
         c.course_name as course_name,
         coalesce(lm.topic_name, lm.file_name, 'Unknown') as topic_name
  from public.questions q
  join public.courses c on c.id = q.course_id
  left join public.learning_materials lm on lm.id = q.material_id
  where c.user_id = p_user_id
    and not exists (
      select 1
      from public.student_progress sp
      where sp.user_id = p_user_id and sp.question_id = q.id
    )
  limit p_limit;
$$;

-- Extra RPC helpers used by course/material/dashboard read models

create or replace function public.count_new_questions_for_course(
  p_user_id uuid,
  p_course_id bigint
)
returns table (count bigint)
language sql
stable
as $$
  select count(*)::bigint as count
  from public.questions q
  where q.course_id = p_course_id
    and not exists (
      select 1 from public.student_progress sp
      where sp.user_id = p_user_id and sp.question_id = q.id
    );
$$;

create or replace function public.topic_due_counts(
  p_user_id uuid,
  p_course_id bigint,
  p_today date
)
returns table (material_id bigint, count bigint)
language sql
stable
as $$
  select q.material_id, count(*)::bigint as count
  from public.student_progress sp
  join public.questions q on q.id = sp.question_id
  where sp.user_id = p_user_id
    and sp.course_id = p_course_id
    and sp.next_review_date is not null
    and sp.next_review_date <= p_today
  group by q.material_id;
$$;

create or replace function public.topic_new_counts(
  p_user_id uuid,
  p_course_id bigint
)
returns table (material_id bigint, count bigint)
language sql
stable
as $$
  select q.material_id, count(*)::bigint as count
  from public.questions q
  where q.course_id = p_course_id
    and not exists (
      select 1 from public.student_progress sp
      where sp.user_id = p_user_id and sp.question_id = q.id
    )
  group by q.material_id;
$$;

create or replace function public.topic_has_progress(
  p_material_id bigint,
  p_user_id uuid
)
returns table (has_progress boolean)
language sql
stable
as $$
  select exists (
    select 1
    from public.student_progress sp
    join public.questions q on q.id = sp.question_id
    where q.material_id = p_material_id
      and sp.user_id = p_user_id
  ) as has_progress;
$$;

create or replace function public.dashboard_scheduled_counts(p_user_id uuid)
returns table (
  date date,
  course_id bigint,
  course_name text,
  material_id bigint,
  topic_name text,
  question_count bigint
)
language sql
stable
as $$
  select
    sp.next_review_date::date as date,
    c.id as course_id,
    c.course_name as course_name,
    q.material_id,
    coalesce(lm.topic_name, lm.file_name, 'Uncategorized') as topic_name,
    count(*)::bigint as question_count
  from public.student_progress sp
  join public.questions q on q.id = sp.question_id
  join public.courses c on c.id = sp.course_id
  left join public.learning_materials lm on lm.id = q.material_id
  where sp.user_id = p_user_id
    and sp.next_review_date is not null
  group by sp.next_review_date::date, c.id, q.material_id, lm.topic_name, lm.file_name, c.course_name
  order by sp.next_review_date::date asc;
$$;

create or replace function public.dashboard_new_counts(p_user_id uuid)
returns table (
  course_id bigint,
  course_name text,
  material_id bigint,
  topic_name text,
  question_count bigint
)
language sql
stable
as $$
  select
    c.id as course_id,
    c.course_name as course_name,
    q.material_id,
    coalesce(lm.topic_name, lm.file_name, 'Uncategorized') as topic_name,
    count(*)::bigint as question_count
  from public.questions q
  join public.courses c on c.id = q.course_id
  left join public.learning_materials lm on lm.id = q.material_id
  where c.user_id = p_user_id
    and not exists (
      select 1 from public.student_progress sp
      where sp.user_id = p_user_id and sp.question_id = q.id
    )
  group by c.id, q.material_id, lm.topic_name, lm.file_name, c.course_name;
$$;

create or replace function public.dashboard_due_by_course(
  p_user_id uuid,
  p_today date
)
returns table (
  course_id bigint,
  course_name text,
  count bigint
)
language sql
stable
as $$
  select c.id as course_id, c.course_name as course_name, count(*)::bigint as count
  from public.student_progress sp
  join public.questions q on q.id = sp.question_id
  join public.courses c on c.id = sp.course_id
  where sp.user_id = p_user_id
    and sp.next_review_date is not null
    and sp.next_review_date <= p_today
  group by c.id, c.course_name;
$$;

