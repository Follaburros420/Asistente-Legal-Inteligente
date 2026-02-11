export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/env/runtime-env"
import { Database } from "@/supabase/types"
import { requireAdminApiAccess } from "@/lib/admin/require-admin-api"
import {
  getCurrentQueueDepth,
  getIngestionMetricsSnapshot,
  ProcessIngestionJobStatus
} from "@/lib/server/jobs/process-ingestion-jobs"

const JOB_TABLE = "process_ingestion_jobs"
const JOB_STATUSES: ProcessIngestionJobStatus[] = [
  "queued",
  "running",
  "retrying",
  "succeeded",
  "failed",
  "canceled",
  "timeout"
]
const STALE_GRACE_SECONDS = parsePositiveInt(
  process.env.PROCESS_INGEST_RUNNING_GRACE_SECONDS,
  30
)

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET() {
  try {
    const auth = await requireAdminApiAccess()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const supabaseAdmin = createSupabaseClient<Database>(
      env.supabaseUrl(),
      env.supabaseServiceRole()
    )

    const statusEntries = await Promise.all(
      JOB_STATUSES.map(async (status) => {
        const { count, error } = await supabaseAdmin
          .from(JOB_TABLE as any)
          .select("id", { head: true, count: "exact" })
          .eq("status", status)
        if (error) {
          return [status, 0] as const
        }
        return [status, count || 0] as const
      })
    )

    const statusCounts = Object.fromEntries(statusEntries)

    const queueDepth = await getCurrentQueueDepth().catch(() => 0)
    const metrics = getIngestionMetricsSnapshot()

    const { data: runningCandidates } = await supabaseAdmin
      .from(JOB_TABLE as any)
      .select("id,started_at,timeout_seconds")
      .eq("status", "running")
      .not("started_at", "is", null)
      .order("started_at", { ascending: true })
      .limit(200)

    const nowMs = Date.now()
    let staleRunningCount = 0
    for (const item of (runningCandidates as any[]) || []) {
      const startedAtMs = new Date(item.started_at).getTime()
      if (!Number.isFinite(startedAtMs)) {
        continue
      }
      const timeoutSeconds =
        Number.isFinite(item.timeout_seconds) && item.timeout_seconds > 0
          ? item.timeout_seconds
          : 120
      const staleAtMs = startedAtMs + (timeoutSeconds + STALE_GRACE_SECONDS) * 1000
      if (staleAtMs <= nowMs) {
        staleRunningCount += 1
      }
    }

    const { data: recentJobs, error: recentError } = await supabaseAdmin
      .from(JOB_TABLE as any)
      .select(
        "id,process_id,document_id,status,attempt_count,max_attempts,error_message,created_at,started_at,finished_at,updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(40)

    if (recentError) {
      return NextResponse.json(
        { error: "Error consultando jobs recientes", details: recentError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      queue_depth: queueDepth,
      stale_running_count: staleRunningCount,
      status_counts: statusCounts,
      metrics,
      recent_jobs: recentJobs || []
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error obteniendo overview de ingestion",
        details: error.message
      },
      { status: 500 }
    )
  }
}
