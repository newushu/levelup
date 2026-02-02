-- Admin to-do submissions from coaches
-- Run in Supabase SQL editor.

create table if not exists admin_todos (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'feature',
  title text,
  body text not null,
  urgency text not null default 'normal',
  student_id uuid references students(id) on delete set null,
  status text not null default 'open',
  created_by uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_todos_status_idx on admin_todos(status, created_at desc);

alter table admin_todos enable row level security;

drop policy if exists "admin_todos_select" on admin_todos;
drop policy if exists "admin_todos_insert" on admin_todos;
drop policy if exists "admin_todos_update" on admin_todos;
drop policy if exists "admin_todos_delete" on admin_todos;

create policy "admin_todos_select"
  on admin_todos for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.role = 'admin'
          or (ur.role = 'coach' and admin_todos.created_by = auth.uid())
        )
    )
  );

create policy "admin_todos_insert"
  on admin_todos for insert
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "admin_todos_update"
  on admin_todos for update
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "admin_todos_delete"
  on admin_todos for delete
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create or replace function admin_todos_kind_check()
returns void language plpgsql as $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'admin_todos_kind_check'
  ) then
    alter table admin_todos
      add constraint admin_todos_kind_check
      check (kind in ('feature','bug','other','todo'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'admin_todos_status_check'
  ) then
    alter table admin_todos
      add constraint admin_todos_status_check
      check (status in ('open','done'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'admin_todos_urgency_check'
  ) then
    alter table admin_todos
      add constraint admin_todos_urgency_check
      check (urgency in ('low','normal','high','urgent'));
  end if;
end;
$$;

select admin_todos_kind_check();
