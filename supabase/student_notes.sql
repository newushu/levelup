-- Student notes + coach todo list settings
-- Run in Supabase SQL editor.

create table if not exists student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  body text not null,
  category text not null default 'note',
  urgency text not null default 'medium',
  status text not null default 'open',
  created_by uuid,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists admin_note_settings (
  id int primary key default 1,
  todo_notify_email text,
  todo_notify_emails text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists student_notes_student_idx on student_notes(student_id, created_at desc);
create index if not exists student_notes_category_idx on student_notes(category, created_at desc);
create index if not exists student_notes_status_idx on student_notes(status, created_at desc);

alter table student_notes enable row level security;
alter table admin_note_settings enable row level security;

drop policy if exists "student_notes_select" on student_notes;
drop policy if exists "student_notes_write" on student_notes;
drop policy if exists "student_notes_insert" on student_notes;
drop policy if exists "student_notes_update" on student_notes;
drop policy if exists "student_notes_delete" on student_notes;
drop policy if exists "admin_note_settings_select" on admin_note_settings;
drop policy if exists "admin_note_settings_write" on admin_note_settings;

create policy "student_notes_select"
  on student_notes for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "student_notes_insert"
  on student_notes for insert
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "student_notes_update"
  on student_notes for update
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

create policy "student_notes_delete"
  on student_notes for delete
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "admin_note_settings_select"
  on admin_note_settings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "admin_note_settings_write"
  on admin_note_settings for all
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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'student_notes_category_check'
  ) then
    alter table student_notes
      add constraint student_notes_category_check
      check (category in ('note','todo'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'student_notes_urgency_check'
  ) then
    alter table student_notes
      add constraint student_notes_urgency_check
      check (urgency in ('low','medium','high','critical'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'student_notes_status_check'
  ) then
    alter table student_notes
      add constraint student_notes_status_check
      check (status in ('open','done'));
  end if;
end $$;

alter table admin_note_settings
  add column if not exists todo_notify_emails text[] not null default '{}';

alter table student_notes add column if not exists completed_by uuid;
alter table student_notes add column if not exists completed_at timestamptz;
