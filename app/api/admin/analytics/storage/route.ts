export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/env/runtime-env"
import { Database } from "@/supabase/types"
import { requireAdminApiAccess } from "@/lib/admin/require-admin-api"

interface UserStorageAggregate {
  filesBytes: number
  otherBytes: number
  filesCount: number
  otherCount: number
}

const TARGET_BUCKETS = new Set([
  "files",
  "message_images",
  "profile_images",
  "workspace_images",
  "assistant_images"
])

function getSupabaseAdmin() {
  return createSupabaseClient<Database>(env.supabaseUrl(), env.supabaseServiceRole())
}

export async function GET() {
  try {
    const adminAuth = await requireAdminApiAccess()
    if (!adminAuth.authorized) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })
    if (usersError) {
      return NextResponse.json(
        { error: "Error al obtener usuarios de auth", details: usersError.message },
        { status: 500 }
      )
    }

    const users = usersData?.users || []

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id,display_name,username")
    if (profilesError) {
      return NextResponse.json(
        { error: "Error al obtener perfiles", details: profilesError.message },
        { status: 500 }
      )
    }

    const { data: inventoryRows, error: inventoryError } = await supabaseAdmin
      .from("object_storage_inventory")
      .select("owner_user_id,bucket,size_bytes")
      .eq("status", "active")
    if (inventoryError) {
      return NextResponse.json(
        {
          error: "Error al obtener inventario de storage",
          details: inventoryError.message
        },
        { status: 500 }
      )
    }

    const byUserStorage = new Map<string, UserStorageAggregate>()

    for (const row of inventoryRows || []) {
      const userId = String((row as any).owner_user_id || "")
      const bucket = String((row as any).bucket || "")
      if (!userId || !TARGET_BUCKETS.has(bucket)) continue

      const size = Number.parseInt(String((row as any).size_bytes || "0"), 10)
      const safeSize = Number.isFinite(size) && size > 0 ? size : 0

      if (!byUserStorage.has(userId)) {
        byUserStorage.set(userId, {
          filesBytes: 0,
          otherBytes: 0,
          filesCount: 0,
          otherCount: 0
        })
      }

      const aggregate = byUserStorage.get(userId)!
      if (bucket === "files") {
        aggregate.filesBytes += safeSize
        aggregate.filesCount += 1
      } else {
        aggregate.otherBytes += safeSize
        aggregate.otherCount += 1
      }
    }

    const byUser = users.map((authUser) => {
      const profile = (profiles || []).find((p) => p.user_id === authUser.id)
      const aggregate = byUserStorage.get(authUser.id) || {
        filesBytes: 0,
        otherBytes: 0,
        filesCount: 0,
        otherCount: 0
      }

      const total = aggregate.filesBytes + aggregate.otherBytes

      return {
        user_id: authUser.id,
        email: authUser.email,
        name:
          authUser.user_metadata?.full_name ||
          profile?.display_name ||
          profile?.username ||
          authUser.email?.split("@")[0] ||
          "",
        storage: {
          files: aggregate.filesBytes,
          file_items: aggregate.otherBytes,
          documents: 0,
          embeddings: 0,
          total
        },
        fileCount: aggregate.filesCount + aggregate.otherCount,
        fileItemCount: aggregate.otherCount,
        documentCount: 0,
        created_at: authUser.created_at
      }
    })

    const totalStorage = byUser.reduce((acc, user) => acc + user.storage.total, 0)
    const totalUsers = byUser.length

    return NextResponse.json({
      success: true,
      totalUsers,
      totalStorage,
      averageStorage: totalUsers > 0 ? totalStorage / totalUsers : 0,
      byUser: byUser.sort((a, b) => b.storage.total - a.storage.total)
    })
  } catch (error) {
    console.error("Error fetching storage analytics:", error)
    return NextResponse.json(
      {
        error: "Error al obtener metricas de storage",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
