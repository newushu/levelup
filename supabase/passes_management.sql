-- Pass management extensions (pricing, discounts, registration, accounting).
-- Run in Supabase SQL editor.

alter table pass_types
  add column if not exists price_usd numeric(10,2),
  add column if not exists discount_price_usd numeric(10,2),
  add column if not exists discount_start date,
  add column if not exists discount_end date,
  add column if not exists access_scope text,
  add column if not exists default_valid_days integer,
  add column if not exists image_url text,
  add column if not exists image_text text,
  add column if not exists use_text boolean default false;

create table if not exists pass_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  pass_type_ids jsonb,
  amount_usd numeric(10,2),
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table student_passes
  add column if not exists payment_confirmed boolean default true,
  add column if not exists payment_id uuid references pass_payments(id) on delete set null;

create table if not exists pass_registrations (
  id uuid primary key default gen_random_uuid(),
  student_name text,
  email text,
  phone text,
  pass_type_ids jsonb,
  desired_start_date date,
  desired_end_date date,
  amount_cents integer,
  notes text,
  status text default 'pending',
  created_at timestamptz not null default now()
);
