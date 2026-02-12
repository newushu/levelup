-- Taolu tracker + IWUF scoring schema
-- Run in Supabase SQL editor.

create table if not exists iwuf_age_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_age int,
  max_age int,
  created_at timestamptz not null default now()
);

create table if not exists iwuf_taolu_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age_group_id uuid references iwuf_age_groups(id) on delete set null,
  sections_count int not null default 4,
  video_links text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists iwuf_codes (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'taolu',
  code_number text not null,
  name text not null,
  description text,
  deduction_amount numeric(6,3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists iwuf_report_windows (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  days int not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists taolu_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  taolu_form_id uuid not null references iwuf_taolu_forms(id) on delete cascade,
  sections int[] not null default '{}',
  separate_sections boolean not null default false,
  created_at timestamptz not null default now(),
  coach_user_id uuid,
  ended_at timestamptz
);

create table if not exists taolu_deductions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references taolu_sessions(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  section_number int,
  note text,
  voided boolean not null default false,
  code_id uuid references iwuf_codes(id) on delete set null,
  assigned_by uuid,
  assigned_at timestamptz
);

create table if not exists taolu_remediations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references taolu_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  taolu_form_id uuid not null references iwuf_taolu_forms(id) on delete cascade,
  deduction_ids jsonb not null default '[]',
  points_awarded int not null default 0,
  completed_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists taolu_refinement_rounds (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  window_days int not null default 7,
  window_start timestamptz not null,
  window_end timestamptz not null,
  points_fixed int not null default 0,
  points_missed int not null default 0,
  points_new int not null default 0,
  points_net int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists taolu_refinement_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references taolu_refinement_rounds(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  taolu_form_id uuid not null references iwuf_taolu_forms(id) on delete cascade,
  section_number int not null,
  code_id uuid references iwuf_codes(id) on delete set null,
  code_number text,
  code_name text,
  status text not null default 'missed',
  deduction_ids jsonb not null default '[]',
  note_samples jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists taolu_refinement_deductions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  taolu_form_id uuid not null references iwuf_taolu_forms(id) on delete cascade,
  section_number int not null,
  code_id uuid references iwuf_codes(id) on delete set null,
  note text,
  occurred_at timestamptz not null default now(),
  kind text not null default 'missed',
  source_round_id uuid references taolu_refinement_rounds(id) on delete set null
);

create table if not exists preps_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  taolu_form_id uuid not null references iwuf_taolu_forms(id) on delete cascade,
  created_at timestamptz not null default now(),
  coach_user_id uuid,
  ended_at timestamptz
);

create table if not exists preps_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references preps_sessions(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  prep_key text,
  note text
);

create table if not exists preps_remediations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references preps_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  taolu_form_id uuid not null references iwuf_taolu_forms(id) on delete cascade,
  note_ids jsonb not null default '[]',
  points_awarded int not null default 0,
  completed_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists nfc_access_tags (
  id uuid primary key default gen_random_uuid(),
  label text,
  role text not null,
  code_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists access_permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null,
  allowed_roles text[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists route_permissions (
  id uuid primary key default gen_random_uuid(),
  route_path text not null,
  allowed_roles text[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table taolu_deductions add column if not exists section_number int;
alter table taolu_deductions add column if not exists note text;
alter table taolu_deductions add column if not exists voided boolean not null default false;

create index if not exists iwuf_taolu_forms_age_idx on iwuf_taolu_forms(age_group_id);
create index if not exists iwuf_codes_event_idx on iwuf_codes(event_type);
create index if not exists iwuf_report_windows_sort_idx on iwuf_report_windows(sort_order);
create index if not exists taolu_sessions_student_idx on taolu_sessions(student_id, created_at desc);
create index if not exists taolu_sessions_form_idx on taolu_sessions(taolu_form_id, created_at desc);
create index if not exists taolu_sessions_active_idx on taolu_sessions(ended_at);
create index if not exists taolu_deductions_session_idx on taolu_deductions(session_id, occurred_at desc);
create unique index if not exists taolu_remediations_session_idx on taolu_remediations(session_id);
create index if not exists taolu_refinement_rounds_student_idx on taolu_refinement_rounds(student_id, created_at desc);
create index if not exists taolu_refinement_items_round_idx on taolu_refinement_items(round_id);
create index if not exists taolu_refinement_deductions_student_idx on taolu_refinement_deductions(student_id, occurred_at desc);
create index if not exists preps_sessions_student_idx on preps_sessions(student_id, created_at desc);
create index if not exists preps_sessions_form_idx on preps_sessions(taolu_form_id, created_at desc);
create index if not exists preps_sessions_active_idx on preps_sessions(ended_at);
create index if not exists preps_notes_session_idx on preps_notes(session_id, occurred_at desc);
create unique index if not exists preps_remediations_session_idx on preps_remediations(session_id);
create unique index if not exists nfc_access_tags_code_idx on nfc_access_tags(code_hash);
create unique index if not exists access_permissions_key_idx on access_permissions(permission_key);
create unique index if not exists route_permissions_path_idx on route_permissions(route_path);

alter table iwuf_age_groups enable row level security;
alter table iwuf_taolu_forms enable row level security;
alter table iwuf_codes enable row level security;
alter table iwuf_report_windows enable row level security;
alter table taolu_sessions enable row level security;
alter table taolu_deductions enable row level security;
alter table taolu_remediations enable row level security;
alter table taolu_refinement_rounds enable row level security;
alter table taolu_refinement_items enable row level security;
alter table taolu_refinement_deductions enable row level security;
alter table preps_sessions enable row level security;
alter table preps_notes enable row level security;
alter table preps_remediations enable row level security;
alter table nfc_access_tags enable row level security;
alter table access_permissions enable row level security;
alter table route_permissions enable row level security;

alter table taolu_sessions add column if not exists ended_at timestamptz;

drop policy if exists "iwuf_age_groups_select" on iwuf_age_groups;
drop policy if exists "iwuf_age_groups_write" on iwuf_age_groups;
drop policy if exists "iwuf_forms_select" on iwuf_taolu_forms;
drop policy if exists "iwuf_forms_write" on iwuf_taolu_forms;
drop policy if exists "iwuf_codes_select" on iwuf_codes;
drop policy if exists "iwuf_codes_write" on iwuf_codes;
drop policy if exists "iwuf_report_windows_select" on iwuf_report_windows;
drop policy if exists "iwuf_report_windows_write" on iwuf_report_windows;
drop policy if exists "taolu_sessions_select" on taolu_sessions;
drop policy if exists "taolu_sessions_write" on taolu_sessions;
drop policy if exists "taolu_deductions_select" on taolu_deductions;
drop policy if exists "taolu_deductions_write" on taolu_deductions;
drop policy if exists "taolu_remediations_select" on taolu_remediations;
drop policy if exists "taolu_remediations_write" on taolu_remediations;
drop policy if exists "taolu_refinement_rounds_select" on taolu_refinement_rounds;
drop policy if exists "taolu_refinement_rounds_write" on taolu_refinement_rounds;
drop policy if exists "taolu_refinement_items_select" on taolu_refinement_items;
drop policy if exists "taolu_refinement_items_write" on taolu_refinement_items;
drop policy if exists "taolu_refinement_deductions_select" on taolu_refinement_deductions;
drop policy if exists "taolu_refinement_deductions_write" on taolu_refinement_deductions;
drop policy if exists "preps_sessions_select" on preps_sessions;
drop policy if exists "preps_sessions_write" on preps_sessions;
drop policy if exists "preps_notes_select" on preps_notes;
drop policy if exists "preps_notes_write" on preps_notes;
drop policy if exists "preps_remediations_select" on preps_remediations;
drop policy if exists "preps_remediations_write" on preps_remediations;
drop policy if exists "nfc_access_tags_select" on nfc_access_tags;
drop policy if exists "nfc_access_tags_write" on nfc_access_tags;
drop policy if exists "access_permissions_select" on access_permissions;
drop policy if exists "access_permissions_write" on access_permissions;
drop policy if exists "route_permissions_select" on route_permissions;
drop policy if exists "route_permissions_write" on route_permissions;

create policy "iwuf_age_groups_select"
  on iwuf_age_groups for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
    )
  );

create policy "iwuf_age_groups_write"
  on iwuf_age_groups for all
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

create policy "iwuf_forms_select"
  on iwuf_taolu_forms for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
    )
  );

create policy "iwuf_forms_write"
  on iwuf_taolu_forms for all
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

create policy "iwuf_codes_select"
  on iwuf_codes for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
    )
  );

create policy "iwuf_codes_write"
  on iwuf_codes for all
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

create policy "iwuf_report_windows_select"
  on iwuf_report_windows for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
    )
  );

create policy "iwuf_report_windows_write"
  on iwuf_report_windows for all
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

create policy "taolu_sessions_select"
  on taolu_sessions for select
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.role in ('admin','coach')
          or ur.student_id = taolu_sessions.student_id
        )
    )
  );

create policy "taolu_sessions_write"
  on taolu_sessions for all
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "taolu_deductions_select"
  on taolu_deductions for select
  using (
    exists (
      select 1
      from taolu_sessions ts
      join user_roles ur on ur.student_id = ts.student_id
      where ts.id = taolu_deductions.session_id
        and (
          ur.user_id = auth.uid()
          or exists (
            select 1 from user_roles ur2
            where ur2.user_id = auth.uid()
              and ur2.role in ('admin','coach')
          )
        )
    )
  );

create policy "taolu_deductions_write"
  on taolu_deductions for all
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "taolu_remediations_select"
  on taolu_remediations for select
  using (
    exists (
      select 1
      from taolu_sessions ts
      join user_roles ur on ur.student_id = ts.student_id
      where ts.id = taolu_remediations.session_id
        and (
          ur.user_id = auth.uid()
          or exists (
            select 1 from user_roles ur2
            where ur2.user_id = auth.uid()
              and ur2.role in ('admin','coach')
          )
        )
    )
  );

create policy "taolu_remediations_write"
  on taolu_remediations for all
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "taolu_refinement_rounds_select"
  on taolu_refinement_rounds for select
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "taolu_refinement_rounds_write"
  on taolu_refinement_rounds for all
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "taolu_refinement_items_select"
  on taolu_refinement_items for select
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "taolu_refinement_items_write"
  on taolu_refinement_items for all
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "taolu_refinement_deductions_select"
  on taolu_refinement_deductions for select
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "taolu_refinement_deductions_write"
  on taolu_refinement_deductions for all
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "preps_sessions_select"
  on preps_sessions for select
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.role in ('admin','coach')
          or ur.student_id = preps_sessions.student_id
        )
    )
  );

create policy "preps_sessions_write"
  on preps_sessions for all
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "preps_notes_select"
  on preps_notes for select
  using (
    exists (
      select 1
      from preps_sessions ps
      join user_roles ur on ur.student_id = ps.student_id
      where ps.id = preps_notes.session_id
        and (
          ur.user_id = auth.uid()
          or exists (
            select 1 from user_roles ur2
            where ur2.user_id = auth.uid()
              and ur2.role in ('admin','coach')
          )
        )
    )
  );

create policy "preps_notes_write"
  on preps_notes for all
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "preps_remediations_select"
  on preps_remediations for select
  using (
    exists (
      select 1
      from preps_sessions ps
      join user_roles ur on ur.student_id = ps.student_id
      where ps.id = preps_remediations.session_id
        and (
          ur.user_id = auth.uid()
          or exists (
            select 1 from user_roles ur2
            where ur2.user_id = auth.uid()
              and ur2.role in ('admin','coach')
          )
        )
    )
  );

create policy "preps_remediations_write"
  on preps_remediations for all
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "nfc_access_tags_select"
  on nfc_access_tags for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "nfc_access_tags_write"
  on nfc_access_tags for all
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

create policy "access_permissions_select"
  on access_permissions for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "access_permissions_write"
  on access_permissions for all
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

create policy "route_permissions_select"
  on route_permissions for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "route_permissions_write"
  on route_permissions for all
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

insert into access_permissions (permission_key, allowed_roles, description)
values
  ('admin_workspace', array['admin']::text[], 'Access to Admin Workspace via NFC'),
  ('roulette_confirm', array['admin','coach']::text[], 'Confirm prize wheel awards with NFC'),
  ('camp_access', array['admin','coach','camp']::text[], 'Access to camp tools via NFC')
on conflict (permission_key) do nothing;
