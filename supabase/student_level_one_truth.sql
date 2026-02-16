-- One source of truth for student level:
-- level is always derived from lifetime_points using avatar_level_thresholds
-- (or avatar_level_settings fallback if thresholds table is empty).

create or replace function public.compute_level_from_lifetime_points(p_lifetime_points integer)
returns integer
language plpgsql
stable
as $$
declare
  v_points integer := greatest(0, coalesce(p_lifetime_points, 0));
  v_level integer := 1;
  v_has_thresholds boolean := false;
  v_base_jump numeric := 50;
  v_difficulty_pct numeric := 8;
  r record;
begin
  select exists(select 1 from public.avatar_level_thresholds)
    into v_has_thresholds;

  if v_has_thresholds then
    for r in
      select level, min_lifetime_points
      from public.avatar_level_thresholds
      order by level asc
    loop
      if v_points >= coalesce(r.min_lifetime_points, 0) then
        v_level := greatest(1, coalesce(r.level, v_level));
      end if;
    end loop;
    return v_level;
  end if;

  select coalesce(base_jump, 50), coalesce(difficulty_pct, 8)
    into v_base_jump, v_difficulty_pct
  from public.avatar_level_settings
  where id = 1;

  for r in
    select
      gs as level,
      case
        when gs = 1 then 0
        else (round((v_base_jump * power(1 + (v_difficulty_pct / 100.0), gs - 1)) / 5.0) * 5.0)::integer
      end as min_points
    from generate_series(1, 99) gs
    order by gs asc
  loop
    if v_points >= coalesce(r.min_points, 0) then
      v_level := greatest(1, coalesce(r.level, v_level));
    end if;
  end loop;

  return v_level;
end;
$$;

create or replace function public.students_set_level_from_lifetime_points()
returns trigger
language plpgsql
as $$
begin
  new.level := public.compute_level_from_lifetime_points(new.lifetime_points);
  return new;
end;
$$;

drop trigger if exists trg_students_level_from_lifetime_points on public.students;
create trigger trg_students_level_from_lifetime_points
before insert or update of lifetime_points
on public.students
for each row
execute function public.students_set_level_from_lifetime_points();

-- Backfill all existing rows now.
update public.students s
set level = public.compute_level_from_lifetime_points(s.lifetime_points)
where coalesce(s.level, 1) <> public.compute_level_from_lifetime_points(s.lifetime_points);

-- Manual utility when thresholds/settings change:
create or replace function public.recompute_all_student_levels()
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
begin
  update public.students s
  set level = public.compute_level_from_lifetime_points(s.lifetime_points)
  where coalesce(s.level, 1) <> public.compute_level_from_lifetime_points(s.lifetime_points);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
