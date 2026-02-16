alter table if exists public.avatar_effects
  add column if not exists rule_keeper_multiplier numeric not null default 1;

alter table if exists public.avatar_effects
  add column if not exists rule_breaker_multiplier numeric not null default 1;

alter table if exists public.avatar_effects
  add column if not exists skill_pulse_multiplier numeric not null default 1;

alter table if exists public.avatar_effects
  add column if not exists spotlight_multiplier numeric not null default 1;

alter table if exists public.avatar_effects
  add column if not exists daily_free_points integer not null default 0;

alter table if exists public.avatar_effects
  add column if not exists challenge_completion_bonus_pct numeric not null default 0;

alter table if exists public.avatar_effects
  add column if not exists mvp_bonus_pct numeric not null default 0;

alter table if exists public.ui_corner_borders
  add column if not exists rule_keeper_multiplier numeric not null default 1;

alter table if exists public.ui_corner_borders
  add column if not exists rule_breaker_multiplier numeric not null default 1;

alter table if exists public.ui_corner_borders
  add column if not exists skill_pulse_multiplier numeric not null default 1;

alter table if exists public.ui_corner_borders
  add column if not exists spotlight_multiplier numeric not null default 1;

alter table if exists public.ui_corner_borders
  add column if not exists daily_free_points integer not null default 0;

alter table if exists public.ui_corner_borders
  add column if not exists challenge_completion_bonus_pct numeric not null default 0;

alter table if exists public.ui_corner_borders
  add column if not exists mvp_bonus_pct numeric not null default 0;
