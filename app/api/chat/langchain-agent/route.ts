/**
 * Endpoint Unificado del Agente Legal con LangChain - VERSIÓN REFACTORIZADA
 * 
 * Arquitectura Industrial:
 * - Orquestación manual en lugar de AgentExecutor autónomo
 * - Flujo controlado: Analizar → Planificar → Investigar → Sintetizar
 * - Streaming activo con progreso real
 * - Respuestas legales estructuradas profesionalmente
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { BaseMessage } from "@langchain/core/messages"
import { createRequestContext, withRequestIdHeaders } from "@/lib/server/request-context"
import { clampTextForModel, toWindowedTextHistory, type WindowedTextMessage } from "@/lib/server/chat-history-window"
import { TimeoutError, withTimeout } from "@/lib/server/async-timeout"
import { requireChatAuthAndRateLimit } from "@/lib/server/chat-auth-guard"
import { canContinueChat, canUseModel, incrementModelUsage } from '@/lib/billing/plan-access'
import { incrementTokenUsage } from '@/db/usage-tracking'
import { detectDraftIntent } from "@/lib/draft-detection"
import { classifyDocumentIntent } from "@/lib/classifiers/document-classifier"
import { validateDraftContent } from "@/lib/utils/draft-utils"
import {
  ALLOWED_M_MODELS,
  isKnownMModelInput,
  M1_MODEL_ID,
  M1_SMALL_MODEL_ID,
  normalizeMModel
} from "@/lib/models/m1-models"

// Importar nuevo orquestador
import { LegalResearchOrchestrator } from "@/lib/legal-research/orchestrator"
import type { ResearchProgress } from "@/lib/legal-research/types"

export const runtime = "nodejs"
export const maxDuration = 180 // 3 minutos

const MAX_HISTORY_MESSAGES = 14
const MAX_HISTORY_TOTAL_CHARS = 12_000
const MAX_HISTORY_MESSAGE_CHARS = 1_800
const MAX_USER_QUERY_CHARS = 6_000
const RESEARCH_TIMEOUT_MS = 120_000 // 2 minutos para investigación completa

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE DE ORQUESTADORES (por sesión)
// ═══════════════════════════════════════════════════════════════════════════════

const orchestratorCache = new Map<string, { 
  orchestrator: LegalResearchOrchestrator
  lastUsed: Date 
}>()

const CACHE_TTL = 10 * 60 * 1000 // 10 minutos

function cleanupCache() {
  const now = Date.now()
  for (const [key, value] of orchestratorCache.entries()) {
    if (now - value.lastUsed.getTime() > CACHE_TTL) {
      orchestratorCache.delete(key)
    }
  }
}

let cleanupInterval: NodeJS.Timeout | null = null

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES Y TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

type StreamEmitter = (event: Record<string, unknown>) => void

interface AgentChatRequest {
  chatSettings: {
    model: string
    temperature?: number
  }
  messages: Array<{
    role: string
    content: string | Array<{text?: string}>
  }>
  chatId?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

function jsonWithRequestId(
  requestId: string,
  payload: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(payload, {
    status,
    headers: withRequestIdHeaders(undefined, requestId)
  })
}

function extractLastUserMessage(messages: AgentChatRequest['messages']): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const content = messages[i].content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        return content.map(c => c.text || '').join(' ')
      }
    }
  }
  return ''
}

function convertMessages(messages: WindowedTextMessage[]): BaseMessage[] {
  // Convertir a formato de LangChain si es necesario
  // Por ahora, el orquestador maneja su propio historial
  return []
}

function estimateMaxIterations(query: string, isDraft: boolean): number {
  const normalized = query.toLowerCase()
  const isSimple = normalized.length < 100 && 
    /^(hola|gracias|qu[eé] tal|buenos d[ií]as)/.test(normalized)
  
  if (isSimple) return 2
  if (isDraft) return 8
  if (normalized.length > 500) return 8
  return 5
}

function buildSearchDiscipline(userQuery: string): string {
  const normalized = userQuery.toLowerCase()
  
  if (normalized.length < 100 && /^(hola|gracias)/.test(normalized)) {
    return ""
  }
  
  return `
[INSTRUCCIÓN DE EFICIENCIA]: Realiza máximo 2-3 búsquedas enfocadas. 
Prioriza fuentes oficiales (.gov.co). No repitas búsquedas similares.`
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const context = createRequestContext(request, "api/chat/langchain-agent")
  
  console.log(`[LangChain Agent] 📥 Request recibido: ${new Date().toISOString()}`)

  // Iniciar cleanup
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupCache, CACHE_TTL)
  }

  try {
    // Parsear request
    const body = await request.json() as AgentChatRequest
    const { chatSettings, messages, chatId } = body
    
    // Validar auth y rate limits
    const guard = await requireChatAuthAndRateLimit()
    if (!guard.ok) {
      guard.response.headers.set("X-Request-Id", context.requestId)
      return guard.response
    }
    const userId = guard.userId

    // Validar modelo
    const requestedModel = chatSettings.model
    if (requestedModel && !isKnownMModelInput(requestedModel)) {
      return jsonWithRequestId(
        context.requestId,
        { error: "Modelo no permitido", allowedModels: ALLOWED_M_MODELS },
        400
      )
    }

    // Billing check
    if (process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true') {
      const canChat = await canContinueChat(userId)
      if (!canChat.allowed) {
        return jsonWithRequestId(
          context.requestId,
          { error: canChat.reason, code: "USAGE_LIMIT_EXCEEDED", needsUpgrade: true },
          402
        )
      }
    }

    // Validar API Key
    if (!process.env.OPENROUTER_API_KEY) {
      return jsonWithRequestId(
        context.requestId,
        { error: "OPENROUTER_API_KEY no configurada" },
        500
      )
    }

    // Extraer mensaje del usuario
    const lastUserMessage = clampTextForModel(
      extractLastUserMessage(messages),
      MAX_USER_QUERY_CHARS
    )
    
    if (!lastUserMessage) {
      return jsonWithRequestId(
        context.requestId,
        { error: "No se encontró mensaje válido", code: "EMPTY_USER_QUERY" },
        400
      )
    }

    // Detectar intención
    const heuristicResult = detectDraftIntent(lastUserMessage)
    const classificationResult = await classifyDocumentIntent(lastUserMessage, heuristicResult)
    const isDraft = classificationResult.intent === "document_write" && classificationResult.is_document
    const isAmbiguous = classificationResult.intent === "ambiguous"
    
    // Preparar input
    let inputMessage = lastUserMessage
    if (isDraft) {
      const { DOCUMENT_SYSTEM_PROMPT } = await import("@/lib/prompts/document-system-prompt")
      inputMessage = `${DOCUMENT_SYSTEM_PROMPT}\n\nUSUARIO: ${lastUserMessage}`
    } else if (isAmbiguous) {
      inputMessage = `${lastUserMessage}\n\n[SISTEMA]: Intención AMBIGUA. NO generes documento todavía. PREGUNTA si desea redactar o solo información.`
    } else {
      inputMessage += buildSearchDiscipline(lastUserMessage)
    }

    const effectiveChatId = chatId || `temp-${Date.now()}`
    const modelId = normalizeMModel(requestedModel || M1_MODEL_ID)
    const temperature = chatSettings.temperature ?? 0.3

    console.log(`[LangChain Agent] 🔧 Config: model=${modelId}, draft=${isDraft}, query="${lastUserMessage.substring(0, 50)}..."`)

    // Crear stream de respuesta
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false
        const emit: StreamEmitter = (event) => {
          if (isClosed) return
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
          } catch (e) { /* ignore */ }
        }

        const safeClose = () => {
          if (isClosed) return
          isClosed = true
          try { controller.close() } catch (e) { /* ignore */ }
        }

        try {
          // Evento inicial
          emit({
            type: "meta",
            message_id: effectiveChatId,
            render_mode: isDraft ? "document" : "chat",
            intent: classificationResult.intent,
            confidence: classificationResult.confidence || 0.8
          })

          // Crear orquestador con callbacks
          const orchestrator = new LegalResearchOrchestrator(
            {
              userId,
              chatId: effectiveChatId,
              messageId: `msg-${Date.now()}`,
              modelId,
              temperature
            },
            {
              onProgress: (progress: ResearchProgress) => {
                emit({
                  type: "status",
                  phase: progress.phase,
                  progress: progress.progress,
                  message: progress.message,
                  detail: progress.detail
                })
              },
              onToken: (token: string) => {
                emit({ type: "delta", text: token })
              }
            }
          )

          // Ejecutar investigación con timeout
          const result = await withTimeout(
            orchestrator.execute(inputMessage),
            RESEARCH_TIMEOUT_MS,
            "Timeout en investigación legal"
          )

          // Si no se emitieron tokens durante la síntesis, emitir respuesta completa
          if (result.response && !isDraft) {
            emit({ type: "delta", text: result.response })
          }

          // Emitir fuentes
          if (result.sources && result.sources.length > 0) {
            emit({
              type: "citations",
              items: result.sources.map((s, idx) => ({
                id: `source-${idx + 1}`,
                title: s.title,
                url: s.url,
                type: s.sourceType
              }))
            })
          }

          // Tracking de uso
          if (process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true') {
            try {
              const outputTokens = Math.ceil(result.response.length / 4)
              const inputTokens = Math.ceil(lastUserMessage.length / 4)
              await incrementTokenUsage(userId, outputTokens, inputTokens)
              await incrementModelUsage(userId, modelId)
            } catch (e) {
              console.error('Error tracking usage:', e)
            }
          }

          // Completado
          emit({
            type: "done",
            ok: result.success,
            metadata: {
              model: modelId,
              processingTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
              sourcesCount: result.sources?.length || 0,
              confidence: result.structuredResponse?.confidence
            }
          })

          safeClose()

        } catch (error: any) {
          console.error(`[LangChain Agent] Error:`, error)
          
          // Manejar error específico
          let errorMessage = "Error procesando su consulta. Por favor, intente de nuevo."
          
          if (error instanceof TimeoutError || error?.name === "TimeoutError") {
            errorMessage = "La investigación tomó demasiado tiempo. Intente con una consulta más específica."
          } else if (error.message?.includes("max iterations")) {
            // Esto no debería pasar con el nuevo orquestador, pero por si acaso
            errorMessage = "La consulta requiere investigación extensa. Intente dividirla en partes más específicas."
          }

          emit({ type: "error", message: errorMessage, code: "RESEARCH_ERROR" })
          safeClose()
        }
      }
    })

    return new Response(stream, {
      headers: withRequestIdHeaders(
        {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Model-Used': modelId,
          'X-Streaming': 'true',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          "X-Render-Mode": isDraft ? "document" : "chat",
          "X-Intent": classificationResult.intent,
        },
        context.requestId
      )
    })

  } catch (error: any) {
    console.error(`[LangChain Agent] Fatal error:`, error)
    return jsonWithRequestId(
      context.requestId,
      { error: error.message || "Error interno del servidor" },
      500
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT GET - Health Check
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, "api/chat/langchain-agent")
  
  return NextResponse.json({
    status: "ok",
    endpoint: "LangChain Agent - Industrial Version",
    version: "2.0.0",
    features: [
      "Orquestación manual (sin max iterations)",
      "Flujo: Analizar → Planificar → Investigar → Sintetizar",
      "Streaming con progreso real",
      "Respuestas legales estructuradas",
      "Modelos M vía OpenRouter"
    ],
    config: {
      timeout: RESEARCH_TIMEOUT_MS,
      maxDuration: maxDuration
    }
  }, {
    headers: withRequestIdHeaders(undefined, context.requestId)
  })
}
