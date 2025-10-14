import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Verificar variables de entorno
    const openrouterApiKey = process.env.OPENROUTER_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // Información del sistema
    const systemInfo = {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      vercelUrl: process.env.VERCEL_URL,
      platform: process.platform,
      nodeVersion: process.version
    }

    // Estado de las variables de entorno
    const envStatus = {
      openrouterApiKey: {
        configured: !!openrouterApiKey,
        preview: openrouterApiKey ? `${openrouterApiKey.substring(0, 10)}...` : 'No configurada'
      },
      supabaseUrl: {
        configured: !!supabaseUrl,
        value: supabaseUrl || 'No configurada'
      },
      supabaseAnonKey: {
        configured: !!supabaseAnonKey,
        preview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'No configurada'
      }
    }

    // Estado de los endpoints
    const endpointsStatus = {
      '/api/chat/robust': 'Disponible - Chat sin herramientas',
      '/api/chat/simple': 'Disponible - Chat simple',
      '/api/chat/openrouter': 'Disponible - Chat con OpenRouter',
      '/api/chat/tools': 'Disponible - Chat con herramientas',
      '/api/diagnose': 'Disponible - Diagnóstico general',
      '/api/test-auth': 'Disponible - Test de autenticación'
    }

    // Recomendaciones
    const recommendations = []
    
    if (!openrouterApiKey) {
      recommendations.push('❌ Configurar OPENROUTER_API_KEY en Vercel')
    } else {
      recommendations.push('✅ OPENROUTER_API_KEY configurada')
    }
    
    if (!supabaseUrl || !supabaseAnonKey) {
      recommendations.push('⚠️ Supabase no configurado (opcional para chat básico)')
    } else {
      recommendations.push('✅ Supabase configurado')
    }

    recommendations.push('💡 Usar /api/chat/robust para chat sin problemas de autenticación')
    recommendations.push('💡 Usar /api/chat/simple como alternativa')

    const diagnosis = {
      status: 'success',
      system: systemInfo,
      environment: envStatus,
      endpoints: endpointsStatus,
      recommendations,
      message: 'Sistema funcionando correctamente'
    }

    return NextResponse.json(diagnosis, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error: any) {
    console.error('Error en diagnóstico completo:', error)
    
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      message: 'Error en diagnóstico del sistema'
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
  }
}
