-- SM-2 thesis telemetry: repetition streak column + immutable review log + atomic apply RPC

-- 1) student_progress: consecutive-correct streak (SM-2 repetition number n)
alter table public.student_progress
  add column if not exists repetition_n integer not null default 0;

comment on column public.student_progress.repetition_n is
  'SM-2 repetition counter n (consecutive successful reviews with q >= 3); resets to 0 on lapse.';

-- Best-effort backfill from legacy rows (interval-only history)
update public.student_progress
set repetition_n = case
  when coalesce(interval, 0) <= 0 then 0
  when interval = 1 then 1
  when interval >= 6 then 2
  else 0
end
where repetition_n = 0;

-- 2) Append-only telemetry (insert-only at application level; triggers enforce immutability)
create table if not exists public.review_telemetry_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id bigint not null references public.questions (id) on delete cascade,
  course_id bigint not null references public.courses (id) on delete cascade,
  response_latency double precision not null,
  is_correct boolean not null,
  quality_score_q integer not null,
  repetition_n integer not null,
  easiness_factor_ef double precision not null,
  next_interval_i integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rtl_user_created
  on public.review_telemetry_logs (user_id, created_at desc);

create index if not exists idx_rtl_question_created
  on public.review_telemetry_logs (question_id, created_at desc);

alter table public.review_telemetry_logs enable row level security;

comment on table public.review_telemetry_logs is
  'Append-only SM-2 execution log (one row per review transaction).';

-- 3) Enforce append-only semantics
create or replace function public.prevent_review_telemetry_mutation ()
returns trigger
language plpgsql
as $$
begin
  raise exception 'review_telemetry_logs is append-only';
end;
$$;

drop trigger if exists review_telemetry_logs_no_update on public.review_telemetry_logs;
create trigger review_telemetry_logs_no_update
  before update on public.review_telemetry_logs
  for each row
  execute procedure public.prevent_review_telemetry_mutation ();

drop trigger if exists review_telemetry_logs_no_delete on public.review_telemetry_logs;
create trigger review_telemetry_logs_no_delete
  before delete on public.review_telemetry_logs
  for each row
  execute procedure public.prevent_review_telemetry_mutation ();

-- 4) Atomic student_progress upsert + telemetry insert (single transaction)
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
begin
  insert into public.student_progress (
    user_id,
    course_id,
    question_id,
    interval,
    ease_factor,
    repetition_n,
    next_review_date
  )
  values (
    p_user_id,
    p_course_id,
    p_question_id,
    p_next_interval_i,
    p_easiness_factor_ef,
    p_repetition_n,
    p_next_review_date
  )
  on conflict (user_id, question_id) do update
  set
    course_id = excluded.course_id,
    interval = excluded.interval,
    ease_factor = excluded.ease_factor,
    repetition_n = excluded.repetition_n,
    next_review_date = excluded.next_review_date;

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

revoke all on function public.apply_review_with_telemetry (
  uuid, bigint, bigint, double precision, boolean, integer, integer, double precision, integer, date
) from public;

grant execute on function public.apply_review_with_telemetry (
  uuid, bigint, bigint, double precision, boolean, integer, integer, double precision, integer, date
) to service_role;
