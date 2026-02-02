-- Coach display slots for mapping dashboards/displays to fixed screens
create table if not exists public.coach_display_slots (
  slot_key text primary key,
  label text not null,
  coach_user_id uuid,
  updated_at timestamptz not null default now()
);

create index if not exists coach_display_slots_coach_user_id_idx
  on public.coach_display_slots (coach_user_id);

insert into public.coach_display_slots (slot_key, label)
values
  ('coach_1', 'Coach Display 1'),
  ('coach_2', 'Coach Display 2'),
  ('coach_3', 'Coach Display 3'),
  ('coach_4', 'Coach Display 4')
on conflict (slot_key) do nothing;
