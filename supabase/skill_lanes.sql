-- Skill Lanes (category-based Battle Pulse mode)
-- Adds metadata for battle lanes
alter table battle_trackers add column if not exists battle_meta jsonb not null default '{}'::jsonb;
