import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET(request: NextRequest) {
  try {
    const openrouterApiKey = process.env.OPENROUTER_API_KEY || ""
    
    if (!openrouterApiKey) {
      return NextResponse.json({
        status: 'error',
        message: 'OPENROUTER_API_KEY no configurada',
        hasKey: false
      }, { status: 500 })
    }

    // Crear cliente OpenAI
    const openai = new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: "https://openrouter.ai/api/v1",
      timeout: 30000
    })

    // Probar con un modelo simple
    const testResponse = await openai.chat.completions.create({
      model: "openai/gpt-3.5-turbo",
      messages: [
        { role: "user", content: "Responde solo con 'OK' si puedes leer este mensaje." }
      ],
      max_tokens: 10
    })

    return NextResponse.json({
      status: 'success',
      message: 'OpenRouter funcionando correctamente',
      hasKey: true,
      keyPreview: `${openrouterApiKey.substring(0, 10)}...`,
      testResponse: testResponse.choices[0]?.message?.content || 'Sin respuesta',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error en test de OpenRouter:', error)
    
    return NextResponse.json({
      status: 'error',
      message: 'Error en OpenRouter',
      hasKey: !!process.env.OPENROUTER_API_KEY,
      keyPreview: process.env.OPENROUTER_API_KEY ? 
        `${process.env.OPENROUTER_API_KEY.substring(0, 10)}...` : 'No configurada',
      error: error.message,
      errorCode: error.status,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
