begin;

do $$
begin
  if to_regclass('public.documents') is not null then
    execute $sql$
      insert into public.legacy_cleanup_archive (source_table, row_data)
      select 'documents' as source_table, to_jsonb(d) as row_data
      from public.documents d
    $sql$;
  end if;

  if to_regclass('public.chunks') is not null then
    execute $sql$
      insert into public.legacy_cleanup_archive (source_table, row_data)
      select 'chunks' as source_table, to_jsonb(c) as row_data
      from public.chunks c
    $sql$;
  end if;
end
$$;

drop function if exists public.hybrid_search(vector, text, integer, double precision, uuid, uuid);
drop function if exists public.match_chunks(vector, integer, uuid, uuid);

drop table if exists public.chunks cascade;
drop table if exists public.documents cascade;

commit;
