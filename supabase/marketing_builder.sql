-- Marketing builder schema
create extension if not exists "pgcrypto";

create table if not exists marketing_builder_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'email',
  data jsonb not null default '{}'::jsonb,
  theme_key text,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketing_builder_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'email',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketing_builder_projects_kind_idx on marketing_builder_projects(kind);
create index if not exists marketing_builder_projects_updated_idx on marketing_builder_projects(updated_at);
create index if not exists marketing_builder_projects_archived_idx on marketing_builder_projects(archived);
create index if not exists marketing_builder_themes_kind_idx on marketing_builder_themes(kind);

alter table if exists marketing_builder_projects
  add column if not exists theme_key text;

alter table if exists marketing_builder_projects
  add column if not exists updated_at timestamptz;

alter table if exists marketing_builder_projects
  alter column updated_at set default now();

alter table if exists marketing_builder_projects
  add column if not exists archived boolean;

alter table if exists marketing_builder_projects
  add column if not exists archived_at timestamptz;

alter table if exists marketing_builder_projects
  alter column archived set default false;

alter table if exists marketing_builder_themes
  add column if not exists data jsonb;
