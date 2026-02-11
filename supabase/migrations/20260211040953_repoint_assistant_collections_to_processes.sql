alter table public.assistant_collections
  drop constraint if exists assistant_collections_collection_id_fkey;

alter table public.assistant_collections
  add constraint assistant_collections_collection_id_fkey
  foreign key (collection_id)
  references public.processes(id)
  on delete cascade;
