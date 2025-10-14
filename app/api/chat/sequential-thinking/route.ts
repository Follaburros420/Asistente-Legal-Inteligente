/**
 * Endpoint API para Sequential Thinking
 * Sistema de agentes legales con verificación de fuentes oficiales
 */

import { executeSequentialThinking } from "@/lib/legal-agents/sequential-thinking"
import { LegalAgentRequest } from "@/types/legal-agents"
import { getServerProfile } from "@/lib/server/server-chat-helpers"

export const runtime = "nodejs"
export const maxDuration = 60 // 60 segundos para búsquedas completas

export async function POST(request: Request) {
  try {
    const profile = await getServerProfile()

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Usuario no autenticado" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const body = await request.json()
    const { objetivo, audiencia, tema, restricciones } = body

    if (!objetivo || !tema) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos: objetivo y tema" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    console.log(`\n🚀 [API] Iniciando Sequential Thinking para: ${objetivo}`)

    const agentRequest: LegalAgentRequest = {
      objetivo,
      audiencia: audiencia || "Profesionales del derecho",
      jurisdiccion: "CO",
      tema,
      restricciones: restricciones || []
    }

    // Ejecutar Sequential Thinking
    const response = await executeSequentialThinking(agentRequest)

    console.log(`✅ [API] Sequential Thinking completado`)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error(`❌ [API] Error en Sequential Thinking:`, error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Error desconocido",
        details: error.stack
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    )
  }
}








