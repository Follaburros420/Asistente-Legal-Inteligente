import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/env/runtime-env"
import { Database } from "@/supabase/types"

const INVENTORY_TABLE = "object_storage_inventory"
const MISSING_TABLE_CODE = "42P01"
const MISSING_FUNCTION_CODE = "42883"

interface UpsertObjectInventoryInput {
  ownerUserId: string
  bucket: string
  objectPath: string
  sizeBytes: number
  contentType?: string | null
  workspaceId?: string | null
  sourceTable?: string | null
  sourceId?: string | null
  metadata?: Record<string, any>
}

function getSupabaseAdmin() {
  return createSupabaseClient<Database>(
    env.supabaseUrl(),
    env.supabaseServiceRole()
  )
}

function getStorageProvider(): "supabase" | "wasabi" {
  const provider = (process.env.OBJECT_STORAGE_PROVIDER || "supabase")
    .trim()
    .toLowerCase()
  return provider === "wasabi" ? "wasabi" : "supabase"
}

function isMissingInventoryError(error: any): boolean {
  const code = String(error?.code || "")
  const message = String(error?.message || "").toLowerCase()
  return (
    code === MISSING_TABLE_CODE ||
    code === MISSING_FUNCTION_CODE ||
    message.includes("object_storage_inventory") ||
    message.includes("get_object_storage_usage_bytes")
  )
}

export async function upsertObjectInventoryRecord(
  input: UpsertObjectInventoryInput
): Promise<void> {
  const path = input.objectPath.trim()
  if (!path) return

  const sizeBytes = Number.isFinite(input.sizeBytes)
    ? Math.max(0, Math.floor(input.sizeBytes))
    : 0

  const supabaseAdmin = getSupabaseAdmin()
  const payload = {
    owner_user_id: input.ownerUserId,
    workspace_id: input.workspaceId || null,
    bucket: input.bucket,
    object_path: path,
    size_bytes: sizeBytes,
    content_type: input.contentType || null,
    storage_provider: getStorageProvider(),
    source_table: input.sourceTable || null,
    source_id: input.sourceId || null,
    metadata: (input.metadata || {}) as any,
    status: "active",
    deleted_at: null
  }

  const { error } = await supabaseAdmin
    .from(INVENTORY_TABLE as any)
    .upsert(payload, { onConflict: "bucket,object_path" })

  if (error && !isMissingInventoryError(error)) {
    console.warn(
      `[object-inventory] upsert failed bucket=${input.bucket} path=${path} error=${error.message}`
    )
  }
}

export async function markObjectInventoryDeleted(
  bucket: string,
  objectPath: string
): Promise<void> {
  const path = objectPath.trim()
  if (!path) return

  const now = new Date().toISOString()
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from(INVENTORY_TABLE as any)
    .update({
      status: "deleted",
      deleted_at: now,
      updated_at: now
    } as any)
    .eq("bucket", bucket)
    .eq("object_path", path)

  if (error && !isMissingInventoryError(error)) {
    console.warn(
      `[object-inventory] delete mark failed bucket=${bucket} path=${path} error=${error.message}`
    )
  }
}

export async function getUserObjectInventoryUsageBytes(
  userId: string
): Promise<number | null> {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: aggregate, error: aggregateError } = await supabaseAdmin.rpc(
    "get_object_storage_usage_bytes" as any,
    { p_user_id: userId } as any
  )

  if (!aggregateError) {
    const value = Number.parseInt(String(aggregate || "0"), 10)
    return Number.isFinite(value) ? Math.max(0, value) : 0
  }

  if (!isMissingInventoryError(aggregateError)) {
    throw new Error(`No se pudo calcular uso de inventario: ${aggregateError.message}`)
  }

  const { data, error } = await supabaseAdmin
    .from(INVENTORY_TABLE as any)
    .select("size_bytes")
    .eq("owner_user_id", userId)
    .eq("status", "active")

  if (error) {
    if (isMissingInventoryError(error)) return null
    throw new Error(`No se pudo calcular uso de inventario: ${error.message}`)
  }

  let usage = 0
  for (const row of data || []) {
    const size = Number.parseInt(String((row as any)?.size_bytes || "0"), 10)
    if (Number.isFinite(size) && size > 0) {
      usage += size
    }
  }

  return usage
}
