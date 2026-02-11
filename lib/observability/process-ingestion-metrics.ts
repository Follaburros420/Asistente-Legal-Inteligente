type ProcessIngestionMetricEvent =
  | "enqueue"
  | "start"
  | "success"
  | "retry"
  | "timeout"
  | "failed"
  | "canceled"
  | "drain"

type NumericMap = Record<string, number>

const MAX_DURATION_SAMPLES = 512

const state: {
  initialized: boolean
  counters: NumericMap
  durationsMs: number[]
  queueDepthSamples: number[]
} = {
  initialized: false,
  counters: {},
  durationsMs: [],
  queueDepthSamples: []
}

export function initProcessIngestionMetrics() {
  if (state.initialized) {
    return
  }
  state.initialized = true
  logMetric("init", {
    timeout_ms: Number.parseInt(process.env.RAG_BACKEND_TIMEOUT_MS || "25000", 10),
    max_retries: Number.parseInt(process.env.RAG_BACKEND_MAX_RETRIES || "2", 10),
    ingest_job_autorun: process.env.PROCESS_INGEST_JOB_AUTORUN !== "false"
  })
}

export function recordProcessIngestionMetric(
  event: ProcessIngestionMetricEvent,
  payload: Record<string, any> = {}
) {
  incrementCounter(`event.${event}`)
  if (typeof payload.duration_ms === "number") {
    pushDuration(payload.duration_ms)
  }
  if (typeof payload.queue_depth === "number") {
    pushQueueDepth(payload.queue_depth)
  }
  logMetric(event, payload)
}

export function getProcessIngestionMetricsSnapshot() {
  const p95 = percentile(state.durationsMs, 95)
  const p99 = percentile(state.durationsMs, 99)
  const queueDepthAvg =
    state.queueDepthSamples.length > 0
      ? state.queueDepthSamples.reduce((acc, value) => acc + value, 0) /
        state.queueDepthSamples.length
      : 0

  return {
    counters: { ...state.counters },
    duration_samples: state.durationsMs.length,
    p95_ms: p95,
    p99_ms: p99,
    queue_depth_samples: state.queueDepthSamples.length,
    queue_depth_avg: Number(queueDepthAvg.toFixed(2)),
    queue_depth_latest:
      state.queueDepthSamples.length > 0
        ? state.queueDepthSamples[state.queueDepthSamples.length - 1]
        : 0
  }
}

function incrementCounter(key: string) {
  state.counters[key] = (state.counters[key] || 0) + 1
}

function pushDuration(durationMs: number) {
  state.durationsMs.push(durationMs)
  if (state.durationsMs.length > MAX_DURATION_SAMPLES) {
    state.durationsMs.shift()
  }
}

function pushQueueDepth(depth: number) {
  state.queueDepthSamples.push(depth)
  if (state.queueDepthSamples.length > MAX_DURATION_SAMPLES) {
    state.queueDepthSamples.shift()
  }
}

function percentile(values: number[], p: number): number {
  if (!values.length) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  const safeIndex = Math.max(0, Math.min(sorted.length - 1, index))
  return sorted[safeIndex]
}

function logMetric(event: string, payload: Record<string, any>) {
  console.log(
    JSON.stringify({
      type: "metric.process_ingestion",
      event,
      ts: new Date().toISOString(),
      ...payload
    })
  )
}
