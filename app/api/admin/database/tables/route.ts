export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { isAdmin } from "@/lib/admin/check-admin"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    // Listar tablas principales de la aplicación
    const tables = [
      { name: "profiles", columns: ["id", "user_id", "display_name", "username", "bio"] },
      { name: "workspaces", columns: ["id", "user_id", "name", "description", "created_at"] },
      { name: "chats", columns: ["id", "user_id", "name", "workspace_id", "created_at"] },
      { name: "messages", columns: ["id", "session_id", "role", "content", "metadata", "created_at"] },
      { name: "files", columns: ["id", "user_id", "name", "type", "size", "created_at"] },
      { name: "subscriptions", columns: ["id", "user_id", "workspace_id", "plan_id", "status"] },
      { name: "plans", columns: ["id", "name", "description", "amount_in_cents", "currency"] },
      { name: "invoices", columns: ["id", "subscription_id", "amount_in_cents", "status", "created_at"] },
      { name: "assistants", columns: ["id", "user_id", "name", "model", "temperature"] },
      { name: "processes", columns: ["id", "user_id", "workspace_id", "name", "status"] },
      { name: "process_documents", columns: ["id", "process_id", "user_id", "file_name", "status"] },
      { name: "process_ingestion_jobs", columns: ["id", "process_id", "document_id", "status", "created_at"] }
    ]

    return NextResponse.json(tables)
  } catch (error) {
    console.error("Error fetching tables:", error)
    return NextResponse.json(
      { error: "Error al obtener tablas" },
      { status: 500 }
    )
  }
}

