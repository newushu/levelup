create table if not exists public.gift_auto_assignments (
  id uuid primary key default gen_random_uuid(),
  gift_item_id uuid not null references public.gift_items(id) on delete cascade,
  scope_type text not null check (scope_type in ('camp_secondary_role')),
  roster_id uuid references public.camp_display_rosters(id) on delete cascade,
  secondary_role text not null default '',
  day_codes text[] not null default '{}'::text[],
  time_et text not null default '16:00',
  start_date date,
  end_date date,
  qty integer not null default 1 check (qty >= 1),
  student_ids uuid[] not null default '{}'::uuid[],
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gift_item_id)
);

create index if not exists gift_auto_assignments_scope_idx
  on public.gift_auto_assignments(scope_type, enabled, roster_id);

create table if not exists public.gift_auto_assignment_runs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.gift_auto_assignments(id) on delete cascade,
  gift_item_id uuid not null references public.gift_items(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  run_key text not null,
  delivered_at timestamptz not null default now(),
  student_gift_id uuid references public.student_gifts(id) on delete set null,
  unique (assignment_id, student_id, run_key)
);

create index if not exists gift_auto_assignment_runs_assignment_idx
  on public.gift_auto_assignment_runs(assignment_id, delivered_at desc);

create index if not exists gift_auto_assignment_runs_student_idx
  on public.gift_auto_assignment_runs(student_id, delivered_at desc);
