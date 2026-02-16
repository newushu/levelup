alter table if exists public.camp_menu_items
  add column if not exists visible_on_menu boolean not null default true;

alter table if exists public.camp_menu_items
  add column if not exists visible_on_pos boolean not null default true;

alter table if exists public.camp_menu_items
  add column if not exists sold_out boolean not null default false;
