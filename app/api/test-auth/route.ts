import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/supabase/types'

export async function GET(request: NextRequest) {
  try {
    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Supabase configuration missing',
        details: {
          hasUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey,
          url: supabaseUrl || 'undefined'
        }
      }, { status: 500 })
    }

    // Crear cliente de Supabase
    const cookieStore = cookies()
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          }
        }
      }
    )

    // Intentar obtener usuario
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get user',
        details: userError.message,
        user: null
      }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No authenticated user found',
        details: 'User needs to be logged in',
        user: null,
        cookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
      }, { status: 401 })
    }

    // Intentar obtener perfil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      profile: profile || null,
      profileError: profileError?.message || null,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Authentication test failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
