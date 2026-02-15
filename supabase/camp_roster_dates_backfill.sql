alter table if exists public.camp_display_rosters
  add column if not exists start_date date;

alter table if exists public.camp_display_rosters
  add column if not exists end_date date;

update public.camp_display_rosters
set start_date = coalesce(start_date, (created_at at time zone 'utc')::date),
    end_date = coalesce(end_date, ((coalesce(start_date, (created_at at time zone 'utc')::date)) + interval '6 day')::date)
where start_date is null
   or end_date is null;
