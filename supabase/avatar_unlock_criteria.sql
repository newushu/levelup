create table if not exists public.unlock_criteria_definitions (
  key text primary key,
  label text not null,
  description text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.unlock_criteria_item_requirements (
  id uuid primary key default gen_random_uuid(),
  item_type text not null,
  item_key text not null,
  criteria_key text not null references public.unlock_criteria_definitions(key) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_type, item_key, criteria_key)
);

create table if not exists public.student_unlock_criteria (
  student_id uuid not null references public.students(id) on delete cascade,
  criteria_key text not null references public.unlock_criteria_definitions(key) on delete cascade,
  fulfilled boolean not null default true,
  note text not null default '',
  fulfilled_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, criteria_key)
);

alter table if exists public.avatars
  add column if not exists limited_event_only boolean not null default false;

alter table if exists public.avatars
  add column if not exists limited_event_name text not null default '';

alter table if exists public.avatars
  add column if not exists limited_event_description text not null default '';

alter table if exists public.avatar_effects
  add column if not exists limited_event_only boolean not null default false;

alter table if exists public.avatar_effects
  add column if not exists limited_event_name text not null default '';

alter table if exists public.avatar_effects
  add column if not exists limited_event_description text not null default '';

create or replace function public.set_unlock_criteria_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_unlock_criteria_definitions_updated_at on public.unlock_criteria_definitions;
create trigger trg_unlock_criteria_definitions_updated_at
before update on public.unlock_criteria_definitions
for each row execute function public.set_unlock_criteria_updated_at();

drop trigger if exists trg_student_unlock_criteria_updated_at on public.student_unlock_criteria;
create trigger trg_student_unlock_criteria_updated_at
before update on public.student_unlock_criteria
for each row execute function public.set_unlock_criteria_updated_at();

alter table public.unlock_criteria_definitions enable row level security;
alter table public.unlock_criteria_item_requirements enable row level security;
alter table public.student_unlock_criteria enable row level security;

drop policy if exists "unlock_criteria_definitions_select" on public.unlock_criteria_definitions;
create policy "unlock_criteria_definitions_select"
on public.unlock_criteria_definitions
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "unlock_criteria_item_requirements_select" on public.unlock_criteria_item_requirements;
create policy "unlock_criteria_item_requirements_select"
on public.unlock_criteria_item_requirements
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "student_unlock_criteria_select" on public.student_unlock_criteria;
create policy "student_unlock_criteria_select"
on public.student_unlock_criteria
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "unlock_criteria_definitions_write_admin" on public.unlock_criteria_definitions;
create policy "unlock_criteria_definitions_write_admin"
on public.unlock_criteria_definitions
for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists "unlock_criteria_item_requirements_write_admin" on public.unlock_criteria_item_requirements;
create policy "unlock_criteria_item_requirements_write_admin"
on public.unlock_criteria_item_requirements
for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists "student_unlock_criteria_write_admin" on public.student_unlock_criteria;
create policy "student_unlock_criteria_write_admin"
on public.student_unlock_criteria
for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);
