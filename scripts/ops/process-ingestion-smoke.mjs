#!/usr/bin/env node

const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(
  /\/$/,
  ""
)
const cronToken = process.env.PROCESS_INGEST_CRON_SECRET || process.env.WOMPI_CRON_SECRET || ""
const limit = Number.parseInt(process.env.PROCESS_INGEST_SMOKE_LIMIT || "1", 10)
const concurrency = Number.parseInt(
  process.env.PROCESS_INGEST_SMOKE_CONCURRENCY || "1",
  10
)
const staleScanLimit = Number.parseInt(
  process.env.PROCESS_INGEST_SMOKE_STALE_SCAN_LIMIT || "10",
  10
)

if (!appUrl) {
  console.error("Missing APP_URL or NEXT_PUBLIC_APP_URL")
  process.exit(1)
}

if (!cronToken) {
  console.error("Missing PROCESS_INGEST_CRON_SECRET (or WOMPI_CRON_SECRET)")
  process.exit(1)
}

function url(path) {
  return `${appUrl}${path}`
}

async function requestJson(path, method = "GET", body) {
  const response = await fetch(url(path), {
    method,
    headers: {
      Authorization: `Bearer ${cronToken}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const payload = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, payload }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  console.log("[ingestion-smoke] Starting smoke check...")

  const cronResult = await requestJson(
    `/api/cron/process-ingestion?limit=${Math.max(1, limit)}&concurrency=${Math.max(
      1,
      concurrency
    )}&stale_scan_limit=${Math.max(1, staleScanLimit)}`
  )

  assert(
    cronResult.ok,
    `Cron route failed: ${cronResult.status} ${JSON.stringify(cronResult.payload)}`
  )
  assert(
    cronResult.payload && cronResult.payload.success === true,
    "Cron route payload missing success=true"
  )

  const metricsResult = await requestJson("/api/internal/process-ingestion/metrics")
  assert(
    metricsResult.ok,
    `Metrics route failed: ${metricsResult.status} ${JSON.stringify(metricsResult.payload)}`
  )
  assert(
    metricsResult.payload && metricsResult.payload.success === true,
    "Metrics payload missing success=true"
  )

  const summary = {
    processed: cronResult.payload.processed || 0,
    queue_before: cronResult.payload.queue_depth_before || 0,
    queue_after: cronResult.payload.queue_depth_after || 0,
    stale_timed_out: cronResult.payload.stale_result?.timed_out || 0,
    stale_requeued: cronResult.payload.stale_result?.requeued || 0,
    p95_ms: metricsResult.payload.metrics?.p95_ms || 0,
    p99_ms: metricsResult.payload.metrics?.p99_ms || 0
  }

  console.log("[ingestion-smoke] OK", JSON.stringify(summary))
}

main().catch((error) => {
  console.error("[ingestion-smoke] FAILED", error.message)
  process.exit(1)
})
