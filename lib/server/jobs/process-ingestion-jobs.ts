import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/env/runtime-env"
import { Database } from "@/supabase/types"
import { ragBackendService } from "@/lib/services/rag-backend"
import {
  getProcessIngestionMetricsSnapshot,
  recordProcessIngestionMetric
} from "@/lib/observability/process-ingestion-metrics"
import { downloadObjectFromBucket } from "@/lib/server/storage/object-storage"

const JOB_TABLE = "process_ingestion_jobs"
const DEFAULT_TIMEOUT_SECONDS = getIntFromEnv(
  process.env.PROCESS_INGEST_TIMEOUT_SECONDS,
  120
)
const DEFAULT_MAX_ATTEMPTS = getIntFromEnv(
  process.env.PROCESS_INGEST_MAX_ATTEMPTS,
  3
)
const DEFAULT_RETRY_BASE_SECONDS = getIntFromEnv(
  process.env.PROCESS_INGEST_RETRY_BASE_SECONDS,
  15
)
const DEFAULT_AUTORUN_CONCURRENCY = getIntFromEnv(
  process.env.PROCESS_INGEST_AUTORUN_CONCURRENCY,
  2
)
const RUNNING_JOB_GRACE_SECONDS = getIntFromEnv(
  process.env.PROCESS_INGEST_RUNNING_GRACE_SECONDS,
  30
)
const JOB_AUTORUN_ENABLED = process.env.PROCESS_INGEST_JOB_AUTORUN !== "false"

const runningJobs = new Set<string>()
const autorunQueue: string[] = []
const autorunQueueSet = new Set<string>()
const delayedAutorunTimers = new Map<string, NodeJS.Timeout>()
let autorunActiveRuns = 0

export type ProcessIngestionJobStatus =
  | "queued"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timeout"

export interface ProcessIngestionJob {
  id: string
  process_id: string
  document_id: string
  workspace_id: string | null
  owner_user_id: string
  status: ProcessIngestionJobStatus
  idempotency_key: string
  payload: Record<string, any>
  result: Record<string, any> | null
  error_message: string | null
  attempt_count: number
  max_attempts: number
  timeout_seconds: number
  next_retry_at: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

interface EnqueueOptions {
  processId: string
  documentId: string
  ownerUserId: string
  workspaceId?: string | null
  idempotencyKey?: string
  metadata?: Record<string, any>
}

function getIntFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getSupabaseAdmin() {
  return createSupabaseClient<Database>(
    env.supabaseUrl(),
    env.supabaseServiceRole()
  )
}

function isMissingTableError(error: any): boolean {
  return (
    error?.code === "42P01" ||
    /does not exist/i.test(String(error?.message || ""))
  )
}

function sanitizeProcessingError(message: string): string {
  if (message.includes("DOCLING_BASE_URL")) {
    return "Error de configuracion del servicio de procesamiento"
  }
  if (message.toLowerCase().includes("timeout")) {
    return "El proceso supero el tiempo limite. Intenta nuevamente."
  }
  if (
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("fetch")
  ) {
    return "No fue posible comunicarse con el backend de procesamiento."
  }
  return message
}

async function getJobById(jobId: string): Promise<ProcessIngestionJob | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .select("*")
    .eq("id", jobId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as ProcessIngestionJob | null) ?? null
}

export async function enqueueProcessDocumentIngestionJob(
  options: EnqueueOptions
): Promise<ProcessIngestionJob> {
  const supabaseAdmin = getSupabaseAdmin()
  const now = new Date().toISOString()
  const idempotencyKey =
    options.idempotencyKey ||
    `process-ingest:${options.processId}:${options.documentId}`

  const insertPayload = {
    process_id: options.processId,
    document_id: options.documentId,
    workspace_id: options.workspaceId || null,
    owner_user_id: options.ownerUserId,
    status: "queued",
    idempotency_key: idempotencyKey,
    payload: options.metadata || {},
    result: null,
    error_message: null,
    attempt_count: 0,
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    timeout_seconds: DEFAULT_TIMEOUT_SECONDS,
    next_retry_at: null,
    started_at: null,
    finished_at: null,
    created_at: now,
    updated_at: now
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .insert(insertPayload)
    .select("*")
    .single()

  let job = inserted as ProcessIngestionJob | null

  if (insertError) {
    if (isMissingTableError(insertError)) {
      throw new Error(
        "La tabla process_ingestion_jobs no existe. Ejecuta la migracion antes de usar ingesta asincrona."
      )
    }

    if (insertError.code !== "23505") {
      throw insertError
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from(JOB_TABLE as any)
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .single()

    if (existingError) {
      throw existingError
    }

    job = existing as ProcessIngestionJob
  }

  if (!job) {
    throw new Error("No se pudo encolar el trabajo de ingestion")
  }

  await supabaseAdmin
    .from("process_documents")
    .update({
      status: "pending",
      error_message: null,
      updated_at: now
    })
    .eq("id", options.documentId)
    .neq("status", "indexed")

  await supabaseAdmin
    .from("processes")
    .update({
      indexing_status: "processing",
      updated_at: now
    } as any)
    .eq("id", options.processId)

  const queueDepth = await getCurrentQueueDepth().catch(() => 0)
  recordProcessIngestionMetric("enqueue", {
    job_id: job.id,
    process_id: options.processId,
    document_id: options.documentId,
    queue_depth: queueDepth
  })

  return job
}

export async function enqueuePendingDocumentsForProcess(options: {
  processId: string
  ownerUserId: string
  workspaceId?: string | null
}): Promise<ProcessIngestionJob[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: documents, error } = await supabaseAdmin
    .from("process_documents")
    .select("id,metadata")
    .eq("process_id", options.processId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  const jobs: ProcessIngestionJob[] = []
  for (const document of documents || []) {
    const job = await enqueueProcessDocumentIngestionJob({
      processId: options.processId,
      documentId: document.id,
      ownerUserId: options.ownerUserId,
      workspaceId: options.workspaceId || null,
      metadata: (document.metadata as Record<string, any>) || {}
    })
    jobs.push(job)
  }

  return jobs
}

export async function reenqueueProcessForRecovery(options: {
  processId: string
  ownerUserId: string
  workspaceId?: string | null
  reason?: string
}): Promise<ProcessIngestionJob[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const reason = options.reason || "missing_vectors_or_graph"

  const { data: documents, error } = await supabaseAdmin
    .from("process_documents")
    .select("id,status,metadata")
    .eq("process_id", options.processId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  if (!documents || documents.length === 0) {
    return []
  }

  const { data: activeJobs, error: activeJobsError } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .select("document_id,status")
    .eq("process_id", options.processId)
    .in("status", ["queued", "running", "retrying"])

  if (activeJobsError) {
    throw activeJobsError
  }

  const activeDocumentIds = new Set((activeJobs || []).map((job: any) => job.document_id))
  const jobs: ProcessIngestionJob[] = []

  for (const document of documents) {
    if (activeDocumentIds.has(document.id)) {
      continue
    }

    if (document.status === "processing") {
      continue
    }

    const nextMetadata = {
      ...((document.metadata as Record<string, any>) || {}),
      recovery_reason: reason,
      recovery_requested_at: nowIso
    }

    await supabaseAdmin
      .from("process_documents")
      .update({
        status: "pending",
        error_message: null,
        metadata: nextMetadata,
        updated_at: nowIso
      })
      .eq("id", document.id)

    const job = await enqueueProcessDocumentIngestionJob({
      processId: options.processId,
      documentId: document.id,
      ownerUserId: options.ownerUserId,
      workspaceId: options.workspaceId || null,
      idempotencyKey: `process-recovery:${options.processId}:${document.id}:${Date.now()}`,
      metadata: nextMetadata
    })

    jobs.push(job)
  }

  for (const job of jobs) {
    scheduleQueuedIngestionJob(job.id)
  }

  return jobs
}

function calculateNextRetry(attemptCount: number): string {
  const seconds = DEFAULT_RETRY_BASE_SECONDS * 2 ** Math.max(0, attemptCount - 1)
  return new Date(Date.now() + seconds * 1000).toISOString()
}

async function updateProcessStatusFromDocuments(processId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: docs, error } = await supabaseAdmin
    .from("process_documents")
    .select("status")
    .eq("process_id", processId)

  if (error) {
    throw error
  }

  const indexed = (docs || []).filter((doc) => doc.status === "indexed").length
  const processing = (docs || []).filter((doc) => doc.status === "processing").length
  const pending = (docs || []).filter((doc) => doc.status === "pending").length
  const errors = (docs || []).filter((doc) => doc.status === "error").length

  let indexingStatus: "pending" | "processing" | "ready" | "error" = "pending"
  if (errors > 0) {
    indexingStatus = "error"
  } else if (processing > 0 || pending > 0) {
    indexingStatus = "processing"
  } else if (indexed > 0) {
    indexingStatus = "ready"
  }

  const updates: Record<string, any> = {
    indexing_status: indexingStatus,
    updated_at: new Date().toISOString()
  }

  if (indexingStatus === "ready") {
    updates.last_indexed_at = new Date().toISOString()
  }

  await supabaseAdmin.from("processes").update(updates as any).eq("id", processId)
}

function getRetryableFromError(error: any): boolean {
  if (typeof error?.retryable === "boolean") {
    return error.retryable
  }
  return true
}

function isTimeoutError(error: any): boolean {
  const message = String(error?.message || "").toLowerCase()
  const status = Number(error?.status || 0)
  return (
    error?.name === "AbortError" ||
    status === 408 ||
    status === 504 ||
    message.includes("timeout")
  )
}

async function claimJobForRun(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  job: ProcessIngestionJob
): Promise<ProcessIngestionJob | null> {
  if (!["queued", "retrying"].includes(job.status)) {
    return null
  }

  if (
    job.status === "retrying" &&
    job.next_retry_at &&
    new Date(job.next_retry_at).getTime() > Date.now()
  ) {
    return null
  }

  const startedAt = new Date().toISOString()
  const attemptCount = (job.attempt_count || 0) + 1
  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .update({
      status: "running",
      attempt_count: attemptCount,
      started_at: startedAt,
      updated_at: startedAt,
      next_retry_at: null,
      error_message: null
    })
    .eq("id", job.id)
    .eq("status", job.status)
    .eq("attempt_count", job.attempt_count || 0)
    .select("*")
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as ProcessIngestionJob | null) ?? null
}

export async function runProcessIngestionJob(jobId: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const jobStartMs = Date.now()
  const existingJob = await getJobById(jobId)
  if (!existingJob) {
    return
  }

  if (
    existingJob.status === "succeeded" ||
    existingJob.status === "canceled" ||
    existingJob.status === "timeout"
  ) {
    return
  }

  if (
    existingJob.status === "failed" &&
    (existingJob.attempt_count || 0) >= (existingJob.max_attempts || 1)
  ) {
    return
  }

  if (
    existingJob.status === "retrying" &&
    existingJob.next_retry_at &&
    new Date(existingJob.next_retry_at).getTime() > Date.now()
  ) {
    return
  }

  const claimedJob = await claimJobForRun(supabaseAdmin, existingJob)
  if (!claimedJob) {
    return
  }

  const attemptCount = claimedJob.attempt_count || 1
  const startedAt = claimedJob.started_at || new Date().toISOString()
  console.log(
    `[process-ingestion-job] start job_id=${jobId} process_id=${claimedJob.process_id} document_id=${claimedJob.document_id} attempt=${attemptCount}`
  )
  recordProcessIngestionMetric("start", {
    job_id: jobId,
    process_id: claimedJob.process_id,
    document_id: claimedJob.document_id,
    attempt: attemptCount
  })

  try {
    const { data: doc, error: docError } = await supabaseAdmin
      .from("process_documents")
      .select("*")
      .eq("id", claimedJob.document_id)
      .single()

    if (docError || !doc) {
      throw new Error("Documento no encontrado para el trabajo de ingestion")
    }

    const { data: processRecord, error: processError } = await supabaseAdmin
      .from("processes")
      .select("id,workspace_id")
      .eq("id", claimedJob.process_id)
      .single()

    if (processError || !processRecord) {
      throw new Error("Proceso no encontrado para el trabajo de ingestion")
    }

    await supabaseAdmin
      .from("process_documents")
      .update({
        status: "processing",
        error_message: null,
        updated_at: startedAt
      })
      .eq("id", doc.id)

    const fileBlob = await downloadObjectFromBucket(doc.storage_path, "files")

    const file = new File([fileBlob], doc.file_name, {
      type: doc.mime_type || "application/octet-stream"
    })

    const metadata = {
      ...(doc.metadata as Record<string, any>),
      process_id: claimedJob.process_id,
      document_id: claimedJob.document_id,
      user_id: claimedJob.owner_user_id
    }

    await ragBackendService.ingestDocument(
      file,
      processRecord.workspace_id || claimedJob.workspace_id || undefined,
      claimedJob.process_id,
      metadata,
      { timeoutMs: claimedJob.timeout_seconds * 1000 }
    )

    const finishedAt = new Date().toISOString()
    const { data: finalizedJob, error: finalizeError } = await supabaseAdmin
      .from(JOB_TABLE as any)
      .update({
        status: "succeeded",
        result: { document_id: doc.id, duration_ms: Date.now() - jobStartMs },
        error_message: null,
        finished_at: finishedAt,
        next_retry_at: null,
        updated_at: finishedAt
      })
      .eq("id", jobId)
      .eq("status", "running")
      .select("id")
      .maybeSingle()

    if (finalizeError) {
      throw finalizeError
    }

    if (!finalizedJob) {
      console.warn(
        `[process-ingestion-job] completion skipped job_id=${jobId} because status changed externally`
      )
      await updateProcessStatusFromDocuments(claimedJob.process_id)
      return
    }

    await supabaseAdmin
      .from("process_documents")
      .update({
        status: "indexed",
        error_message: null,
        metadata: {
          ...(doc.metadata as Record<string, any>),
          processed_with: "external_rag",
          processed_at: finishedAt
        },
        updated_at: finishedAt
      })
      .eq("id", doc.id)

    await updateProcessStatusFromDocuments(claimedJob.process_id)
    console.log(
      `[process-ingestion-job] success job_id=${jobId} duration_ms=${Date.now() - jobStartMs}`
    )
    recordProcessIngestionMetric("success", {
      job_id: jobId,
      process_id: claimedJob.process_id,
      document_id: claimedJob.document_id,
      attempt: attemptCount,
      duration_ms: Date.now() - jobStartMs
    })
  } catch (error: any) {
    const timeoutError = isTimeoutError(error)
    const retryable = getRetryableFromError(error)
    const canRetry = retryable && attemptCount < (claimedJob.max_attempts || 1)
    const errorMessage = sanitizeProcessingError(
      error?.message || "Error desconocido en ingestion"
    )
    const finishedAt = new Date().toISOString()
    const status = canRetry ? "retrying" : timeoutError ? "timeout" : "failed"
    const nextRetryAt = canRetry ? calculateNextRetry(attemptCount) : null

    const { data: transitionedJob, error: transitionError } = await supabaseAdmin
      .from(JOB_TABLE as any)
      .update({
        status,
        error_message: errorMessage,
        next_retry_at: nextRetryAt,
        finished_at: canRetry ? null : finishedAt,
        updated_at: finishedAt
      })
      .eq("id", jobId)
      .eq("status", "running")
      .select("id")
      .maybeSingle()

    if (transitionError) {
      throw transitionError
    }

    if (!transitionedJob) {
      console.warn(
        `[process-ingestion-job] transition skipped job_id=${jobId} because status changed externally`
      )
      await updateProcessStatusFromDocuments(claimedJob.process_id)
      return
    }

    await supabaseAdmin
      .from("process_documents")
      .update({
        status: canRetry ? "pending" : "error",
        error_message: canRetry ? null : errorMessage,
        updated_at: finishedAt
      })
      .eq("id", claimedJob.document_id)

    await updateProcessStatusFromDocuments(claimedJob.process_id)

    if (timeoutError) {
      recordProcessIngestionMetric("timeout", {
        job_id: jobId,
        process_id: claimedJob.process_id,
        document_id: claimedJob.document_id,
        attempt: attemptCount,
        will_retry: canRetry
      })
    }

    if (canRetry && JOB_AUTORUN_ENABLED) {
      const retryDelayMs = Math.max(
        0,
        new Date(nextRetryAt as string).getTime() - Date.now()
      )
      console.warn(
        `[process-ingestion-job] retry job_id=${jobId} attempt=${attemptCount} next_retry_ms=${retryDelayMs} error="${errorMessage}"`
      )
      recordProcessIngestionMetric("retry", {
        job_id: jobId,
        process_id: claimedJob.process_id,
        document_id: claimedJob.document_id,
        attempt: attemptCount,
        retry_delay_ms: retryDelayMs,
        error: errorMessage
      })
      scheduleQueuedIngestionJob(jobId, retryDelayMs)
    } else {
      console.error(
        `[process-ingestion-job] failed job_id=${jobId} attempt=${attemptCount} duration_ms=${Date.now() - jobStartMs} error="${errorMessage}"`
      )
      if (!timeoutError) {
        recordProcessIngestionMetric("failed", {
          job_id: jobId,
          process_id: claimedJob.process_id,
          document_id: claimedJob.document_id,
          attempt: attemptCount,
          duration_ms: Date.now() - jobStartMs,
          error: errorMessage
        })
      }
    }
  }
}

function enqueueAutorunJob(jobId: string) {
  if (runningJobs.has(jobId) || autorunQueueSet.has(jobId)) {
    return
  }
  autorunQueue.push(jobId)
  autorunQueueSet.add(jobId)
  pumpAutorunQueue()
}

function removeFromAutorunQueue(jobId: string) {
  if (!autorunQueueSet.has(jobId)) {
    return
  }
  autorunQueueSet.delete(jobId)
  for (let index = autorunQueue.length - 1; index >= 0; index -= 1) {
    if (autorunQueue[index] === jobId) {
      autorunQueue.splice(index, 1)
    }
  }
}

function pumpAutorunQueue() {
  if (!JOB_AUTORUN_ENABLED) {
    return
  }
  const concurrency = Math.max(1, DEFAULT_AUTORUN_CONCURRENCY)
  while (autorunActiveRuns < concurrency && autorunQueue.length > 0) {
    const jobId = autorunQueue.shift()
    if (!jobId) {
      break
    }
    autorunQueueSet.delete(jobId)
    if (runningJobs.has(jobId)) {
      continue
    }
    runningJobs.add(jobId)
    autorunActiveRuns += 1
    void runProcessIngestionJob(jobId).finally(() => {
      runningJobs.delete(jobId)
      autorunActiveRuns = Math.max(0, autorunActiveRuns - 1)
      pumpAutorunQueue()
    })
  }
}

export function unscheduleQueuedIngestionJob(jobId: string) {
  const timer = delayedAutorunTimers.get(jobId)
  if (timer) {
    clearTimeout(timer)
    delayedAutorunTimers.delete(jobId)
  }
  removeFromAutorunQueue(jobId)
}

export function scheduleQueuedIngestionJob(jobId: string, delayMs = 0) {
  if (!JOB_AUTORUN_ENABLED) {
    return
  }
  if (
    runningJobs.has(jobId) ||
    autorunQueueSet.has(jobId) ||
    delayedAutorunTimers.has(jobId)
  ) {
    return
  }
  const safeDelay = Math.max(0, delayMs)
  if (safeDelay === 0) {
    enqueueAutorunJob(jobId)
    return
  }

  const timer = setTimeout(() => {
    delayedAutorunTimers.delete(jobId)
    enqueueAutorunJob(jobId)
  }, safeDelay)
  delayedAutorunTimers.set(jobId, timer)
}

export async function getProcessIngestionJobs(options: {
  processId: string
  limit?: number
}): Promise<ProcessIngestionJob[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .select("*")
    .eq("process_id", options.processId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50)

  if (error) {
    if (isMissingTableError(error)) {
      return []
    }
    throw error
  }

  return (data as ProcessIngestionJob[]) || []
}

export async function getDueIngestionJobs(limit = 10): Promise<ProcessIngestionJob[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .select("*")
    .in("status", ["queued", "retrying"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) {
      return []
    }
    throw error
  }

  return (data as ProcessIngestionJob[]) || []
}

export async function timeoutStaleRunningIngestionJobs(
  limit = 50
): Promise<{ timed_out: number; requeued: number; job_ids: string[] }> {
  const supabaseAdmin = getSupabaseAdmin()
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const { data: runningJobs, error } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .select(
      "id,process_id,document_id,started_at,timeout_seconds,attempt_count,max_attempts"
    )
    .eq("status", "running")
    .not("started_at", "is", null)
    .order("started_at", { ascending: true })
    .limit(Math.max(1, limit))

  if (error) {
    if (isMissingTableError(error)) {
      return { timed_out: 0, requeued: 0, job_ids: [] }
    }
    throw error
  }

  let timedOutCount = 0
  let requeuedCount = 0
  const jobIds: string[] = []
  const touchedProcesses = new Set<string>()

  for (const candidate of (runningJobs as ProcessIngestionJob[]) || []) {
    if (!candidate.started_at) {
      continue
    }
    const startedAtMs = new Date(candidate.started_at).getTime()
    if (!Number.isFinite(startedAtMs)) {
      continue
    }

    const timeoutSeconds =
      Number.isFinite(candidate.timeout_seconds) && candidate.timeout_seconds > 0
        ? candidate.timeout_seconds
        : DEFAULT_TIMEOUT_SECONDS
    const timeoutAtMs = startedAtMs + (timeoutSeconds + RUNNING_JOB_GRACE_SECONDS) * 1000
    if (timeoutAtMs > nowMs) {
      continue
    }

    const attemptCount = candidate.attempt_count || 1
    const canRetry = attemptCount < (candidate.max_attempts || 1)
    const nextRetryAt = canRetry ? calculateNextRetry(attemptCount) : null
    const nextStatus: ProcessIngestionJobStatus = canRetry ? "retrying" : "timeout"
    const timeoutMessage = "Timeout por estancamiento del worker de ingestion"

    const { data: transitioned, error: transitionError } = await supabaseAdmin
      .from(JOB_TABLE as any)
      .update({
        status: nextStatus,
        error_message: timeoutMessage,
        next_retry_at: nextRetryAt,
        finished_at: canRetry ? null : nowIso,
        updated_at: nowIso
      })
      .eq("id", candidate.id)
      .eq("status", "running")
      .select("id")
      .maybeSingle()

    if (transitionError) {
      throw transitionError
    }
    if (!transitioned) {
      continue
    }

    await supabaseAdmin
      .from("process_documents")
      .update({
        status: canRetry ? "pending" : "error",
        error_message: canRetry ? null : timeoutMessage,
        updated_at: nowIso
      })
      .eq("id", candidate.document_id)

    touchedProcesses.add(candidate.process_id)
    jobIds.push(candidate.id)
    if (canRetry) {
      requeuedCount += 1
    } else {
      timedOutCount += 1
    }

    recordProcessIngestionMetric("timeout", {
      job_id: candidate.id,
      process_id: candidate.process_id,
      document_id: candidate.document_id,
      attempt: attemptCount,
      stale_running: true,
      will_retry: canRetry
    })
  }

  for (const processId of touchedProcesses) {
    await updateProcessStatusFromDocuments(processId)
  }

  return {
    timed_out: timedOutCount,
    requeued: requeuedCount,
    job_ids: jobIds
  }
}

export async function cancelProcessIngestionJob(options: {
  processId: string
  jobId: string
  ownerUserId: string
}): Promise<ProcessIngestionJob | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .update({
      status: "canceled",
      finished_at: now,
      updated_at: now,
      error_message: "Trabajo cancelado por el usuario"
    })
    .eq("id", options.jobId)
    .eq("process_id", options.processId)
    .eq("owner_user_id", options.ownerUserId)
    .in("status", ["queued", "retrying", "running"])
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) {
      return null
    }
    throw error
  }

  if (data) {
    unscheduleQueuedIngestionJob(options.jobId)
    await supabaseAdmin
      .from("process_documents")
      .update({
        status: "error",
        error_message: "Trabajo cancelado por el usuario",
        updated_at: now
      })
      .eq("id", (data as ProcessIngestionJob).document_id)

    recordProcessIngestionMetric("canceled", {
      job_id: options.jobId,
      process_id: options.processId,
      document_id: (data as ProcessIngestionJob).document_id
    })
  }

  await updateProcessStatusFromDocuments(options.processId)
  return (data as ProcessIngestionJob | null) ?? null
}

export async function retryProcessIngestionJob(options: {
  processId: string
  jobId: string
  ownerUserId: string
}): Promise<ProcessIngestionJob | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .update({
      status: "queued",
      error_message: null,
      attempt_count: 0,
      started_at: null,
      finished_at: null,
      next_retry_at: null,
      updated_at: now
    })
    .eq("id", options.jobId)
    .eq("process_id", options.processId)
    .eq("owner_user_id", options.ownerUserId)
    .in("status", ["failed", "timeout", "canceled"])
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) {
      return null
    }
    throw error
  }

  const job = (data as ProcessIngestionJob | null) ?? null
  if (job) {
    await supabaseAdmin
      .from("process_documents")
      .update({
        status: "pending",
        error_message: null,
        updated_at: now
      })
      .eq("id", job.document_id)

    await supabaseAdmin
      .from("processes")
      .update({
        indexing_status: "processing",
        updated_at: now
      } as any)
      .eq("id", options.processId)

    recordProcessIngestionMetric("retry", {
      job_id: options.jobId,
      process_id: options.processId,
      document_id: job.document_id,
      attempt: 0,
      source: "manual_retry"
    })
  }

  return job
}

export async function getCurrentQueueDepth(): Promise<number> {
  const supabaseAdmin = getSupabaseAdmin()
  const { count, error } = await supabaseAdmin
    .from(JOB_TABLE as any)
    .select("id", { head: true, count: "exact" })
    .in("status", ["queued", "running", "retrying"])

  if (error) {
    if (isMissingTableError(error)) {
      return 0
    }
    throw error
  }

  return count || 0
}

export function getIngestionMetricsSnapshot() {
  return getProcessIngestionMetricsSnapshot()
}
