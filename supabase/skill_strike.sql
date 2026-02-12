-- Skill Strike (card-based battle pulse mode)
-- Requires pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

create table if not exists public.skill_strike_settings (
  id uuid primary key default gen_random_uuid(),
  hp_default integer not null default 50,
  max_team_size integer not null default 4,
  max_effects_in_play integer not null default 3,
  updated_at timestamptz not null default now()
);

create table if not exists public.skill_strike_card_defs (
  id uuid primary key default gen_random_uuid(),
  card_type text not null check (card_type in ('attack','shield','negate','joker')),
  category text,
  damage integer,
  shield_value integer,
  copies integer not null default 0,
  image_url text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create unique index if not exists skill_strike_card_defs_unique
  on public.skill_strike_card_defs (card_type, coalesce(category,''), coalesce(damage,0), coalesce(shield_value,0));

create table if not exists public.skill_strike_skill_difficulty (
  skill_id uuid primary key,
  damage integer not null default 3,
  updated_at timestamptz not null default now()
);

create table if not exists public.skill_strike_games (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  status text not null default 'setup',
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create index if not exists skill_strike_games_status_idx on public.skill_strike_games (status);

create table if not exists public.skill_strike_game_logs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.skill_strike_games(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists skill_strike_game_logs_game_idx on public.skill_strike_game_logs (game_id);
