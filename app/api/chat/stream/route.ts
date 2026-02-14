/**
 * API Route: POST /api/chat/stream
 * 
 * Streaming real con orquestador thin.
 * 
 * Eventos emitidos (en orden):
 * 1. meta: { message_id, intent, render_mode }
 * 2. status: { phase: "classifying"|"searching"|"streaming", message }
 * 3. delta: { text } (múltiples, durante streaming)
 * 4. citations: { items } (opcional, si hay fuentes)
 * 5. done: { ok: true, metadata } | error: { message, code } | cancelled
 */

import { NextRequest } from "next/server"
import { orchestrateChat } from "@/lib/chat/orchestrator"
import { createStreamEmitter } from "@/lib/chat/stream-emitter"
import { ChatMessage } from "@/lib/chat/types"
import { createRequestContext, withRequestIdHeaders } from "@/lib/server/request-context"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const context = createRequestContext(req, "api/chat/stream")
  const requestId = context.requestId
  
  console.log(`[${requestId}] 🚀 Chat stream started`)
  
  // Parsear body
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
  
  // Verificar API key
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OpenRouter API key not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
  
  // Crear AbortController para cancelación
  const abortController = new AbortController()
  
  // Manejar disconnect del cliente
  req.signal.addEventListener("abort", () => {
    console.log(`[${requestId}] ⚠️ Client disconnected, cancelling...`)
    abortController.abort()
  })
  
  // Crear stream
  const stream = new ReadableStream({
    async start(controller) {
      const emitter = createStreamEmitter(controller)
      
      try {
        // Convertir historial al formato interno
        const chatHistory: ChatMessage[] = history.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }))
        
        // Ejecutar orquestador
        const result = await orchestrateChat(message, chatHistory, {
          apiKey,
          emitter,
          abortSignal: abortController.signal,
          config: {
            model: config.model || "openai/gpt-4o-mini",
            temperature: config.temperature ?? 0.3,
            maxTokens: config.maxTokens ?? 4000,
            maxToolIterations: 5,
            toolTimeoutMs: 15000,
            llmTimeoutMs: 60000
          }
        })
        
        console.log(`[${requestId}] ✅ Chat completed:`, {
          processingTime: `${result.processingTimeMs}ms`,
          citations: result.citations.length,
          toolExecutions: result.toolExecutions.length
        })
        
      } catch (error: any) {
        console.error(`[${requestId}] ❌ Chat error:`, error)
        
        if (error.name === "CancelledError" || error.code === "CANCELLED") {
          emitter.emitCancelled("User cancelled")
        } else if (error.code === "TIMEOUT") {
          emitter.emitError(error.message, "TIMEOUT")
        } else {
          emitter.emitError(error.message || "Unknown error", error.code || "UNKNOWN")
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
      "X-Accel-Buffering": "no"  // Deshabilitar buffering de nginx
    }, requestId)
  })
}

export async function GET(req: NextRequest) {
  const context = createRequestContext(req, "api/chat/stream")
  
  return new Response(
    JSON.stringify({
      status: "ok",
      endpoint: "Chat Stream",
      version: "3.0",
      features: [
        "Real streaming (no fake)",
        "Tool calling",
        "Intent classification",
        "Cancellation support"
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
