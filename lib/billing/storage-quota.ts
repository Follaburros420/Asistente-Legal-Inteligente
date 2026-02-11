import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/env/runtime-env"
import { Database } from "@/supabase/types"
import { getUserObjectInventoryUsageBytes } from "@/lib/server/storage/object-inventory"

type PlanType = "none" | "basic" | "pro" | "enterprise"

interface StorageQuotaStatus {
  planType: PlanType
  usageBytes: number
  limitBytes: number
  remainingBytes: number
}

const MB = 1024 * 1024

function getPlanLimitBytes(planType: PlanType): number {
  if (planType === "enterprise") {
    const override = Number.parseInt(process.env.STORAGE_LIMIT_ENTERPRISE_MB || "-1", 10)
    return Number.isFinite(override) ? override * MB : -1
  }
  if (planType === "pro") {
    const override = Number.parseInt(process.env.STORAGE_LIMIT_PRO_MB || "10240", 10)
    return Math.max(override, 1) * MB
  }
  if (planType === "basic") {
    const override = Number.parseInt(process.env.STORAGE_LIMIT_BASIC_MB || "512", 10)
    return Math.max(override, 1) * MB
  }
  const override = Number.parseInt(process.env.STORAGE_LIMIT_NONE_MB || "128", 10)
  return Math.max(override, 1) * MB
}

function getSupabaseAdmin() {
  return createSupabaseClient<Database>(env.supabaseUrl(), env.supabaseServiceRole())
}

async function getUserPlanType(userId: string): Promise<PlanType> {
  const supabase = getSupabaseAdmin()
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("plans:plan_id(plan_type)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !subscription?.plans) {
    return "none"
  }

  const planType = String((subscription.plans as any).plan_type || "none").toLowerCase()
  if (planType === "enterprise" || planType === "pro" || planType === "basic") {
    return planType
  }
  return "none"
}

async function getUserObjectUsageBytes(userId: string): Promise<number> {
  const inventoryUsage = await getUserObjectInventoryUsageBytes(userId).catch(() => null)
  if (inventoryUsage !== null) {
    return inventoryUsage
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .schema("storage")
    .from("objects")
    .select("metadata")
    .like("name", `${userId}/%`)

  if (error) {
    throw new Error(`No se pudo calcular uso de storage: ${error.message}`)
  }

  let usage = 0
  for (const row of data || []) {
    const sizeRaw = (row as any)?.metadata?.size
    const size = Number.parseInt(String(sizeRaw || "0"), 10)
    if (Number.isFinite(size) && size > 0) {
      usage += size
    }
  }
  return usage
}

export async function getStorageQuotaStatus(userId: string): Promise<StorageQuotaStatus> {
  const [planType, usageBytes] = await Promise.all([
    getUserPlanType(userId),
    getUserObjectUsageBytes(userId)
  ])

  const limitBytes = getPlanLimitBytes(planType)
  const remainingBytes = limitBytes < 0 ? Number.MAX_SAFE_INTEGER : Math.max(0, limitBytes - usageBytes)

  return {
    planType,
    usageBytes,
    limitBytes,
    remainingBytes
  }
}

export async function assertUserCanUploadBytes(userId: string, bytesToUpload: number) {
  if (!Number.isFinite(bytesToUpload) || bytesToUpload <= 0) {
    return
  }

  const quota = await getStorageQuotaStatus(userId)
  if (quota.limitBytes < 0) {
    return
  }

  if (quota.usageBytes + bytesToUpload > quota.limitBytes) {
    const usedMb = Math.ceil(quota.usageBytes / MB)
    const limitMb = Math.ceil(quota.limitBytes / MB)
    throw new Error(
      `Límite de almacenamiento alcanzado (${usedMb}MB/${limitMb}MB). Elimina archivos o mejora tu plan.`
    )
  }
}
