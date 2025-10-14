import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const openrouterApiKey = process.env.OPENROUTER_API_KEY || ""
    
    // Información básica
    const basicInfo = {
      hasKey: !!openrouterApiKey,
      keyPreview: openrouterApiKey ? `${openrouterApiKey.substring(0, 15)}...` : 'No configurada',
      keyLength: openrouterApiKey.length,
      timestamp: new Date().toISOString()
    }

    if (!openrouterApiKey) {
      return NextResponse.json({
        status: 'error',
        message: 'OPENROUTER_API_KEY no configurada',
        ...basicInfo
      }, { status: 500 })
    }

    // Probar la API key con una petición simple
    try {
      const testResponse = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (testResponse.ok) {
        const models = await testResponse.json()
        return NextResponse.json({
          status: 'success',
          message: 'OpenRouter API Key válida',
          ...basicInfo,
          modelsCount: models.data?.length || 0,
          availableModels: models.data?.slice(0, 5).map((m: any) => m.id) || []
        })
      } else {
        const errorText = await testResponse.text()
        return NextResponse.json({
          status: 'error',
          message: `OpenRouter API Key inválida: ${testResponse.status}`,
          ...basicInfo,
          errorDetails: errorText,
          statusCode: testResponse.status
        }, { status: 500 })
      }
    } catch (fetchError: any) {
      return NextResponse.json({
        status: 'error',
        message: 'Error al probar OpenRouter API Key',
        ...basicInfo,
        error: fetchError.message
      }, { status: 500 })
    }

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Error en diagnóstico de API Key',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
