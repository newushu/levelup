-- Data point catalog for achievements + challenges
-- Run in Supabase SQL editor.

create table if not exists data_point_catalog (
  key text primary key,
  label text not null,
  description text,
  unit text,
  default_compare text not null default '>=',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table data_point_catalog enable row level security;

drop policy if exists "data_point_catalog_select" on data_point_catalog;
drop policy if exists "data_point_catalog_write" on data_point_catalog;

create policy "data_point_catalog_select"
  on data_point_catalog for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "data_point_catalog_write"
  on data_point_catalog for all
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

insert into data_point_catalog (key, label, description, unit, default_compare, enabled) values
  ('skill_completions_total', 'Skill completions (lifetime)', 'Total skills completed by a student.', 'count', '>=', true),
  ('skill_completions_30d', 'Skill completions (30d)', 'Skills completed in the last 30 days.', 'count', '>=', true),
  ('skill_completions_60d', 'Skill completions (60d)', 'Skills completed in the last 60 days.', 'count', '>=', true),
  ('skill_completions_90d', 'Skill completions (90d)', 'Skills completed in the last 90 days.', 'count', '>=', true),
  ('tracker_attempts_total', 'Skill tracker attempts', 'Total tracker logs (success + fail).', 'count', '>=', true),
  ('tracker_success_pct', 'Skill tracker success %', 'Lifetime success percentage from tracker logs.', 'percent', '>=', true),
  ('tracker_reps_by_skill', 'Tracker reps by skill', 'Total tracker reps for a specific tracker skill.', 'count', '>=', true),
  ('skills_unlocked_total', 'Skills unlocked', 'Total skills unlocked/assigned to a student.', 'count', '>=', true),
  ('challenges_completed_total', 'Challenges completed', 'Total challenges completed by a student.', 'count', '>=', true),
  ('challenges_completed_30d', 'Challenges completed (30d)', 'Challenges completed in the last 30 days.', 'count', '>=', true),
  ('challenges_completed_60d', 'Challenges completed (60d)', 'Challenges completed in the last 60 days.', 'count', '>=', true),
  ('challenges_completed_90d', 'Challenges completed (90d)', 'Challenges completed in the last 90 days.', 'count', '>=', true)
on conflict (key) do nothing;

alter table challenges add column if not exists data_point_key text;
alter table challenges add column if not exists data_point_window_days int;
