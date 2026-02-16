alter table if exists public.ui_corner_borders
  add column if not exists limited_event_only boolean not null default false;

alter table if exists public.ui_corner_borders
  add column if not exists limited_event_name text not null default '';

alter table if exists public.ui_corner_borders
  add column if not exists limited_event_description text not null default '';
