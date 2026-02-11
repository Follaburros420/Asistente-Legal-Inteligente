-- Canonical object inventory for quota enforcement when using external object storage (Wasabi).
-- Keeps ownership + size accounting decoupled from storage.objects.

create table if not exists public.object_storage_inventory (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  bucket text not null,
  object_path text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  content_type text null,
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase', 'wasabi')),
  source_table text null,
  source_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'deleted')),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create index if not exists idx_object_storage_inventory_owner_status
  on public.object_storage_inventory (owner_user_id, status);

create index if not exists idx_object_storage_inventory_workspace_status
  on public.object_storage_inventory (workspace_id, status);

create index if not exists idx_object_storage_inventory_bucket_status
  on public.object_storage_inventory (bucket, status);

alter table public.object_storage_inventory enable row level security;

drop policy if exists object_storage_inventory_owner_select on public.object_storage_inventory;
create policy object_storage_inventory_owner_select
on public.object_storage_inventory
for select
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists object_storage_inventory_owner_insert on public.object_storage_inventory;
create policy object_storage_inventory_owner_insert
on public.object_storage_inventory
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists object_storage_inventory_owner_update on public.object_storage_inventory;
create policy object_storage_inventory_owner_update
on public.object_storage_inventory
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

drop policy if exists object_storage_inventory_owner_delete on public.object_storage_inventory;
create policy object_storage_inventory_owner_delete
on public.object_storage_inventory
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

drop trigger if exists update_object_storage_inventory_updated_at on public.object_storage_inventory;
create trigger update_object_storage_inventory_updated_at
before update on public.object_storage_inventory
for each row
execute procedure update_updated_at_column();

create or replace function public.get_object_storage_usage_bytes(p_user_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester uuid;
  target_user_id uuid;
begin
  requester := auth.uid();
  if requester is not null then
    if requester <> p_user_id then
      raise exception 'forbidden';
    end if;
    target_user_id := requester;
  else
    target_user_id := p_user_id;
  end if;

  return coalesce((
    select sum(size_bytes)::bigint
    from public.object_storage_inventory
    where owner_user_id = target_user_id
      and status = 'active'
  ), 0);
end;
$$;

revoke all on function public.get_object_storage_usage_bytes(uuid) from public;
grant execute on function public.get_object_storage_usage_bytes(uuid) to authenticated;
grant execute on function public.get_object_storage_usage_bytes(uuid) to service_role;

with base as (
  select
    f.user_id as owner_user_id,
    f.workspace_id,
    'files'::text as bucket,
    f.file_path as object_path,
    greatest(coalesce(f.size, 0), 0)::bigint as size_bytes,
    null::text as content_type,
    'files'::text as source_table,
    f.id as source_id
  from public.files f
  where nullif(trim(f.file_path), '') is not null
), dedup as (
  select distinct on (bucket, object_path)
    owner_user_id,
    workspace_id,
    bucket,
    object_path,
    size_bytes,
    content_type,
    source_table,
    source_id
  from base
  order by bucket, object_path, size_bytes desc, source_id desc
)
insert into public.object_storage_inventory (
  owner_user_id,
  workspace_id,
  bucket,
  object_path,
  size_bytes,
  content_type,
  storage_provider,
  source_table,
  source_id,
  metadata,
  status,
  deleted_at
)
select
  owner_user_id,
  workspace_id,
  bucket,
  object_path,
  size_bytes,
  content_type,
  'supabase',
  source_table,
  source_id,
  jsonb_build_object('backfill', true),
  'active',
  null
from dedup
on conflict (bucket, object_path)
do update set
  owner_user_id = excluded.owner_user_id,
  workspace_id = excluded.workspace_id,
  size_bytes = excluded.size_bytes,
  source_table = excluded.source_table,
  source_id = excluded.source_id,
  metadata = coalesce(public.object_storage_inventory.metadata, '{}'::jsonb) || excluded.metadata,
  status = 'active',
  deleted_at = null;

with base as (
  select
    d.user_id as owner_user_id,
    p.workspace_id,
    'files'::text as bucket,
    d.storage_path as object_path,
    greatest(coalesce(d.size_bytes, 0), 0)::bigint as size_bytes,
    d.mime_type::text as content_type,
    'process_documents'::text as source_table,
    d.id as source_id
  from public.process_documents d
  left join public.processes p on p.id = d.process_id
  where nullif(trim(d.storage_path), '') is not null
), dedup as (
  select distinct on (bucket, object_path)
    owner_user_id,
    workspace_id,
    bucket,
    object_path,
    size_bytes,
    content_type,
    source_table,
    source_id
  from base
  order by bucket, object_path, size_bytes desc, source_id desc
)
insert into public.object_storage_inventory (
  owner_user_id,
  workspace_id,
  bucket,
  object_path,
  size_bytes,
  content_type,
  storage_provider,
  source_table,
  source_id,
  metadata,
  status,
  deleted_at
)
select
  owner_user_id,
  workspace_id,
  bucket,
  object_path,
  size_bytes,
  content_type,
  'supabase',
  source_table,
  source_id,
  jsonb_build_object('backfill', true),
  'active',
  null
from dedup
on conflict (bucket, object_path)
do update set
  owner_user_id = excluded.owner_user_id,
  workspace_id = excluded.workspace_id,
  size_bytes = greatest(public.object_storage_inventory.size_bytes, excluded.size_bytes),
  content_type = coalesce(excluded.content_type, public.object_storage_inventory.content_type),
  source_table = excluded.source_table,
  source_id = excluded.source_id,
  metadata = coalesce(public.object_storage_inventory.metadata, '{}'::jsonb) || excluded.metadata,
  status = 'active',
  deleted_at = null;

with base as (
  select
    t.user_id as owner_user_id,
    t.workspace_id,
    'files'::text as bucket,
    t.audio_path as object_path,
    greatest(coalesce(t.file_size, 0), 0)::bigint as size_bytes,
    t.audio_format::text as content_type,
    'transcriptions'::text as source_table,
    t.id as source_id
  from public.transcriptions t
  where nullif(trim(t.audio_path), '') is not null
), dedup as (
  select distinct on (bucket, object_path)
    owner_user_id,
    workspace_id,
    bucket,
    object_path,
    size_bytes,
    content_type,
    source_table,
    source_id
  from base
  order by bucket, object_path, size_bytes desc, source_id desc
)
insert into public.object_storage_inventory (
  owner_user_id,
  workspace_id,
  bucket,
  object_path,
  size_bytes,
  content_type,
  storage_provider,
  source_table,
  source_id,
  metadata,
  status,
  deleted_at
)
select
  owner_user_id,
  workspace_id,
  bucket,
  object_path,
  size_bytes,
  content_type,
  'supabase',
  source_table,
  source_id,
  jsonb_build_object('backfill', true),
  'active',
  null
from dedup
on conflict (bucket, object_path)
do update set
  owner_user_id = excluded.owner_user_id,
  workspace_id = excluded.workspace_id,
  size_bytes = greatest(public.object_storage_inventory.size_bytes, excluded.size_bytes),
  content_type = coalesce(excluded.content_type, public.object_storage_inventory.content_type),
  source_table = excluded.source_table,
  source_id = excluded.source_id,
  metadata = coalesce(public.object_storage_inventory.metadata, '{}'::jsonb) || excluded.metadata,
  status = 'active',
  deleted_at = null;

with profile_images as (
  select
    p.user_id as owner_user_id,
    null::uuid as workspace_id,
    'profile_images'::text as bucket,
    p.image_path as object_path,
    case
      when (so.metadata ->> 'size') ~ '^[0-9]+$' then (so.metadata ->> 'size')::bigint
      else 0::bigint
    end as size_bytes,
    null::text as content_type,
    'profiles'::text as source_table,
    p.id as source_id
  from public.profiles p
  left join storage.objects so
    on so.bucket_id = 'profile_images'
   and so.name = p.image_path
  where nullif(trim(p.image_path), '') is not null
),
workspace_images as (
  select
    w.user_id as owner_user_id,
    w.id as workspace_id,
    'workspace_images'::text as bucket,
    w.image_path as object_path,
    case
      when (so.metadata ->> 'size') ~ '^[0-9]+$' then (so.metadata ->> 'size')::bigint
      else 0::bigint
    end as size_bytes,
    null::text as content_type,
    'workspaces'::text as source_table,
    w.id as source_id
  from public.workspaces w
  left join storage.objects so
    on so.bucket_id = 'workspace_images'
   and so.name = w.image_path
  where nullif(trim(w.image_path), '') is not null
),
assistant_images as (
  select
    a.user_id as owner_user_id,
    null::uuid as workspace_id,
    'assistant_images'::text as bucket,
    a.image_path as object_path,
    case
      when (so.metadata ->> 'size') ~ '^[0-9]+$' then (so.metadata ->> 'size')::bigint
      else 0::bigint
    end as size_bytes,
    null::text as content_type,
    'assistants'::text as source_table,
    a.id as source_id
  from public.assistants a
  left join storage.objects so
    on so.bucket_id = 'assistant_images'
   and so.name = a.image_path
  where nullif(trim(a.image_path), '') is not null
),
unioned as (
  select * from profile_images
  union all
  select * from workspace_images
  union all
  select * from assistant_images
),
dedup as (
  select distinct on (bucket, object_path)
    owner_user_id,
    workspace_id,
    bucket,
    object_path,
    greatest(coalesce(size_bytes, 0), 0) as size_bytes,
    content_type,
    source_table,
    source_id
  from unioned
  order by bucket, object_path, size_bytes desc
)
insert into public.object_storage_inventory (
  owner_user_id,
  workspace_id,
  bucket,
  object_path,
  size_bytes,
  content_type,
  storage_provider,
  source_table,
  source_id,
  metadata,
  status,
  deleted_at
)
select
  owner_user_id,
  workspace_id,
  bucket,
  object_path,
  size_bytes,
  content_type,
  'supabase',
  source_table,
  source_id,
  jsonb_build_object('backfill', true),
  'active',
  null
from dedup
on conflict (bucket, object_path)
do update set
  owner_user_id = excluded.owner_user_id,
  workspace_id = coalesce(excluded.workspace_id, public.object_storage_inventory.workspace_id),
  size_bytes = greatest(public.object_storage_inventory.size_bytes, excluded.size_bytes),
  source_table = excluded.source_table,
  source_id = excluded.source_id,
  metadata = coalesce(public.object_storage_inventory.metadata, '{}'::jsonb) || excluded.metadata,
  status = 'active',
  deleted_at = null;
