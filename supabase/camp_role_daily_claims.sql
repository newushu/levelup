create extension if not exists pgcrypto;

create table if not exists public.student_camp_role_daily_claims (
  student_id uuid not null references public.students(id) on delete cascade,
  claim_date date not null,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (student_id, claim_date)
);

create index if not exists student_camp_role_daily_claims_student_date_idx
  on public.student_camp_role_daily_claims (student_id, claim_date desc);

alter table public.student_camp_role_daily_claims enable row level security;

drop policy if exists "student_camp_role_daily_claims_select_admin_coach" on public.student_camp_role_daily_claims;
create policy "student_camp_role_daily_claims_select_admin_coach"
on public.student_camp_role_daily_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'classroom')
  )
);

drop policy if exists "student_camp_role_daily_claims_insert_admin_coach" on public.student_camp_role_daily_claims;
create policy "student_camp_role_daily_claims_insert_admin_coach"
on public.student_camp_role_daily_claims
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach', 'classroom')
  )
);
