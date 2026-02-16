alter table if exists public.unlock_criteria_definitions
  add column if not exists start_date date;

alter table if exists public.unlock_criteria_definitions
  add column if not exists end_date date;

alter table if exists public.unlock_criteria_definitions
  add column if not exists daily_free_points integer not null default 0;

create table if not exists public.student_event_daily_claims (
  student_id uuid not null references public.students(id) on delete cascade,
  criteria_key text not null references public.unlock_criteria_definitions(key) on delete cascade,
  claim_date date not null,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (student_id, criteria_key, claim_date)
);

create index if not exists student_event_daily_claims_student_date_idx
  on public.student_event_daily_claims (student_id, claim_date desc);

alter table public.student_event_daily_claims enable row level security;

drop policy if exists "student_event_daily_claims_select_admin_coach" on public.student_event_daily_claims;
create policy "student_event_daily_claims_select_admin_coach"
on public.student_event_daily_claims
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

drop policy if exists "student_event_daily_claims_insert_admin_coach" on public.student_event_daily_claims;
create policy "student_event_daily_claims_insert_admin_coach"
on public.student_event_daily_claims
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'coach')
  )
);
