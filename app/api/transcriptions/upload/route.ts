export const dynamic = 'force-dynamic'

import { env } from "@/lib/env/runtime-env"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { canUseTranscription } from "@/lib/billing/plan-access"
import { assertWorkspaceAccess } from "@/lib/server/workspaces/access"
import {
  deleteObjectFromBucket,
  uploadObject
} from "@/lib/server/storage/object-storage"
import { assertUserCanUploadBytes } from "@/lib/billing/storage-quota"
import {
  markObjectInventoryDeleted,
  upsertObjectInventoryRecord
} from "@/lib/server/storage/object-inventory"

export const maxDuration = 300 // 5 minutos para upload de archivos grandes

export async function POST(request: Request) {
  try {
    const profile = await getServerProfile()
    const supabaseAdmin = createClient<Database>(
      env.supabaseUrl(),
      env.supabaseServiceRole()
    )

    const formData = await request.formData()
    const file = formData.get("file") as File
    const name = formData.get("name") as string
    const description = formData.get("description") as string
    const rawWorkspaceId = formData.get("workspace_id")
    const workspace_id =
      typeof rawWorkspaceId === "string" && rawWorkspaceId.trim().length > 0
        ? rawWorkspaceId
        : null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BILLING CHECK: Verify user can use transcriptions
    // ═══════════════════════════════════════════════════════════════════════
    if (env.billingEnabled() === 'true') {
      const canTranscribe = await canUseTranscription(profile.user_id)

      if (!canTranscribe.allowed) {
        return NextResponse.json(
          {
            error: canTranscribe.reason || "Tu plan no incluye transcripciones",
            code: "PLAN_LIMIT_EXCEEDED",
            needsUpgrade: true
          },
          { status: 402 } // Payment Required
        )
      }
    }

    if (workspace_id) {
      const access = await assertWorkspaceAccess(supabaseAdmin, workspace_id, profile.user_id).catch(
        () => null
      )
      if (!access) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Validar formato de audio
    const validAudioFormats = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/webm", "audio/ogg", "audio/x-m4a", "audio/mp3"]
    if (!validAudioFormats.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid audio format. Supported: MP3, WAV, M4A, OGG, WEBM" },
        { status: 400 }
      )
    }

    // Limitar tamaño (100MB por defecto, ajustar según necesidad)
    const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    // Subir archivo a object storage (Supabase/Wasabi segun configuracion)
    const fileName = `${profile.user_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filePath = fileName

    try {
      await assertUserCanUploadBytes(profile.user_id, file.size)
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
          user_id: profile.user_id,
          workspace_id: workspace_id || "",
          source: "transcription_upload"
        }
      })
    } catch (uploadError: any) {
      console.error("Error uploading file to storage:", uploadError)
      throw new Error(`Failed to upload file: ${uploadError?.message || "unknown"}`)
    }

    // Crear registro de transcripción usando el cliente admin
    const { data: transcription, error: transcriptionError } = await supabaseAdmin
      .from("transcriptions")
      .insert({
        user_id: profile.user_id,
        workspace_id,
        name: name || file.name,
        audio_path: filePath,
        file_size: file.size,
        audio_format: file.type,
        status: "pending",
        description: description || null
      })
      .select("*")
      .single()

    if (transcriptionError || !transcription) {
      console.error("Error creating transcription:", transcriptionError)
      await deleteObjectFromBucket(filePath, "files").catch(() => undefined)
      await markObjectInventoryDeleted("files", filePath).catch(() => undefined)
      throw new Error(`Failed to create transcription: ${transcriptionError?.message || "Unknown error"}`)
    }

    await upsertObjectInventoryRecord({
      ownerUserId: profile.user_id,
      workspaceId: workspace_id,
      bucket: "files",
      objectPath: filePath,
      sizeBytes: file.size,
      contentType: file.type || "application/octet-stream",
      sourceTable: "transcriptions",
      sourceId: transcription.id,
      metadata: {
        source: "transcription_upload"
      }
    })

    // NOTA: En producción deberías usar un job queue (ej: Bull, pg-boss)
    // Por ahora, el frontend llamará a /api/transcriptions/transcribe después de subir
    console.log(`📝 Transcription ${transcription.id} ready for processing`)

    return NextResponse.json({
      success: true,
      transcription
    })

  } catch (error: any) {
    console.error("Error uploading transcription:", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload audio file" },
      { status: 500 }
    )
  }
}
