-- Migration: create process_ingestion_jobs
-- Description: async job queue for process document ingestion orchestration

create table if not exists process_ingestion_jobs (
  id uuid primary key default uuid_generate_v4(),
  process_id uuid not null references processes(id) on delete cascade,
  document_id uuid not null references process_documents(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'retrying', 'succeeded', 'failed', 'canceled', 'timeout')),
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts > 0),
  timeout_seconds integer not null default 120 check (timeout_seconds > 0),
  next_retry_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_process_ingestion_jobs_idempotency
  on process_ingestion_jobs(idempotency_key);

create index if not exists idx_process_ingestion_jobs_process_status
  on process_ingestion_jobs(process_id, status, created_at desc);

create index if not exists idx_process_ingestion_jobs_retry
  on process_ingestion_jobs(status, next_retry_at);

create index if not exists idx_process_ingestion_jobs_owner
  on process_ingestion_jobs(owner_user_id, created_at desc);

alter table process_ingestion_jobs enable row level security;

drop policy if exists "Select own ingestion jobs" on process_ingestion_jobs;
create policy "Select own ingestion jobs"
  on process_ingestion_jobs
  for select
  using (owner_user_id = auth.uid());

drop policy if exists "Insert own ingestion jobs" on process_ingestion_jobs;
create policy "Insert own ingestion jobs"
  on process_ingestion_jobs
  for insert
  with check (owner_user_id = auth.uid());

drop policy if exists "Update own ingestion jobs" on process_ingestion_jobs;
create policy "Update own ingestion jobs"
  on process_ingestion_jobs
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Delete own ingestion jobs" on process_ingestion_jobs;
create policy "Delete own ingestion jobs"
  on process_ingestion_jobs
  for delete
  using (owner_user_id = auth.uid());

drop trigger if exists update_process_ingestion_jobs_updated_at on process_ingestion_jobs;
create trigger update_process_ingestion_jobs_updated_at
  before update on process_ingestion_jobs
  for each row
  execute procedure update_updated_at_column();

comment on table process_ingestion_jobs is 'Queue de trabajos de ingestion de documentos por proceso';
