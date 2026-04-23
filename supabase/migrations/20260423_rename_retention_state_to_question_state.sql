-- Rename retention_state -> question_state (no drops, no data loss)
-- This aligns schema terminology with "question_state" while preserving existing values.

begin;

-- 1) Column rename (safe, preserves data)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_progress'
      and column_name = 'retention_state'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_progress'
      and column_name = 'question_state'
  ) then
    alter table public.student_progress
      rename column retention_state to question_state;
  end if;
end $$;

-- 2) Ensure check constraint references the new name (constraint name may remain historical)
alter table public.student_progress
  drop constraint if exists student_progress_retention_state_check;

alter table public.student_progress
  add constraint student_progress_question_state_check
  check (question_state in ('Learning', 'Familiar', 'Mastered'));

-- 3) Update RPC helpers to return / reference question_state
-- Postgres cannot change OUT-parameter row types via CREATE OR REPLACE,
-- so we must DROP the functions before recreating them.

drop function if exists public.get_due_questions(uuid, bigint, bigint, date, integer);
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
  correct_answer text,
  question_state text
)
language sql
stable
as $$
  select q.id, q.course_id, q.material_id, q.question_text, q.choices, q.correct_answer, sp.question_state
  from public.student_progress sp
  join public.questions q on q.id = sp.question_id
  where sp.user_id = p_user_id
    and sp.course_id = p_course_id
    and (sp.next_review_date is null or sp.next_review_date <= p_today)
    and (p_material_id is null or q.material_id = p_material_id)
  order by sp.next_review_date asc nulls first
  limit p_limit;
$$;

drop function if exists public.get_new_questions(uuid, bigint, bigint, integer);
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
  correct_answer text,
  question_state text
)
language sql
stable
as $$
  select q.id, q.course_id, q.material_id, q.question_text, q.choices, q.correct_answer, 'Learning'::text as question_state
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

drop function if exists public.get_global_due_questions(uuid, date, integer);
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
  topic_name text,
  question_state text
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
         coalesce(lm.topic_name, lm.file_name, 'Unknown') as topic_name,
         sp.question_state
  from public.student_progress sp
  join public.questions q on q.id = sp.question_id
  join public.courses c on c.id = sp.course_id
  left join public.learning_materials lm on lm.id = q.material_id
  where sp.user_id = p_user_id
    and (sp.next_review_date is null or sp.next_review_date <= p_today)
  order by sp.next_review_date asc nulls first
  limit p_limit;
$$;

drop function if exists public.get_global_new_questions(uuid, integer);
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
  topic_name text,
  question_state text
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
         coalesce(lm.topic_name, lm.file_name, 'Unknown') as topic_name,
         'Learning'::text as question_state
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

-- 4) Update due-count helpers (no need to expose question_state here, but keep consistent schema)
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
    and (sp.next_review_date is null or sp.next_review_date <= p_today)
  group by q.material_id;
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
    and (sp.next_review_date is null or sp.next_review_date <= p_today)
  group by c.id, c.course_name;
$$;

-- 5) Update apply_review_with_telemetry to persist question_state
create or replace function public.apply_review_with_telemetry (
  p_user_id uuid,
  p_course_id bigint,
  p_question_id bigint,
  p_response_latency double precision,
  p_is_correct boolean,
  p_quality_score_q integer,
  p_repetition_n integer,
  p_easiness_factor_ef double precision,
  p_next_interval_i integer,
  p_next_review_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ef1 double precision;
  v_ef2 double precision;
  v_avg_ef double precision;
  v_question_state text;
begin
  select l.easiness_factor_ef into v_ef1
  from public.review_telemetry_logs l
  where l.user_id = p_user_id and l.question_id = p_question_id
  order by l.created_at desc
  limit 1 offset 0;

  select l.easiness_factor_ef into v_ef2
  from public.review_telemetry_logs l
  where l.user_id = p_user_id and l.question_id = p_question_id
  order by l.created_at desc
  limit 1 offset 1;

  if p_repetition_n >= 3 then
    if v_ef1 is not null and v_ef2 is not null then
      v_avg_ef := (v_ef1 + v_ef2 + p_easiness_factor_ef) / 3.0;
    elsif v_ef1 is not null then
      v_avg_ef := (v_ef1 + p_easiness_factor_ef) / 2.0;
    else
      v_avg_ef := p_easiness_factor_ef;
    end if;

    if v_avg_ef > 2.5 then
      v_question_state := 'Mastered';
    elsif p_easiness_factor_ef >= 2.5 then
      v_question_state := 'Familiar';
    else
      v_question_state := 'Learning';
    end if;
  else
    if p_easiness_factor_ef >= 2.5 then
      v_question_state := 'Familiar';
    else
      v_question_state := 'Learning';
    end if;
  end if;

  insert into public.student_progress (
    user_id,
    course_id,
    question_id,
    interval,
    ease_factor,
    repetition_n,
    next_review_date,
    question_state
  )
  values (
    p_user_id,
    p_course_id,
    p_question_id,
    p_next_interval_i,
    p_easiness_factor_ef,
    p_repetition_n,
    p_next_review_date,
    v_question_state
  )
  on conflict (user_id, question_id) do update
  set
    course_id = excluded.course_id,
    interval = excluded.interval,
    ease_factor = excluded.ease_factor,
    repetition_n = excluded.repetition_n,
    next_review_date = excluded.next_review_date,
    question_state = excluded.question_state;

  insert into public.review_telemetry_logs (
    user_id,
    question_id,
    course_id,
    response_latency,
    is_correct,
    quality_score_q,
    repetition_n,
    easiness_factor_ef,
    next_interval_i
  )
  values (
    p_user_id,
    p_question_id,
    p_course_id,
    p_response_latency,
    p_is_correct,
    p_quality_score_q,
    p_repetition_n,
    p_easiness_factor_ef,
    p_next_interval_i
  );
end;
$$;

commit;

