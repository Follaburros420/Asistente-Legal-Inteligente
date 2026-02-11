with home_workspaces as (
  select user_id, id as workspace_id
  from public.workspaces
  where is_home = true
)
insert into public.assistant_workspaces (user_id, assistant_id, workspace_id)
select a.user_id, a.id, h.workspace_id
from public.assistants a
join home_workspaces h on h.user_id = a.user_id
where not exists (
  select 1
  from public.assistant_workspaces aw
  where aw.assistant_id = a.id
);

with home_workspaces as (
  select user_id, id as workspace_id
  from public.workspaces
  where is_home = true
)
insert into public.tool_workspaces (user_id, tool_id, workspace_id)
select t.user_id, t.id, h.workspace_id
from public.tools t
join home_workspaces h on h.user_id = t.user_id
where not exists (
  select 1
  from public.tool_workspaces tw
  where tw.tool_id = t.id
);

with home_workspaces as (
  select user_id, id as workspace_id
  from public.workspaces
  where is_home = true
)
insert into public.collection_workspaces (user_id, collection_id, workspace_id)
select c.user_id, c.id, h.workspace_id
from public.collections c
join home_workspaces h on h.user_id = c.user_id
where not exists (
  select 1
  from public.collection_workspaces cw
  where cw.collection_id = c.id
);
