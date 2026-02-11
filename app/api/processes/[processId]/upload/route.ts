export const dynamic = 'force-dynamic'

import { env } from "@/lib/env/runtime-env"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/supabase/types"
import { assertProcessAccess } from "@/lib/server/access/processes"
import { ForbiddenError, NotFoundError } from "@/lib/server/errors"
import {
  enqueueProcessDocumentIngestionJob,
  scheduleQueuedIngestionJob
} from "@/lib/server/jobs/process-ingestion-jobs"
import {
  deleteObjectFromBucket,
  uploadObject
} from "@/lib/server/storage/object-storage"
import { assertUserCanUploadBytes } from "@/lib/billing/storage-quota"
import {
  markObjectInventoryDeleted,
  upsertObjectInventoryRecord
} from "@/lib/server/storage/object-inventory"

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

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron archivos" },
        { status: 400 }
      )
    }

    const uploadedDocuments: any[] = []
    const queuedJobs: any[] = []
    const allowedTypes = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json"
    ])

    for (const file of files) {
      const hasAllowedMime = allowedTypes.has(file.type)
      const hasAllowedExt = !!file.name.match(/\.(pdf|docx|doc|txt|md|csv|json)$/i)

      if (!hasAllowedMime && !hasAllowedExt) {
        continue
      }

      const fileId = crypto.randomUUID()
      const filePath = `${user.id}/${Buffer.from(fileId).toString("base64")}`

      try {
        await assertUserCanUploadBytes(user.id, file.size)
      } catch (quotaError: any) {
        return NextResponse.json(
          { error: quotaError?.message || "Límite de almacenamiento alcanzado" },
          { status: 402 }
        )
      }

      try {
        await uploadObject({
          bucket: "files",
          key: filePath,
          file,
          contentType: file.type || "application/octet-stream",
          metadata: {
            user_id: user.id,
            process_id: processId,
            source: "process_upload"
          }
        })
      } catch (uploadError) {
        console.error("Error uploading file to storage:", uploadError)
        continue
      }

      const { data: createdDocument, error: docError } = await supabaseAdmin
        .from("process_documents")
        .insert([
          {
            process_id: processId,
            user_id: user.id,
            file_name: file.name,
            storage_path: filePath,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            status: "pending",
            metadata: {}
          }
        ])
        .select("*")
        .single()

      if (docError || !createdDocument) {
        await deleteObjectFromBucket(filePath, "files").catch(() => undefined)
        await markObjectInventoryDeleted("files", filePath).catch(() => undefined)
        continue
      }

      await upsertObjectInventoryRecord({
        ownerUserId: user.id,
        workspaceId: access.process.workspace_id || null,
        bucket: "files",
        objectPath: filePath,
        sizeBytes: file.size,
        contentType: file.type || "application/octet-stream",
        sourceTable: "process_documents",
        sourceId: createdDocument.id,
        metadata: {
          process_id: processId,
          source: "process_upload"
        }
      })

      uploadedDocuments.push(createdDocument)

      const job = await enqueueProcessDocumentIngestionJob({
        processId,
        documentId: createdDocument.id,
        ownerUserId: user.id,
        workspaceId: access.process.workspace_id,
        metadata: (createdDocument.metadata as Record<string, any>) || {}
      })
      queuedJobs.push(job)
    }

    if (uploadedDocuments.length === 0) {
      return NextResponse.json(
        { error: "No se pudieron subir archivos válidos" },
        { status: 400 }
      )
    }

    await supabaseAdmin
      .from("processes")
      .update({ indexing_status: "processing" })
      .eq("id", processId)
      .eq("indexing_status", "pending")

    for (const job of queuedJobs) {
      scheduleQueuedIngestionJob(job.id)
    }

    return NextResponse.json({
      success: true,
      documents: uploadedDocuments,
      queued: queuedJobs.length,
      jobs: queuedJobs.map((job) => ({
        id: job.id,
        document_id: job.document_id,
        status: job.status
      })),
      message: `${uploadedDocuments.length} documento(s) subido(s) y encolado(s)`
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error al subir documentos",
        details: error?.message || "Unknown error",
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}
