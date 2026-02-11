export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { isAdmin } from "@/lib/admin/check-admin"

export async function GET(
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

    // Obtener información del usuario desde auth (fuente de verdad actual)
    const {
      data: { user: authUser },
      error: userError
    } = await supabase.auth.admin.getUserById(userId)

    if (userError || !authUser) throw userError ?? new Error("User not found")

    // Obtener perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single()

    // Obtener suscripción
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    // Obtener workspaces
    const { data: workspaces } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", userId)

    // Obtener chats
    const { data: chats } = await supabase
      .from("chats")
      .select("id, name, created_at, workspace_id")
      .eq("user_id", userId)
      .limit(50)

    // Obtener archivos
    const { data: files } = await supabase
      .from("files")
      .select("id, name, type, size, created_at")
      .eq("user_id", userId)
      .limit(50)

    const userData = {
      id: authUser.id,
      email: authUser.email,
      role: authUser.role,
      created_at: authUser.created_at,
      updated_at: authUser.updated_at,
      user_metadata: authUser.user_metadata,
      app_metadata: authUser.app_metadata,
      is_active:
        authUser.banned_until === null ||
        new Date(authUser.banned_until) <= new Date(),
      banned_until: authUser.banned_until
    }

    return NextResponse.json({
      user: userData,
      profile,
      subscription,
      workspaces,
      chats,
      files
    })
  } catch (error) {
    console.error("Error fetching user details:", error)
    return NextResponse.json(
      { error: "Error al obtener detalles del usuario" },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const body = await request.json()
    const updatePayload: Record<string, unknown> = {}

    if (typeof body.email === "string" && body.email.trim().length > 0) {
      updatePayload.email = body.email.trim()
    }

    if (typeof body.is_active === "boolean") {
      updatePayload.ban_duration = body.is_active ? "none" : "876000h" // ~100 años
    }

    if (typeof body.name === "string" && body.name.trim().length > 0) {
      const {
        data: { user: existingUser }
      } = await supabase.auth.admin.getUserById(userId)

      updatePayload.user_metadata = {
        ...(existingUser?.user_metadata || {}),
        name: body.name.trim(),
        full_name: body.name.trim()
      }
    }

    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      updatePayload
    )

    if (error) throw error

    // Permitir actualización opcional de perfil público
    const profilePatch: Record<string, unknown> = {}
    if (typeof body.display_name === "string") profilePatch.display_name = body.display_name
    if (typeof body.username === "string") profilePatch.username = body.username
    if (typeof body.bio === "string") profilePatch.bio = body.bio

    if (Object.keys(profilePatch).length > 0) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profilePatch)
        .eq("user_id", userId)
      if (profileError) throw profileError
    }

    return NextResponse.json(data.user)
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Eliminar usuario de auth (fuente de verdad). El resto se limpia por cascada/FKs.
    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    )
  }
}

