import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/admin/check-admin"

export interface AdminApiAuthResult {
  authorized: boolean
  status: 401 | 403
  error: string
}

export async function requireAdminApiAccess(): Promise<AdminApiAuthResult> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      authorized: false,
      status: 401,
      error: "No autorizado"
    }
  }

  if (!isAdmin(user.email)) {
    return {
      authorized: false,
      status: 403,
      error: "No autorizado"
    }
  }

  return {
    authorized: true,
    status: 403,
    error: ""
  }
}
