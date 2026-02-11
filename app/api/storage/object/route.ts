export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/supabase/types"
import { env } from "@/lib/env/runtime-env"
import { assertWorkspaceAccess } from "@/lib/server/workspaces/access"
import { deleteObjectFromBucket, downloadObjectFromBucket } from "@/lib/server/storage/object-storage"
import { markObjectInventoryDeleted } from "@/lib/server/storage/object-inventory"

const ALLOWED_BUCKETS = new Set([
  "files",
  "message_images",
  "profile_images",
  "workspace_images",
  "assistant_images"
])

function getSupabaseAdmin() {
  return createSupabaseClient<Database>(env.supabaseUrl(), env.supabaseServiceRole())
}

function isSafeStoragePath(path: string): boolean {
  if (!path || path.length > 2048) return false
  if (path.startsWith("/") || path.includes("..")) return false
  return true
}

async function canAccessFilesBucket(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  path: string
) {
  const { data: file } = await supabaseAdmin
    .from("files")
    .select("id,user_id,workspace_id")
    .eq("file_path", path)
    .maybeSingle()

  if (file) {
    if (file.workspace_id) {
      await assertWorkspaceAccess(supabaseAdmin as any, file.workspace_id, userId)
      return true
    }
    if (file.user_id === userId) {
      return true
    }
  }

  const { data: processDoc } = await supabaseAdmin
    .from("process_documents")
    .select("id,user_id,process_id")
    .eq("storage_path", path)
    .maybeSingle()

  if (processDoc) {
    const { data: process } = await supabaseAdmin
      .from("processes")
      .select("id,user_id,workspace_id")
      .eq("id", processDoc.process_id)
      .maybeSingle()

    if (process?.workspace_id) {
      await assertWorkspaceAccess(supabaseAdmin as any, process.workspace_id, userId)
      return true
    }
    if (process?.user_id === userId || processDoc.user_id === userId) {
      return true
    }
  }

  const { data: transcription } = await supabaseAdmin
    .from("transcriptions")
    .select("id,user_id,workspace_id")
    .eq("audio_path", path)
    .maybeSingle()

  if (transcription) {
    if (transcription.workspace_id) {
      await assertWorkspaceAccess(supabaseAdmin as any, transcription.workspace_id, userId)
      return true
    }
    if (transcription.user_id === userId) {
      return true
    }
  }

  return path.startsWith(`${userId}/`)
}

async function assertObjectAccess(userId: string, bucket: string, path: string) {
  const supabaseAdmin = getSupabaseAdmin()

  if (bucket === "files") {
    const ok = await canAccessFilesBucket(supabaseAdmin, userId, path)
    if (!ok) throw new Error("No autorizado")
    return
  }

  if (bucket === "message_images" || bucket === "profile_images") {
    if (!path.startsWith(`${userId}/`)) {
      throw new Error("No autorizado")
    }
    return
  }

  if (bucket === "workspace_images") {
    const workspaceId = path.split("/").filter(Boolean)[1]
    if (!workspaceId) throw new Error("Ruta de workspace inválida")
    await assertWorkspaceAccess(supabaseAdmin as any, workspaceId, userId)
    return
  }

  if (bucket === "assistant_images") {
    const assistantId = path.split("/").filter(Boolean)[1]
    if (!assistantId) throw new Error("Ruta de assistant inválida")
    const { data: assistant, error } = await supabaseAdmin
      .from("assistants")
      .select("id,user_id")
      .eq("id", assistantId)
      .maybeSingle()
    if (error || !assistant) {
      throw new Error("No autorizado")
    }

    if (assistant.user_id === userId) {
      return
    }

    const { data: assistantWorkspaces } = await supabaseAdmin
      .from("assistant_workspaces")
      .select("workspace_id")
      .eq("assistant_id", assistantId)

    for (const row of assistantWorkspaces || []) {
      try {
        await assertWorkspaceAccess(supabaseAdmin as any, row.workspace_id, userId)
        return
      } catch {
        // continue
      }
    }

    throw new Error("No autorizado")
  }

  throw new Error("Bucket no soportado")
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path") || ""
    const bucket = searchParams.get("bucket") || "files"
    const download = searchParams.get("download") === "1"

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: "Bucket no soportado" }, { status: 400 })
    }
    if (!isSafeStoragePath(path)) {
      return NextResponse.json({ error: "Ruta inválida" }, { status: 400 })
    }

    await assertObjectAccess(user.id, bucket, path)

    const blob = await downloadObjectFromBucket(path, bucket)
    const contentType = blob.type || "application/octet-stream"
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300"
    })

    if (download) {
      const safeName = path.split("/").pop() || "file"
      headers.set("Content-Disposition", `attachment; filename="${safeName}"`)
    }

    return new NextResponse(await blob.arrayBuffer(), { status: 200, headers })
  } catch (error: any) {
    const message = String(error?.message || "")
    const lower = message.toLowerCase()
    let statusCode = 500
    if (lower.includes("no autorizado")) {
      statusCode = 403
    } else if (lower.includes("bucket no soportado") || lower.includes("ruta inválida")) {
      statusCode = 400
    }
    return NextResponse.json(
      { error: error?.message || "Error leyendo objeto de storage" },
      { status: statusCode }
    )
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path") || ""
    const bucket = searchParams.get("bucket") || "files"

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: "Bucket no soportado" }, { status: 400 })
    }
    if (!isSafeStoragePath(path)) {
      return NextResponse.json({ error: "Ruta inválida" }, { status: 400 })
    }

    await assertObjectAccess(user.id, bucket, path)
    await deleteObjectFromBucket(path, bucket)
    await markObjectInventoryDeleted(bucket, path)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    const message = String(error?.message || "")
    const lower = message.toLowerCase()
    let statusCode = 500
    if (lower.includes("no autorizado")) {
      statusCode = 403
    } else if (lower.includes("bucket no soportado") || lower.includes("ruta inválida")) {
      statusCode = 400
    }
    return NextResponse.json(
      { error: error?.message || "Error eliminando objeto de storage" },
      { status: statusCode }
    )
  }
}
