alter table public.chats
  add column if not exists assistant_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chats_assistant_id_fkey'
      and conrelid = 'public.chats'::regclass
  ) then
    alter table public.chats
      add constraint chats_assistant_id_fkey
      foreign key (assistant_id)
      references public.assistants(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_chats_assistant_id on public.chats(assistant_id);
