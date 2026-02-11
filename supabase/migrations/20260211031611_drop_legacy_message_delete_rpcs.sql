-- Remove legacy message delete RPCs tied to the old chat/message schema.
-- Current code path deletes by session_id + metadata.sequence_number directly.

drop function if exists public.delete_message_including_and_after(uuid, uuid, integer);
drop function if exists public.delete_messages_including_and_after(uuid, uuid, integer);
