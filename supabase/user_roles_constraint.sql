alter table user_roles drop constraint if exists user_roles_role_check;

alter table user_roles add constraint user_roles_role_check
check (role in (
  'admin',
  'coach',
  'student',
  'parent',
  'classroom',
  'display',
  'skill_pulse',
  'camp',
  'coach-dashboard',
  'skill-tablet'
));
