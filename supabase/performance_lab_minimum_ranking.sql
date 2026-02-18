alter table if exists public.stats
  add column if not exists minimum_value_for_ranking numeric not null default 0;
