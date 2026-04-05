-- Reminded expects `public.courses.user_id` (uuid, FK to `public.profiles.id`).
-- Run this if your `courses` table already existed without that column, or if you used another name.

-- 1) Add the column when it is missing (safe to run if `user_id` already exists)
alter table public.courses add column if not exists user_id uuid references public.profiles(id);

create index if not exists idx_courses_user on public.courses(user_id);

-- 2) If you already added `student_id` from an older script, rename it once:
-- alter table public.courses rename column student_id to user_id;

-- 3) If your owner column has another name (e.g. `owner_id`), rename it to `user_id` and add the FK in the dashboard if needed.
