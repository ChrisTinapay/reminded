-- Distractor logging: store the exact choice clicked per review event.

-- 1) Append-only telemetry log: add selected_answer column (per review event, not on questions).
alter table public.review_telemetry_logs
  add column if not exists selected_answer text;

-- 2) Extend atomic apply RPC to accept + persist selected_answer.
--    We drop the previous signature because Postgres cannot "replace" a function with a changed signature.
drop function if exists public.apply_review_with_telemetry(
  uuid, bigint, bigint, double precision, boolean, integer, integer, double precision, integer, date
);

create or replace function public.apply_review_with_telemetry (
  p_user_id uuid,
  p_course_id bigint,
  p_question_id bigint,
  p_response_latency double precision,
  p_is_correct boolean,
  p_quality_score_q integer,
  p_selected_answer text,
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
    selected_answer,
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
    p_selected_answer,
    p_repetition_n,
    p_easiness_factor_ef,
    p_next_interval_i
  );
end;
$$;

revoke all on function public.apply_review_with_telemetry(
  uuid, bigint, bigint, double precision, boolean, integer, text, integer, double precision, integer, date
) from public;

grant execute on function public.apply_review_with_telemetry(
  uuid, bigint, bigint, double precision, boolean, integer, text, integer, double precision, integer, date
) to service_role;

