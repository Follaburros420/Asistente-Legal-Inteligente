export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    // Obtener datos de la base de datos
    const [chatsResult, filesResult, fileItemsResult, sessionsResult] = await Promise.all([
      // Contar chats del usuario
      supabase
        .from("chats")
        .select("id", { count: "exact", head: false })
        .eq("user_id", user.id),
      
      // Contar archivos del usuario
      supabase
        .from("files")
        .select("id, size, tokens", { count: "exact", head: false })
        .eq("user_id", user.id),
      
      // Obtener file_items del usuario
      supabase
        .from("file_items")
        .select("id, tokens")
        .eq("user_id", user.id),
      
      // Obtener sesiones del usuario para calcular mensajes legacy
      supabase
        .from("sessions")
        .select("id")
        .eq("user_id", user.id)
    ])

    const chatsCount = chatsResult.count || 0
    const filesCount = filesResult.count || 0
    const sessionIds = (sessionsResult.data || []).map((s) => s.id)
    let messagesCount = 0
    if (sessionIds.length > 0) {
      const messagesResult = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("session_id", sessionIds)
      messagesCount = messagesResult.count || 0
    }

    // Calcular storage usado
    const files = filesResult.data || []
    const fileSizeSum = files.reduce((acc, file) => acc + (file.size || 0), 0)
    
    const fileItems = fileItemsResult.data || []
    const fileItemsTokenSum = fileItems.reduce((acc, item) => acc + (item.tokens || 0), 0)
    const fileItemsSize = fileItemsTokenSum * 4 // Estimación: 4 bytes por token
    
    const totalStorage = fileSizeSum + fileItemsSize

    // Calcular días activo desde la creación del usuario
    const createdAt = user.created_at ? new Date(user.created_at) : new Date()
    const daysActive = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    // Obtener perfil para el último acceso
    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("user_id", user.id)
      .single()

    return NextResponse.json({
      chats: chatsCount,
      files: filesCount,
      messages: messagesCount,
      storage: totalStorage,
      daysActive,
      createdAt: user.created_at
    })
  } catch (error) {
    console.error("Error fetching user stats:", error)
    return NextResponse.json(
      { 
        error: "Error al obtener estadísticas", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

