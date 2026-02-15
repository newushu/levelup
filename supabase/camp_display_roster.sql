create extension if not exists pgcrypto;

create table if not exists public.camp_display_rosters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.camp_display_rosters
  add column if not exists start_date date;

alter table if exists public.camp_display_rosters
  add column if not exists end_date date;

update public.camp_display_rosters
set start_date = coalesce(start_date, (created_at at time zone 'utc')::date),
    end_date = coalesce(end_date, ((coalesce(start_date, (created_at at time zone 'utc')::date)) + interval '6 day')::date)
where start_date is null
   or end_date is null;

create table if not exists public.camp_display_groups (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.camp_display_rosters(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roster_id, name)
);

create table if not exists public.camp_display_members (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.camp_display_rosters(id) on delete cascade,
  group_id uuid references public.camp_display_groups(id) on delete set null,
  student_id uuid not null references public.students(id) on delete cascade,
  display_role text not null default 'camper',
  secondary_role text not null default '',
  faction_id uuid,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roster_id, student_id)
);

alter table if exists public.camp_display_members
  add column if not exists display_role text not null default 'camper';

alter table if exists public.camp_display_members
  add column if not exists secondary_role text not null default '';

alter table if exists public.camp_display_members
  add column if not exists faction_id uuid;

create table if not exists public.camp_factions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#38bdf8',
  icon text not null default '🏕️',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.camp_factions
  add column if not exists logo_url text;

alter table if exists public.camp_display_members
  drop constraint if exists camp_display_members_faction_id_fkey;

alter table if exists public.camp_display_members
  add constraint camp_display_members_faction_id_fkey
  foreign key (faction_id) references public.camp_factions(id) on delete set null;

create table if not exists public.camp_display_screens (
  id integer primary key,
  title text not null default '',
  roster_id uuid references public.camp_display_rosters(id) on delete set null,
  group_id uuid references public.camp_display_groups(id) on delete set null,
  show_all_groups boolean not null default true,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  check (id between 1 and 3)
);

create table if not exists public.camp_display_students (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  display_role text not null default 'camper',
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id)
);

create or replace function public.set_camp_display_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_camp_display_rosters_updated_at on public.camp_display_rosters;
create trigger trg_camp_display_rosters_updated_at
before update on public.camp_display_rosters
for each row execute function public.set_camp_display_updated_at();

drop trigger if exists trg_camp_display_groups_updated_at on public.camp_display_groups;
create trigger trg_camp_display_groups_updated_at
before update on public.camp_display_groups
for each row execute function public.set_camp_display_updated_at();

drop trigger if exists trg_camp_display_members_updated_at on public.camp_display_members;
create trigger trg_camp_display_members_updated_at
before update on public.camp_display_members
for each row execute function public.set_camp_display_updated_at();

drop trigger if exists trg_camp_display_screens_updated_at on public.camp_display_screens;
create trigger trg_camp_display_screens_updated_at
before update on public.camp_display_screens
for each row execute function public.set_camp_display_updated_at();

drop trigger if exists trg_camp_display_students_updated_at on public.camp_display_students;
create trigger trg_camp_display_students_updated_at
before update on public.camp_display_students
for each row execute function public.set_camp_display_updated_at();

drop trigger if exists trg_camp_factions_updated_at on public.camp_factions;
create trigger trg_camp_factions_updated_at
before update on public.camp_factions
for each row execute function public.set_camp_display_updated_at();

insert into public.camp_display_screens (id, title, show_all_groups, enabled)
values
  (1, 'Camp Display 1', true, true),
  (2, 'Camp Display 2', true, true),
  (3, 'Camp Display 3', true, true)
on conflict (id) do nothing;

alter table public.camp_display_rosters enable row level security;
alter table public.camp_display_groups enable row level security;
alter table public.camp_display_members enable row level security;
alter table public.camp_display_screens enable row level security;
alter table public.camp_display_students enable row level security;
alter table public.camp_factions enable row level security;

drop policy if exists "camp_display_rosters_select" on public.camp_display_rosters;
create policy "camp_display_rosters_select"
on public.camp_display_rosters
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "camp_display_groups_select" on public.camp_display_groups;
create policy "camp_display_groups_select"
on public.camp_display_groups
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "camp_display_members_select" on public.camp_display_members;
create policy "camp_display_members_select"
on public.camp_display_members
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "camp_display_screens_select" on public.camp_display_screens;
create policy "camp_display_screens_select"
on public.camp_display_screens
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "camp_display_students_select" on public.camp_display_students;
create policy "camp_display_students_select"
on public.camp_display_students
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "camp_factions_select" on public.camp_factions;
create policy "camp_factions_select"
on public.camp_factions
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "camp_display_rosters_write_admin_coach_camp" on public.camp_display_rosters;
create policy "camp_display_rosters_write_admin_coach_camp"
on public.camp_display_rosters
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
);

drop policy if exists "camp_display_groups_write_admin_coach_camp" on public.camp_display_groups;
create policy "camp_display_groups_write_admin_coach_camp"
on public.camp_display_groups
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
);

drop policy if exists "camp_display_members_write_admin_coach_camp" on public.camp_display_members;
create policy "camp_display_members_write_admin_coach_camp"
on public.camp_display_members
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
);

drop policy if exists "camp_display_screens_write_admin_coach_camp" on public.camp_display_screens;
create policy "camp_display_screens_write_admin_coach_camp"
on public.camp_display_screens
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
);

drop policy if exists "camp_display_students_write_admin_coach_camp" on public.camp_display_students;
create policy "camp_display_students_write_admin_coach_camp"
on public.camp_display_students
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
);

drop policy if exists "camp_factions_write_admin_coach_camp" on public.camp_factions;
create policy "camp_factions_write_admin_coach_camp"
on public.camp_factions
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'camp')
  )
);
