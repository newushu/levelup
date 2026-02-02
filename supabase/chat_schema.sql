-- Chat schema for student-to-student messaging
-- Run in Supabase SQL editor.

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table chat_conversations add column if not exists title text;
alter table chat_conversations add column if not exists kind text not null default 'direct';
alter table chat_conversations add column if not exists is_public boolean not null default false;

create unique index if not exists chat_conversations_public_kind_idx
  on chat_conversations(kind)
  where kind = 'public';

create table if not exists chat_participants (
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, student_id)
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  sender_student_id uuid references students(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists chat_presence (
  student_id uuid primary key references students(id) on delete cascade,
  last_seen timestamptz not null default now()
);

create index if not exists chat_presence_last_seen_idx on chat_presence(last_seen desc);

create index if not exists chat_participants_student_idx on chat_participants(student_id);
create index if not exists chat_messages_conv_created_idx on chat_messages(conversation_id, created_at desc);

alter table chat_conversations enable row level security;
alter table chat_participants enable row level security;
alter table chat_messages enable row level security;
alter table chat_presence enable row level security;

drop policy if exists "chat_conversations_select" on chat_conversations;
drop policy if exists "chat_conversations_insert" on chat_conversations;
drop policy if exists "chat_participants_select" on chat_participants;
drop policy if exists "chat_participants_insert" on chat_participants;
drop policy if exists "chat_messages_select" on chat_messages;
drop policy if exists "chat_messages_insert" on chat_messages;
drop policy if exists "chat_presence_select" on chat_presence;
drop policy if exists "chat_presence_upsert" on chat_presence;
drop policy if exists "chat_presence_update" on chat_presence;

create policy "chat_conversations_select"
  on chat_conversations for select
  using (
    chat_conversations.is_public = true
    or exists (
      select 1
      from chat_participants cp
      join user_roles ur on ur.student_id = cp.student_id
      where cp.conversation_id = chat_conversations.id
        and ur.user_id = auth.uid()
    )
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "chat_conversations_insert"
  on chat_conversations for insert
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
    or (
      exists (
        select 1 from user_roles ur
        where ur.user_id = auth.uid()
          and ur.role = 'student'
      )
      and (
        (chat_conversations.kind = 'public' and chat_conversations.is_public = true)
        or (chat_conversations.kind = 'direct' and chat_conversations.is_public = false)
      )
    )
  );

create policy "chat_participants_select"
  on chat_participants for select
  using (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.student_id = chat_participants.student_id
    )
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "chat_participants_insert"
  on chat_participants for insert
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.student_id = chat_participants.student_id
    )
    or exists (
      select 1
      from chat_participants cp
      join user_roles ur on ur.student_id = cp.student_id
      where cp.conversation_id = chat_participants.conversation_id
        and ur.user_id = auth.uid()
    )
  );

create policy "chat_messages_select"
  on chat_messages for select
  using (
    exists (
      select 1
      from chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.is_public = true
    )
    or exists (
      select 1
      from chat_participants cp
      join user_roles ur on ur.student_id = cp.student_id
      where cp.conversation_id = chat_messages.conversation_id
        and ur.user_id = auth.uid()
    )
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "chat_messages_insert"
  on chat_messages for insert
  with check (
    exists (
      select 1
      from chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.is_public = true
    )
    or exists (
      select 1
      from chat_participants cp
      join user_roles ur on ur.student_id = cp.student_id
      where cp.conversation_id = chat_messages.conversation_id
        and ur.user_id = auth.uid()
    )
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "chat_presence_select"
  on chat_presence for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','coach')
    )
  );

create policy "chat_presence_upsert"
  on chat_presence for insert
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.student_id = chat_presence.student_id
    )
  );

create policy "chat_presence_update"
  on chat_presence for update
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.student_id = chat_presence.student_id
    )
  );
