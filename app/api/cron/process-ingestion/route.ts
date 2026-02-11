export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
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

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "")
  const expected =
    process.env.PROCESS_INGEST_CRON_SECRET || process.env.WOMPI_CRON_SECRET || ""
  return Boolean(expected) && token === expected
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

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Number.parseInt(
      url.searchParams.get("limit") || String(DEFAULT_DRAIN_LIMIT),
      10
    )
    const concurrency = Number.parseInt(
      url.searchParams.get("concurrency") || String(DEFAULT_DRAIN_CONCURRENCY),
      10
    )
    const staleScanLimit = Number.parseInt(
      url.searchParams.get("stale_scan_limit") || String(DEFAULT_STALE_SCAN_LIMIT),
      10
    )

    const safeLimit = clamp(
      Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DRAIN_LIMIT,
      1,
      MAX_DRAIN_LIMIT
    )
    const safeConcurrency = clamp(
      Number.isFinite(concurrency) && concurrency > 0
        ? concurrency
        : DEFAULT_DRAIN_CONCURRENCY,
      1,
      Math.min(10, safeLimit)
    )
    const safeStaleScanLimit = clamp(
      Number.isFinite(staleScanLimit) && staleScanLimit > 0
        ? staleScanLimit
        : DEFAULT_STALE_SCAN_LIMIT,
      1,
      200
    )

    const staleResult = await timeoutStaleRunningIngestionJobs(safeStaleScanLimit)
    const dueJobs = await getDueIngestionJobs(safeLimit)
    const queueDepthBefore = await getCurrentQueueDepth().catch(() => 0)
    await runWithConcurrency(
      dueJobs.map((job) => job.id),
      safeConcurrency
    )
    const queueDepthAfter = await getCurrentQueueDepth().catch(() => 0)

    recordProcessIngestionMetric("drain", {
      source: "cron_route",
      requested_limit: safeLimit,
      concurrency: safeConcurrency,
      stale_scan_limit: safeStaleScanLimit,
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
      stale_scan_limit: safeStaleScanLimit,
      stale_result: staleResult,
      job_ids: dueJobs.map((job) => job.id),
      queue_depth_before: queueDepthBefore,
      queue_depth_after: queueDepthAfter,
      metrics: getIngestionMetricsSnapshot()
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Process ingestion cron failed",
        details: error.message
      },
      { status: 500 }
    )
  }
}
