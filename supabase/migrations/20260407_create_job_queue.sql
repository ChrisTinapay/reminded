-- Job queue for background LLM processing (Gemini worker polls this table).
-- Safe to run multiple times.

create table if not exists public.job_queue (
  id bigserial primary key,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  type text not null default 'quiz_from_text',
  payload jsonb not null default '{}'::jsonb,
  result jsonb null,
  attempts integer not null default 0,
  last_error text null,
  locked_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_queue_status_created on public.job_queue(status, created_at);

-- Optional: RLS can remain disabled since worker uses service role key.
-- If you enable RLS later, ensure the service role can still read/update.

