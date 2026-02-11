export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/supabase/types"
import { env } from "@/lib/env/runtime-env"
import { assertProcessAccess } from "@/lib/server/access/processes"
import { ForbiddenError, NotFoundError } from "@/lib/server/errors"
import {
  enqueuePendingDocumentsForProcess,
  enqueueProcessDocumentIngestionJob,
  scheduleQueuedIngestionJob
} from "@/lib/server/jobs/process-ingestion-jobs"

export async function POST(
  request: Request,
  { params }: { params: { processId: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { processId } = params
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const requestedDocumentId =
      typeof body.document_id === "string" ? body.document_id : undefined

    const supabaseAdmin = createSupabaseClient<Database>(
      env.supabaseUrl(),
      env.supabaseServiceRole()
    )

    let access
    try {
      access = await assertProcessAccess(supabaseAdmin, processId, user.id)
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: "No tienes acceso a este proceso" },
          { status: 403 }
        )
      }
      throw error
    }

    const queuedJobs = []

    if (requestedDocumentId) {
      const { data: document, error: documentError } = await supabaseAdmin
        .from("process_documents")
        .select("id,process_id,metadata")
        .eq("id", requestedDocumentId)
        .single()

      if (documentError || !document) {
        return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 })
      }

      if (document.process_id !== processId) {
        return NextResponse.json(
          { error: "El documento no pertenece al proceso indicado" },
          { status: 400 }
        )
      }

      const job = await enqueueProcessDocumentIngestionJob({
        processId,
        documentId: document.id,
        ownerUserId: user.id,
        workspaceId: access.process.workspace_id,
        metadata: (document.metadata as Record<string, any>) || {}
      })
      queuedJobs.push(job)
    } else {
      const jobs = await enqueuePendingDocumentsForProcess({
        processId,
        ownerUserId: user.id,
        workspaceId: access.process.workspace_id
      })
      queuedJobs.push(...jobs)
    }

    if (queuedJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay documentos pendientes por encolar",
        queued: 0
      })
    }

    for (const job of queuedJobs) {
      scheduleQueuedIngestionJob(job.id)
    }

    return NextResponse.json(
      {
        success: true,
        message: "Ingestion encolada",
        queued: queuedJobs.length,
        jobs: queuedJobs.map((job: any) => ({
          id: job.id,
          document_id: job.document_id,
          status: job.status
        }))
      },
      { status: 202 }
    )
  } catch (error: any) {
    console.error("❌ Error encolando ingestion:", error)
    return NextResponse.json(
      {
        error: "Error al encolar documentos",
        details: error.message
      },
      { status: 500 }
    )
  }
}
