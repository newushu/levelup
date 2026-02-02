-- Battle MVP tracking.
-- Run in Supabase SQL editor.

create table if not exists battle_mvp_awards (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid references battle_trackers(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (battle_id, student_id)
);

create index if not exists battle_mvp_awards_student_id_idx
  on battle_mvp_awards (student_id);

alter table battle_mvp_awards
  drop constraint if exists battle_mvp_awards_battle_id_key;
