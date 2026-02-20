-- Gift feature tables
create extension if not exists pgcrypto;

create table if not exists public.gift_designs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  preview_image_url text,
  html text,
  css text,
  js text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gift_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('item','points','discount','weapon','uniform','package')),
  category_tags text[] not null default '{}'::text[],
  gift_type text not null default 'generic',
  design_id uuid references public.gift_designs(id) on delete set null,
  design_image_url text,
  design_html text,
  design_css text,
  design_js text,
  points_value integer not null default 0,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.gift_items
  drop constraint if exists gift_items_category_check;
alter table if exists public.gift_items
  add constraint gift_items_category_check
  check (category in ('item','points','discount','weapon','uniform','package'));

alter table if exists public.gift_items
  add column if not exists category_tags text[] not null default '{}'::text[];

update public.gift_items
set category_tags = array[category]
where (category_tags is null or cardinality(category_tags) = 0)
  and category is not null;

create table if not exists public.student_gifts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  gift_item_id uuid not null references public.gift_items(id) on delete cascade,
  qty integer not null default 1 check (qty >= 0),
  opened_qty integer not null default 0 check (opened_qty >= 0),
  expires_at timestamptz,
  expired_at timestamptz,
  granted_by uuid,
  note text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.student_gifts
  add column if not exists expires_at timestamptz;

alter table if exists public.student_gifts
  add column if not exists expired_at timestamptz;

create index if not exists student_gifts_student_idx on public.student_gifts(student_id, created_at desc);
create index if not exists gift_items_enabled_idx on public.gift_items(enabled, created_at desc);

create table if not exists public.gift_open_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  student_gift_id uuid not null references public.student_gifts(id) on delete cascade,
  gift_item_id uuid not null references public.gift_items(id) on delete cascade,
  points_awarded integer not null default 0,
  points_before_open integer not null default 0,
  points_after_open integer not null default 0,
  opened_at timestamptz not null default now(),
  ledger_id uuid references public.ledger(id) on delete set null
);

alter table if exists public.gift_open_events
  add column if not exists points_before_open integer not null default 0;

alter table if exists public.gift_open_events
  add column if not exists points_after_open integer not null default 0;

create index if not exists gift_open_events_student_idx on public.gift_open_events(student_id, opened_at desc);

create table if not exists public.gift_package_components (
  id uuid primary key default gen_random_uuid(),
  package_gift_item_id uuid not null references public.gift_items(id) on delete cascade,
  component_order integer not null default 0,
  component_category text not null check (component_category in ('item','points','discount','weapon','uniform')),
  component_name text not null,
  component_points_value integer not null default 0,
  component_design_id uuid references public.gift_designs(id) on delete set null,
  component_design_image_url text,
  component_design_html text,
  component_design_css text,
  component_design_js text,
  component_qty integer not null default 1 check (component_qty >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gift_package_components_package_idx
  on public.gift_package_components(package_gift_item_id, component_order, created_at);

create table if not exists public.gift_feature_settings (
  id text primary key default 'default',
  student_button_design_id uuid references public.gift_designs(id) on delete set null,
  student_button_image_url text,
  student_button_emoji text not null default '🎁',
  updated_at timestamptz not null default now()
);
