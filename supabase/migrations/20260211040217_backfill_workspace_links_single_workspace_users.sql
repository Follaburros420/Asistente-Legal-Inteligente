-- Backfill workspace link tables for entities owned by users with exactly one workspace.
-- This avoids ambiguous mappings for users that belong to multiple workspaces.

with single_workspace_users as (
  select user_id,
         min(id::text)::uuid as workspace_id
  from public.workspaces
  group by user_id
  having count(*) = 1
)
insert into public.assistant_workspaces (user_id, assistant_id, workspace_id)
select a.user_id, a.id, sw.workspace_id
from public.assistants a
join single_workspace_users sw on sw.user_id = a.user_id
where not exists (
  select 1
  from public.assistant_workspaces aw
  where aw.assistant_id = a.id
    and aw.workspace_id = sw.workspace_id
);

with single_workspace_users as (
  select user_id,
         min(id::text)::uuid as workspace_id
  from public.workspaces
  group by user_id
  having count(*) = 1
)
insert into public.tool_workspaces (user_id, tool_id, workspace_id)
select t.user_id, t.id, sw.workspace_id
from public.tools t
join single_workspace_users sw on sw.user_id = t.user_id
where not exists (
  select 1
  from public.tool_workspaces tw
  where tw.tool_id = t.id
    and tw.workspace_id = sw.workspace_id
);

with single_workspace_users as (
  select user_id,
         min(id::text)::uuid as workspace_id
  from public.workspaces
  group by user_id
  having count(*) = 1
)
insert into public.collection_workspaces (user_id, collection_id, workspace_id)
select c.user_id, c.id, sw.workspace_id
from public.collections c
join single_workspace_users sw on sw.user_id = c.user_id
where not exists (
  select 1
  from public.collection_workspaces cw
  where cw.collection_id = c.id
    and cw.workspace_id = sw.workspace_id
);
