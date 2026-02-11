begin;

-- Tools: avoid SELECT overlap from ALL + SELECT.
drop policy if exists "Allow full access to own tools" on public.tools;
drop policy if exists "Allow view access to non-private tools" on public.tools;
create policy tools_select_authenticated
on public.tools
for select
to authenticated
using ((user_id = (select auth.uid())) or (sharing <> 'private'));
create policy tools_insert_owner_authenticated
on public.tools
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy tools_update_owner_authenticated
on public.tools
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy tools_delete_owner_authenticated
on public.tools
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Process artifacts: split ALL owner policies and merge select semantics.
drop policy if exists "Allow full access to own process_documents" on public.process_documents;
drop policy if exists "Workspace members can view process_documents" on public.process_documents;
create policy process_documents_select_authenticated
on public.process_documents
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or exists (
    select 1
    from public.processes p
    where p.id = process_documents.process_id
      and p.workspace_id is not null
      and is_workspace_member(p.workspace_id, (select auth.uid()))
  )
);
create policy process_documents_insert_owner_authenticated
on public.process_documents
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy process_documents_update_owner_authenticated
on public.process_documents
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy process_documents_delete_owner_authenticated
on public.process_documents
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own process_document_sections" on public.process_document_sections;
drop policy if exists "Workspace members can view process_document_sections" on public.process_document_sections;
create policy process_document_sections_select_authenticated
on public.process_document_sections
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or exists (
    select 1
    from public.processes p
    where p.id = process_document_sections.process_id
      and p.workspace_id is not null
      and is_workspace_member(p.workspace_id, (select auth.uid()))
  )
);
create policy process_document_sections_insert_owner_authenticated
on public.process_document_sections
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy process_document_sections_update_owner_authenticated
on public.process_document_sections
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy process_document_sections_delete_owner_authenticated
on public.process_document_sections
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own process_files" on public.process_files;
drop policy if exists "Allow view access to process files for non-private processes" on public.process_files;
create policy process_files_select_authenticated
on public.process_files
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or process_id in (
    select p.id
    from public.processes p
    where p.sharing <> 'private'
  )
);
create policy process_files_insert_owner_authenticated
on public.process_files
for insert
to authenticated
with check (user_id = (select auth.uid()));
create policy process_files_update_owner_authenticated
on public.process_files
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy process_files_delete_owner_authenticated
on public.process_files
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow full access to own process_transcriptions" on public.process_transcriptions;
create policy process_transcriptions_owner_all_authenticated
on public.process_transcriptions
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Ingestion jobs: merge SELECT policies and scope to authenticated.
drop policy if exists "Delete own ingestion jobs" on public.process_ingestion_jobs;
drop policy if exists "Insert own ingestion jobs" on public.process_ingestion_jobs;
drop policy if exists "Select own ingestion jobs" on public.process_ingestion_jobs;
drop policy if exists "Workspace members can view ingestion jobs" on public.process_ingestion_jobs;
drop policy if exists "Update own ingestion jobs" on public.process_ingestion_jobs;
create policy process_ingestion_jobs_select_authenticated
on public.process_ingestion_jobs
for select
to authenticated
using (
  (owner_user_id = (select auth.uid()))
  or exists (
    select 1
    from public.processes p
    where p.id = process_ingestion_jobs.process_id
      and p.workspace_id is not null
      and is_workspace_member(p.workspace_id, (select auth.uid()))
  )
);
create policy process_ingestion_jobs_insert_authenticated
on public.process_ingestion_jobs
for insert
to authenticated
with check (
  (owner_user_id = (select auth.uid()))
  and exists (
    select 1
    from public.processes p
    where p.id = process_ingestion_jobs.process_id
      and (
        p.user_id = (select auth.uid())
        or (p.workspace_id is not null and is_workspace_member(p.workspace_id, (select auth.uid())))
      )
  )
  and exists (
    select 1
    from public.process_documents d
    where d.id = process_ingestion_jobs.document_id
      and d.process_id = process_ingestion_jobs.process_id
  )
);
create policy process_ingestion_jobs_update_authenticated
on public.process_ingestion_jobs
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));
create policy process_ingestion_jobs_delete_authenticated
on public.process_ingestion_jobs
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

-- Billing and payment policies: keep semantics, tighten role + auth call style.
drop policy if exists "payment_sources_workspace_member_select" on public.payment_sources;
drop policy if exists "payment_sources_workspace_member_insert" on public.payment_sources;
drop policy if exists "payment_sources_workspace_member_update" on public.payment_sources;
drop policy if exists "payment_sources_workspace_member_delete" on public.payment_sources;
create policy payment_sources_workspace_member_select
on public.payment_sources
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = payment_sources.workspace_id
      and wm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = payment_sources.workspace_id
      and w.user_id = (select auth.uid())
  )
);
create policy payment_sources_workspace_member_insert
on public.payment_sources
for insert
to authenticated
with check (
  (user_id = (select auth.uid()))
  and (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = payment_sources.workspace_id
        and wm.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.workspaces w
      where w.id = payment_sources.workspace_id
        and w.user_id = (select auth.uid())
    )
  )
);
create policy payment_sources_workspace_member_update
on public.payment_sources
for update
to authenticated
using (
  (user_id = (select auth.uid()))
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = payment_sources.workspace_id
      and wm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = payment_sources.workspace_id
      and w.user_id = (select auth.uid())
  )
)
with check (
  (user_id = (select auth.uid()))
  and (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = payment_sources.workspace_id
        and wm.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.workspaces w
      where w.id = payment_sources.workspace_id
        and w.user_id = (select auth.uid())
    )
  )
);
create policy payment_sources_workspace_member_delete
on public.payment_sources
for delete
to authenticated
using (
  (user_id = (select auth.uid()))
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = payment_sources.workspace_id
      and wm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = payment_sources.workspace_id
      and w.user_id = (select auth.uid())
  )
);

drop policy if exists "invoices_workspace_member_select" on public.invoices;
drop policy if exists "invoices_workspace_member_insert" on public.invoices;
drop policy if exists "invoices_workspace_member_update" on public.invoices;
drop policy if exists "invoices_workspace_member_delete" on public.invoices;
create policy invoices_workspace_member_select
on public.invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = invoices.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = invoices.workspace_id
      and wm.user_id = (select auth.uid())
  )
);
create policy invoices_workspace_member_insert
on public.invoices
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = invoices.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = invoices.workspace_id
      and wm.user_id = (select auth.uid())
  )
);
create policy invoices_workspace_member_update
on public.invoices
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = invoices.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = invoices.workspace_id
      and wm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = invoices.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = invoices.workspace_id
      and wm.user_id = (select auth.uid())
  )
);
create policy invoices_workspace_member_delete
on public.invoices
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = invoices.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = invoices.workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists "transactions_workspace_member_select" on public.transactions;
drop policy if exists "transactions_workspace_member_insert" on public.transactions;
drop policy if exists "transactions_workspace_member_update" on public.transactions;
drop policy if exists "transactions_workspace_member_delete" on public.transactions;
create policy transactions_workspace_member_select
on public.transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = transactions.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = transactions.workspace_id
      and wm.user_id = (select auth.uid())
  )
);
create policy transactions_workspace_member_insert
on public.transactions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = transactions.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = transactions.workspace_id
      and wm.user_id = (select auth.uid())
  )
);
create policy transactions_workspace_member_update
on public.transactions
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = transactions.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = transactions.workspace_id
      and wm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = transactions.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = transactions.workspace_id
      and wm.user_id = (select auth.uid())
  )
);
create policy transactions_workspace_member_delete
on public.transactions
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = transactions.workspace_id
      and w.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = transactions.workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can insert subscriptions for their workspaces" on public.subscriptions;
drop policy if exists "Users can update subscriptions for their workspaces" on public.subscriptions;
drop policy if exists "subscriptions_select_owner_or_workspace_member" on public.subscriptions;
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
create policy subscriptions_insert_workspace_owner_authenticated
on public.subscriptions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = subscriptions.workspace_id
      and w.user_id = (select auth.uid())
  )
);
create policy subscriptions_update_workspace_owner_authenticated
on public.subscriptions
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = subscriptions.workspace_id
      and w.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = subscriptions.workspace_id
      and w.user_id = (select auth.uid())
  )
);

-- Workspace audit logs: authenticated members/owners only.
drop policy if exists "Workspace members can view audit logs" on public.workspace_audit_logs;
create policy workspace_audit_logs_select_authenticated
on public.workspace_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_audit_logs.workspace_id
      and wm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = workspace_audit_logs.workspace_id
      and w.user_id = (select auth.uid())
  )
);

commit;
