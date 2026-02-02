-- Coach display state table for syncing coach dashboard to presenter display
create table if not exists public.coach_display_state (
  coach_user_id uuid primary key,
  tool_key text not null default 'default',
  tool_payload jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists coach_display_state_updated_at_idx
  on public.coach_display_state (updated_at desc);
