/**
 * Endpoint Unificado del Agente Legal con LangChain
 *
 * Protocolo de Eventos v2.0:
 * - {"type": "meta", message_id, render_mode, intent, confidence} - Metadatos iniciales
 * - {"type": "status", phase, message, progress} - Cambios de fase
 * - {"type": "delta", text} - Tokens de respuesta (renombrado de 'token')
 * - {"type": "citations", items} - Fuentes encontradas (renombrado de 'sources')
 * - {"type": "done", ok, metadata} - Finalización
 * - {"type": "error", message, code} - Errores
 *
 * Fases: classifying → searching → drafting → streaming → completed
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages"
import { LegalAgent, RESEARCH_MODELS } from "@/lib/langchain"
import { BaseCallbackHandler } from "@langchain/core/callbacks/base"
import {
  extractLastUserMessage,
  extractMessageText as extractPayloadText,
  parseAgentChatRequest,
  type AgentChatRequest
} from "@/lib/server/chat-payload"
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

export const runtime = "nodejs"
export const maxDuration = 180 // 3 minutos para investigación completa

const MAX_HISTORY_MESSAGES = 14
const MAX_HISTORY_TOTAL_CHARS = 12_000
const MAX_HISTORY_MESSAGE_CHARS = 1_800
const MAX_USER_QUERY_CHARS = 6_000
// Timeout para invocación del agente (75 segundos para investigación completa)
const AGENT_INVOKE_TIMEOUT_MS = 75_000

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

type RequestBody = AgentChatRequest

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

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE DE AGENTES (por sesión)
// ═══════════════════════════════════════════════════════════════════════════════

// Cache simple de agentes por chatId para reutilizar en conversaciones
const agentCache = new Map<string, { agent: LegalAgent; lastUsed: Date }>()

// Limpiar agentes inactivos cada 10 minutos
const CACHE_TTL = 10 * 60 * 1000 // 10 minutos

function cleanupCache() {
  const now = Date.now()
  for (const [key, value] of agentCache.entries()) {
    if (now - value.lastUsed.getTime() > CACHE_TTL) {
      agentCache.delete(key)
    }
  }
}

// Ejecutar cleanup periódicamente (solo en el primer request)
let cleanupInterval: NodeJS.Timeout | null = null

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING CALLBACK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

type StreamEmitter = (event: Record<string, unknown>) => void

const TOOL_LABELS: Record<string, string> = {
  search_legal_official: "Investigando normas oficiales",
  search_jurisprudencia: "Contrastando jurisprudencia aplicable",
  buscar_articulo_ley: "Verificando texto literal de articulos",
  serper_web_search: "Contrastando fuentes complementarias"
}

const TRUSTED_SOURCE_DOMAINS = [
  ".gov.co",
  "corteconstitucional.gov.co",
  "consejodeestado.gov.co",
  "cortesuprema.gov.co",
  "suin-juriscol.gov.co",
  "secretariasenado.gov.co",
  "funcionpublica.gov.co",
  "ramajudicial.gov.co",
  "imprenta.gov.co",
  "superfinanciera.gov.co"
]

function safeJsonParse(input: string): Record<string, any> | null {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

function normalizeStatusTopic(value: unknown): string {
  if (typeof value !== "string") return ""
  return value
    .replace(/\s+/g, " ")
    .replace(/\b(serper|api|tool|herramienta|llamada)\b/gi, "")
    .replace(/site:[^\s]+/gi, "")
    .replace(/\b(and|or)\b/gi, " ")
    .replace(/[{}[\]"`]+/g, "")
    .trim()
    .slice(0, 90)
}

function extractToolTopic(rawInput: string): string {
  const parsed = safeJsonParse(rawInput)
  if (!parsed) {
    return normalizeStatusTopic(rawInput)
  }
  return (
    normalizeStatusTopic(parsed.query) ||
    normalizeStatusTopic(parsed.norma) ||
    normalizeStatusTopic(parsed.ley) ||
    normalizeStatusTopic(parsed.articulo) ||
    normalizeStatusTopic(parsed.tema)
  )
}

function buildToolLabel(toolName: string, rawInput: string): string {
  const base = TOOL_LABELS[toolName] || "Investigando fuentes legales"
  const topic = extractToolTopic(rawInput)
  return topic ? `${base}: ${topic}` : base
}

function isTrustedLegalSource(url: string): boolean {
  const normalized = url.toLowerCase()
  return TRUSTED_SOURCE_DOMAINS.some(domain => normalized.includes(domain))
}

function normalizeSourceName(url: string): string {
  const normalized = url.toLowerCase()
  if (normalized.includes("secretariasenado.gov.co")) return "Secretaria del Senado"
  if (normalized.includes("suin-juriscol.gov.co")) return "SUIN-Juriscol"
  if (normalized.includes("corteconstitucional.gov.co")) return "Corte Constitucional"
  if (normalized.includes("consejodeestado.gov.co")) return "Consejo de Estado"
  if (normalized.includes("cortesuprema.gov.co")) return "Corte Suprema de Justicia"
  if (normalized.includes("superfinanciera.gov.co")) return "Superintendencia Financiera"
  if (normalized.includes("funcionpublica.gov.co")) return "Funcion Publica"
  if (normalized.includes(".gov.co")) return "Fuente oficial"
  return "Fuente legal"
}

function normalizeSources(
  rawSources: Array<{ title?: string; url?: string }>
): Array<{ title: string; url: string; type: string }> {
  const cleaned = rawSources
    .filter(source => typeof source?.url === "string" && source.url.startsWith("http"))
    .map(source => {
      const url = (source.url || "").trim()
      const trusted = isTrustedLegalSource(url)
      const fallbackTitle = trusted ? normalizeSourceName(url) : "Fuente complementaria"
      const title = source.title?.trim() || fallbackTitle
      return {
        title,
        url,
        type: trusted ? "oficial" : "complementaria"
      }
    })

  const deduped = cleaned.filter(
    (item, index, arr) => arr.findIndex(other => other.url === item.url) === index
  )

  const prioritized = deduped.sort((a, b) => {
    if (a.type === b.type) return 0
    return a.type === "oficial" ? -1 : 1
  })

  const official = prioritized.filter(item => item.type === "oficial")
  return (official.length > 0 ? official : prioritized).slice(0, 10)
}

function extractSourcesFromText(output: string): Array<{ title: string; url: string }> {
  const matches = output.match(/https?:\/\/[^\s)\]>"']+/g) || []
  const urls = matches
    .map(url => url.replace(/[.,\])}]+$/, ""))
    .filter((url, index, arr) => arr.indexOf(url) === index)

  return urls.map(url => ({
    title: normalizeSourceName(url),
    url
  }))
}

function sanitizeFinalOutput(text: string): string {
  const withoutThinkBlocks = text.replace(/<think>[\s\S]*?<\/think>/gi, "")
  const lines = withoutThinkBlocks
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^\**\s*(think|análisis interno|razonamiento interno)\s*[:\s]/i.test(line))
    .filter(line => !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(line))
    .filter(
      line =>
        !/^(?:\[.*?\]\s*)?(?:tool|tool calls|query optimizada|serper|input|iteración|modelo|fuentes|respuesta completada)\s*[:\-]/i.test(
          line
        )
    )
    .filter(line => !/^(?:═|─){5,}$/.test(line))
    .filter(
      line =>
        !/^\**\s*(ok|listo|respuesta|respuesta final|procedo|nota mental|fin del pensamiento|fin|adelante)\s*[:.]?\s*\**$/i.test(
          line
        )
    )
    .filter(
      line =>
        !/^\**\s*(voy a|procedo a|generando respuesta|respuesta generada|última verificación|último chequeo)\b/i.test(
          line
        )
    )

  const deduped: string[] = []
  const seenKeys = new Set<string>()
  for (const line of lines) {
    const key = line.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, " ").trim()
    if (!key) continue
    if (seenKeys.has(key) && key.length < 80) continue
    seenKeys.add(key)
    deduped.push(line)
  }

  return deduped.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

class StreamingCallbackHandler extends BaseCallbackHandler {
  name = "streaming_status_handler"
  private emit: StreamEmitter
  
  // Tracking de contenido emitido
  public hasEmittedContent = false
  public totalEmittedLength = 0

  constructor(emit: StreamEmitter) {
    super()
    this.emit = emit
  }

  async handleLLMStart() {
    console.log(`[StreamingCallback] 🎬 LLM Start - iniciando generación`)
    this.emit({
      type: "status",
      phase: "classifying",
      progress: 15,
      message: "Analizando tu consulta legal…"
    })
  }
  
  async handleLLMEnd() {
    console.log(`[StreamingCallback] 🏁 LLM End - generación completada, tokens emitidos: ${this.tokenCount}, contenido emitido: ${this.totalEmittedLength}`)
    this.flushBuffer()
  }
  
  async handleLLMError(error: Error) {
    console.error(`[StreamingCallback] ❌ LLM Error:`, error.message)
  }

  async handleToolStart(tool: { name?: string }, input: string) {
    const toolName = tool?.name || "search_legal_official"
    const label = buildToolLabel(toolName, input)

    this.emit({
      type: "status",
      phase: "searching",
      progress: 40,
      message: label
    })
  }

  async handleToolEnd() {
    this.emit({
      type: "status",
      phase: "searching",
      progress: 65,
      message: "Fuentes contrastadas…"
    })
  }

  async handleToolError(err: Error) {
    this.emit({
      type: "status",
      phase: "searching",
      progress: 55,
      message: "Hubo un problema validando una fuente, continuo con otras…"
    })
  }

  // Streaming real token por token
  private inThinkBlock = false
  private buffer = ""

  private tokenCount = 0
  
  async handleLLMNewToken(token: string) {
    if (!token) return
    
    this.tokenCount++
    if (this.tokenCount % 50 === 0) {
      console.log(`[LangChain Agent] 📝 Tokens emitidos: ${this.tokenCount}`)
    }

    // Acumulamos en buffer para manejar tags partidos
    this.buffer += token

    // Verificar si estamos dentro de un bloque <think>
    if (this.inThinkBlock) {
      // Buscar cierre
      const endIndex = this.buffer.indexOf('</think>')
      if (endIndex !== -1) {
        this.inThinkBlock = false
        // Emitir lo que sigue después del cierre
        const remaining = this.buffer.slice(endIndex + 8) // length of </think>
        this.buffer = ""
        if (remaining) {
          this.hasEmittedContent = true
          this.totalEmittedLength += remaining.length
          this.emit({ type: 'delta', text: remaining })
        }
      }
      // Si no hay cierre, seguimos buffering (y suprimiendo)
      if (this.buffer.length > 50000) this.buffer = "" // Safety clear
      return
    }

    // No estamos en think block. Verificar si empieza uno.
    const startIndex = this.buffer.indexOf('<think>')
    if (startIndex !== -1) {
      this.inThinkBlock = true
      // Emitir lo que habia antes del start
      const visible = this.buffer.slice(0, startIndex)
      if (visible) {
        this.hasEmittedContent = true
        this.totalEmittedLength += visible.length
        this.emit({ type: 'delta', text: visible })
      }
      this.buffer = this.buffer.slice(startIndex) // Mantener desde <think>
      // Recursivamente checar si cierra en el mismo chunk
      return this.handleLLMNewToken("")
    }

    // No hay tags completos. 
    // Pero cuidado con tags parciales al final: "<", "<th", "<think"
    if (/<(?:t(?:h(?:i(?:n(?:k(?:>)?)?)?)?)?)?$/.test(this.buffer)) {
      // Es un posible inicio parcial, no emitimos aun.
      if (this.buffer.length > 20) {
        const safeToEmit = this.buffer.slice(0, -7)
        const remaining = this.buffer.slice(-7)
        if (safeToEmit) {
          this.hasEmittedContent = true
          this.totalEmittedLength += safeToEmit.length
          this.emit({ type: 'delta', text: safeToEmit })
        }
        this.buffer = remaining
      }
      return
    }

    // Si llegamos aqui, el buffer es contenido seguro
    if (this.buffer) {
      this.hasEmittedContent = true
      this.totalEmittedLength += this.buffer.length
      this.emit({ type: 'delta', text: this.buffer })
    }
    this.buffer = ""
  }
  
  /**
   * Fuerza la emisión de cualquier contenido pendiente en el buffer
   */
  flushBuffer() {
    if (this.buffer && !this.inThinkBlock) {
      const content = this.buffer.trim()
      if (content) {
        this.hasEmittedContent = true
        this.totalEmittedLength += content.length
        this.emit({ type: 'delta', text: content })
      }
      this.buffer = ""
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

function convertMessages(messages: WindowedTextMessage[]): BaseMessage[] {
  return messages
    .filter(m => m.role !== 'system') // El system prompt lo maneja el agente
    .map(msg => {
      const text = msg.content
      if (msg.role === 'user') {
        return new HumanMessage(text)
      } else {
        return new AIMessage(text)
      }
    })
}

/**
 * Obtiene o crea un agente para un chat específico
 */
async function getOrCreateAgent(
  chatId: string,
  modelId: string,
  temperature: number,
  maxIterations: number,
  userScope: string
): Promise<LegalAgent> {
  const cacheKey = `${userScope}:${chatId}-${modelId}-${maxIterations}`
  console.log("[getOrCreateAgent] 🔍 Cache key:", cacheKey)

  const cached = agentCache.get(cacheKey)
  if (cached) {
    console.log("[getOrCreateAgent] ♻️ Retornando agente desde cache")
    cached.lastUsed = new Date()
    return cached.agent
  }
  
  console.log("[getOrCreateAgent] 🆕 Creando nuevo agente LegalAgent…")
  console.log("[getOrCreateAgent] ⚙️ Config:", { modelId, temperature, maxIterations })
  
  try {
    const agent = await LegalAgent.create({
      modelId,
      temperature,
      maxIterations,
      verbose: process.env.NODE_ENV === 'development'
    })
    console.log("[getOrCreateAgent] ✅ Agente creado exitosamente")
    agentCache.set(cacheKey, { agent, lastUsed: new Date() })
    return agent
  } catch (error) {
    console.error("[getOrCreateAgent] ❌ Error creando LegalAgent:", error)
    throw error
  }
}

function estimateAgentMaxIterations(userQuery: string, isDraft: boolean): number {
  const normalized = (userQuery || "").toLowerCase()
  const isLikelySmallTalk =
    normalized.length < 120 &&
    /^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|gracias|qui[eé]n eres|qu[eé] puedes hacer)/.test(
      normalized.trim()
    )
  const isSimpleArticleLookup =
    /\bart(?:[íi]culo|\.)?\s*\d+[a-z]?\b/.test(normalized) &&
    /(constituci[óo]n|c[óo]digo|ley|estatuto)/.test(normalized)
  const isLikelyComplex =
    normalized.length > 700 ||
    /(jurisprudencia|comparad|doctrina|linea jurisprudencial|an[aá]lisis integral|estrategia legal)/.test(
      normalized
    )

  if (isLikelySmallTalk) return 1
  if (isDraft || isLikelyComplex) return 6
  if (isSimpleArticleLookup) return 2
  if (normalized.length < 220) return 3
  return 4
}

function buildSearchDisciplineInstruction(userQuery: string): string {
  const normalized = (userQuery || "").toLowerCase()
  const isLikelySmallTalk =
    normalized.length < 120 &&
    /^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|gracias|qui[eé]n eres|qu[eé] puedes hacer)/.test(
      normalized.trim()
    )
  const isSimpleArticleLookup =
    /\bart(?:[íi]culo|\.)?\s*\d+[a-z]?\b/.test(normalized) &&
    /(constituci[óo]n|c[óo]digo|ley|estatuto)/.test(normalized)

  if (isLikelySmallTalk) {
    return "\n\n[INSTRUCCIÓN DE EFICIENCIA: Consulta conversacional. Responde sin usar herramientas de búsqueda.]"
  }

  if (isSimpleArticleLookup) {
    return (
      "\n\n[INSTRUCCIÓN DE EFICIENCIA: Esta consulta es puntual. Usa como máximo 1 búsqueda principal " +
      "y NO repitas consultas equivalentes.]"
    )
  }

  return (
    "\n\n[INSTRUCCIÓN DE EFICIENCIA: No repitas búsquedas equivalentes. " +
    "Usa máximo 2 búsquedas salvo contradicción real entre fuentes.]"
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log("[LangChain Agent] 📥 POST recibido:", new Date().toISOString())
  
  const context = createRequestContext(request, "api/chat/langchain-agent")

  // Iniciar cleanup si no está corriendo
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupCache, CACHE_TTL)
  }

  try {
    console.log("[LangChain Agent] 📦 Parsing body…")
    const rawBody = await request.json().catch((err) => {
      console.error("[LangChain Agent] ❌ Error parsing body:", err)
      return null
    })
    console.log("[LangChain Agent] ✅ Body recibido:", JSON.stringify(rawBody, null, 2))
    const parsed = parseAgentChatRequest(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalido: chatSettings.model y messages son requeridos" },
        {
          status: 400,
          headers: withRequestIdHeaders(undefined, context.requestId)
        }
      )
    }
    const { chatSettings, messages, chatId } = parsed.data
    const guard = await requireChatAuthAndRateLimit()
    if (!guard.ok) {
      guard.response.headers.set("X-Request-Id", context.requestId)
      return guard.response
    }
    const effectiveUserId = guard.userId

    const requestedModel = chatSettings.model
    if (requestedModel && !isKnownMModelInput(requestedModel)) {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "Modelo no permitido para este asistente",
          code: "MODEL_NOT_ALLOWED",
          allowedModels: ALLOWED_M_MODELS
        },
        400
      )
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BILLING CHECK: Verify user can continue chatting
    // ═══════════════════════════════════════════════════════════════════════
    // Check if billing is enabled and user has access
    if (process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true') {
      const canChat = await canContinueChat(effectiveUserId)

      if (!canChat.allowed) {
        return jsonWithRequestId(
          context.requestId,
          {
            error: canChat.reason || "Has alcanzado el límite de tu plan",
            code: "USAGE_LIMIT_EXCEEDED",
            needsUpgrade: true
          },
          402 // Payment Required
        )
      }

      // Check model-specific usage limits
      const modelId = normalizeMModel(requestedModel || M1_MODEL_ID)
      const modelCheck = await canUseModel(effectiveUserId, modelId)

      if (!modelCheck.allowed) {
        return jsonWithRequestId(
          context.requestId,
          {
            error: modelCheck.reason || "Has alcanzado el límite de uso de este modelo",
            code: "MODEL_LIMIT_EXCEEDED",
            needsUpgrade: true,
            suggestModel: M1_SMALL_MODEL_ID,
            usage: modelCheck.usage
          },
          402 // Payment Required
        )
      }
    }

    // Validar API Key
    const apiKey = process.env.OPENROUTER_API_KEY
    console.log("[LangChain Agent] 🔑 API Key configurada:", apiKey ? "✅ Sí" : "❌ No")
    console.log("[LangChain Agent] 🔑 Longitud API Key:", apiKey?.length || 0)
    
    if (!apiKey) {
      console.error("[LangChain Agent] ❌ OPENROUTER_API_KEY no configurada")
      return jsonWithRequestId(
        context.requestId,
        { error: "OPENROUTER_API_KEY no configurada" },
        500
      )
    }

    // Determinar modelo a usar
    const modelId = normalizeMModel(requestedModel || M1_MODEL_ID)
    const temperature = chatSettings.temperature ?? 0.3

    // Extraer el ultimo mensaje del usuario y limitar su tamano
    const lastUserMessage = clampTextForModel(
      extractLastUserMessage(messages),
      MAX_USER_QUERY_CHARS
    )
    if (!lastUserMessage) {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "No se encontro texto valido en el mensaje del usuario",
          code: "EMPTY_USER_QUERY"
        },
        400
      )
    }

    // Detección de draft: heurística + clasificación LLM
    const heuristicResult = detectDraftIntent(lastUserMessage)
    let classificationResult = await classifyDocumentIntent(lastUserMessage, heuristicResult)

    // Lógica estricta de decisión basada en el clasificador
    const isDraft = classificationResult.intent === "document_write" && classificationResult.is_document

    // Manejo de Ambigüedad: Si es ambiguo, forzamos Chat Mode pero instruimos al modelo para que aclare
    const isAmbiguous = classificationResult.intent === "ambiguous"

    const draftType = classificationResult.doc_type
    const maxIterations = estimateAgentMaxIterations(lastUserMessage, isDraft)

    // Obtener o crear agente
    const effectiveChatId = chatId || `temp-${Date.now()}`
    console.log("[LangChain Agent] 🔧 Creando/Obteniendo agente…")
    console.log("[LangChain Agent] ⚙️ Config - Model:", modelId, "MaxIter:", maxIterations)
    
    let agent
    try {
      agent = await getOrCreateAgent(effectiveChatId, modelId, temperature, maxIterations, effectiveUserId)
      console.log("[LangChain Agent] ✅ Agente creado/obtenido exitosamente")
    } catch (agentError) {
      console.error("[LangChain Agent] ❌ Error creando agente:", agentError)
      return jsonWithRequestId(
        context.requestId,
        {
          error: "Error inicializando el agente legal",
          details: agentError instanceof Error ? agentError.message : "Unknown error"
        },
        500
      )
    }

    // Inyectar System Prompt si es un documento
    // Nota: El agente de LangChain maneja su propio system prompt, 
    // pero podemos prefijar la instrucción en el input o historial si es necesario.
    // En este caso, modificaremos dinámicamente el comportamiento si detectamos draft.
    let inputMessage = lastUserMessage
    if (isDraft) {
      const { DOCUMENT_SYSTEM_PROMPT } = await import("@/lib/prompts/document-system-prompt")
      inputMessage = `${DOCUMENT_SYSTEM_PROMPT}\n\nUSUARIO: ${lastUserMessage}`
    } else if (isAmbiguous) {
      inputMessage = `${lastUserMessage}\n\n[SISTEMA]: La intención del usuario es AMBIGUA entre consulta y redacción. NO generes un documento completo todavía. PREGUNTA cortésmente si desea que redactes/generes el documento formalmente o si solo busca información.`
    } else {
      inputMessage = `${lastUserMessage}${buildSearchDisciplineInstruction(lastUserMessage)}`
    }

    // Convertir historial en ventana acotada (excluyendo el ultimo mensaje del usuario)
    const chatHistoryWindow = toWindowedTextHistory(messages.slice(0, -1), {
      maxMessages: MAX_HISTORY_MESSAGES,
      maxTotalChars: MAX_HISTORY_TOTAL_CHARS,
      maxMessageChars: MAX_HISTORY_MESSAGE_CHARS
    })
    const chatHistory = convertMessages(chatHistoryWindow)

    // Crear stream de respuesta con eventos JSON
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false
        let heartbeat: NodeJS.Timeout | null = null

        // Helper para emitir eventos de forma segura
        const emit = (event: object) => {
          if (isClosed) return
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
          } catch (e) {
            // Ignorar errores si el controller ya está cerrado
          }
        }

        const safeClose = () => {
          if (isClosed) return
          if (heartbeat) {
            clearInterval(heartbeat)
            heartbeat = null
          }
          isClosed = true
          try {
            controller.close()
          } catch (e) {
            // Ignorar errores si ya está cerrado
          }
        }

        try {
          // ═══════════════════════════════════════════════════════════════════
          // EVENTO META: Metadatos iniciales del stream
          // ═══════════════════════════════════════════════════════════════════
          emit({
            type: "meta",
            message_id: effectiveChatId,
            render_mode: isDraft ? "document" : "chat",
            intent: classificationResult.intent,
            confidence: classificationResult.confidence || 0.8
          })

          // ═══════════════════════════════════════════════════════════════════
          // FASE: CLASSIFYING - Análisis inicial
          // ═══════════════════════════════════════════════════════════════════
          emit({
            type: "status",
            phase: "classifying",
            progress: 10,
            message: "Analizando tu consulta legal…"
          })

          // ═══════════════════════════════════════════════════════════════════
          // FASE: SEARCHING - Investigación de fuentes
          // ═══════════════════════════════════════════════════════════════════
          const heartbeatMessages = [
            "Investigando normas oficiales…",
            "Contrastando jurisprudencia aplicable…",
            "Verificando texto literal de artículos…"
          ]
          let heartbeatIndex = 0
          heartbeat = setInterval(() => {
            if (isClosed) return
            emit({
              type: "status",
              phase: "searching",
              progress: Math.min(70, 25 + heartbeatIndex * 15),
              message: heartbeatMessages[Math.min(heartbeatIndex, heartbeatMessages.length - 1)]
            })
            heartbeatIndex = Math.min(heartbeatIndex + 1, heartbeatMessages.length - 1)
          }, 2500)

          const callbackHandler = new StreamingCallbackHandler(emit)

          // Ejecutar el agente
          console.log("[LangChain Agent] 🤖 Invocando agente…")
          console.log("[LangChain Agent] 📝 Input:", inputMessage.substring(0, 100))
          console.log("[LangChain Agent] 📜 Chat history length:", chatHistory.length)
          
          const result = await withTimeout(
            agent.invoke(
              {
                input: inputMessage,
                chatHistory
              },
              {
                callbacks: [callbackHandler]
              }
            ),
            AGENT_INVOKE_TIMEOUT_MS,
            "Timeout ejecutando el agente legal"
          )
          
          console.log("[LangChain Agent] ✅ Agente completado")
          console.log("[LangChain Agent] 📄 Output length:", result.output?.length || 0)
          console.log("[LangChain Agent] 📄 Output preview:", result.output?.substring(0, 200))
          console.log("[LangChain Agent] 🔧 Tools used:", result.toolsUsed?.join(', ') || 'ninguna')
          console.log("[LangChain Agent] 📊 Intermediate steps:", result.intermediateSteps?.length || 0)

          if (heartbeat) {
            clearInterval(heartbeat)
            heartbeat = null
          }

          // ═══════════════════════════════════════════════════════════════════
          // FASE: DRAFTING - Preparación de respuesta
          // ═══════════════════════════════════════════════════════════════════
          emit({
            type: "status",
            phase: "drafting",
            progress: 75,
            message: "Sintetizando hallazgos…"
          })

          // Limpiar la respuesta del modelo
          let cleanOutput = result.output

          // Si es modo draft, validar y formatear JSON
          if (isDraft) {
            const validation = validateDraftContent(cleanOutput)
            if (validation.valid && validation.draft) {
              // Asegurar disclaimer
              if (!validation.draft.notes || validation.draft.notes.length === 0) {
                validation.draft.notes = ["⚠️ Documento preliminar, requiere revisión profesional, no sustituye asesoría legal."]
              } else if (!validation.draft.notes.some(note => note.includes("preliminar") || note.includes("revisión"))) {
                validation.draft.notes.push("⚠️ Documento preliminar, requiere revisión profesional, no sustituye asesoría legal.")
              }
              cleanOutput = JSON.stringify(validation.draft)
              emit({ type: 'draft_detected', doc_type: draftType })
            } else {
              // Intentar extraer JSON si está envuelto
              const jsonMatch = cleanOutput.match(/```json\s*([\s\S]*?)\s*```/)
              if (jsonMatch) {
                try {
                  const parsed = JSON.parse(jsonMatch[1])
                  const revalidation = validateDraftContent(parsed)
                  if (revalidation.valid && revalidation.draft) {
                    cleanOutput = JSON.stringify(revalidation.draft)
                    emit({ type: 'draft_detected', doc_type: draftType })
                  }
                } catch (e) {
                  console.error("Error parseando JSON extraído:", e)
                }
              }
            }
          } else {
            // Limpieza de formato normal
            const sanitizedOutput = sanitizeFinalOutput(
              cleanOutput
                .replace(/\*{0,2}Fuentes consultadas\*{0,2}\s*\n+/gi, '')
                .replace(/\d+\s*referencias?\s*\n+/gi, '')
                .replace(/\n+---\n*\*{0,2}Fuentes?\s*(consultadas|legales?)?\*{0,2}:?\s*\n*$/gi, '')
                .replace(/\n+\*{0,2}Fuentes?\s*(consultadas|legales?)?\*{0,2}:?\s*\n*$/gi, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim()
            )
            cleanOutput = sanitizedOutput || cleanOutput.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
          }

          // ═══════════════════════════════════════════════════════════════════
          // EMITIR RESPUESTA FINAL
          // ═══════════════════════════════════════════════════════════════════
          // Hacer flush del buffer del callback para asegurar que todo se emitió
          callbackHandler.flushBuffer()
          
          // Verificar si el callback emitió suficiente contenido
          // Si no emitió nada o muy poco, emitimos la respuesta completa limpia
          const emittedLength = callbackHandler.totalEmittedLength
          const expectedLength = cleanOutput.length
          const emissionRatio = expectedLength > 0 ? emittedLength / expectedLength : 0
          
          console.log(`[LangChain Agent] 📊 Streaming check: emitted=${emittedLength}, expected=${expectedLength}, ratio=${emissionRatio.toFixed(2)}`)
          
          // Si se emitió menos del 80% del contenido esperado, emitir la respuesta completa
          if (emissionRatio < 0.8 && expectedLength > 0) {
            console.log(`[LangChain Agent] ⚠️ Streaming incompleto, emitiendo respuesta completa…`)
            emit({
              type: "status",
              phase: "streaming",
              progress: 85,
              message: "Generando respuesta…"
            })
            emit({ type: 'delta', text: cleanOutput })
          } else if (!callbackHandler.hasEmittedContent && expectedLength > 0) {
            // Caso extremo: no se emitió nada
            console.log(`[LangChain Agent] ⚠️ No se emitió contenido via streaming, enviando respuesta completa…`)
            emit({ type: 'delta', text: cleanOutput })
          }
          
          // Caso especial: si el output parece incompleto (muy corto o solo la frase inicial)
          if (expectedLength < 50 && expectedLength > 0) {
            console.log(`[LangChain Agent] ⚠️ Respuesta muy corta (${expectedLength} chars), posible respuesta incompleta`)
            // No hacer nada especial, solo loggear para monitoreo
          }

          // ═══════════════════════════════════════════════════════════════════
          // FASE: STREAMING → COMPLETED - Finalización
          // Emitir citas si existen (antes de done para que estén disponibles)
          // ═══════════════════════════════════════════════════════════════════
          const fallbackSources = extractSourcesFromText(cleanOutput)
          const mergedSources = normalizeSources([...(result.sources || []), ...fallbackSources])

          if (mergedSources.length > 0) {
            emit({ 
              type: "citations", 
              items: mergedSources.map((s, idx) => ({
                id: `source-${idx + 1}`,
                title: s.title,
                url: s.url,
                type: s.type
              }))
            })
          }

          // ═══════════════════════════════════════════════════════════════════
          // TOKEN TRACKING: Track usage for billing
          // ═══════════════════════════════════════════════════════════════════
          if (effectiveUserId && process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true') {
            // Estimate token usage (rough approximation)
            // Output tokens: approximately 1 token per 4 characters
            const outputTokens = Math.ceil(cleanOutput.length / 4)
            // Input tokens: sum of all message characters
            const inputTokens = Math.ceil(
              messages.reduce((acc, m) => acc + extractPayloadText(m).length, 0) / 4
            )

            try {
              await incrementTokenUsage(effectiveUserId, outputTokens, inputTokens)
              console.log(`📊 Token usage tracked: output=${outputTokens}, input=${inputTokens}`)
            } catch (trackingError) {
              console.error('Error tracking token usage:', trackingError)
              // Don't fail the request for tracking errors
            }

            // Track model-specific usage for plan limits
            try {
              const modelUsageResult = await incrementModelUsage(effectiveUserId, modelId)
              if (modelUsageResult.success && modelUsageResult.usage) {
                console.log(`📊 Model usage tracked: ${modelId} - ${modelUsageResult.usage.usage_count}/${modelUsageResult.usage.monthly_limit === -1 ? '∞' : modelUsageResult.usage.monthly_limit}`)
              }
            } catch (modelTrackingError) {
              console.error('Error tracking model usage:', modelTrackingError)
              // Don't fail the request for tracking errors
            }
          }

          // Evento de finalización
          const processingTime = ((Date.now() - startTime) / 1000).toFixed(1)
          emit({
            type: "done",
            ok: true,
            metadata: {
              model: modelId,
              processingTime: processingTime + 's',
              maxIterations,
              sourcesCount: mergedSources.length
            }
          })

          safeClose()

        } catch (error: any) {
          if (heartbeat) {
            clearInterval(heartbeat)
            heartbeat = null
          }

          // Mensaje específico para error de max iterations
          let errorMessage = 'Hubo un error procesando tu consulta. Por favor, intenta de nuevo.'

          if (error instanceof TimeoutError || error?.name === "TimeoutError") {
            errorMessage = 'La consulta tomo demasiado tiempo. Intenta con una pregunta mas acotada.'
            emit({ type: 'delta', text: errorMessage })
            emit({ type: 'error', message: errorMessage, code: 'TIMEOUT', recoverable: true })
          } else if (error.message?.includes('max iterations') || error.message?.includes('Agent stopped')) {
            errorMessage = 'La consulta requiere más investigación de la que puedo completar en este momento. ' +
              'Te recomiendo dividir tu pregunta en consultas más específicas.'
            emit({ type: 'delta', text: errorMessage })
            emit({ type: 'done', ok: true, metadata: { partial: true, maxIterationsReached: true } })
          } else {
            emit({ type: 'error', message: errorMessage, code: 'AGENT_ERROR' })
          }

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
    if (error instanceof TimeoutError || error?.name === "TimeoutError") {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "El agente legal excedio el tiempo maximo de ejecucion",
          code: "AGENT_TIMEOUT"
        },
        504
      )
    }

    return NextResponse.json(
      {
        error: error.message || "Error procesando la consulta",
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      {
        status: 500,
        headers: withRequestIdHeaders(undefined, context.requestId)
      }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT GET - INFORMACIÓN DEL SERVICIO
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, "api/chat/langchain-agent")
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY)
  const hasSerper = Boolean(process.env.SERPER_API_KEY)

  return NextResponse.json({
    status: "ok",
    endpoint: "LangChain Agent - Unified Legal Assistant",
    version: "1.0.0",
    features: [
      "Tool calling nativo",
      "Modelos M vía OpenRouter",
      "El modelo decide autónomamente cuándo usar herramientas",
      "Streaming de respuestas",
      "Cache de agentes por sesión"
    ],
    recommendedModels: RESEARCH_MODELS,
    tools: [
      "search_legal_official",
      "search_legal_academic",
      "search_general_web",
      "extract_web_content",
      "verify_sources"
    ],
    apiKeys: {
      openrouter: hasOpenRouter ? "✅ Configurada" : "❌ Falta",
      serper: hasSerper ? "✅ Configurada" : "❌ Falta"
    },
    cacheStats: {
      activeAgents: agentCache.size
    }
  }, {
    headers: withRequestIdHeaders(undefined, context.requestId)
  })
}




