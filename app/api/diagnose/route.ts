import { NextResponse } from "next/server"
import { verifySupabaseConnection } from "@/lib/supabase/robust-client"

export async function GET() {
  try {
    console.log('🔍 Iniciando diagnóstico de Supabase...')
    
    // Obtener información de configuración
    const configInfo = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      anonKeyPreview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + "..." : "N/A",
      serviceKeyPreview: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
        process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + "..." : "N/A",
    }
    
    // Verificar conexión
    const connectionStatus = await verifySupabaseConnection()
    
    const diagnosis = {
      timestamp: new Date().toISOString(),
      status: 'success',
      configuration: configInfo,
      connection: {
        status: connectionStatus ? 'connected' : 'failed',
        verified: connectionStatus
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nextPublicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY
      }
    }
    
    console.log('✅ Diagnóstico completado exitosamente')
    
    return NextResponse.json(diagnosis, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
    
  } catch (error: any) {
    console.error('❌ Error en diagnóstico:', error)
    
    const errorDiagnosis = {
      timestamp: new Date().toISOString(),
      status: 'error',
      error: {
        message: error.message,
        stack: error.stack
      },
      configuration: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        anonKeyPreview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + "..." : "N/A",
        serviceKeyPreview: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
          process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + "..." : "N/A",
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nextPublicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY
      }
    }
    
    return NextResponse.json(errorDiagnosis, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
  }
}
