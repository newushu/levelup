-- UI customization: sound effects + avatar catalog tweaks
-- Run in Supabase SQL editor.

create table if not exists ui_sound_effects (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label text not null,
  audio_url text,
  category text not null default 'effect',
  volume numeric(4,2) not null default 1,
  enabled boolean not null default true,
  loop boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ui_sound_effects_key_idx on ui_sound_effects(key);

alter table ui_sound_effects enable row level security;
alter table ui_sound_effects add column if not exists category text not null default 'effect';

drop policy if exists "ui_sound_effects_select" on ui_sound_effects;
drop policy if exists "ui_sound_effects_write" on ui_sound_effects;
drop policy if exists "ui_sound_effects_select_auth" on ui_sound_effects;

create policy "ui_sound_effects_select"
  on ui_sound_effects for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "ui_sound_effects_select_auth"
  on ui_sound_effects for select
  using (auth.uid() is not null);

create policy "ui_sound_effects_write"
  on ui_sound_effects for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create table if not exists ui_timer_settings (
  id integer primary key default 1,
  music_url text,
  end_sound_key text,
  ctf_image_url text,
  crack_a_bat_image_url text,
  fishy_fish_image_url text,
  cross_my_ocean_image_url text,
  siege_survive_image_url text,
  updated_at timestamptz not null default now()
);

alter table ui_timer_settings enable row level security;

drop policy if exists "ui_timer_settings_select" on ui_timer_settings;
drop policy if exists "ui_timer_settings_write" on ui_timer_settings;

create policy "ui_timer_settings_select"
  on ui_timer_settings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "ui_timer_settings_write"
  on ui_timer_settings for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create table if not exists ui_nav_settings (
  id integer primary key default 1,
  logo_url text,
  logo_zoom numeric not null default 1,
  updated_at timestamptz not null default now()
);

alter table ui_nav_settings enable row level security;

drop policy if exists "ui_nav_settings_select" on ui_nav_settings;
drop policy if exists "ui_nav_settings_select_auth" on ui_nav_settings;
drop policy if exists "ui_nav_settings_write" on ui_nav_settings;

create policy "ui_nav_settings_select"
  on ui_nav_settings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "ui_nav_settings_select_auth"
  on ui_nav_settings for select
  using (auth.uid() is not null);

create policy "ui_nav_settings_write"
  on ui_nav_settings for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create table if not exists ui_badge_overlay_settings (
  id integer primary key default 1,
  show_admin boolean not null default true,
  show_coach boolean not null default true,
  show_student boolean not null default true,
  show_classroom boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table ui_badge_overlay_settings enable row level security;

drop policy if exists "ui_badge_overlay_settings_select" on ui_badge_overlay_settings;
drop policy if exists "ui_badge_overlay_settings_write" on ui_badge_overlay_settings;

create policy "ui_badge_overlay_settings_select"
  on ui_badge_overlay_settings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "ui_badge_overlay_settings_write"
  on ui_badge_overlay_settings for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create table if not exists ui_display_settings (
  id integer primary key default 1,
  live_activity_enabled boolean not null default true,
  skill_pulse_enabled boolean not null default true,
  battle_pulse_enabled boolean not null default true,
  badges_enabled boolean not null default true,
  live_activity_types text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

alter table ui_display_settings enable row level security;

drop policy if exists "ui_display_settings_select" on ui_display_settings;
drop policy if exists "ui_display_settings_write" on ui_display_settings;

create policy "ui_display_settings_select"
  on ui_display_settings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach','display')
    )
  );

create policy "ui_display_settings_write"
  on ui_display_settings for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

alter table avatars add column if not exists is_secondary boolean not null default false;
alter table avatars add column if not exists unlock_level integer not null default 1;
alter table avatars add column if not exists unlock_points integer not null default 0;
alter table avatars add column if not exists rule_keeper_multiplier numeric(6,2) not null default 1;
alter table avatars add column if not exists rule_breaker_multiplier numeric(6,2) not null default 1;
alter table avatars add column if not exists skill_pulse_multiplier numeric(6,2) not null default 1;
alter table avatars add column if not exists spotlight_multiplier numeric(6,2) not null default 1;
alter table avatars add column if not exists daily_free_points integer not null default 0;
alter table avatars add column if not exists zoom_pct integer not null default 100;
alter table avatars add column if not exists competition_only boolean not null default false;
alter table avatars add column if not exists competition_discount_pct integer not null default 0;
alter table student_avatar_settings add column if not exists corner_border_key text;
alter table student_avatar_settings add column if not exists card_plate_key text;
alter table student_avatar_settings add column if not exists avatar_set_at timestamptz not null default now();
alter table student_avatar_settings add column if not exists avatar_daily_granted_at timestamptz;

alter table attendance_checkins add column if not exists instance_id uuid;
create index if not exists attendance_checkins_instance_idx on attendance_checkins (instance_id);
update attendance_checkins ac
  set instance_id = cs.instance_id
  from class_sessions cs
  where ac.instance_id is null
    and ac.session_id = cs.id
    and cs.instance_id is not null;

alter table tracker_skills add column if not exists base_name text;
alter table tracker_skills add column if not exists quality text;
alter table tracker_skills add column if not exists supplement text;
alter table tracker_skills add column if not exists landing text;
alter table tracker_skills add column if not exists rotation text;
alter table tracker_skills add column if not exists combo_key text;

alter table battle_trackers add column if not exists battle_mode text not null default 'duel';
alter table battle_trackers add column if not exists created_source text not null default 'admin';
alter table battle_trackers add column if not exists participant_ids uuid[] not null default '{}';
alter table battle_trackers add column if not exists team_a_ids uuid[] not null default '{}';
alter table battle_trackers add column if not exists team_b_ids uuid[] not null default '{}';
alter table skill_trackers add column if not exists created_source text not null default 'admin';
alter table skill_trackers add column if not exists points_per_rep integer;
alter table skill_tracker_logs add column if not exists created_by uuid;
alter table battle_tracker_logs add column if not exists created_by uuid;

create unique index if not exists tracker_skills_combo_key_idx
  on tracker_skills (combo_key)
  where combo_key is not null;

create or replace function prevent_skill_tracker_overlog()
returns trigger as $$
declare
  target int;
  current_count int;
begin
  select repetitions_target
    into target
    from skill_trackers
    where id = new.tracker_id
    for update;
  if target is null then
    return new;
  end if;

  select count(*) into current_count from skill_tracker_logs where tracker_id = new.tracker_id;
  if target > 0 and current_count >= target then
    return null;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_skill_tracker_overlog on skill_tracker_logs;
create trigger trg_prevent_skill_tracker_overlog
before insert on skill_tracker_logs
for each row
execute function prevent_skill_tracker_overlog();

create or replace function prevent_battle_tracker_overlog()
returns trigger as $$
declare
  target int;
  current_count int;
begin
  select repetitions_target
    into target
    from battle_trackers
    where id = new.battle_id
    for update;
  if target is null then
    return new;
  end if;

  select count(*) into current_count from battle_tracker_logs where battle_id = new.battle_id and student_id = new.student_id;
  if target > 0 and current_count >= target then
    return null;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_battle_tracker_overlog on battle_tracker_logs;
create trigger trg_prevent_battle_tracker_overlog
before insert on battle_tracker_logs
for each row
execute function prevent_battle_tracker_overlog();

create table if not exists tracker_skill_elements (
  id uuid primary key default gen_random_uuid(),
  element_type text not null,
  label text not null,
  is_skill_name boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tracker_skill_elements add column if not exists is_skill_name boolean not null default false;
update tracker_skill_elements
  set is_skill_name = true
  where element_type = 'name' and is_skill_name = false;

create unique index if not exists tracker_skill_elements_type_label_idx
  on tracker_skill_elements (element_type, lower(label));

alter table tracker_skill_elements enable row level security;

drop policy if exists "tracker_skill_elements_select" on tracker_skill_elements;
drop policy if exists "tracker_skill_elements_select_auth" on tracker_skill_elements;
drop policy if exists "tracker_skill_elements_write" on tracker_skill_elements;

create policy "tracker_skill_elements_select"
  on tracker_skill_elements for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "tracker_skill_elements_select_auth"
  on tracker_skill_elements for select
  using (auth.uid() is not null);

create policy "tracker_skill_elements_write"
  on tracker_skill_elements for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create table if not exists avatar_effects (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  unlock_level integer not null default 1,
  unlock_points integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  render_mode text not null default 'particles',
  html text,
  css text,
  js text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table avatar_effects add column if not exists unlock_level integer not null default 1;
alter table avatar_effects add column if not exists unlock_points integer not null default 0;
alter table avatar_effects add column if not exists config jsonb not null default '{}'::jsonb;
alter table avatar_effects add column if not exists render_mode text not null default 'particles';
alter table avatar_effects add column if not exists html text;
alter table avatar_effects add column if not exists css text;
alter table avatar_effects add column if not exists js text;

create unique index if not exists avatar_effects_key_idx on avatar_effects(key);

alter table avatar_effects enable row level security;

drop policy if exists "avatar_effects_select" on avatar_effects;
drop policy if exists "avatar_effects_select_auth" on avatar_effects;
drop policy if exists "avatar_effects_write" on avatar_effects;

create policy "avatar_effects_select"
  on avatar_effects for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "avatar_effects_select_auth"
  on avatar_effects for select
  using (auth.uid() is not null);

create policy "avatar_effects_write"
  on avatar_effects for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create table if not exists battle_pulse_effects (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  html text,
  css text,
  js text,
  effect_type text not null default 'attack',
  effect_types text not null default 'attack',
  offset_x integer not null default 0,
  offset_y integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists battle_pulse_effects_key_idx on battle_pulse_effects(key);

alter table battle_pulse_effects enable row level security;
alter table battle_pulse_effects add column if not exists effect_type text not null default 'attack';
alter table battle_pulse_effects add column if not exists effect_types text not null default 'attack';
alter table battle_pulse_effects add column if not exists offset_x integer not null default 0;
alter table battle_pulse_effects add column if not exists offset_y integer not null default 0;

drop policy if exists "battle_pulse_effects_select" on battle_pulse_effects;
drop policy if exists "battle_pulse_effects_write" on battle_pulse_effects;

create policy "battle_pulse_effects_select"
  on battle_pulse_effects for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach','display')
    )
  );

create policy "battle_pulse_effects_write"
  on battle_pulse_effects for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create table if not exists ui_corner_borders (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  image_url text,
  render_mode text not null default 'image',
  offset_x integer not null default 0,
  offset_y integer not null default 0,
  html text,
  css text,
  js text,
  unlock_level integer not null default 1,
  unlock_points integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ui_corner_borders add column if not exists unlock_level integer not null default 1;
alter table ui_corner_borders add column if not exists unlock_points integer not null default 0;
alter table ui_corner_borders add column if not exists render_mode text not null default 'image';
alter table ui_corner_borders add column if not exists offset_x integer not null default 0;
alter table ui_corner_borders add column if not exists offset_y integer not null default 0;
alter table ui_corner_borders add column if not exists offsets_by_context jsonb not null default '{}'::jsonb;
alter table ui_corner_borders add column if not exists html text;
alter table ui_corner_borders add column if not exists css text;
alter table ui_corner_borders add column if not exists js text;

create unique index if not exists ui_corner_borders_key_idx on ui_corner_borders(key);

alter table ui_corner_borders enable row level security;

drop policy if exists "ui_corner_borders_select" on ui_corner_borders;
drop policy if exists "ui_corner_borders_select_auth" on ui_corner_borders;
drop policy if exists "ui_corner_borders_write" on ui_corner_borders;

create policy "ui_corner_borders_select"
  on ui_corner_borders for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "ui_corner_borders_select_auth"
  on ui_corner_borders for select
  using (auth.uid() is not null);

create policy "ui_corner_borders_write"
  on ui_corner_borders for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create table if not exists avatar_level_thresholds (
  level integer primary key,
  min_lifetime_points integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists avatar_level_settings (
  id integer primary key default 1,
  base_jump integer not null default 50,
  difficulty_pct integer not null default 8,
  updated_at timestamptz not null default now()
);

create table if not exists ui_corner_border_positions (
  id integer primary key default 1,
  dashboard_x integer not null default -8,
  dashboard_y integer not null default -8,
  dashboard_size integer not null default 88,
  selector_x integer not null default -8,
  selector_y integer not null default -8,
  selector_size integer not null default 84,
  skill_pulse_x integer not null default -10,
  skill_pulse_y integer not null default -10,
  skill_pulse_size integer not null default 72,
  skill_pulse_tracker_x integer not null default -10,
  skill_pulse_tracker_y integer not null default -10,
  skill_pulse_tracker_size integer not null default 72,
  live_activity_x integer not null default -10,
  live_activity_y integer not null default -10,
  live_activity_size integer not null default 72,
  roster_x integer not null default -8,
  roster_y integer not null default -8,
  roster_size integer not null default 96,
  updated_at timestamptz not null default now()
);

alter table ui_corner_border_positions add column if not exists dashboard_size integer not null default 88;
alter table ui_corner_border_positions add column if not exists selector_size integer not null default 84;
alter table ui_corner_border_positions add column if not exists skill_pulse_size integer not null default 72;
alter table ui_corner_border_positions add column if not exists skill_pulse_tracker_x integer not null default -10;
alter table ui_corner_border_positions add column if not exists skill_pulse_tracker_y integer not null default -10;
alter table ui_corner_border_positions add column if not exists skill_pulse_tracker_size integer not null default 72;
alter table ui_corner_border_positions add column if not exists live_activity_size integer not null default 72;
alter table ui_corner_border_positions add column if not exists roster_size integer not null default 96;
alter table ui_corner_border_positions enable row level security;

drop policy if exists "ui_corner_border_positions_select" on ui_corner_border_positions;
drop policy if exists "ui_corner_border_positions_write" on ui_corner_border_positions;

create policy "ui_corner_border_positions_select"
  on ui_corner_border_positions for select
  using (auth.uid() is not null);

create policy "ui_corner_border_positions_write"
  on ui_corner_border_positions for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create table if not exists ui_card_plate_borders (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  image_url text,
  unlock_level integer not null default 1,
  unlock_points integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ui_card_plate_borders_key_idx on ui_card_plate_borders(key);

alter table ui_card_plate_borders enable row level security;

drop policy if exists "ui_card_plate_borders_select" on ui_card_plate_borders;
drop policy if exists "ui_card_plate_borders_select_auth" on ui_card_plate_borders;
drop policy if exists "ui_card_plate_borders_write" on ui_card_plate_borders;

create policy "ui_card_plate_borders_select"
  on ui_card_plate_borders for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "ui_card_plate_borders_select_auth"
  on ui_card_plate_borders for select
  using (auth.uid() is not null);

create policy "ui_card_plate_borders_write"
  on ui_card_plate_borders for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create table if not exists ui_card_plate_positions (
  id integer primary key default 1,
  dashboard_x integer not null default 0,
  dashboard_y integer not null default 0,
  dashboard_size integer not null default 200,
  selector_x integer not null default 0,
  selector_y integer not null default 0,
  selector_size integer not null default 200,
  skill_pulse_x integer not null default 0,
  skill_pulse_y integer not null default 0,
  skill_pulse_size integer not null default 200,
  skill_pulse_tracker_x integer not null default 0,
  skill_pulse_tracker_y integer not null default 0,
  skill_pulse_tracker_size integer not null default 120,
  live_activity_x integer not null default 0,
  live_activity_y integer not null default 0,
  live_activity_size integer not null default 200,
  roster_x integer not null default 0,
  roster_y integer not null default 0,
  roster_size integer not null default 220,
  taolu_tracker_x integer not null default 0,
  taolu_tracker_y integer not null default 0,
  taolu_tracker_size integer not null default 220,
  battle_pulse_x integer not null default 0,
  battle_pulse_y integer not null default 0,
  battle_pulse_size integer not null default 240,
  updated_at timestamptz not null default now()
);

alter table ui_card_plate_positions add column if not exists skill_pulse_tracker_x integer not null default 0;
alter table ui_card_plate_positions add column if not exists skill_pulse_tracker_y integer not null default 0;
alter table ui_card_plate_positions add column if not exists skill_pulse_tracker_size integer not null default 120;
alter table ui_card_plate_positions enable row level security;

drop policy if exists "ui_card_plate_positions_select" on ui_card_plate_positions;
drop policy if exists "ui_card_plate_positions_write" on ui_card_plate_positions;

create policy "ui_card_plate_positions_select"
  on ui_card_plate_positions for select
  using (auth.uid() is not null);

create policy "ui_card_plate_positions_write"
  on ui_card_plate_positions for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create table if not exists student_custom_unlocks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  item_type text not null,
  item_key text not null,
  unlocked_at timestamptz not null default now()
);

create unique index if not exists student_custom_unlocks_idx
  on student_custom_unlocks (student_id, item_type, item_key);

alter table student_custom_unlocks enable row level security;

drop policy if exists "student_custom_unlocks_select" on student_custom_unlocks;
drop policy if exists "student_custom_unlocks_write" on student_custom_unlocks;

create policy "student_custom_unlocks_select"
  on student_custom_unlocks for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach','display')
    )
  );

create policy "student_custom_unlocks_write"
  on student_custom_unlocks for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach','display')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach','display')
    )
  );

alter table avatar_level_thresholds enable row level security;
alter table avatar_level_settings enable row level security;

alter table challenges add column if not exists data_point_key text;
alter table challenges add column if not exists data_point_window_days int;
alter table challenges add column if not exists points_awarded int;
alter table ledger add column if not exists points_base integer;
alter table ledger add column if not exists points_multiplier numeric(6,2);
alter table achievement_badges add column if not exists icon_zoom numeric not null default 1;
alter table skills add column if not exists bound_stat_id uuid;
alter table skills add column if not exists bound_stat_operator text;
alter table skills add column if not exists bound_stat_value_min numeric;
alter table skills add column if not exists bound_stat_value_max numeric;
alter table skills add column if not exists bound_tracker_skill_id uuid;

create table if not exists video_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  categories text[] not null default '{}',
  levels text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table video_library add column if not exists categories text[] not null default '{}';
alter table video_library add column if not exists levels text[] not null default '{}';

alter table video_library enable row level security;

drop policy if exists "video_library_select" on video_library;
drop policy if exists "video_library_admin_write" on video_library;

create policy "video_library_select"
  on video_library for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "video_library_admin_write"
  on video_library for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create table if not exists season_settings (
  id integer primary key default 1,
  name text not null default 'Season',
  start_date date,
  weeks integer not null default 10,
  updated_at timestamptz not null default now()
);

create table if not exists leaderboard_bonus_settings (
  id integer primary key default 1,
  total_points integer not null default 0,
  skill_pulse_points integer not null default 0,
  performance_lab_points integer not null default 0,
  skill_tracker_points_per_rep integer not null default 2,
  updated_at timestamptz not null default now()
);

create table if not exists student_leaderboard_bonus_grants (
  student_id uuid primary key references students(id) on delete cascade,
  last_granted_at timestamptz
);

create table if not exists roulette_wheels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wheel_type text not null default 'prize',
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roulette_segments (
  id uuid primary key default gen_random_uuid(),
  wheel_id uuid not null references roulette_wheels(id) on delete cascade,
  label text not null,
  segment_type text not null default 'points_add',
  points_value integer not null default 0,
  prize_text text,
  item_key text,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roulette_spins (
  id uuid primary key default gen_random_uuid(),
  wheel_id uuid not null references roulette_wheels(id) on delete cascade,
  segment_id uuid not null references roulette_segments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  result_type text not null,
  points_delta integer not null default 0,
  prize_text text,
  item_key text,
  confirmed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists roulette_segments_wheel_idx
  on roulette_segments (wheel_id, sort_order);

create index if not exists roulette_spins_student_idx
  on roulette_spins (student_id, created_at desc);

create table if not exists lesson_forge_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lesson_forge_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references lesson_forge_templates(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lesson_forge_section_tools (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references lesson_forge_sections(id) on delete cascade,
  tool_type text not null,
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lesson_forge_section_titles (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists lesson_forge_plans (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references lesson_forge_templates(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  session_start_date date,
  session_end_date date,
  session_date date,
  week_index integer not null default 1,
  week_label text,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lesson_forge_plan_sections (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references lesson_forge_plans(id) on delete cascade,
  section_order integer not null default 0,
  section_title text not null,
  entry text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_forge_sections_template_idx
  on lesson_forge_sections (template_id, sort_order);

create index if not exists lesson_forge_section_tools_section_idx
  on lesson_forge_section_tools (section_id, sort_order);

create index if not exists lesson_forge_plans_template_idx
  on lesson_forge_plans (template_id, session_date);

create index if not exists lesson_forge_plan_sections_plan_idx
  on lesson_forge_plan_sections (plan_id, section_order);

alter table lesson_forge_templates enable row level security;
alter table lesson_forge_sections enable row level security;
alter table lesson_forge_section_tools enable row level security;
alter table lesson_forge_section_titles enable row level security;
alter table lesson_forge_plans enable row level security;
alter table lesson_forge_plan_sections enable row level security;

drop policy if exists "lesson_forge_templates_select" on lesson_forge_templates;
drop policy if exists "lesson_forge_templates_write" on lesson_forge_templates;
drop policy if exists "lesson_forge_sections_select" on lesson_forge_sections;
drop policy if exists "lesson_forge_sections_write" on lesson_forge_sections;
drop policy if exists "lesson_forge_section_tools_select" on lesson_forge_section_tools;
drop policy if exists "lesson_forge_section_tools_write" on lesson_forge_section_tools;
drop policy if exists "lesson_forge_section_titles_select" on lesson_forge_section_titles;
drop policy if exists "lesson_forge_section_titles_write" on lesson_forge_section_titles;
drop policy if exists "lesson_forge_plans_select" on lesson_forge_plans;
drop policy if exists "lesson_forge_plans_write" on lesson_forge_plans;
drop policy if exists "lesson_forge_plan_sections_select" on lesson_forge_plan_sections;
drop policy if exists "lesson_forge_plan_sections_write" on lesson_forge_plan_sections;

create policy "lesson_forge_templates_select"
  on lesson_forge_templates for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_templates_write"
  on lesson_forge_templates for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_sections_select"
  on lesson_forge_sections for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_sections_write"
  on lesson_forge_sections for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_section_tools_select"
  on lesson_forge_section_tools for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_section_tools_write"
  on lesson_forge_section_tools for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_section_titles_select"
  on lesson_forge_section_titles for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_section_titles_write"
  on lesson_forge_section_titles for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_plans_select"
  on lesson_forge_plans for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_plans_write"
  on lesson_forge_plans for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_plan_sections_select"
  on lesson_forge_plan_sections for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "lesson_forge_plan_sections_write"
  on lesson_forge_plan_sections for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

alter table season_settings enable row level security;
alter table leaderboard_bonus_settings enable row level security;
alter table student_leaderboard_bonus_grants enable row level security;
alter table roulette_wheels enable row level security;
alter table roulette_segments enable row level security;
alter table roulette_spins enable row level security;

drop policy if exists "season_settings_select" on season_settings;
drop policy if exists "season_settings_admin_write" on season_settings;
drop policy if exists "leaderboard_bonus_settings_select" on leaderboard_bonus_settings;
drop policy if exists "leaderboard_bonus_settings_write" on leaderboard_bonus_settings;
drop policy if exists "student_leaderboard_bonus_grants_select" on student_leaderboard_bonus_grants;
drop policy if exists "student_leaderboard_bonus_grants_write" on student_leaderboard_bonus_grants;
drop policy if exists "roulette_wheels_select" on roulette_wheels;
drop policy if exists "roulette_wheels_write" on roulette_wheels;
drop policy if exists "roulette_segments_select" on roulette_segments;
drop policy if exists "roulette_segments_write" on roulette_segments;
drop policy if exists "roulette_spins_select" on roulette_spins;
drop policy if exists "roulette_spins_write" on roulette_spins;

create policy "season_settings_select"
  on season_settings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "leaderboard_bonus_settings_select"
  on leaderboard_bonus_settings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "roulette_wheels_select"
  on roulette_wheels for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach','display')
    )
  );

create policy "season_settings_admin_write"
  on season_settings for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "roulette_wheels_write"
  on roulette_wheels for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "leaderboard_bonus_settings_write"
  on leaderboard_bonus_settings for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "roulette_segments_select"
  on roulette_segments for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach','display')
    )
  );

create policy "roulette_segments_write"
  on roulette_segments for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "student_leaderboard_bonus_grants_select"
  on student_leaderboard_bonus_grants for select
  using (auth.uid() is not null);

create policy "student_leaderboard_bonus_grants_write"
  on student_leaderboard_bonus_grants for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "roulette_spins_select"
  on roulette_spins for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach','display')
    )
  );

create policy "roulette_spins_write"
  on roulette_spins for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

drop policy if exists "avatar_level_thresholds_select" on avatar_level_thresholds;
drop policy if exists "avatar_level_thresholds_write" on avatar_level_thresholds;
drop policy if exists "avatar_level_settings_select" on avatar_level_settings;
drop policy if exists "avatar_level_settings_write" on avatar_level_settings;

create policy "avatar_level_thresholds_select"
  on avatar_level_thresholds for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "avatar_level_thresholds_write"
  on avatar_level_thresholds for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "avatar_level_settings_select"
  on avatar_level_settings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "avatar_level_settings_write"
  on avatar_level_settings for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

-- Realtime publication additions (for live activity + dashboard updates)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ledger'
  ) then
    alter publication supabase_realtime add table public.ledger;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'student_achievement_badges'
  ) then
    alter publication supabase_realtime add table public.student_achievement_badges;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'student_skill_completions'
  ) then
    alter publication supabase_realtime add table public.student_skill_completions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'skill_tracker_logs'
  ) then
    alter publication supabase_realtime add table public.skill_tracker_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'battle_tracker_logs'
  ) then
    alter publication supabase_realtime add table public.battle_tracker_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'students'
  ) then
    alter publication supabase_realtime add table public.students;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'student_avatar_settings'
  ) then
    alter publication supabase_realtime add table public.student_avatar_settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'roulette_spins'
  ) then
    alter publication supabase_realtime add table public.roulette_spins;
  end if;
end $$;

-- Realtime select policies for display/admin roles
alter table ledger enable row level security;
alter table student_achievement_badges enable row level security;
alter table student_skill_completions enable row level security;
alter table skill_tracker_logs enable row level security;
alter table battle_tracker_logs enable row level security;
alter table students enable row level security;
alter table student_avatar_settings enable row level security;

drop policy if exists "realtime_select_display_admin_ledger" on ledger;
drop policy if exists "realtime_select_display_admin_student_achievement_badges" on student_achievement_badges;
drop policy if exists "realtime_select_display_admin_student_skill_completions" on student_skill_completions;
drop policy if exists "realtime_select_display_admin_skill_tracker_logs" on skill_tracker_logs;
drop policy if exists "realtime_select_display_admin_battle_tracker_logs" on battle_tracker_logs;
drop policy if exists "realtime_select_display_admin_students" on students;
drop policy if exists "realtime_select_display_admin_student_avatar_settings" on student_avatar_settings;

create policy "realtime_select_display_admin_ledger"
  on ledger for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','display')
    )
  );

create policy "realtime_select_display_admin_student_achievement_badges"
  on student_achievement_badges for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','display')
    )
  );

create policy "realtime_select_display_admin_student_skill_completions"
  on student_skill_completions for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','display')
    )
  );

create policy "realtime_select_display_admin_skill_tracker_logs"
  on skill_tracker_logs for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','display')
    )
  );

create policy "realtime_select_display_admin_battle_tracker_logs"
  on battle_tracker_logs for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','display')
    )
  );

create policy "realtime_select_display_admin_students"
  on students for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','display')
    )
  );

create policy "realtime_select_display_admin_student_avatar_settings"
  on student_avatar_settings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','display')
    )
  );
