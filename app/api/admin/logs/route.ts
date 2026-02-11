export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { isAdmin } from "@/lib/admin/check-admin"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    // Use workspace audit logs as source of truth for admin activity.
    const { data: auditLogs, error: auditError } = await supabase
      .from("workspace_audit_logs")
      .select(
        "id, actor_id, action_type, resource_type, resource_id, details, ip_address, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100)

    if (auditError) {
      console.log(
        "No se pudieron cargar logs de workspace_audit_logs:",
        auditError.message
      )
      return NextResponse.json([])
    }

    const normalizedLogs = (auditLogs || []).map(log => ({
      id: log.id,
      admin_email: log.actor_id,
      action_type: log.action_type,
      resource_type: log.resource_type,
      resource_id: log.resource_id,
      details: log.details || {},
      ip_address: log.ip_address ? String(log.ip_address) : null,
      created_at: log.created_at
    }))

    return NextResponse.json(normalizedLogs)
  } catch (error) {
    console.error("Error fetching admin logs:", error)
    return NextResponse.json([])
  }
}
