-- Run once if your `courses` table still has column `name` (older Reminded schema).
-- Safe to skip if you already have `course_name`.

alter table public.courses rename column name to course_name;
