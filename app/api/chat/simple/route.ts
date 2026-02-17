/**
 * API Route: POST /api/chat/simple
 * 
 * Simplified chat endpoint for quick responses with optional web search.
 * Bypasses the complex LangGraph pipeline for faster responses.
 * 
 * Events emitted (SSE format):
 * 1. meta: { message_id, intent, render_mode }
 * 2. status: { phase, message }
 * 3. delta: { text } (multiple, during streaming)
 * 4. citations: { items } (optional)
 * 5. done: { ok: true, metadata }
 */

import { NextRequest } from "next/server"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { simpleWebSearch } from "@/lib/tools/web-search-simple"

export const runtime = "nodejs"
export const maxDuration = 60

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_MODEL = "google/gemini-2.0-flash-001"

const SYSTEM_PROMPT = `Eres ALI (Asistente Legal Inteligente), un asistente legal colombiano experto. Tu tarea es responder preguntas de manera clara y precisa.

REGLAS:
1. Responde de forma directa y concisa
2. Si necesitas información específica, indícalo claramente
3. Cita fuentes cuando las tengas disponibles usando [1], [2], etc.
4. Si no estás seguro, indícalo claramente
5. Usa lenguaje jurídico apropiado pero accesible
6. Para saludos y preguntas conversacionales, responde amablemente sin buscar en la web

FORMATO DE RESPUESTA:
## Respuesta
[Tu respuesta directa]

## Fuentes (si aplica)
[Lista de fuentes con numeración]

## Nota (si aplica)
[Información adicional o advertencias]`

interface RequestBody {
  message: string
  history: Array<{ role: string; content: string }>
  config?: {
    model?: string
    temperature?: number
    maxTokens?: number
    enableWebSearch?: boolean
  }
}

/**
 * Determine if the query needs web search
 * Returns true for legal/complex queries, false for greetings/conversation
 */
function needsWebSearch(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim()
  
  // Greetings and conversational phrases - NO search needed
  const greetings = [
    'hola', 'buenos días', 'buenas tardes', 'buenas noches',
    'qué tal', 'como estás', 'cómo estás', 'qué haces', 'que haces',
    'quién eres', 'quien eres', 'qué eres', 'que eres', 'cómo te llamas',
    'como te llamas', 'tu nombre', 'ayuda', 'help', 'gracias', 'thanks',
    'buen día', 'buen dia', 'saludos', 'hey', 'hi', 'hello'
  ]
  
  // Check if message is just a greeting
  if (greetings.some(g => lowerMessage === g || lowerMessage.startsWith(g + ' ') || lowerMessage.endsWith(g))) {
    // But if it has additional content, might need search
    const words = lowerMessage.split(' ').filter(w => w.length > 2)
    if (words.length <= 3) {
      return false
    }
  }
  
  // Short messages (< 4 meaningful words) usually don't need search
  const meaningfulWords = lowerMessage.split(' ').filter(w => w.length > 2 && !greetings.includes(w))
  if (meaningfulWords.length < 2) {
    return false
  }
  
  // Legal keywords that indicate need for search
  const legalKeywords = [
    'ley', 'código', 'artículo', 'decreto', 'sentencia', 'jurisprudencia',
    'norma', 'reglamento', 'resolución', 'constitución', 'constitucional',
    'penal', 'civil', 'laboral', 'administrativo', 'tributario', 'comercial',
    'derecho', 'derechos', 'obligación', 'contrato', 'demanda', 'tutela',
    'proceso', 'juicio', 'fallo', 'corte', 'tribunal', 'juez', 'abogado',
    'requisito', 'plazo', 'prescripción', 'caducidad', 'impuesto', 'multa',
    'sanción', 'recurso', 'apelación', 'casación', 'acción', 'pretensión'
  ]
  
  // Check for legal keywords
  if (legalKeywords.some(k => lowerMessage.includes(k))) {
    return true
  }
  
  // Questions about specific topics
  const questionPatterns = [
    'qué dice', 'que dice', 'cuál es', 'cual es', 'cómo funciona', 'como funciona',
    'qué es', 'que es', 'cuándo', 'cuando', 'dónde', 'donde', 'por qué', 'porque',
    'cuánto', 'cuanto', 'qué pasa', 'que pasa', 'es legal', 'es ilegal',
    'puedo', 'debo', 'tengo que', 'necesito', 'quiero saber'
  ]
  
  if (questionPatterns.some(p => lowerMessage.includes(p))) {
    return true
  }
  
  // Default: no search for simple conversational messages
  return false
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  console.log(`[${requestId}] 💬 Simple chat started`)

  try {
    const body = await req.json() as RequestBody
    const { message, history = [], config = {} } = body

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get API key
    const profile = await getProfile()
    const apiKey = process.env.OPENROUTER_API_KEY || profile?.openrouter_api_key || ""

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No API key configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
    })

    const model = config.model || DEFAULT_MODEL

    // Determine if web search is needed
    const shouldSearch = needsWebSearch(message)
    console.log(`[${requestId}] 🔍 Needs web search: ${shouldSearch}`)

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: string, data: any) => {
          controller.enqueue(
            encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        }

        try {
          // Emit meta
          sendEvent("meta", {
            message_id: requestId,
            intent: "chat",
            render_mode: "chat"
          })

          // Build messages
          const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history.filter(m => m.role === "user" || m.role === "assistant").map(m => ({
              role: m.role as "user" | "assistant",
              content: m.content
            }))
          ]

          // Optional: Perform quick web search only if needed
          let webContext = ""
          let citations: any[] = []
          
          if (shouldSearch) {
            sendEvent("status", {
              phase: "searching",
              message: "Buscando información relevante..."
            })

            try {
              // Use simple web search for general queries
              const searchResult = await simpleWebSearch(message, 5)
              
              if (searchResult.success && searchResult.results.length > 0) {
                webContext = "\n\nFuentes encontradas:\n" + 
                  searchResult.results.map((r, i) => 
                    `[${i + 1}] ${r.title}\nURL: ${r.url}\nExtracto: ${r.snippet}`
                  ).join("\n\n")
                
                citations = searchResult.results.map((r, i) => ({
                  id: `source-${i}`,
                  title: r.title,
                  url: r.url,
                  type: r.type,
                  snippet: r.snippet?.substring(0, 200)
                }))
                
                console.log(`[${requestId}] 🌐 Web search: ${searchResult.results.length} results`)
              }
            } catch (searchError) {
              console.warn(`[${requestId}] Web search failed:`, searchError)
              // Continue without web context - the LLM will still respond
            }
          }

          // Add user message with context
          messages.push({ 
            role: "user", 
            content: webContext ? `${message}\n\n${webContext}` : message 
          })

          // Emit status
          sendEvent("status", {
            phase: "streaming",
            message: "Generando respuesta..."
          })

          // Stream response
          const response = await client.chat.completions.create({
            model: model as ChatCompletionCreateParamsBase["model"],
            messages,
            temperature: config.temperature ?? 0.3,
            max_tokens: config.maxTokens || 4000,
            stream: true,
          })

          let fullText = ""
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              fullText += content
              sendEvent("delta", { text: content })
            }
          }

          // Emit citations if we have them
          if (citations.length > 0) {
            sendEvent("citations", { items: citations })
          }

          // Emit done
          sendEvent("done", {
            metadata: {
              model,
              webSearchUsed: shouldSearch,
              processingTime: Date.now()
            }
          })

          controller.close()

        } catch (error: any) {
          console.error(`[${requestId}] ❌ Error:`, error)
          sendEvent("error", {
            message: error.message || "Error en el chat",
            code: "CHAT_ERROR"
          })
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    })

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Outer error:`, error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

async function getProfile() {
  try {
    return await getServerProfile()
  } catch {
    return null
  }
}
