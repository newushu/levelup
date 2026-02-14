create table if not exists public.leaderboard_bonus_daily_snapshots (
  snapshot_date date not null,
  board_key text not null,
  student_id uuid not null references public.students(id) on delete cascade,
  board_points integer not null default 15,
  created_at timestamptz not null default now(),
  primary key (snapshot_date, board_key, student_id)
);

create index if not exists leaderboard_bonus_daily_snapshots_student_idx
  on public.leaderboard_bonus_daily_snapshots (student_id, snapshot_date desc);

alter table public.leaderboard_bonus_daily_snapshots enable row level security;

drop policy if exists "leaderboard_bonus_daily_snapshots_select" on public.leaderboard_bonus_daily_snapshots;
create policy "leaderboard_bonus_daily_snapshots_select"
  on public.leaderboard_bonus_daily_snapshots
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "leaderboard_bonus_daily_snapshots_write" on public.leaderboard_bonus_daily_snapshots;
create policy "leaderboard_bonus_daily_snapshots_write"
  on public.leaderboard_bonus_daily_snapshots
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );
