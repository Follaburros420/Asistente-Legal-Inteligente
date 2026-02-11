export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/supabase/types"
import { env } from "@/lib/env/runtime-env"
import { assertWorkspaceAccess } from "@/lib/server/workspaces/access"
import { assertUserCanUploadBytes } from "@/lib/billing/storage-quota"
import { deleteObjectFromBucket, uploadObject } from "@/lib/server/storage/object-storage"
import {
  markObjectInventoryDeleted,
  upsertObjectInventoryRecord
} from "@/lib/server/storage/object-inventory"

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

function buildObjectUrl(path: string, bucket: string) {
  return `/api/storage/object?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`
}

async function assertUploadAccess(
  userId: string,
  bucket: string,
  path: string,
  formData: FormData
) {
  const supabaseAdmin = getSupabaseAdmin()

  if (bucket === "files" || bucket === "message_images" || bucket === "profile_images") {
    if (!path.startsWith(`${userId}/`)) {
      throw new Error("Forbidden path")
    }
    return
  }

  if (bucket === "workspace_images") {
    const workspaceId =
      (formData.get("workspace_id") as string | null) || path.split("/").filter(Boolean)[1]
    if (!workspaceId) {
      throw new Error("workspace_id es requerido para workspace_images")
    }
    await assertWorkspaceAccess(supabaseAdmin as any, workspaceId, userId)
    return
  }

  if (bucket === "assistant_images") {
    const assistantId =
      (formData.get("assistant_id") as string | null) || path.split("/").filter(Boolean)[1]
    if (!assistantId) {
      throw new Error("assistant_id es requerido para assistant_images")
    }

    const { data: assistant, error } = await supabaseAdmin
      .from("assistants")
      .select("id,user_id")
      .eq("id", assistantId)
      .maybeSingle()

    if (error || !assistant || assistant.user_id !== userId) {
      throw new Error("No tienes permisos sobre este asistente")
    }
    return
  }

  throw new Error("Bucket no soportado")
}

export async function POST(request: Request) {
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

    const formData = await request.formData()
    const file = formData.get("file")
    const path = String(formData.get("path") || "")
    const bucket = String(formData.get("bucket") || "files")
    const oldPath = String(formData.get("old_path") || "")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 })
    }
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: "Bucket no soportado" }, { status: 400 })
    }
    if (!isSafeStoragePath(path)) {
      return NextResponse.json({ error: "Ruta inválida" }, { status: 400 })
    }

    await assertUploadAccess(user.id, bucket, path, formData)
    await assertUserCanUploadBytes(user.id, file.size)

    await uploadObject({
      bucket,
      key: path,
      file,
      contentType: file.type || "application/octet-stream",
      metadata: {
        user_id: user.id,
        source: "client_storage_upload"
      }
    })
    await upsertObjectInventoryRecord({
      ownerUserId: user.id,
      workspaceId:
        bucket === "workspace_images"
          ? ((formData.get("workspace_id") as string | null) ||
            path.split("/").filter(Boolean)[1] ||
            null)
          : null,
      bucket,
      objectPath: path,
      sizeBytes: file.size,
      contentType: file.type || "application/octet-stream",
      sourceTable: null,
      sourceId: null,
      metadata: {
        source: "client_storage_upload"
      }
    })

    if (oldPath && oldPath !== path && isSafeStoragePath(oldPath)) {
      await deleteObjectFromBucket(oldPath, bucket).catch(() => undefined)
      await markObjectInventoryDeleted(bucket, oldPath).catch(() => undefined)
    }

    return NextResponse.json({
      success: true,
      path,
      bucket,
      url: buildObjectUrl(path, bucket)
    })
  } catch (error: any) {
    const message = String(error?.message || "")
    const lower = message.toLowerCase()
    let statusCode = 500
    if (message.includes("Límite de almacenamiento")) {
      statusCode = 402
    } else if (lower.includes("forbidden") || lower.includes("no tienes permisos")) {
      statusCode = 403
    } else if (
      lower.includes("bucket no soportado") ||
      lower.includes("ruta inválida") ||
      lower.includes("requerido") ||
      lower.includes("archivo inválido")
    ) {
      statusCode = 400
    }
    return NextResponse.json(
      { error: error?.message || "Error subiendo archivo a storage" },
      { status: statusCode }
    )
  }
}
