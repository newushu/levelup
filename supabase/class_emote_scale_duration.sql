alter table if exists public.class_emotes
  add column if not exists scale numeric(6,2) not null default 1;

alter table if exists public.class_emotes
  add column if not exists duration_ms integer not null default 3000;

update public.class_emotes
set scale = coalesce(scale, 1),
    duration_ms = coalesce(duration_ms, 3000)
where scale is null
   or duration_ms is null;
