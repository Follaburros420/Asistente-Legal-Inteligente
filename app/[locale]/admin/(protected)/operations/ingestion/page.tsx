"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Play, Activity, Clock3, AlertTriangle, CheckCircle2 } from "lucide-react"

type JobStatus =
  | "queued"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timeout"

interface RecentJob {
  id: string
  process_id: string
  document_id: string
  status: JobStatus
  attempt_count: number
  max_attempts: number
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

interface IngestionOverview {
  success: boolean
  queue_depth: number
  stale_running_count: number
  status_counts: Record<JobStatus, number>
  metrics: {
    counters: Record<string, number>
    duration_samples: number
    p95_ms: number
    p99_ms: number
    queue_depth_samples: number
    queue_depth_avg: number
    queue_depth_latest: number
  }
  recent_jobs: RecentJob[]
}

const ACTIVE_STATUSES: JobStatus[] = ["queued", "running", "retrying"]

function statusClassName(status: JobStatus): string {
  if (status === "succeeded") {
    return "bg-emerald-500/15 text-emerald-300"
  }
  if (status === "running") {
    return "bg-blue-500/15 text-blue-300"
  }
  if (status === "queued" || status === "retrying") {
    return "bg-amber-500/15 text-amber-300"
  }
  if (status === "canceled") {
    return "bg-gray-500/20 text-gray-200"
  }
  return "bg-red-500/15 text-red-300"
}

export default function ProcessIngestionOperationsPage() {
  const [overview, setOverview] = useState<IngestionOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [draining, setDraining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drainMessage, setDrainMessage] = useState<string | null>(null)

  async function fetchOverview(silent = false) {
    if (!silent) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const response = await fetch("/api/admin/process-ingestion/overview")
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || "No fue posible cargar el overview")
      }
      setOverview(payload as IngestionOverview)
      setError(null)
    } catch (err: any) {
      console.error("Error loading ingestion overview:", err)
      setError(err?.message || "Error de conexión")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleDrainNow() {
    setDraining(true)
    setDrainMessage(null)

    try {
      const response = await fetch("/api/admin/process-ingestion/drain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          limit: 10,
          concurrency: 3
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || "No fue posible drenar la cola")
      }

      setDrainMessage(
        `Drenado ejecutado: ${payload.processed || 0} job(s), cola ${payload.queue_depth_before} -> ${payload.queue_depth_after}`
      )
      await fetchOverview(true)
    } catch (err: any) {
      console.error("Error draining ingestion queue:", err)
      setDrainMessage(err?.message || "Fallo en drenado manual")
    } finally {
      setDraining(false)
    }
  }

  useEffect(() => {
    void fetchOverview(false)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchOverview(true)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const activeCount = useMemo(() => {
    if (!overview) {
      return 0
    }
    return ACTIVE_STATUSES.reduce((acc, status) => acc + (overview.status_counts[status] || 0), 0)
  }, [overview])

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-[360px]">
        <div className="text-gray-500">Cargando operaciones de ingestion...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Operations: Process Ingestion
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Cola asíncrona, latencias y salud operativa del orquestador del monolito.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void fetchOverview(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button onClick={handleDrainNow} disabled={draining}>
            <Play className="h-4 w-4 mr-2" />
            {draining ? "Drenando..." : "Drenar ahora"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
          {error}
        </div>
      )}

      {drainMessage && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-300">
          {drainMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Queue Depth"
          value={overview?.queue_depth ?? 0}
          description="Jobs en queued/running/retrying"
          icon={<Activity className="h-5 w-5 text-blue-500" />}
        />
        <MetricCard
          title="Jobs Activos"
          value={activeCount}
          description="queued + running + retrying"
          icon={<Clock3 className="h-5 w-5 text-amber-500" />}
        />
        <MetricCard
          title="Running Estancados"
          value={overview?.stale_running_count ?? 0}
          description="Superaron timeout + grace"
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
        />
        <MetricCard
          title="Completados"
          value={overview?.status_counts?.succeeded ?? 0}
          description="Estado succeeded"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Latencias y Muestras
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoItem label="p95" value={`${overview?.metrics?.p95_ms ?? 0} ms`} />
            <InfoItem label="p99" value={`${overview?.metrics?.p99_ms ?? 0} ms`} />
            <InfoItem
              label="Duraciones"
              value={String(overview?.metrics?.duration_samples ?? 0)}
            />
            <InfoItem
              label="Queue avg"
              value={String(overview?.metrics?.queue_depth_avg ?? 0)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Contadores de Eventos
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoItem
              label="enqueue"
              value={String(overview?.metrics?.counters?.["event.enqueue"] || 0)}
            />
            <InfoItem
              label="start"
              value={String(overview?.metrics?.counters?.["event.start"] || 0)}
            />
            <InfoItem
              label="success"
              value={String(overview?.metrics?.counters?.["event.success"] || 0)}
            />
            <InfoItem
              label="retry"
              value={String(overview?.metrics?.counters?.["event.retry"] || 0)}
            />
            <InfoItem
              label="failed"
              value={String(overview?.metrics?.counters?.["event.failed"] || 0)}
            />
            <InfoItem
              label="timeout"
              value={String(overview?.metrics?.counters?.["event.timeout"] || 0)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Jobs Recientes</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {overview?.recent_jobs?.length || 0} items
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Job</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Attempts</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Proceso</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Documento</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Error</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.recent_jobs || []).map((job) => (
                <tr
                  key={job.id}
                  className="border-t border-gray-100 dark:border-gray-700/60 align-top"
                >
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                    {job.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClassName(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                    {job.attempt_count}/{job.max_attempts}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                    {job.process_id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                    {job.document_id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 text-xs text-red-500 max-w-[320px] truncate">
                    {job.error_message || "-"}
                  </td>
                </tr>
              ))}
              {(overview?.recent_jobs || []).length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Sin jobs recientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon
}: {
  title: string
  value: string | number
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</h3>
        {icon}
      </div>
      <div className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}
