create table if not exists public.staff_schedule_profiles (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  availability_hours text not null default '',
  services text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create or replace function public.set_staff_schedule_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_staff_schedule_profiles_updated_at on public.staff_schedule_profiles;
create trigger trg_staff_schedule_profiles_updated_at
before update on public.staff_schedule_profiles
for each row execute function public.set_staff_schedule_profiles_updated_at();

alter table public.staff_schedule_profiles enable row level security;

drop policy if exists "staff_schedule_profiles_select_admin_coach" on public.staff_schedule_profiles;
create policy "staff_schedule_profiles_select_admin_coach"
on public.staff_schedule_profiles
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

drop policy if exists "staff_schedule_profiles_write_admin" on public.staff_schedule_profiles;
create policy "staff_schedule_profiles_write_admin"
on public.staff_schedule_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

