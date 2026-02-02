-- Performance Lab sessions (saved configurations)
-- Run in Supabase SQL editor.

create table if not exists performance_lab_sessions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  student_ids uuid[] not null default '{}',
  stat_ids uuid[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists performance_lab_sessions_created_idx on performance_lab_sessions(created_at desc);

alter table performance_lab_sessions enable row level security;

drop policy if exists "performance_lab_sessions_select" on performance_lab_sessions;
drop policy if exists "performance_lab_sessions_write" on performance_lab_sessions;

create policy "performance_lab_sessions_select"
  on performance_lab_sessions for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "performance_lab_sessions_write"
  on performance_lab_sessions for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );
