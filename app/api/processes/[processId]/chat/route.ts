/**
 * API Route: POST /api/processes/[processId]/chat
 * 
 * Uses the LangGraph pipeline (mainGraph) for streaming legal assistant responses
 * within the context of a specific legal process/case.
 * 
 * Events emitted (SSE format, compatible with existing frontend):
 * 1. meta: { message_id, intent, render_mode }
 * 2. status: { phase, message }
 * 3. delta: { text } (multiple, during streaming)
 * 4. citations: { items } (optional)
 * 5. done: { ok: true, metadata } | error: { message, code } | cancelled
 */

export const dynamic = 'force-dynamic'

import { env } from "@/lib/env/runtime-env"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Database } from "@/supabase/types"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { assertWorkspaceAccess } from "@/lib/server/workspaces/access"
import { checkRateLimit, formatRateLimitHeaders, chatRateLimit } from "@/lib/rate-limit"
import { HumanMessage, AIMessage } from "@langchain/core/messages"
import { v4 as uuidv4 } from "uuid"

import { mainGraph } from "@/lib/langgraph/graphs/mainGraph"
import { createStreamEmitter, SSEController } from "@/lib/chat/stream-emitter"
import { createRequestContext, withRequestIdHeaders } from "@/lib/server/request-context"

export const runtime = "nodejs"
export const maxDuration = 120

interface RequestBody {
  message?: string // Campo directo (para compatibilidad)
  messages?: Array<{ role: string; content: string }> // Array de mensajes (formato useChat)
  chatSettings?: {
    model?: string
    temperature?: number
  }
  match_count?: number // Configurable match count (default 10)
  chatId?: string // Optional chat ID for message history
}

export async function POST(
  request: NextRequest,
  { params }: { params: { processId: string } }
) {
  const context = createRequestContext(request, "api/processes/[processId]/chat")
  const requestId = context.requestId
  const messageId = uuidv4()
  
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const supabaseAdmin = createSupabaseClient<Database>(
      env.supabaseUrl(),
      env.supabaseServiceRole()
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    // Rate limiting check (per user)
    const rateLimitResult = await checkRateLimit(user.id, chatRateLimit);

    if (!rateLimitResult.success) {
      const headers = formatRateLimitHeaders(rateLimitResult);
      return NextResponse.json(
        {
          error: 'Too many chat requests. Please wait a moment.',
          retryAfter: headers['Retry-After'],
        },
        {
          status: 429,
          headers,
        }
      );
    }

    const { processId } = params
    const body: RequestBody = await request.json()
    const { message, messages: bodyMessages, chatSettings, match_count = 10, chatId } = body

    // Extraer el mensaje: puede venir como campo directo o como último mensaje del array
    let userMessage: string | undefined = message

    if (!userMessage && bodyMessages && Array.isArray(bodyMessages) && bodyMessages.length > 0) {
      // Buscar el último mensaje del usuario en el array
      const lastUserMessage = [...bodyMessages].reverse().find(msg => msg.role === "user")
      if (lastUserMessage) {
        userMessage = lastUserMessage.content
      }
    }

    if (!userMessage || userMessage.trim().length === 0) {
      console.error("❌ Mensaje vacío recibido. Body:", JSON.stringify(body, null, 2))
      return NextResponse.json(
        { error: "El mensaje no puede estar vacío" },
        { status: 400 }
      )
    }

    // Verify user has access to the process using admin client
    const { data: processRecord, error: processError } = await supabaseAdmin
      .from("processes")
      .select("id,user_id,workspace_id,name,indexing_status")
      .eq("id", processId)
      .single()

    if (processError || !processRecord) {
      return NextResponse.json(
        { error: "Proceso no encontrado", details: processError?.message },
        { status: 404 }
      )
    }

    if (processRecord.workspace_id) {
      const access = await assertWorkspaceAccess(
        supabaseAdmin,
        processRecord.workspace_id,
        user.id
      ).catch(() => null)

      if (!access) {
        return NextResponse.json(
          { error: "No tienes acceso a este proceso" },
          { status: 403 }
        )
      }
    } else if (processRecord.user_id !== user.id) {
      return NextResponse.json(
        { error: "No tienes acceso a este proceso" },
        { status: 403 }
      )
    }

    // Verify process is ready for chat
    if (processRecord.indexing_status !== "ready") {
      return NextResponse.json(
        {
          error: "El proceso no está listo para consultas",
          indexing_status: processRecord.indexing_status,
          message: processRecord.indexing_status === "processing"
            ? "Los documentos se están indexando. Por favor espera unos momentos."
            : processRecord.indexing_status === "pending"
              ? "No hay documentos indexados en este proceso."
              : "Hubo un error al indexar los documentos."
        },
        { status: 400 }
      )
    }

    // Verify at least one API key is configured
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "No LLM API key configured (OPENROUTER_API_KEY or OPENAI_API_KEY)" },
        { status: 500 }
      )
    }

    console.log(`[${requestId}] 🔍 Procesando mensaje para proceso: ${processId} (LangGraph pipeline)`)

    // Create AbortController for cancellation
    const abortController = new AbortController()
    
    // Handle client disconnect
    request.signal.addEventListener("abort", () => {
      console.log(`[${requestId}] ⚠️ Client disconnected, cancelling...`)
      abortController.abort()
    })

    // Create stream
    const stream = new ReadableStream({
      async start(controller) {
        const emitter = createStreamEmitter(controller as unknown as SSEController)
        
        try {
          const startTime = Date.now()
          
          // Build thread ID for conversation continuity
          const threadId = chatId || uuidv4()
          
          // Build initial messages from history
          const historyMessages = (bodyMessages || [])
            .filter(msg => msg.role !== "user" || msg.content !== userMessage)
            .slice(-6) // Keep last 6 messages for context
            .map((msg: { role: string; content: string }) => {
              if (msg.role === "user") {
                return new HumanMessage(msg.content)
              }
              return new AIMessage(msg.content)
            })
          
          // Build initial state for LangGraph with process context
          const initialState = {
            messages: [...historyMessages, new HumanMessage(userMessage!)],
            user_goal: userMessage!,
            case_context: {
              case_id: processId,
              workspace_id: processRecord.workspace_id,
              process_name: processRecord.name
            },
            constraints: {
              tone: "formal" as const,
              format: "markdown" as const,
              language: "es" as const
            }
          }
          
          const graphConfig = {
            configurable: {
              thread_id: threadId,
              run_id: requestId
            }
          }
          
          // Emit meta event
          emitter.emitMeta(messageId, "chat_response", "chat")
          emitter.emitStatus("classifying", "Analizando tu consulta legal…")
          
          console.log(`[${requestId}] 📊 Running LangGraph pipeline for process: ${processId}`)
          
          // Stream events from the LangGraph pipeline
          const eventStream = await mainGraph.streamEvents(initialState, {
            ...graphConfig,
            version: "v2"
          })
          
          let lastNodeName = ""
          let fullText = ""
          let hasStartedStreaming = false
          
          for await (const event of eventStream) {
            // Check abort
            if (abortController.signal.aborted) {
              emitter.emitCancelled("User cancelled")
              return
            }
            
            // Handle node transitions for status updates
            if (event.event === "on_chain_start" && event.name) {
              const nodeName = event.name
              if (nodeName !== lastNodeName) {
                lastNodeName = nodeName
                const statusMessage = getNodeStatusMessage(nodeName)
                if (statusMessage) {
                  const phase = getNodePhase(nodeName)
                  emitter.emitStatus(phase, statusMessage)
                  console.log(`[${requestId}] 📍 Node: ${nodeName} → ${statusMessage}`)
                }
              }
            }
            
            // Handle LLM token streaming
            if (event.event === "on_chat_model_stream") {
              const content = event.data?.chunk?.content
              if (content && typeof content === "string" && content.length > 0) {
                if (!hasStartedStreaming) {
                  hasStartedStreaming = true
                  emitter.emitStatus("streaming", "Generando respuesta…")
                }
                fullText += content
                emitter.emitDelta(content)
              }
            }
          }
          
          const duration = Date.now() - startTime
          
          console.log(`[${requestId}] ✅ LangGraph completed in ${duration}ms, ${fullText.length} chars`)
          
          // If we got no streamed text, try to get final state
          if (!hasStartedStreaming || fullText.length === 0) {
            try {
              const finalState = await mainGraph.getState(graphConfig)
              const messages = finalState.values?.messages || []
              const lastAIMessage = [...messages].reverse().find(
                (m: any) => m._getType() === "ai" && m.content
              )
              if (lastAIMessage) {
                const content = lastAIMessage.content.toString()
                emitter.emitStatus("streaming", "Generando respuesta…")
                emitter.emitDelta(content)
                fullText = content
              }
            } catch (stateErr: any) {
              console.warn(`[${requestId}] Could not get final state:`, stateErr.message)
            }
          }
          
          // Emit citations if available
          try {
            const finalState = await mainGraph.getState(graphConfig)
            const citations = finalState.values?.citations || []
            if (citations.length > 0) {
              emitter.emitCitations(citations.map((c: any) => ({
                title: c.ref || c.title || "Fuente",
                url: c.source_url || "",
                snippet: c.excerpt || "",
                source: c.type || "internal"
              })))
            }
          } catch {
            // Citations are optional
          }
          
          // Emit done
          emitter.emitDone({
            model: chatSettings?.model || process.env.MAIN_MODEL || "openai/gpt-4o-mini",
            processingTime: `${duration}ms`,
            sourcesCount: 0,
            processId: processId
          })
          
        } catch (error: any) {
          console.error(`[${requestId}] ❌ LangGraph error:`, error)
          
          if (error.name === "AbortError" || abortController.signal.aborted) {
            emitter.emitCancelled("User cancelled")
          } else {
            emitter.emitError(
              error.message || "Error in LangGraph pipeline",
              error.code || "LANGGRAPH_ERROR"
            )
          }
        }
      },
      
      cancel(reason) {
        console.log(`[${requestId}] 🛑 Stream cancelled:`, reason)
        abortController.abort()
      }
    })
    
    return new Response(stream, {
      headers: withRequestIdHeaders({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Process-Id": processId
      }, requestId)
    })

  } catch (error: any) {
    console.error("Error in process chat:", error)
    return NextResponse.json(
      {
        error: "Error al procesar la consulta",
        details: error.message
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// NODE STATUS MAPPING
// ============================================================================

function getNodeStatusMessage(nodeName: string): string | null {
  const messages: Record<string, string> = {
    "classify_intent": "Analizando tu consulta legal…",
    "initialize_todo": "Preparando estructura del documento…",
    "collect_context": "Buscando en documentos y knowledge graph…",
    "detect_missing_info": "Evaluando información disponible…",
    "interrupt_for_user_answers": "Se necesita información adicional…",
    "build_outline": "Definiendo estructura del documento…",
    "draft_sections_react_loop": "Redactando secciones del documento…",
    "merge_and_audit": "Revisando documento por consistencia…",
    "finalize_document": "Finalizando documento con fuentes…",
    "make_research_plan": "Planificando investigación legal…",
    "retrieve_vector": "Buscando en documentos internos…",
    "retrieve_graph": "Consultando knowledge graph…",
    "maybe_web_search": "Investigando fuentes web…",
    "synthesize_answer": "Sintetizando respuesta con citas…",
    "quality_review": "Revisión de calidad…",
  }
  return messages[nodeName] || null
}

function getNodePhase(nodeName: string): "classifying" | "searching" | "drafting" | "streaming" {
  const searchNodes = ["collect_context", "retrieve_vector", "retrieve_graph", "maybe_web_search"]
  const draftNodes = ["draft_sections_react_loop", "merge_and_audit", "finalize_document", "build_outline"]
  const classifyNodes = ["classify_intent", "make_research_plan"]
  
  if (searchNodes.includes(nodeName)) return "searching"
  if (draftNodes.includes(nodeName)) return "drafting"
  if (classifyNodes.includes(nodeName)) return "classifying"
  return "streaming"
}

// ============================================================================
// GET Handler for endpoint info
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { processId: string } }
) {
  const context = createRequestContext(request, "api/processes/[processId]/chat")
  
  return new Response(
    JSON.stringify({
      status: "ok",
      endpoint: "Process Chat (LangGraph Pipeline)",
      version: "4.0",
      processId: params.processId,
      features: [
        "LangGraph StateGraph pipeline",
        "Two modes: INVESTIGATE & DRAFT",
        "Vector Store + Knowledge Graph + Web Search tools",
        "Interrupt-based human-in-the-loop",
        "Evidence-based responses with citations",
        "Quality audit for document drafting",
        "Process-scoped context (case_id)"
      ],
      eventTypes: ["meta", "status", "delta", "citations", "done", "error", "cancelled"]
    }),
    {
      headers: withRequestIdHeaders({
        "Content-Type": "application/json"
      }, context.requestId)
    }
  )
}
