import { assertRuntimeEnv } from "@/lib/env"
import { initProcessIngestionMetrics } from "@/lib/observability/process-ingestion-metrics"

export function register() {
  if (process.env.NODE_ENV === "test") return
  if (process.env.NEXT_PHASE === "phase-production-build") return

  assertRuntimeEnv()
  initProcessIngestionMetrics()
}

