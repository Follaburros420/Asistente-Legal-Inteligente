export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { requireAdminApiAccess } from "@/lib/admin/require-admin-api"
import {
  getCurrentQueueDepth,
  getDueIngestionJobs,
  getIngestionMetricsSnapshot,
  runProcessIngestionJob,
  timeoutStaleRunningIngestionJobs
} from "@/lib/server/jobs/process-ingestion-jobs"
import { recordProcessIngestionMetric } from "@/lib/observability/process-ingestion-metrics"

const DEFAULT_DRAIN_LIMIT = parsePositiveInt(process.env.PROCESS_INGEST_DRAIN_LIMIT, 5)
const MAX_DRAIN_LIMIT = parsePositiveInt(process.env.PROCESS_INGEST_DRAIN_MAX_LIMIT, 25)
const DEFAULT_DRAIN_CONCURRENCY = parsePositiveInt(
  process.env.PROCESS_INGEST_DRAIN_CONCURRENCY,
  3
)
const DEFAULT_STALE_SCAN_LIMIT = parsePositiveInt(
  process.env.PROCESS_INGEST_STALE_SCAN_LIMIT,
  50
)

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

async function runWithConcurrency(jobIds: string[], concurrency: number) {
  const queue = [...jobIds]
  const workers = Array.from({ length: Math.min(concurrency, jobIds.length) }, async () => {
    while (queue.length > 0) {
      const jobId = queue.shift()
      if (!jobId) {
        break
      }
      await runProcessIngestionJob(jobId)
    }
  })

  await Promise.all(workers)
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminApiAccess()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const limit = Number.parseInt(String(body.limit ?? DEFAULT_DRAIN_LIMIT), 10)
    const safeLimit = clamp(
      Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DRAIN_LIMIT,
      1,
      MAX_DRAIN_LIMIT
    )
    const concurrency = Number.parseInt(
      String(body.concurrency ?? DEFAULT_DRAIN_CONCURRENCY),
      10
    )
    const safeConcurrency = clamp(
      Number.isFinite(concurrency) && concurrency > 0
        ? concurrency
        : DEFAULT_DRAIN_CONCURRENCY,
      1,
      Math.min(10, safeLimit)
    )
    const staleScanLimit = clamp(
      Number.parseInt(
        String(body.stale_scan_limit ?? Math.max(DEFAULT_STALE_SCAN_LIMIT, safeLimit * 2)),
        10
      ) || DEFAULT_STALE_SCAN_LIMIT,
      1,
      200
    )

    const staleResult = await timeoutStaleRunningIngestionJobs(staleScanLimit)
    const dueJobs = await getDueIngestionJobs(safeLimit)
    const queueDepthBefore = await getCurrentQueueDepth().catch(() => 0)
    await runWithConcurrency(
      dueJobs.map((job) => job.id),
      safeConcurrency
    )
    const queueDepthAfter = await getCurrentQueueDepth().catch(() => 0)

    recordProcessIngestionMetric("drain", {
      source: "admin_route",
      requested_limit: safeLimit,
      concurrency: safeConcurrency,
      stale_scan_limit: staleScanLimit,
      stale_timed_out: staleResult.timed_out,
      stale_requeued: staleResult.requeued,
      processed: dueJobs.length,
      queue_depth_before: queueDepthBefore,
      queue_depth: queueDepthAfter
    })

    return NextResponse.json({
      success: true,
      processed: dueJobs.length,
      requested_limit: safeLimit,
      concurrency: safeConcurrency,
      stale_scan_limit: staleScanLimit,
      stale_result: staleResult,
      job_ids: dueJobs.map((job) => job.id),
      queue_depth_before: queueDepthBefore,
      queue_depth_after: queueDepthAfter,
      metrics: getIngestionMetricsSnapshot()
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error drenando cola de ingestion (admin)",
        details: error.message
      },
      { status: 500 }
    )
  }
}
