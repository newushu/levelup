alter table if exists public.avatars
  add column if not exists challenge_completion_bonus_pct numeric(6,2) not null default 0;
