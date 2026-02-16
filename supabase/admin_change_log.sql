create extension if not exists pgcrypto;

create table if not exists public.admin_change_log (
  id uuid primary key default gen_random_uuid(),
  page text not null default '',
  category text not null default 'General',
  summary text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_change_log enable row level security;

drop policy if exists "admin_change_log_select_admin_coach" on public.admin_change_log;
create policy "admin_change_log_select_admin_coach"
on public.admin_change_log
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach')
  )
);

drop policy if exists "admin_change_log_write_admin_coach" on public.admin_change_log;
create policy "admin_change_log_write_admin_coach"
on public.admin_change_log
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach')
  )
);
