-- Remove 'Retained' retention_state and migrate data to 'Mastered'

-- 1) migrate any existing values
update public.student_progress
set retention_state = 'Mastered'
where retention_state = 'Retained';

-- 2) tighten constraint
alter table public.student_progress
  drop constraint if exists student_progress_retention_state_check;

alter table public.student_progress
  add constraint student_progress_retention_state_check
  check (retention_state in ('Learning', 'Familiar', 'Mastered'));

-- 3) ensure apply_review_with_telemetry can never write 'Retained'
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
security definer
set search_path = public
language sql
as $apply_review_with_telemetry$
  with efs as (
    select
      (select l.easiness_factor_ef
       from public.review_telemetry_logs l
       where l.user_id = p_user_id and l.question_id = p_question_id
       order by l.created_at desc
       limit 1 offset 0) as ef1,
      (select l.easiness_factor_ef
       from public.review_telemetry_logs l
       where l.user_id = p_user_id and l.question_id = p_question_id
       order by l.created_at desc
       limit 1 offset 1) as ef2
  ),
  retention as (
    select
      case
        when p_repetition_n >= 3 then
          case
            when (
              (
                coalesce(ef1, 0) +
                coalesce(ef2, 0) +
                p_easiness_factor_ef
              ) /
              (
                case
                  when ef1 is null and ef2 is null then 1
                  when ef1 is null or ef2 is null then 2
                  else 3
                end
              )
            ) > 2.5 then 'Mastered'
            when p_easiness_factor_ef >= 2.5 then 'Familiar'
            else 'Learning'
          end
        else
          case when p_easiness_factor_ef >= 2.5 then 'Familiar' else 'Learning' end
      end as retention_state
    from efs
  ),
  upsert_progress as (
    insert into public.student_progress (
      user_id,
      course_id,
      question_id,
      interval,
      ease_factor,
      repetition_n,
      next_review_date,
      retention_state
    )
    select
      p_user_id,
      p_course_id,
      p_question_id,
      p_next_interval_i,
      p_easiness_factor_ef,
      p_repetition_n,
      p_next_review_date,
      (select retention_state from retention)
    on conflict (user_id, question_id) do update
    set
      course_id = excluded.course_id,
      interval = excluded.interval,
      ease_factor = excluded.ease_factor,
      repetition_n = excluded.repetition_n,
      next_review_date = excluded.next_review_date,
      retention_state = excluded.retention_state
    returning 1
  )
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
$apply_review_with_telemetry$;

