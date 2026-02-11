export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { isAdmin } from "@/lib/admin/check-admin"

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
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

    const { userId } = params

    // Obtener estado actual desde auth
    const {
      data: { user: currentUser },
      error: fetchError
    } = await supabase.auth.admin.getUserById(userId)

    if (fetchError || !currentUser) throw fetchError ?? new Error("User not found")

    const isActiveNow =
      currentUser.banned_until === null ||
      new Date(currentUser.banned_until) <= new Date()

    // Cambiar el estado en auth
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: isActiveNow ? "876000h" : "none"
    })

    if (error) throw error

    return NextResponse.json({
      id: data.user.id,
      email: data.user.email,
      is_active: !isActiveNow,
      banned_until: data.user.banned_until
    })
  } catch (error) {
    console.error("Error suspending/activating user:", error)
    return NextResponse.json(
      { error: "Error al cambiar estado del usuario" },
      { status: 500 }
    )
  }
}

