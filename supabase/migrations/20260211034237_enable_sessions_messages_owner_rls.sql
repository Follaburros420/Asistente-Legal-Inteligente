-- Enable owner-based RLS for legacy chat persistence tables.
-- This keeps data isolated per authenticated user while allowing optional
-- persistence when LEGACY_MESSAGES_PERSISTENCE is enabled in the app.

alter table public.sessions enable row level security;
alter table public.messages enable row level security;

drop policy if exists sessions_no_access on public.sessions;
drop policy if exists messages_no_access on public.messages;

create policy sessions_owner_all
on public.sessions
for all
to authenticated
using (user_id = (select auth.uid()::text))
with check (user_id = (select auth.uid()::text));

create policy messages_owner_all
on public.messages
for all
to authenticated
using (
  exists (
    select 1
    from public.sessions s
    where s.id = messages.session_id
      and s.user_id = (select auth.uid()::text)
  )
)
with check (
  exists (
    select 1
    from public.sessions s
    where s.id = messages.session_id
      and s.user_id = (select auth.uid()::text)
  )
);

create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_messages_session_id on public.messages(session_id);
