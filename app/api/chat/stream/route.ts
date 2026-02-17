/**
 * API Route: POST /api/chat/stream
 * 
 * Uses the LangGraph pipeline (mainGraph) for streaming legal assistant responses.
 * 
 * Events emitted (SSE format, compatible with existing frontend):
 * 1. meta: { message_id, intent, render_mode }
 * 2. status: { phase, message }
 * 3. delta: { text } (multiple, during streaming)
 * 4. citations: { items } (optional)
 * 5. done: { ok: true, metadata } | error: { message, code } | cancelled
 */

import { NextRequest } from "next/server"
import { HumanMessage, AIMessage } from "@langchain/core/messages"
import { v4 as uuidv4 } from "uuid"

import { mainGraph } from "@/lib/langgraph/graphs/mainGraph"
import { createStreamEmitter, SSEController } from "@/lib/chat/stream-emitter"
import { createRequestContext, withRequestIdHeaders } from "@/lib/server/request-context"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const context = createRequestContext(req, "api/chat/stream")
  const requestId = context.requestId
  const messageId = uuidv4()
  
  console.log(`[${requestId}] 🚀 Chat stream started (LangGraph pipeline)`)
  
  // Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }
  
  const { message, history = [], config = {} } = body
  
  if (!message || typeof message !== "string") {
    return new Response(
      JSON.stringify({ error: "Message is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }
  
  // Verify at least one API key is configured
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "No LLM API key configured (OPENROUTER_API_KEY or OPENAI_API_KEY)" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
  
  // Create AbortController for cancellation
  const abortController = new AbortController()
  
  // Handle client disconnect
  req.signal.addEventListener("abort", () => {
    console.log(`[${requestId}] ⚠️ Client disconnected, cancelling...`)
    abortController.abort()
  })
  
  // Create stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emitter = createStreamEmitter(controller as unknown as SSEController)
      
      try {
        const startTime = Date.now()
        
        // Build thread ID for conversation continuity
        const threadId = config.threadId || uuidv4()
        
        // Build initial messages from history
        const historyMessages = history.map((msg: any) => {
          if (msg.role === "user") {
            return new HumanMessage(msg.content)
          }
          return new AIMessage(msg.content)
        })
        
        // Build initial state for LangGraph
        const initialState = {
          messages: [...historyMessages, new HumanMessage(message)],
          user_goal: message,
          case_context: config.caseContext || {},
          constraints: {
            tone: "formal" as const,
            format: "markdown" as const,
            language: "es" as const
          },
          // If forceMode is set, skip classification and use the forced mode
          mode: config.forceMode || undefined,
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
        
        console.log(`[${requestId}] 📊 Running LangGraph pipeline...`)
        
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
          model: config.model || process.env.MAIN_MODEL || "openai/gpt-4o-mini",
          processingTime: `${duration}ms`,
          sourcesCount: 0
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
      "X-Accel-Buffering": "no"
    }, requestId)
  })
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

export async function GET(req: NextRequest) {
  const context = createRequestContext(req, "api/chat/stream")
  
  return new Response(
    JSON.stringify({
      status: "ok",
      endpoint: "Chat Stream (LangGraph Pipeline)",
      version: "4.0",
      features: [
        "LangGraph StateGraph pipeline",
        "Two modes: INVESTIGATE & DRAFT",
        "Vector Store + Knowledge Graph + Web Search tools",
        "Interrupt-based human-in-the-loop",
        "Evidence-based responses with citations",
        "Quality audit for document drafting"
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
