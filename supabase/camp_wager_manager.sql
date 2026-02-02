-- Camp Wager Manager schema
create extension if not exists "pgcrypto";

create table if not exists camp_wager_sessions (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists camp_wager_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references camp_wager_sessions(id) on delete cascade,
  name text not null,
  bankroll numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists camp_wager_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references camp_wager_sessions(id) on delete cascade,
  round_number int not null,
  blind numeric(12, 2) not null default 0,
  winner_player_id uuid references camp_wager_players(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, round_number)
);

create index if not exists camp_wager_players_session_idx on camp_wager_players(session_id);
create index if not exists camp_wager_rounds_session_idx on camp_wager_rounds(session_id);
