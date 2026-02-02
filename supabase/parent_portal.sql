-- Parent portal schema
create extension if not exists "pgcrypto";

create table if not exists parents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  name text not null,
  email text not null,
  pin_hash text,
  phone text,
  dob date,
  created_at timestamptz not null default now()
);

create table if not exists parent_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  parent_name text not null,
  email text not null,
  student_names text[] not null default '{}'::text[],
  request_note text,
  status text not null default 'pending',
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists parent_students (
  parent_id uuid not null references parents(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  relationship_type text not null default 'parent',
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create table if not exists parent_relationships (
  id uuid primary key default gen_random_uuid(),
  student_id_a uuid not null references students(id) on delete cascade,
  student_id_b uuid not null references students(id) on delete cascade,
  relationship_type text not null default 'sibling',
  created_by_parent_id uuid references parents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists parent_messages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  thread_key text not null default 'general',
  student_id uuid references students(id) on delete set null,
  coach_user_id uuid,
  note_id uuid,
  body text not null,
  is_from_admin boolean not null default false,
  admin_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists parent_pairing_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  parent_id uuid references parents(id) on delete set null,
  student_id uuid references students(id) on delete set null,
  student_id_b uuid references students(id) on delete set null,
  relationship_type text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  announcement_type text not null default 'banner',
  announcement_kind text not null default 'general',
  discount_label text,
  discount_ends_at timestamptz,
  status text not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists parent_requests_status_idx on parent_requests(status);
create index if not exists parent_students_parent_idx on parent_students(parent_id);
create index if not exists parent_students_student_idx on parent_students(student_id);
create index if not exists parent_relationships_a_idx on parent_relationships(student_id_a);
create index if not exists parent_relationships_b_idx on parent_relationships(student_id_b);
create index if not exists parent_messages_parent_idx on parent_messages(parent_id);
create index if not exists parent_messages_thread_idx on parent_messages(thread_key);
create index if not exists parent_pairing_events_parent_idx on parent_pairing_events(parent_id);
create index if not exists parent_pairing_events_student_idx on parent_pairing_events(student_id);
create index if not exists parent_pairing_events_created_idx on parent_pairing_events(created_at);
create index if not exists announcements_status_idx on announcements(status);
create index if not exists announcements_type_idx on announcements(announcement_type);
create index if not exists announcements_kind_idx on announcements(announcement_kind);
create index if not exists announcements_starts_idx on announcements(starts_at);
create index if not exists announcements_ends_idx on announcements(ends_at);

alter table if exists parent_messages
  add column if not exists is_from_admin boolean not null default false;

alter table if exists parent_messages
  add column if not exists admin_user_id uuid;

alter table if exists parent_messages
  add column if not exists thread_key text not null default 'general';

alter table if exists parent_messages
  add column if not exists student_id uuid;

alter table if exists parent_messages
  add column if not exists coach_user_id uuid;

alter table if exists parent_messages
  add column if not exists note_id uuid;

create index if not exists parent_messages_coach_idx on parent_messages(coach_user_id);

alter table if exists parents
  add column if not exists pin_hash text;

alter table if exists parents
  add column if not exists dob date;

alter table if exists parent_students
  add column if not exists relationship_type text not null default 'parent';

alter table if exists parent_requests
  add column if not exists approved_at timestamptz;

alter table if exists parent_requests
  add column if not exists request_note text;

alter table if exists parent_pairing_events
  add column if not exists event_type text;

alter table if exists parent_pairing_events
  add column if not exists student_id_b uuid;

alter table if exists students
  add column if not exists dob date;

alter table if exists announcements
  add column if not exists status text not null default 'active';

alter table if exists announcements
  add column if not exists announcement_type text not null default 'banner';

alter table if exists announcements
  add column if not exists announcement_kind text not null default 'general';

alter table if exists announcements
  add column if not exists discount_label text;

alter table if exists announcements
  add column if not exists discount_ends_at timestamptz;

alter table if exists announcements
  add column if not exists starts_at timestamptz;

alter table if exists announcements
  add column if not exists ends_at timestamptz;

alter table if exists marketing_announcements
  add column if not exists image_scale numeric(6,2) not null default 1;

alter table if exists marketing_announcements
  add column if not exists image_x numeric(6,2) not null default 0;

alter table if exists marketing_announcements
  add column if not exists image_y numeric(6,2) not null default 0;

alter table if exists marketing_announcements
  add column if not exists image_rotate numeric(6,2) not null default 0;

alter table if exists marketing_announcements
  add column if not exists border_style text not null default 'clean';

alter table if exists marketing_announcements
  add column if not exists border_color text;

alter table if exists marketing_announcements
  add column if not exists template_key text;

alter table if exists marketing_announcements
  add column if not exists template_payload jsonb;
