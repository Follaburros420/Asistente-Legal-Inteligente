export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"

/**
 * Endpoint de prueba simple - Sin agente, solo verifica conectividad
 */
export async function POST(request: NextRequest) {
  console.log("[Test Simple] 📥 POST recibido")
  
  try {
    const body = await request.json()
    console.log("[Test Simple] 📦 Body:", body)
    
    // Verificar API key
    const apiKey = process.env.OPENROUTER_API_KEY
    console.log("[Test Simple] 🔑 OPENROUTER_API_KEY:", apiKey ? "✅ Configurada" : "❌ No configurada")
    
    // Respuesta simple de prueba
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }
        
        // Enviar eventos de prueba
        send({ type: "meta", message_id: "test-123", render_mode: "chat", intent: "chat_response", confidence: 0.9 })
        
        await new Promise(r => setTimeout(r, 500))
        send({ type: "status", phase: "classifying", message: "Analizando…", progress: 10 })
        
        await new Promise(r => setTimeout(r, 500))
        send({ type: "status", phase: "searching", message: "Buscando…", progress: 50 })
        
        await new Promise(r => setTimeout(r, 500))
        send({ type: "delta", text: "Hola" })
        
        await new Promise(r => setTimeout(r, 200))
        send({ type: "delta", text: ", " })
        
        await new Promise(r => setTimeout(r, 200))
        send({ type: "delta", text: "esto" })
        
        await new Promise(r => setTimeout(r, 200))
        send({ type: "delta", text: " es" })
        
        await new Promise(r => setTimeout(r, 200))
        send({ type: "delta", text: " una" })
        
        await new Promise(r => setTimeout(r, 200))
        send({ type: "delta", text: " prueba." })
        
        await new Promise(r => setTimeout(r, 300))
        send({ type: "done", ok: true, metadata: { test: true } })
        
        controller.close()
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Test-Endpoint': 'true'
      }
    })
    
  } catch (error) {
    console.error("[Test Simple] ❌ Error:", error)
    return NextResponse.json(
      { error: "Error en test", details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    openrouter_key_configured: !!process.env.OPENROUTER_API_KEY,
    timestamp: new Date().toISOString()
  })
}
