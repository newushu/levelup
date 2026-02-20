create table if not exists public.student_skill_countdowns (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  source_type text not null check (source_type in ('skill_tree','skill_pulse','manual')),
  source_key text,
  source_label text not null,
  due_at timestamptz not null,
  penalty_points_per_day integer not null default 5 check (penalty_points_per_day >= 0),
  reward_points integer not null default 10 check (reward_points >= 0),
  charged_days integer not null default 0 check (charged_days >= 0),
  note text,
  enabled boolean not null default true,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid,
  last_penalty_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_skill_countdowns_student_idx
  on public.student_skill_countdowns(student_id, enabled, completed_at, due_at);

create index if not exists student_skill_countdowns_due_idx
  on public.student_skill_countdowns(enabled, completed_at, due_at);
