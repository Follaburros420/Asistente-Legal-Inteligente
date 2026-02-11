begin;

-- Owner-only tables: replace broad public policies with authenticated owner policies.
drop policy if exists "Allow full access to own profiles" on public.profiles;
create policy profiles_owner_all_authenticated
on public.profiles
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own assistant_collections" on public.assistant_collections;
create policy assistant_collections_owner_all_authenticated
on public.assistant_collections
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own assistant_files" on public.assistant_files;
create policy assistant_files_owner_all_authenticated
on public.assistant_files
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own assistant_tools" on public.assistant_tools;
create policy assistant_tools_owner_all_authenticated
on public.assistant_tools
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own assistant_workspaces" on public.assistant_workspaces;
create policy assistant_workspaces_owner_all_authenticated
on public.assistant_workspaces
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own chat_files" on public.chat_files;
create policy chat_files_owner_all_authenticated
on public.chat_files
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own message_file_items" on public.message_file_items;
create policy message_file_items_owner_all_authenticated
on public.message_file_items
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own preset_workspaces" on public.preset_workspaces;
create policy preset_workspaces_owner_all_authenticated
on public.preset_workspaces
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own prompt_workspaces" on public.prompt_workspaces;
create policy prompt_workspaces_owner_all_authenticated
on public.prompt_workspaces
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own tool_workspaces" on public.tool_workspaces;
create policy tool_workspaces_owner_all_authenticated
on public.tool_workspaces
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own model_workspaces" on public.model_workspaces;
create policy model_workspaces_owner_all_authenticated
on public.model_workspaces
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Tables with owner + shared-read semantics: split ALL policy to avoid duplicated SELECT policies.
drop policy if exists "Allow full access to own workspaces" on public.workspaces;
drop policy if exists "Allow view access to non-private workspaces" on public.workspaces;
create policy workspaces_select_authenticated
on public.workspaces
for select
to authenticated
using ((user_id = (select auth.uid())) or (sharing <> 'private'));
create policy workspaces_insert_owner_authenticated
on public.workspaces
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy workspaces_update_owner_authenticated
on public.workspaces
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy workspaces_delete_owner_authenticated
on public.workspaces
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own files" on public.files;
drop policy if exists "Allow view access to non-private files" on public.files;
create policy files_select_authenticated
on public.files
for select
to authenticated
using ((user_id = (select auth.uid())) or (sharing <> 'private'));
create policy files_insert_owner_authenticated
on public.files
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy files_update_owner_authenticated
on public.files
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy files_delete_owner_authenticated
on public.files
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own assistants" on public.assistants;
drop policy if exists "Allow view access to non-private assistants" on public.assistants;
create policy assistants_select_authenticated
on public.assistants
for select
to authenticated
using ((user_id = (select auth.uid())) or (sharing <> 'private'));
create policy assistants_insert_owner_authenticated
on public.assistants
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy assistants_update_owner_authenticated
on public.assistants
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy assistants_delete_owner_authenticated
on public.assistants
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own chats" on public.chats;
drop policy if exists "Allow view access to non-private chats" on public.chats;
create policy chats_select_authenticated
on public.chats
for select
to authenticated
using ((user_id = (select auth.uid())) or (sharing <> 'private'));
create policy chats_insert_owner_authenticated
on public.chats
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy chats_update_owner_authenticated
on public.chats
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy chats_delete_owner_authenticated
on public.chats
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own models" on public.models;
drop policy if exists "Allow view access to non-private models" on public.models;
create policy models_select_authenticated
on public.models
for select
to authenticated
using ((user_id = (select auth.uid())) or (sharing <> 'private'));
create policy models_insert_owner_authenticated
on public.models
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy models_update_owner_authenticated
on public.models
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy models_delete_owner_authenticated
on public.models
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own presets" on public.presets;
drop policy if exists "Allow view access to non-private presets" on public.presets;
create policy presets_select_authenticated
on public.presets
for select
to authenticated
using ((user_id = (select auth.uid())) or (sharing <> 'private'));
create policy presets_insert_owner_authenticated
on public.presets
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy presets_update_owner_authenticated
on public.presets
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy presets_delete_owner_authenticated
on public.presets
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own prompts" on public.prompts;
drop policy if exists "Allow view access to non-private prompts" on public.prompts;
create policy prompts_select_authenticated
on public.prompts
for select
to authenticated
using ((user_id = (select auth.uid())) or (sharing <> 'private'));
create policy prompts_insert_owner_authenticated
on public.prompts
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy prompts_update_owner_authenticated
on public.prompts
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy prompts_delete_owner_authenticated
on public.prompts
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own file items" on public.file_items;
drop policy if exists "Allow view access to non-private file items" on public.file_items;
create policy file_items_select_authenticated
on public.file_items
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or (
    file_id in (
      select f.id
      from public.files f
      where f.sharing <> 'private'
    )
  )
);
create policy file_items_insert_owner_authenticated
on public.file_items
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy file_items_update_owner_authenticated
on public.file_items
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy file_items_delete_owner_authenticated
on public.file_items
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Process domain: merge overlapping SELECT policies.
drop policy if exists "Allow full access to own processes" on public.processes;
drop policy if exists "Allow view access to non-private processes" on public.processes;
drop policy if exists "Workspace members can view processes" on public.processes;
create policy processes_select_authenticated
on public.processes
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or (sharing <> 'private')
  or ((workspace_id is not null) and is_workspace_member(workspace_id, (select auth.uid())))
);
create policy processes_insert_owner_authenticated
on public.processes
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy processes_update_owner_authenticated
on public.processes
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy processes_delete_owner_authenticated
on public.processes
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own transcriptions" on public.transcriptions;
drop policy if exists "Allow view access to non-private transcriptions" on public.transcriptions;
create policy transcriptions_select_authenticated
on public.transcriptions
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or (
    (status = 'completed')
    and exists (
      select 1
      from public.workspaces w
      where w.id = transcriptions.workspace_id
        and w.sharing <> 'private'
    )
  )
);
create policy transcriptions_insert_owner_authenticated
on public.transcriptions
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy transcriptions_update_owner_authenticated
on public.transcriptions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy transcriptions_delete_owner_authenticated
on public.transcriptions
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Workspace collaboration: avoid duplicated SELECT from ALL policies.
drop policy if exists "Workspace owners and admins can manage members" on public.workspace_members;
drop policy if exists "Members can view workspace members" on public.workspace_members;
create policy workspace_members_select_authenticated
on public.workspace_members
for select
to authenticated
using (
  ((select auth.uid()) = user_id)
  or is_workspace_member(workspace_id, (select auth.uid()))
);
create policy workspace_members_insert_admin_authenticated
on public.workspace_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.user_id = (select auth.uid())
  )
  or is_workspace_admin(workspace_id, (select auth.uid()))
);
create policy workspace_members_update_admin_authenticated
on public.workspace_members
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.user_id = (select auth.uid())
  )
  or is_workspace_admin(workspace_id, (select auth.uid()))
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.user_id = (select auth.uid())
  )
  or is_workspace_admin(workspace_id, (select auth.uid()))
);
create policy workspace_members_delete_admin_authenticated
on public.workspace_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.user_id = (select auth.uid())
  )
  or is_workspace_admin(workspace_id, (select auth.uid()))
);

drop policy if exists "Workspace owners and admins can manage invitations" on public.workspace_invitations;
drop policy if exists "Users can view own invitations" on public.workspace_invitations;
drop policy if exists "Workspace owners and admins can view invitations" on public.workspace_invitations;
create policy workspace_invitations_select_authenticated
on public.workspace_invitations
for select
to authenticated
using (
  (
    status = 'PENDING'
    and email = (
      select u.email::text
      from auth.users u
      where u.id = (select auth.uid())
    )
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = workspace_invitations.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'ADMIN'
  )
);
create policy workspace_invitations_insert_admin_authenticated
on public.workspace_invitations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_invitations.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'ADMIN'
  )
);
create policy workspace_invitations_update_admin_authenticated
on public.workspace_invitations
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_invitations.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'ADMIN'
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_invitations.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'ADMIN'
  )
);
create policy workspace_invitations_delete_admin_authenticated
on public.workspace_invitations
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_invitations.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'ADMIN'
  )
);

-- Session tracking: avoid public role evaluation for service role policy.
drop policy if exists "Service role can manage all sessions" on public.user_sessions;
drop policy if exists "Users can delete their own sessions" on public.user_sessions;
drop policy if exists "Users can view their own sessions" on public.user_sessions;
create policy user_sessions_service_role_all
on public.user_sessions
for all
to service_role
using (true)
with check (true);
create policy user_sessions_owner_all_authenticated
on public.user_sessions
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- User location: remove over-broad select and keep owner/admin read semantics.
drop policy if exists "Users can insert their own location" on public.user_locations;
drop policy if exists "Admins can view all user locations" on public.user_locations;
drop policy if exists "Users can view their own locations" on public.user_locations;
create policy user_locations_insert_owner_authenticated
on public.user_locations
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy user_locations_select_owner_or_admin_authenticated
on public.user_locations
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and lower(u.role) = 'admin'
  )
);

-- Users table policies: normalize auth call style.
drop policy if exists "Users can view own data" on public.users;
drop policy if exists "Users can update own profile" on public.users;
create policy users_select_own_authenticated
on public.users
for select
to authenticated
using (id = (select auth.uid()));
create policy users_update_own_authenticated
on public.users
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Plan/model/usage policies: normalize auth call style.
drop policy if exists "Plans are viewable by authenticated users" on public.plans;
create policy plans_select_authenticated
on public.plans
for select
to authenticated
using (true);

drop policy if exists "Users can view own model usage" on public.model_usage;
drop policy if exists "Users can insert own model usage" on public.model_usage;
drop policy if exists "Users can update own model usage" on public.model_usage;
create policy model_usage_select_own_authenticated
on public.model_usage
for select
to authenticated
using (user_id = (select auth.uid()));
create policy model_usage_insert_own_authenticated
on public.model_usage
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy model_usage_update_own_authenticated
on public.model_usage
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can view their own usage" on public.usage_tracking;
create policy usage_tracking_select_own_authenticated
on public.usage_tracking
for select
to authenticated
using (user_id = (select auth.uid()));

-- Service-role-only policy for special offers.
drop policy if exists "Service role can manage special offers" on public.special_offers;
create policy special_offers_service_role_all
on public.special_offers
for all
to service_role
using (true)
with check (true);

-- Remove redundant SELECT duplicates in billing tables.
drop policy if exists "Users can view invoices for their workspaces" on public.invoices;
drop policy if exists "Users can view transactions for their workspaces" on public.transactions;
drop policy if exists "Users can view subscriptions for their workspaces" on public.subscriptions;
drop policy if exists "Users can view their own subscriptions by user_id" on public.subscriptions;
create policy subscriptions_select_owner_or_workspace_member
on public.subscriptions
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or exists (
    select 1
    from public.workspaces w
    where w.id = subscriptions.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = subscriptions.workspace_id
      and wm.user_id = (select auth.uid())
  )
);

commit;
