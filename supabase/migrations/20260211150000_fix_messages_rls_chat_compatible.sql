-- Migration: Fix messages RLS to support both session_id and chat_id
-- Created: 2026-02-11
-- Description: Add RLS policy for messages using chat_id for backward compatibility

begin;

-- Drop existing messages policies to avoid conflicts
drop policy if exists messages_owner_all on public.messages;

-- Create policy for messages based on chat_id (backward compatibility)
create policy messages_chat_owner_all
on public.messages
for all
to authenticated
using (
  -- Allow if user owns the chat
  exists (
    select 1
    from public.chats c
    where c.id = messages.chat_id
      and c.user_id = (select auth.uid())
  )
  -- OR if user owns the session (new system)
  or exists (
    select 1
    from public.sessions s
    where s.id = messages.session_id
      and s.user_id = (select public.current_auth_uid_text())
  )
  -- OR if user is the message owner (legacy)
  or user_id = (select auth.uid())
)
with check (
  -- Allow if user owns the chat
  exists (
    select 1
    from public.chats c
    where c.id = messages.chat_id
      and c.user_id = (select auth.uid())
  )
  -- OR if user owns the session (new system)
  or exists (
    select 1
    from public.sessions s
    where s.id = messages.session_id
      and s.user_id = (select public.current_auth_uid_text())
  )
  -- OR if user is the message owner (legacy)
  or user_id = (select auth.uid())
);

-- Also ensure chats RLS allows proper access
drop policy if exists chats_insert_owner_authenticated on public.chats;
create policy chats_insert_owner_authenticated
on public.chats
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or user_id is null  -- Allow null for system-created chats
);

commit;
