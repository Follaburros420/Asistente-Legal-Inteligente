export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import {
  getCurrentQueueDepth,
  getIngestionMetricsSnapshot
} from "@/lib/server/jobs/process-ingestion-jobs"

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "")
  const expected =
    process.env.PROCESS_INGEST_CRON_SECRET || process.env.WOMPI_CRON_SECRET || ""

  if (!expected) {
    return false
  }

  return token === expected
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const queueDepth = await getCurrentQueueDepth().catch(() => 0)
    return NextResponse.json({
      success: true,
      queue_depth: queueDepth,
      metrics: getIngestionMetricsSnapshot()
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error obteniendo metricas de ingestion",
        details: error.message
      },
      { status: 500 }
    )
  }
}
