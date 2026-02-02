-- Camp menu + register schema.
-- Run in Supabase SQL editor.

create table if not exists camp_menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists camp_menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid references camp_menus(id) on delete cascade,
  name text not null,
  price_points integer not null default 0,
  allow_second boolean not null default false,
  second_price_points integer,
  image_url text,
  image_text text,
  use_text boolean default false,
  image_x integer,
  image_y integer,
  image_zoom integer,
  enabled boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists camp_accounts (
  student_id uuid primary key references students(id) on delete cascade,
  balance_points integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists camp_orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  student_name text,
  items jsonb not null,
  total_points integer not null default 0,
  discount_points integer,
  payments jsonb,
  coupons_used jsonb,
  paid_by text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists camp_order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references camp_orders(id) on delete cascade,
  refunded_points integer not null default 0,
  refunded_by uuid,
  refunded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (order_id)
);

create table if not exists camp_settings (
  id text primary key default 'default',
  daily_points integer not null default 0,
  helper_points integer not null default 0,
  camp_pin_hash text
);

create table if not exists camp_leaders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  start_date date not null,
  end_date date,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists camp_helper_entries (
  id uuid primary key default gen_random_uuid(),
  leader_student_id uuid references students(id) on delete set null,
  helper_student_id uuid references students(id) on delete set null,
  entry_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists camp_leader_awards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  award_date date not null,
  created_at timestamptz not null default now(),
  unique (student_id, award_date)
);

alter table students
  add column if not exists nfc_code text;

alter table camp_orders
  add column if not exists discount_points integer;

alter table camp_orders
  add column if not exists payments jsonb,
  add column if not exists coupons_used jsonb;

alter table camp_menu_items
  add column if not exists image_x integer,
  add column if not exists image_y integer,
  add column if not exists image_zoom integer;

create unique index if not exists camp_helper_entries_unique_helper_day
  on camp_helper_entries (helper_student_id, entry_date);

create unique index if not exists camp_helper_entries_unique_leader_day
  on camp_helper_entries (leader_student_id, entry_date, helper_student_id);

create table if not exists camp_coupon_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  coupon_type text not null,
  points_value integer,
  item_id uuid references camp_menu_items(id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists camp_student_coupons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  coupon_type_id uuid references camp_coupon_types(id) on delete cascade,
  remaining_qty integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, coupon_type_id)
);

create table if not exists camp_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  coupon_type_id uuid references camp_coupon_types(id) on delete set null,
  order_id uuid references camp_orders(id) on delete set null,
  qty integer not null default 1,
  redeemed_at timestamptz not null default now()
);

create table if not exists camp_student_auras (
  student_id uuid primary key references students(id) on delete cascade,
  aura_name text,
  discount_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
