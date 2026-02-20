alter table if exists public.student_gifts
  add column if not exists expires_at timestamptz;

alter table if exists public.student_gifts
  add column if not exists expired_at timestamptz;

create index if not exists student_gifts_expiry_idx
  on public.student_gifts(student_id, enabled, expires_at, expired_at);
