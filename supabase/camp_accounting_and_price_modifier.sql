-- Camp menu price modifier + accounting bootstrap

alter table if exists public.camp_menus
  add column if not exists price_modifier_pct numeric not null default 0;

alter table if exists public.camp_settings
  add column if not exists accounting_pin_hash text;

create table if not exists public.camp_accounting_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  student_name text not null,
  camp_type text not null check (camp_type in ('general','competition','overnight')),
  enrollment_by_day jsonb not null default '{}'::jsonb,
  lunch_by_day jsonb not null default '{}'::jsonb,
  lunch_item_by_day jsonb not null default '{}'::jsonb,
  lunch_price_by_day jsonb not null default '{}'::jsonb,
  manual_discount numeric not null default 0,
  payment_date date,
  payment_method text,
  paid_amount numeric not null default 0,
  fees_paid numeric not null default 0,
  payment_log jsonb not null default '[]'::jsonb,
  total_revenue numeric not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.camp_accounting_pricing (
  id text primary key default 'default',
  general_full_week numeric not null default 0,
  general_full_day numeric not null default 0,
  general_am numeric not null default 0,
  general_pm numeric not null default 0,
  general_enabled boolean not null default true,
  competition_full_week numeric not null default 0,
  competition_full_day numeric not null default 0,
  competition_am numeric not null default 0,
  competition_pm numeric not null default 0,
  competition_enabled boolean not null default true,
  overnight_per_day numeric not null default 0,
  overnight_full_week numeric not null default 0,
  overnight_enabled boolean not null default true,
  lunch_expenses numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_accounting_tabs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tab_type text not null check (tab_type in ('camp','normal_classes','events','testing','expenses')),
  accounting_year integer,
  accounting_season_id uuid,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_accounting_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


alter table if exists public.camp_accounting_pricing
  add column if not exists accounting_tab_id uuid references public.admin_accounting_tabs(id) on delete cascade;

alter table if exists public.camp_accounting_entries
  add column if not exists accounting_tab_id uuid references public.admin_accounting_tabs(id) on delete cascade;

create unique index if not exists camp_accounting_pricing_tab_uidx
  on public.camp_accounting_pricing(accounting_tab_id)
  where accounting_tab_id is not null;

create index if not exists camp_accounting_entries_tab_idx
  on public.camp_accounting_entries(accounting_tab_id, updated_at desc);

create table if not exists public.accounting_expenses (
  id uuid primary key default gen_random_uuid(),
  accounting_tab_id uuid not null references public.admin_accounting_tabs(id) on delete cascade,
  item text not null,
  amount numeric not null default 0,
  category text not null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounting_expenses_tab_idx
  on public.accounting_expenses(accounting_tab_id, updated_at desc);

alter table if exists public.camp_accounting_pricing
  add column if not exists general_enabled boolean not null default true;
alter table if exists public.camp_accounting_pricing
  add column if not exists competition_enabled boolean not null default true;
alter table if exists public.camp_accounting_pricing
  add column if not exists overnight_enabled boolean not null default true;
alter table if exists public.camp_accounting_pricing
  add column if not exists lunch_expenses numeric not null default 0;
alter table if exists public.camp_accounting_entries
  add column if not exists student_id uuid references public.students(id) on delete set null;
alter table if exists public.camp_accounting_entries
  add column if not exists lunch_item_by_day jsonb not null default '{}'::jsonb;
alter table if exists public.camp_accounting_entries
  add column if not exists paid_amount numeric not null default 0;
alter table if exists public.camp_accounting_entries
  add column if not exists payment_log jsonb not null default '[]'::jsonb;
alter table if exists public.admin_accounting_tabs
  add column if not exists accounting_year integer;
alter table if exists public.admin_accounting_tabs
  add column if not exists accounting_season_id uuid;

create index if not exists admin_accounting_tabs_year_season_idx
  on public.admin_accounting_tabs(accounting_year, accounting_season_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_accounting_tabs_season_fk'
  ) then
    alter table public.admin_accounting_tabs
      add constraint admin_accounting_tabs_season_fk
      foreign key (accounting_season_id) references public.admin_accounting_seasons(id) on delete set null;
  end if;
end
$$;

create index if not exists camp_accounting_entries_student_idx
  on public.camp_accounting_entries(student_id, updated_at desc);

-- Refresh PostgREST schema cache so newly added columns are immediately available.
select pg_notify('pgrst', 'reload schema');
