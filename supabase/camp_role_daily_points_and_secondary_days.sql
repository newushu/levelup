alter table if exists public.camp_settings
  add column if not exists seller_daily_points integer not null default 300;

alter table if exists public.camp_settings
  add column if not exists cleaner_daily_points integer not null default 500;

update public.camp_settings
set seller_daily_points = coalesce(seller_daily_points, 300),
    cleaner_daily_points = coalesce(cleaner_daily_points, 500)
where id = 'default';

alter table if exists public.camp_display_members
  add column if not exists secondary_role_days text[] not null default '{}';

update public.camp_display_members
set secondary_role_days = '{}'
where secondary_role_days is null;
