/**
 * Endpoint del Agente Legal con tool-calling directo sobre OpenRouter.
 */

import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import {
  LEGAL_TOOLS_DEFINITIONS,
  executeTool
} from "@/lib/tools/legal/legal-search-toolkit"
import { extractLastUserMessage, parseAgentChatRequest } from "@/lib/server/chat-payload"
import {
  createRequestContext,
  getElapsedMs,
  logRequestDebug,
  logRequestError,
  logRequestInfo,
  logRequestWarn,
  withRequestIdHeaders
} from "@/lib/server/request-context"
import {
  createToolExecutionState,
  runToolCalls,
  type ToolCallResult
} from "@/lib/server/tool-execution-guard"
import { clampTextForModel, toWindowedTextHistory } from "@/lib/server/chat-history-window"
import { withTimeout } from "@/lib/server/async-timeout"
import { detectDraftIntent } from "@/lib/draft-detection"
import { classifyDocumentIntent } from "@/lib/classifiers/document-classifier"
import { validateDraftContent } from "@/lib/utils/draft-utils"
import { GUARANTEED_FALLBACKS } from "@/lib/langchain/config/models"
import { checkSerperConfig } from "@/lib/tools/search/serper-legal-search"
import { LEGAL_AGENT_SYSTEM_PROMPT } from "@/lib/langchain/config/prompts"
import { requireChatAuthAndRateLimit } from "@/lib/server/chat-auth-guard"
import { canContinueChat, canUseModel } from "@/lib/billing/plan-access"
import {
  ALLOWED_M_MODELS,
  isKnownMModelInput,
  M1_MODEL_ID,
  M1_PRO_MODEL_ID,
  M1_SMALL_MODEL_ID,
  normalizeMModel
} from "@/lib/models/m1-models"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_TOTAL_TOOL_EXECUTIONS = 8
const MAX_TOOL_ARGUMENTS_LENGTH = 8_000
const MAX_ITERATIONS = 5
const MAX_HISTORY_MESSAGES = 14
const MAX_HISTORY_TOTAL_CHARS = 12_000
const MAX_HISTORY_MESSAGE_CHARS = 1_800
const MAX_USER_QUERY_CHARS = 6_000
const OPENROUTER_REQUEST_TIMEOUT_MS = 45_000

const DRAFT_MODE_INSTRUCTIONS = `
## MODO GENERADOR DE DOCUMENTOS ACTIVO

Genera un documento legal colombiano en formato JSON estricto.

REGLAS CRITICAS:
1. ANTES de generar, usa search_legal_official para verificar la normativa aplicable.
2. NO inventes articulos, fundamentos ni jurisprudencia.
3. Usa placeholders {{NOMBRE}} para datos faltantes.
4. Responde SOLO con JSON valido, sin markdown ni explicaciones.
`

function jsonWithRequestId(
  requestId: string,
  payload: Record<string, unknown>,
  status: number
): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: withRequestIdHeaders(undefined, requestId)
  })
}

function requiresLegalSearch(query: string): boolean {
  const legalKeywords = [
    "ley",
    "decreto",
    "articulo",
    "codigo",
    "sentencia",
    "jurisprudencia",
    "constitucion",
    "constitucional",
    "tutela",
    "demanda",
    "proceso",
    "prescripcion",
    "caducidad",
    "derecho",
    "legal",
    "norma",
    "legislacion",
    "tribunal",
    "corte",
    "juez",
    "fiscal",
    "penal",
    "civil",
    "comercial",
    "laboral",
    "administrativo",
    "tributario",
    "contrato",
    "obligacion",
    "responsabilidad",
    "indemnizacion",
    "dano",
    "perjuicio",
    "colombia",
    "colombiano"
  ]

  const queryLower = query.toLowerCase()
  return legalKeywords.some(keyword => queryLower.includes(keyword))
}

function extractSourcesFromResponse(text: string): Array<{ title: string; url: string }> {
  const sources: Array<{ title: string; url: string }> = []
  const seenUrls = new Set<string>()
  const urlRegex = /https?:\/\/[^\s)\]>]+/g
  const urls = text.match(urlRegex) || []

  const domainNames: Record<string, string> = {
    "corteconstitucional.gov.co": "Corte Constitucional",
    "consejodeestado.gov.co": "Consejo de Estado",
    "cortesuprema.gov.co": "Corte Suprema",
    "suin-juriscol.gov.co": "SUIN-Juriscol",
    "secretariasenado.gov.co": "Secretaria del Senado",
    "funcionpublica.gov.co": "Funcion Publica",
    "ramajudicial.gov.co": "Rama Judicial"
  }

  for (const url of urls) {
    const cleanUrl = url.replace(/[,.}\]]+$/, "")
    if (seenUrls.has(cleanUrl)) continue
    seenUrls.add(cleanUrl)

    let title = "Fuente legal"
    for (const [domain, name] of Object.entries(domainNames)) {
      if (cleanUrl.includes(domain)) {
        title = name
        break
      }
    }

    sources.push({ title, url: cleanUrl })
  }

  return sources.slice(0, 10)
}

async function selectModelWithFallback(
  _client: OpenAI,
  _userQuery: string,
  requestedModel: string
): Promise<{ model: string; usedFallback: boolean; originalModel?: string }> {
  if (requestedModel && requestedModel !== "auto") {
    return { model: normalizeMModel(requestedModel), usedFallback: false }
  }
  return { model: M1_MODEL_ID, usedFallback: false }
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, "api/chat/legal-agent")
  logRequestInfo(context, "request_started")

  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = parseAgentChatRequest(rawBody)
    if (!parsed.success) {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "Payload invalido: chatSettings.model y messages son requeridos",
          code: "INVALID_PAYLOAD"
        },
        400
      )
    }

    const { chatSettings, messages } = parsed.data

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

    if (process.env.NEXT_PUBLIC_BILLING_ENABLED === "true") {
      const canChat = await canContinueChat(effectiveUserId)
      if (!canChat.allowed) {
        return jsonWithRequestId(
          context.requestId,
          {
            error: canChat.reason || "Has alcanzado el limite de tu plan",
            code: "USAGE_LIMIT_EXCEEDED",
            needsUpgrade: true
          },
          402
        )
      }

      const modelCheck = await canUseModel(effectiveUserId, normalizeMModel(requestedModel || M1_MODEL_ID))
      if (!modelCheck.allowed) {
        return jsonWithRequestId(
          context.requestId,
          {
            error: modelCheck.reason || "Has alcanzado el limite de uso de este modelo",
            code: "MODEL_LIMIT_EXCEEDED",
            needsUpgrade: true
          },
          402
        )
      }
    }

    const openrouterApiKey = process.env.OPENROUTER_API_KEY
    if (!openrouterApiKey) {
      return jsonWithRequestId(
        context.requestId,
        { error: "OPENROUTER_API_KEY no configurada", code: "MISSING_OPENROUTER_KEY" },
        500
      )
    }

    if (!process.env.SERPER_API_KEY) {
      logRequestWarn(context, "missing_serper_api_key")
    }

    const client = new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: "https://openrouter.ai/api/v1"
    })

    const userQuery = clampTextForModel(extractLastUserMessage(messages), MAX_USER_QUERY_CHARS)
    if (!userQuery) {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "No se encontro texto valido en el mensaje del usuario",
          code: "EMPTY_USER_QUERY"
        },
        400
      )
    }
    const isLegalQuery = requiresLegalSearch(userQuery)

    const heuristicResult = detectDraftIntent(userQuery)
    let classificationResult = await classifyDocumentIntent(userQuery, heuristicResult, true)
    if (heuristicResult.isDraft && heuristicResult.confidence >= 0.8 && !classificationResult.is_document) {
      classificationResult = {
        is_document: true,
        doc_type: (heuristicResult.type as any) || "otro",
        confidence: heuristicResult.confidence * 0.9
      }
    }

    const isDraft = classificationResult.is_document && classificationResult.confidence >= 0.6

    const { model: modelName, usedFallback, originalModel } = await selectModelWithFallback(
      client,
      userQuery,
      requestedModel
    )

    logRequestDebug(context, "model_selected", {
      modelName,
      usedFallback,
      isDraft,
      isLegalQuery
    })

    let systemContent = LEGAL_AGENT_SYSTEM_PROMPT
    if (isDraft) {
      systemContent += DRAFT_MODE_INSTRUCTIONS
    }

    let userMessageContent = userQuery
    if (!isDraft && isLegalQuery) {
      userMessageContent +=
        "\n\n[INSTRUCCION: Si necesitas verificar normas o jurisprudencia, usa search_legal_official.]"
    }

    const historyMessages = toWindowedTextHistory(messages.slice(0, -1), {
      maxMessages: MAX_HISTORY_MESSAGES,
      maxTotalChars: MAX_HISTORY_TOTAL_CHARS,
      maxMessageChars: MAX_HISTORY_MESSAGE_CHARS
    })

    let currentMessages: any[] = [
      {
        role: "system",
        content: systemContent
      },
      ...historyMessages,
      {
        role: "user",
        content: userMessageContent
      }
    ]

    let finalResponse: string | null = null
    let totalToolCalls = 0
    const toolState = createToolExecutionState(MAX_TOTAL_TOOL_EXECUTIONS)

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const shouldForceJSON = isDraft && iteration === MAX_ITERATIONS - 1

      const response = await withTimeout(
        client.chat.completions.create({
          model: modelName,
          messages: currentMessages,
          tools: shouldForceJSON ? undefined : LEGAL_TOOLS_DEFINITIONS,
          tool_choice: shouldForceJSON ? undefined : "auto",
          temperature: chatSettings.temperature ?? 0.3,
          max_tokens: 4000,
          ...(shouldForceJSON ? { response_format: { type: "json_object" } } : {})
        }),
        OPENROUTER_REQUEST_TIMEOUT_MS,
        "Timeout esperando respuesta del modelo legal"
      )

      const message = response.choices[0]?.message
      if (!message) break

      if (message.tool_calls && message.tool_calls.length > 0) {
        currentMessages.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: message.tool_calls
        })

        const toolResults: ToolCallResult[] = await runToolCalls(message.tool_calls as any, toolState, {
          maxArgumentsLength: MAX_TOOL_ARGUMENTS_LENGTH,
          executeTool,
          onWarn: (event, data) => logRequestWarn(context, event, data)
        })
        totalToolCalls += toolResults.length
        currentMessages.push(...toolResults)
        continue
      }

      finalResponse = message.content || ""
      break
    }

    if (!finalResponse) {
      const fallbackResponse = await withTimeout(
        client.chat.completions.create({
          model: modelName,
          messages: [
            ...currentMessages,
            {
              role: "user",
              content: "Genera una respuesta final basada en toda la informacion encontrada."
            }
          ],
          temperature: 0.3,
          max_tokens: 4000
        }),
        OPENROUTER_REQUEST_TIMEOUT_MS,
        "Timeout esperando respuesta final del modelo legal"
      )

      finalResponse =
        fallbackResponse.choices[0]?.message?.content ||
        "No pude completar la investigacion. Intenta reformular tu pregunta."
    }

    if (isDraft) {
      const validation = validateDraftContent(finalResponse)
      if (validation.valid && validation.draft) {
        if (!validation.draft.notes?.some((n: string) => n.includes("preliminar"))) {
          validation.draft.notes = [
            ...(validation.draft.notes || []),
            "Documento preliminar, requiere revision profesional."
          ]
        }
        finalResponse = JSON.stringify(validation.draft)
      }
    }

    const sources = extractSourcesFromResponse(finalResponse)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const words = finalResponse!.split(" ")
        let index = 0

        const pushWord = () => {
          if (index < words.length) {
            const word = words[index] + (index < words.length - 1 ? " " : "")
            controller.enqueue(encoder.encode(word))
            index += 1
            queueMicrotask(pushWord)
            return
          }
          controller.close()
        }

        pushWord()
      }
    })

    logRequestInfo(context, "request_completed", {
      modelName,
      toolCallsFromModel: totalToolCalls,
      toolExecutions: toolState.executedCount,
      toolCacheHits: toolState.cacheHits,
      latencyMs: getElapsedMs(context)
    })

    return new Response(stream, {
      headers: withRequestIdHeaders(
        {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "X-Tool-Calls": String(totalToolCalls),
          "X-Tool-Executed": String(toolState.executedCount),
          "X-Sources-Count": String(sources.length),
          "X-Model-Used": modelName,
          "X-Model-Original": usedFallback ? originalModel || "" : "",
          "X-Model-Fallback": usedFallback ? "true" : "false"
        },
        context.requestId
      )
    })
  } catch (error: any) {
    logRequestError(context, "request_failed", error, {
      latencyMs: getElapsedMs(context)
    })

    const errorMessage = error?.message || String(error)

    if (error?.name === "TimeoutError") {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "El modelo tardo demasiado en responder",
          code: "MODEL_TIMEOUT",
          details: "Intenta nuevamente con una consulta mas acotada."
        },
        504
      )
    }

    if (errorMessage.includes("model") && errorMessage.includes("not found")) {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "Modelo no encontrado en OpenRouter",
          details:
            "El modelo seleccionado no esta disponible. Deberia haberse aplicado fallback automatico.",
          suggestion: "Verifica la lista de modelos disponibles en https://openrouter.ai/docs#models",
          availableFallbacks: GUARANTEED_FALLBACKS
        },
        503
      )
    }

    if (errorMessage.includes("authentication") || errorMessage.includes("api key")) {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "Error de autenticacion con OpenRouter",
          details: "Verifica que OPENROUTER_API_KEY este configurada correctamente"
        },
        401
      )
    }

    if (errorMessage.includes("rate limit") || errorMessage.includes("too many requests")) {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "Limite de peticiones alcanzado",
          details: "Has excedido el limite de requests. Espera un momento e intenta de nuevo."
        },
        429
      )
    }

    return jsonWithRequestId(
      context.requestId,
      {
        error: "Error procesando la consulta",
        type: error?.name || "Error",
        fallbacksAvailable: GUARANTEED_FALLBACKS
      },
      500
    )
  }
}

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, "api/chat/legal-agent")
  const serperConfig = checkSerperConfig()

  return NextResponse.json(
    {
      status: "ok",
      endpoint: "Legal Agent",
      version: "2.2",
      models: {
        primary: M1_MODEL_ID,
        fallbacks: [M1_SMALL_MODEL_ID, M1_PRO_MODEL_ID]
      },
      search: {
        provider: "Serper",
        status: serperConfig.configured ? "configured" : "missing_api_key",
        message: serperConfig.message
      },
      tools: LEGAL_TOOLS_DEFINITIONS.map(t => t.function.name),
      requiredEnvVars: ["OPENROUTER_API_KEY", "SERPER_API_KEY"],
      note: "Solo modelos M estan disponibles via OpenRouter"
    },
    {
      headers: withRequestIdHeaders(undefined, context.requestId)
    }
  )
}
