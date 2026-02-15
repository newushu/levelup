alter table if exists public.avatars
  add column if not exists mvp_bonus_pct numeric(6,2) not null default 0;

alter table if exists public.avatars
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.avatars
  add column if not exists updated_at timestamptz not null default now();

update public.avatars
set created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where created_at is null
   or updated_at is null;

create or replace function public.set_avatars_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_avatars_updated_at on public.avatars;
create trigger trg_avatars_updated_at
before update on public.avatars
for each row execute function public.set_avatars_updated_at();
