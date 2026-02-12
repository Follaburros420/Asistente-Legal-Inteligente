/**
 * Endpoint Unificado del Agente Legal con LangChain
 *
 * Este endpoint usa LangChain para implementar un agente con tool calling nativo.
 *
 * Características:
 * - Soporta solo modelos M vía OpenRouter
 * - Tool calling nativo (el modelo decide cuándo usar herramientas)
 * - Streaming REAL de respuestas y razonamiento
 * - Manejo de historial de conversación
 *
 * Modelos recomendados:
 * - moonshotai/kimi-k2.5: Razonamiento avanzado (M1 Pro)
 * - deepseek/deepseek-v3.2: Balance general (M1)
 * - openai/gpt-oss-120b: Rapido y eficiente (M1 Small)
 *
 * Formato de streaming (JSON Lines):
 * - {"type": "thinking", "content": "..."} - Proceso de razonamiento
 * - {"type": "tool_start", "tool": "...", "input": "..."} - Inicio de herramienta
 * - {"type": "tool_end", "tool": "...", "output": "..."} - Fin de herramienta
 * - {"type": "token", "content": "..."} - Token de respuesta
 * - {"type": "sources", "sources": [...]} - Fuentes encontradas
 * - {"type": "done"} - Fin del stream
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages"
import { LegalAgent, RESEARCH_MODELS } from "@/lib/langchain"
import { BaseCallbackHandler } from "@langchain/core/callbacks/base"
import { getSupabaseServer } from '@/lib/supabase/server-client'
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

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface RequestBody {
  chatSettings: {
    model: string
    temperature?: number
  }
  messages: Array<{
    role: string
    content?: unknown
    parts?: unknown
  }>
  chatId?: string
  userId?: string
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

  constructor(emit: StreamEmitter) {
    super()
    this.emit = emit
  }

  async handleLLMStart() {
    this.emit({
      type: "status",
      phase: "analyzing",
      progress: 10,
      message: "Analizando tu consulta legal"
    })
  }

  async handleToolStart(tool: { name?: string }, input: string) {
    const toolName = tool?.name || "search_legal_official"
    const label = buildToolLabel(toolName, input)

    this.emit({
      type: "status",
      phase: "investigating",
      progress: 40,
      message: label
    })

    this.emit({
      type: "tool_start",
      label,
      progress: 45
    })
  }

  async handleToolEnd() {
    this.emit({
      type: "tool_end",
      message: "Fuentes contrastadas",
      progress: 70
    })
  }

  async handleToolError(err: Error) {
    this.emit({
      type: "status",
      phase: "investigating",
      progress: 55,
      message: "Hubo un problema validando una fuente, continuo con otras"
    })

    this.emit({
      type: "tool_error",
      error: err.message
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convierte mensajes del formato del chat al formato de LangChain
 */
function extractMessageText(message: RequestBody["messages"][number]): string {
  if (typeof message.content === "string") {
    return message.content
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) =>
        typeof part === "string"
          ? part
          : typeof part?.text === "string"
            ? part.text
            : ""
      )
      .filter(Boolean)
      .join("\n")
      .trim()
  }

  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim()
  }

  return ""
}

function convertMessages(messages: RequestBody['messages']): BaseMessage[] {
  return messages
    .filter(m => m.role !== 'system') // El system prompt lo maneja el agente
    .map(msg => {
      const text = extractMessageText(msg)
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
  maxIterations: number
): Promise<LegalAgent> {
  const cacheKey = `${chatId}-${modelId}-${maxIterations}`

  const cached = agentCache.get(cacheKey)
  if (cached) {
    cached.lastUsed = new Date()
    return cached.agent
  }
  const agent = await LegalAgent.create({
    modelId,
    temperature,
    maxIterations,
    verbose: process.env.NODE_ENV === 'development'
  })

  agentCache.set(cacheKey, { agent, lastUsed: new Date() })
  return agent
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

  // Iniciar cleanup si no está corriendo
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupCache, CACHE_TTL)
  }

  try {
    const body = await request.json() as RequestBody
    const { chatSettings, messages, chatId, userId } = body

    // ═══════════════════════════════════════════════════════════════════════
    // BILLING CHECK: Verify user can continue chatting
    // ═══════════════════════════════════════════════════════════════════════
    let effectiveUserId = userId

    // If no userId provided, try to get from auth header
    if (!effectiveUserId) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        const supabase = getSupabaseServer()
        const { data: { user } } = await supabase.auth.getUser(token)
        effectiveUserId = user?.id
      }
    }

    // Check if billing is enabled and user has access
    if (process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true' && effectiveUserId) {
      const canChat = await canContinueChat(effectiveUserId)

      if (!canChat.allowed) {
        return NextResponse.json(
          {
            error: canChat.reason || "Has alcanzado el límite de tu plan",
            code: "USAGE_LIMIT_EXCEEDED",
            needsUpgrade: true
          },
          { status: 402 } // Payment Required
        )
      }

      const requestedModel = chatSettings.model
      if (requestedModel && !isKnownMModelInput(requestedModel)) {
        return NextResponse.json(
          {
            error: "Modelo no permitido para este asistente",
            code: "MODEL_NOT_ALLOWED",
            allowedModels: ALLOWED_M_MODELS
          },
          { status: 400 }
        )
      }

      // Check model-specific usage limits
      const modelId = normalizeMModel(requestedModel || M1_MODEL_ID)
      const modelCheck = await canUseModel(effectiveUserId, modelId)

      if (!modelCheck.allowed) {
        return NextResponse.json(
          {
            error: modelCheck.reason || "Has alcanzado el límite de uso de este modelo",
            code: "MODEL_LIMIT_EXCEEDED",
            needsUpgrade: true,
            suggestModel: M1_SMALL_MODEL_ID,
            usage: modelCheck.usage
          },
          { status: 402 } // Payment Required
        )
      }
    }

    // Validar API Key
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY no configurada" },
        { status: 500 }
      )
    }

    const requestedModel = chatSettings.model
    if (requestedModel && !isKnownMModelInput(requestedModel)) {
      return NextResponse.json(
        {
          error: "Modelo no permitido para este asistente",
          code: "MODEL_NOT_ALLOWED",
          allowedModels: ALLOWED_M_MODELS
        },
        { status: 400 }
      )
    }

    // Determinar modelo a usar
    const modelId = normalizeMModel(requestedModel || M1_MODEL_ID)
    const temperature = chatSettings.temperature ?? 0.3

    // Extraer el último mensaje del usuario
    const userMessages = messages.filter(m => m.role === 'user')
    let lastUserMessage = extractMessageText(userMessages[userMessages.length - 1])

    if (!lastUserMessage) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const candidate = extractMessageText(messages[i])
        if (candidate.trim().length > 0) {
          lastUserMessage = candidate
          break
        }
      }
    }

    // Detección de draft: heurística + clasificación LLM
    const heuristicResult = detectDraftIntent(lastUserMessage)
    let classificationResult = await classifyDocumentIntent(lastUserMessage, heuristicResult, true)

    // Si la heurística tiene alta confianza pero LLM dice que no, dar más peso a heurística
    if (heuristicResult.isDraft && heuristicResult.confidence >= 0.8 && !classificationResult.is_document) {
      classificationResult = {
        is_document: true,
        doc_type: (heuristicResult.type as any) || "otro",
        confidence: heuristicResult.confidence * 0.9
      }
    }

    const isDraft = classificationResult.is_document && classificationResult.confidence >= 0.6
    const draftType = classificationResult.doc_type
    const maxIterations = estimateAgentMaxIterations(lastUserMessage, isDraft)

    // Obtener o crear agente
    const effectiveChatId = chatId || `temp-${Date.now()}`
    const agent = await getOrCreateAgent(effectiveChatId, modelId, temperature, maxIterations)

    // Inyectar System Prompt si es un documento
    // Nota: El agente de LangChain maneja su propio system prompt, 
    // pero podemos prefijar la instrucción en el input o historial si es necesario.
    // En este caso, modificaremos dinámicamente el comportamiento si detectamos draft.
    let inputMessage = lastUserMessage
    if (isDraft) {
      const { DOCUMENT_SYSTEM_PROMPT } = await import("@/lib/prompts/document-system-prompt")
      inputMessage = `${DOCUMENT_SYSTEM_PROMPT}\n\nUSUARIO: ${lastUserMessage}`
    } else {
      inputMessage = `${lastUserMessage}${buildSearchDisciplineInstruction(lastUserMessage)}`
    }

    // Convertir historial (excluyendo el último mensaje del usuario)
    const chatHistory = convertMessages(messages.slice(0, -1))

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
          // Emitir estado inicial
          emit({
            type: "status",
            phase: "preparing",
            progress: 5,
            message: "Preparando contexto legal"
          })
          emit({
            type: "status",
            phase: "investigating",
            progress: 15,
            message: "Analizando el alcance de la consulta"
          })

          const heartbeatMessages = [
            "Investigando normas y precedentes relevantes",
            "Contrastando fuentes oficiales y vigentes",
            "Verificando consistencia jurídica de los hallazgos"
          ]
          let heartbeatIndex = 0
          heartbeat = setInterval(() => {
            if (isClosed) return
            emit({
              type: "status",
              phase: "investigating",
              progress: Math.min(70, 20 + heartbeatIndex * 8),
              message: heartbeatMessages[Math.min(heartbeatIndex, heartbeatMessages.length - 1)]
            })
            heartbeatIndex = Math.min(heartbeatIndex + 1, heartbeatMessages.length - 1)
          }, 2500)

          const callbackHandler = new StreamingCallbackHandler(emit)

          // Ejecutar el agente
          const result = await agent.invoke(
            {
              input: inputMessage,
              chatHistory
            },
            {
              callbacks: [callbackHandler]
            }
          )

          // Emitir información sobre herramientas usadas
          if (result.toolsUsed && result.toolsUsed.length > 0) {
            emit({
              type: "status",
              phase: "investigating",
              progress: 75,
              message: "Sintetizando hallazgos y validando consistencia"
            })
          }

          if (heartbeat) {
            clearInterval(heartbeat)
            heartbeat = null
          }

          // Emitir fin del razonamiento
          emit({
            type: "thinking_done"
          })
          emit({
            type: "status",
            phase: "generating",
            progress: 85,
            message: "Redactando respuesta final"
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
              .replace(/\n*\*{0,2}(Advertencia|Nota importante|Importante|Disclaimer):?\*{0,2}[^]*?(consultar?|abogado|profesional|asesor)[^]*?\.?\n*/gi, '\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim()
            )
            cleanOutput = sanitizedOutput || cleanOutput.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
          }

          // Emitir respuesta token por token (streaming real)
          const words = cleanOutput.split(' ').filter(Boolean)

          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '')
            emit({ type: 'token', content: word })

            // Pequeña pausa para efecto de streaming visual
            await new Promise(resolve => setTimeout(resolve, 10))
          }

          // Emitir fuentes si existen
          const fallbackSources = extractSourcesFromText(cleanOutput)
          const mergedSources = normalizeSources([...(result.sources || []), ...fallbackSources])

          if (mergedSources.length > 0) {
            emit({ type: "sources", sources: mergedSources })
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
              messages.reduce((acc, m) => acc + extractMessageText(m).length, 0) / 4
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

          // Emitir evento de finalización
          const processingTime = ((Date.now() - startTime) / 1000).toFixed(1)
          emit({
            type: "status",
            phase: "completed",
            progress: 100,
            message: "Respuesta lista"
          })
          emit({
            type: 'done',
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

          if (error.message?.includes('max iterations') || error.message?.includes('Agent stopped')) {
            errorMessage = 'La consulta requiere más investigación de la que puedo completar en este momento. ' +
              'Te recomiendo dividir tu pregunta en consultas más específicas.'
            // Emitir como respuesta parcial, no como error
            emit({ type: 'token', content: errorMessage })
            emit({ type: 'done', metadata: { partial: true } })
          } else {
            emit({ type: 'error', message: errorMessage })
          }

          safeClose()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Model-Used': modelId,
        'X-Streaming': 'true',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Error procesando la consulta",
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT GET - INFORMACIÓN DEL SERVICIO
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
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
  })
}




