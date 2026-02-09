export const dynamic = 'force-dynamic'

import { env } from "@/lib/env/runtime-env"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/supabase/types"
import { assertProcessAccess } from "@/lib/server/access/processes"
import { ForbiddenError, NotFoundError } from "@/lib/server/errors"

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

    try {
      await assertProcessAccess(supabaseAdmin, processId, user.id)
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

      const { error: uploadError } = await supabaseAdmin.storage
        .from("files")
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        console.error("❌ Error uploading file to storage:", uploadError)
        // Try to create bucket if it doesn't exist
        if (uploadError.message?.includes("bucket") || uploadError.message?.includes("not found")) {
          console.log("⚠️ Storage bucket 'files' may not exist. Please create it in Supabase.")
        }
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
        continue
      }

      uploadedDocuments.push(createdDocument)
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

    return NextResponse.json({
      success: true,
      documents: uploadedDocuments,
      message: `${uploadedDocuments.length} documento(s) subido(s) correctamente`
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

