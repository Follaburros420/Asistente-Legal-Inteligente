begin;

do $$
begin
  if to_regclass('public.collection_workspaces') is not null then
    execute $sql$
      insert into public.legacy_cleanup_archive (source_table, row_data)
      select 'collection_workspaces' as source_table, to_jsonb(cw) as row_data
      from public.collection_workspaces cw
    $sql$;
  end if;

  if to_regclass('public.collection_files') is not null then
    execute $sql$
      insert into public.legacy_cleanup_archive (source_table, row_data)
      select 'collection_files' as source_table, to_jsonb(cf) as row_data
      from public.collection_files cf
    $sql$;
  end if;

  if to_regclass('public.collections') is not null then
    execute $sql$
      insert into public.legacy_cleanup_archive (source_table, row_data)
      select 'collections' as source_table, to_jsonb(c) as row_data
      from public.collections c
    $sql$;
  end if;
end
$$;

drop table if exists public.collection_files cascade;
drop table if exists public.collection_workspaces cascade;
drop table if exists public.collections cascade;

commit;

