-- Remove Bloom's taxonomy from questions
-- Safe to run once; column is nullable so dropping is straightforward.

alter table public.questions
  drop column if exists bloom_level;

