create table if not exists public.class_emotes (
  id uuid primary key default gen_random_uuid(),
  emote_key text unique not null,
  label text not null,
  emoji text not null default '✨',
  image_url text,
  html text,
  css text,
  js text,
  scale numeric(6,2) not null default 1,
  duration_ms integer not null default 3000,
  points_cost integer not null default 0,
  unlock_level integer not null default 1,
  enabled boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_emote_messages (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid references public.class_schedule_instances(id) on delete set null,
  sender_name text not null,
  recipient_name text not null,
  recipient_search text not null,
  emote_id uuid not null references public.class_emotes(id) on delete cascade,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists class_emote_messages_recipient_idx
  on public.class_emote_messages (recipient_search, consumed_at, created_at desc);

create or replace function public.set_class_emotes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_class_emotes_updated_at on public.class_emotes;
create trigger trg_class_emotes_updated_at
before update on public.class_emotes
for each row execute function public.set_class_emotes_updated_at();

insert into public.class_emotes (emote_key, label, emoji, points_cost, unlock_level, enabled, is_default)
values
  ('fist', 'Punching Fist', '👊', 0, 1, true, true),
  ('hearts', 'Hearts', '💖', 0, 1, true, true),
  ('swords', 'Flying Swords', '🗡️', 0, 1, true, true),
  ('hammer', 'Hammer', '🔨', 0, 1, true, true),
  ('energy_ball', 'Energy Ball', '🔵', 0, 1, true, true),
  ('cat_scratch', 'Cat Scratch', '🐾', 0, 1, true, true)
on conflict (emote_key) do nothing;
