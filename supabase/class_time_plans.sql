create table if not exists class_time_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists class_time_plan_sections (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references class_time_plans(id) on delete cascade,
  label text not null,
  duration_minutes integer not null default 5,
  color text not null default '#60a5fa',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_time_plan_sections_plan_idx on class_time_plan_sections(plan_id);

create table if not exists class_time_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references class_time_plans(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id),
  unique (plan_id, class_id)
);

create index if not exists class_time_plan_assignments_plan_idx on class_time_plan_assignments(plan_id);
create index if not exists class_time_plan_assignments_class_idx on class_time_plan_assignments(class_id);
