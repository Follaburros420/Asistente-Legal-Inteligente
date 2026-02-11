export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { isAdmin } from "@/lib/admin/check-admin"
import { AdminUser } from "@/types/admin"

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

    // Obtener perfiles (que tienen referencias a user_id de auth.users)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, bio, image_url, created_at, updated_at")

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError)
      return NextResponse.json(
        { error: "Error al obtener perfiles", details: profilesError.message },
        { status: 500 }
      )
    }

    // Obtener usuarios de auth.users usando el admin de Supabase
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      console.error("Error fetching auth users:", usersError)
      return NextResponse.json(
        { error: "Error al obtener usuarios de auth", details: usersError.message },
        { status: 500 }
      )
    }

    console.log("Total users from auth:", users?.length || 0)
    console.log("Total profiles:", profiles?.length || 0)

    // Obtener suscripciones
    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("user_id, plan_id, status, current_period_end")

    // Obtener métricas de consumo por usuario
    const { data: chats } = await supabase
      .from("chats")
      .select("id, user_id")

    const { data: files } = await supabase
      .from("files")
      .select("id, user_id, name, size, tokens")

    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, user_id")

    const { data: messages } = await supabase
      .from("messages")
      .select("id, session_id")

    // Obtener file_items para calcular storage real
    const { data: fileItems } = await supabase
      .from("file_items")
      .select("id, file_id, user_id, tokens")

    // Obtener documentos
    const { data: documents } = await supabase
      .from("process_documents")
      .select("id, user_id")

    const sessionIdsByUser = new Map<string, Set<string>>()
    for (const session of sessions || []) {
      if (!session.user_id) continue
      if (!sessionIdsByUser.has(session.user_id)) {
        sessionIdsByUser.set(session.user_id, new Set<string>())
      }
      sessionIdsByUser.get(session.user_id)!.add(session.id)
    }

    // Combinar datos de auth.users con profiles
    const adminUsers: AdminUser[] = (users || []).map(authUser => {
      const profile = profiles?.find(p => p.user_id === authUser.id)
      const subscription = subscriptions?.find(s => s.user_id === authUser.id)
      const userChats = chats?.filter(c => c.user_id === authUser.id).length || 0
      const userFiles = files?.filter(f => f.user_id === authUser.id)
      const userFileItems = fileItems?.filter(fi => fi.user_id === authUser.id) || []
      const userDocuments = documents?.filter(d => d.user_id === authUser.id) || []
      const sessionIds = sessionIdsByUser.get(authUser.id) || new Set<string>()
      const userMessages = messages?.filter(m => sessionIds.has(m.session_id)).length || 0
      
      // Calcular storage más preciso
      const filesSize = userFiles?.reduce((acc, f) => acc + (f.size || 0), 0) || 0
      const fileItemsEstimatedSize = userFileItems.reduce((acc, fi) => acc + (fi.tokens * 4), 0)
      const documentsEstimatedSize = userDocuments.length * 1500 // 1.5KB estimado por documento
      const embeddingsEstimatedSize = userFileItems.length * 1536 * 4 // embeddings estimados
      const totalStorage = filesSize + fileItemsEstimatedSize + documentsEstimatedSize + embeddingsEstimatedSize
      
      const totalTokens = [...(userFiles || []), ...userFileItems].reduce((acc, f) => acc + (f.tokens || 0), 0)
      
      return {
        id: authUser.id,
        email: authUser.email || "",
        name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "",
        role: authUser.user_metadata?.role || null,
        is_active: authUser.banned_until === null || new Date(authUser.banned_until) > new Date(),
        created_at: authUser.created_at || "",
        updated_at: authUser.updated_at || null,
        subscription: subscription ? {
          plan_id: subscription.plan_id,
          status: subscription.status,
          current_period_end: subscription.current_period_end
        } : undefined,
        profile: profile ? {
          display_name: profile.display_name,
          username: profile.username,
          bio: profile.bio,
          image_url: profile.image_url
        } : undefined,
        // Métricas de consumo
        stats: {
          chats: userChats,
          files: userFiles?.length || 0,
          messages: userMessages,
          storage: totalStorage,
          tokens: totalTokens,
          storageBreakdown: {
            files: filesSize,
            fileItems: fileItemsEstimatedSize,
            documents: documentsEstimatedSize,
            embeddings: embeddingsEstimatedSize,
            total: totalStorage
          }
        }
      }
    })

    return NextResponse.json(adminUsers)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Error al obtener usuarios", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
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

    const body = await request.json()
    
    // Aquí implementar la lógica para crear usuario
    // Esta funcionalidad requeriría crear usuario en auth y luego en la tabla users
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    )
  }
}

