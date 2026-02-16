alter table if exists public.challenges
  add column if not exists daily_limit_count integer;

alter table if exists public.challenges
  drop constraint if exists challenges_daily_limit_count_check;

alter table if exists public.challenges
  add constraint challenges_daily_limit_count_check
  check (daily_limit_count is null or daily_limit_count > 0);
