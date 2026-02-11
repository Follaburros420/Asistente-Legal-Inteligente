begin;

create or replace function public.current_auth_uid_text()
returns text
language sql
stable
set search_path = public
as $$
  select auth.uid()::text
$$;

drop policy if exists sessions_owner_all on public.sessions;
create policy sessions_owner_all
on public.sessions
for all
to authenticated
using (user_id = (select public.current_auth_uid_text()))
with check (user_id = (select public.current_auth_uid_text()));

drop policy if exists messages_owner_all on public.messages;
create policy messages_owner_all
on public.messages
for all
to authenticated
using (
  exists (
    select 1
    from public.sessions s
    where s.id = messages.session_id
      and s.user_id = (select public.current_auth_uid_text())
  )
)
with check (
  exists (
    select 1
    from public.sessions s
    where s.id = messages.session_id
      and s.user_id = (select public.current_auth_uid_text())
  )
);

commit;
