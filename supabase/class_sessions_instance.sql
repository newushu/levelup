-- Class sessions per schedule instance (unique per day)
-- Run in Supabase SQL editor.

alter table class_sessions
  add column if not exists instance_id uuid references class_schedule_instances(id) on delete set null;

create index if not exists class_sessions_instance_idx on class_sessions(instance_id);
create unique index if not exists class_sessions_instance_active_idx
  on class_sessions(instance_id)
  where ended_at is null;

-- Best-effort backfill for existing rows
update class_sessions cs
set instance_id = csi.id
from class_schedule_instances csi
where cs.instance_id is null
  and (
    (cs.schedule_entry_id = csi.id)
    or (cs.schedule_entry_id = csi.schedule_entry_id and cs.session_date = csi.session_date)
  );
