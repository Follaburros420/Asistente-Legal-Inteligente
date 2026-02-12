/**
 * Endpoint del Agente Legal con Tool Calling
 *
 * Usa:
 * - Solo modelos M vía OpenRouter
 * - Serper como única herramienta de búsqueda web
 */

import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import {
  LEGAL_TOOLS_DEFINITIONS,
  executeTool
} from "@/lib/tools/legal/legal-search-toolkit"
import { detectDraftIntent } from "@/lib/draft-detection"
import { classifyDocumentIntent } from "@/lib/classifiers/document-classifier"
import { validateDraftContent } from "@/lib/utils/draft-utils"
import {
  GUARANTEED_FALLBACKS
} from "@/lib/langchain/config/models"
import { checkSerperConfig } from "@/lib/tools/search/serper-legal-search"
import { LEGAL_AGENT_SYSTEM_PROMPT } from "@/lib/langchain/config/prompts"
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

interface ToolCallResult {
  tool_call_id: string
  role: "tool"
  name: string
  content: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS DEL SISTEMA
// ═══════════════════════════════════════════════════════════════════════════════

const DRAFT_MODE_INSTRUCTIONS = `
## MODO GENERADOR DE DOCUMENTOS ACTIVO

Genera un documento legal colombiano en formato JSON estricto.

REGLAS CRÍTICAS:
1. ANTES de generar, usa search_legal_official para verificar la normativa aplicable
2. NO inventes artículos, fundamentos ni jurisprudencia
3. Usa placeholders {{NOMBRE}} para datos faltantes
4. Responde SOLO con el JSON, sin markdown ni explicaciones

Esquema JSON requerido:
{
  "type": "draft",
  "doc_type": "contrato|minuta|tutela|derecho_de_peticion|memorial|otro",
  "title": "Título del documento",
  "jurisdiction": "CO",
  "language": "es-CO",
  "content_markdown": "# Contenido en Markdown...",
  "placeholders": [{"key": "NOMBRE", "label": "Descripción", "example": "Ejemplo"}],
  "missing_info": ["Dato faltante"],
  "notes": ["⚠️ Documento preliminar, requiere revisión profesional."]
}
`

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

function extractMessageText(message: { content?: unknown; parts?: unknown }): string {
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

function extractLastUserMessage(messages: Array<{ role: string; content?: unknown; parts?: unknown }>): string {
  const userMessages = messages.filter(m => m.role === 'user')
  const lastUserMessage = extractMessageText(userMessages[userMessages.length - 1] || {})
  if (lastUserMessage) return lastUserMessage

  for (let i = messages.length - 1; i >= 0; i--) {
    const fallback = extractMessageText(messages[i])
    if (fallback) return fallback
  }

  return ""
}

function requiresLegalSearch(query: string): boolean {
  const legalKeywords = [
    'ley', 'decreto', 'artículo', 'código', 'sentencia', 'jurisprudencia',
    'constitución', 'constitucional', 'tutela', 'demanda', 'proceso',
    'prescripción', 'caducidad', 'derecho', 'legal', 'norma', 'legislación',
    'tribunal', 'corte', 'juez', 'fiscal', 'penal', 'civil', 'comercial',
    'laboral', 'administrativo', 'tributario', 'contrato', 'obligación',
    'responsabilidad', 'indemnización', 'daño', 'perjuicio', 'colombia',
    'colombiano', 'ministerio', 'superintendencia', 'dian', 'requisitos',
    'procedimiento', 'trámite'
  ]

  const queryLower = query.toLowerCase()
  return legalKeywords.some(keyword => queryLower.includes(keyword))
}

async function processToolCalls(
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = []

  for (const toolCall of toolCalls) {
    const { id, function: { name, arguments: argsString } } = toolCall

    console.log(`🔧 Procesando tool call: ${name}`)

    try {
      const args = JSON.parse(argsString)
      const toolResult = await executeTool(name, args)

      results.push({
        tool_call_id: id,
        role: "tool",
        name,
        content: toolResult
      })

    } catch (error) {
      console.error(`❌ Error ejecutando tool ${name}:`, error)
      results.push({
        tool_call_id: id,
        role: "tool",
        name,
        content: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      })
    }
  }

  return results
}

function extractSourcesFromResponse(text: string): Array<{ title: string; url: string }> {
  const sources: Array<{ title: string; url: string }> = []
  const seenUrls = new Set<string>()
  const urlRegex = /https?:\/\/[^\s\)\]\>]+/g
  const urls = text.match(urlRegex) || []

  for (const url of urls) {
    const cleanUrl = url.replace(/[,\.\]\}]+$/, '')
    if (!seenUrls.has(cleanUrl)) {
      seenUrls.add(cleanUrl)

      // Extraer título del contexto
      let title = 'Fuente legal'
      const lines = text.split('\n')
      for (const line of lines) {
        if (line.includes(cleanUrl)) {
          const titleMatch = line.match(/\*\*([^*]+)\*\*/)
          if (titleMatch) title = titleMatch[1]
          break
        }
      }

      // Mapeo de dominios conocidos
      const domainNames: Record<string, string> = {
        'corteconstitucional.gov.co': 'Corte Constitucional',
        'consejodeestado.gov.co': 'Consejo de Estado',
        'cortesuprema.gov.co': 'Corte Suprema',
        'suin-juriscol.gov.co': 'SUIN-Juriscol',
        'secretariasenado.gov.co': 'Secretaría del Senado',
        'funcionpublica.gov.co': 'Función Pública',
        'ramajudicial.gov.co': 'Rama Judicial'
      }

      for (const [domain, name] of Object.entries(domainNames)) {
        if (cleanUrl.includes(domain)) {
          title = name
          break
        }
      }

      sources.push({ title, url: cleanUrl })
    }
  }

  return sources.slice(0, 10)
}

/**
 * Selecciona el modelo a usar con fallback automático
 * SIEMPRE usa modelos Google Gemini vía OpenRouter
 */
async function selectModelWithFallback(
  client: OpenAI,
  userQuery: string,
  requestedModel: string
): Promise<{ model: string; usedFallback: boolean; originalModel?: string }> {

  // Determinar modelo objetivo - solo modelos M
  let targetModel: string

  if (requestedModel && requestedModel !== 'auto') {
    targetModel = normalizeMModel(requestedModel)
    console.log(`🎯 Modelo solicitado: ${targetModel}`)
  } else {
    targetModel = M1_MODEL_ID
    console.log(`🎯 Modelo por defecto: ${targetModel}`)
  }

  // Intentar usar el modelo seleccionado
  try {
    // Hacer una petición de prueba ligera
    const testResponse = await client.chat.completions.create({
      model: targetModel,
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    })

    if (testResponse.choices && testResponse.choices.length > 0) {
      console.log(`✅ Modelo ${targetModel} disponible`)
      return { model: targetModel, usedFallback: false }
    }
  } catch (error: any) {
    console.warn(`⚠️ Modelo ${targetModel} no disponible:`, error.message || error)

    const modelFallbacks = [M1_PRO_MODEL_ID, M1_SMALL_MODEL_ID, M1_MODEL_ID]

    for (const fallbackModel of modelFallbacks) {
      if (fallbackModel === targetModel) continue

      console.log(`🔄 Intentando fallback: ${fallbackModel}`)

      try {
        const testFallback = await client.chat.completions.create({
          model: fallbackModel,
          messages: [{ role: 'user', content: 'OK' }],
          max_tokens: 5
        })

        if (testFallback.choices && testFallback.choices.length > 0) {
          console.log(`✅ Usando fallback: ${fallbackModel}`)
          return {
            model: fallbackModel,
            usedFallback: true,
            originalModel: targetModel
          }
        }
      } catch (fallbackError) {
        console.warn(`⚠️ Fallback ${fallbackModel} también falló:`, fallbackError)
      }
    }
  }

  const lastResort = M1_MODEL_ID
  console.log(`⚠️ Usando último recurso: ${lastResort}`)
  return { model: lastResort, usedFallback: true, originalModel: targetModel }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`🤖 LEGAL AGENT - ENDPOINT`)
  console.log(`${'═'.repeat(80)}`)

  try {
    const { chatSettings, messages, chatId, userId } = await request.json() as RequestBody

    const requestedModel = chatSettings?.model
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

    // Validar API Keys
    const openrouterApiKey = process.env.OPENROUTER_API_KEY
    if (!openrouterApiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY no configurada" },
        { status: 500 }
      )
    }

    const serperApiKey = process.env.SERPER_API_KEY
    if (!serperApiKey) {
      console.warn("⚠️ SERPER_API_KEY no configurada")
    }

    // Inicializar cliente OpenAI apuntando a OpenRouter
    const client = new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: "https://openrouter.ai/api/v1"
    })

    // Extraer consulta del usuario
    const userQuery = extractLastUserMessage(messages)
    const isLegalQuery = requiresLegalSearch(userQuery)

    // Detección de modo borrador
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
    const draftType = classificationResult.doc_type

    // Seleccionar modelo con fallback automático
    const { model: modelName, usedFallback, originalModel } = await selectModelWithFallback(
      client,
      userQuery,
      requestedModel
    )

    const queryPreview = userQuery
      ? userQuery.substring(0, 100) + (userQuery.length > 100 ? "..." : "")
      : "[vacia]"
    console.log(`📝 Query: "${queryPreview}"`)
    console.log(`🤖 Modelo: ${modelName}${usedFallback ? ` (fallback de ${originalModel})` : ''}`)
    console.log(`🔍 Consulta legal: ${isLegalQuery}`)
    console.log(`📄 Modo borrador: ${isDraft}`)

    // Construir mensajes
    let systemContent = LEGAL_AGENT_SYSTEM_PROMPT
    if (isDraft) {
      systemContent += DRAFT_MODE_INSTRUCTIONS
    }

    const systemMessage = {
      role: "system" as const,
      content: systemContent
    }

    // Agregar instrucción para forzar búsqueda en consultas legales
    let userMessageContent = userQuery
    if (!isDraft && isLegalQuery) {
      userMessageContent += `\n\n[INSTRUCCIÓN: Esta es una consulta legal. SI es necesario verificar normas o jurisprudencia, usa search_legal_official.]`
    }

    const conversationMessages = [
      systemMessage,
      ...messages.slice(0, -1),
      { role: "user" as const, content: userMessageContent }
    ]

    // ═══════════════════════════════════════════════════════════════════════════
    // CICLO DE TOOL CALLING
    // ═══════════════════════════════════════════════════════════════════════════

    let currentMessages: any[] = [...conversationMessages]
    let finalResponse: string | null = null
    let totalToolCalls = 0
    const maxIterations = 5

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`\n📍 Iteración ${iteration + 1}/${maxIterations}`)

      const shouldForceJSON = isDraft && iteration === maxIterations - 1

      const response = await client.chat.completions.create({
        model: modelName,
        messages: currentMessages,
        tools: shouldForceJSON ? undefined : LEGAL_TOOLS_DEFINITIONS,
        tool_choice: shouldForceJSON ? undefined : (iteration === 0 && isLegalQuery ? "auto" : "auto"),
        temperature: chatSettings.temperature || 0.3,
        max_tokens: isDraft ? 4000 : 4000,
        ...(shouldForceJSON ? { response_format: { type: "json_object" } } : {})
      })

      const message = response.choices[0]?.message

      if (!message) {
        console.error("❌ No se recibió mensaje del modelo")
        break
      }

      console.log(`   Contenido: ${message.content ? message.content.substring(0, 80) + '...' : 'N/A'}`)
      console.log(`   Tool calls: ${message.tool_calls?.length || 0}`)

      // Si hay tool calls, procesarlas
      if (message.tool_calls && message.tool_calls.length > 0) {
        // IMPORTANTE: content debe ser string o undefined, nunca null
        currentMessages.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: message.tool_calls
        })

        const toolResults = await processToolCalls(message.tool_calls)
        totalToolCalls += toolResults.length

        for (const result of toolResults) {
          currentMessages.push(result)
        }

      } else {
        // Respuesta final
        finalResponse = message.content || ""
        break
      }
    }

    // Si no hay respuesta final, generarla
    if (!finalResponse) {
      const fallbackResponse = await client.chat.completions.create({
        model: modelName,
        messages: [
          ...currentMessages,
          { role: "user", content: "Genera una respuesta final basada en toda la información encontrada." }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })

      finalResponse = fallbackResponse.choices[0]?.message?.content ||
        "No pude completar la investigación. Intenta reformular tu pregunta."
    }

    // Validar borrador si aplica
    if (isDraft && finalResponse) {
      const validation = validateDraftContent(finalResponse)
      if (validation.valid && validation.draft) {
        if (!validation.draft.notes?.some((n: string) => n.includes("preliminar"))) {
          validation.draft.notes = [...(validation.draft.notes || []),
            "⚠️ Documento preliminar, requiere revisión profesional."]
        }
        finalResponse = JSON.stringify(validation.draft)
      }
    }

    // Extraer fuentes
    const sources = extractSourcesFromResponse(finalResponse)

    console.log(`\n${'═'.repeat(80)}`)
    console.log(`✅ RESPUESTA COMPLETADA`)
    console.log(`   📊 Tool calls: ${totalToolCalls}`)
    console.log(`   📚 Fuentes: ${sources.length}`)
    console.log(`   📝 Caracteres: ${finalResponse.length}`)
    console.log(`${'═'.repeat(80)}\n`)

    // Crear stream de respuesta
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const words = finalResponse!.split(' ')
        let index = 0

        const pushWord = () => {
          if (index < words.length) {
            const word = words[index] + (index < words.length - 1 ? ' ' : '')
            controller.enqueue(encoder.encode(word))
            index++
            setTimeout(pushWord, 8)
          } else {
            controller.close()
          }
        }

        pushWord()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Tool-Calls': String(totalToolCalls),
        'X-Sources-Count': String(sources.length),
        'X-Model-Used': modelName,
        'X-Model-Original': usedFallback ? (originalModel || '') : '',
        'X-Model-Fallback': usedFallback ? 'true' : 'false'
      }
    })

  } catch (error: any) {
    console.error(`❌ Error en Legal Agent:`, error)

    // Detectar errores específicos de modelo
    const errorMessage = error.message || error.toString()

    if (errorMessage.includes('model') && errorMessage.includes('not found')) {
      return NextResponse.json(
        {
          error: "Modelo no encontrado en OpenRouter",
          details: "El modelo seleccionado no está disponible. Se debería haber usado un fallback automático.",
          suggestion: "Verifica la lista de modelos disponibles en https://openrouter.ai/docs#models",
          availableFallbacks: GUARANTEED_FALLBACKS
        },
        { status: 503 }
      )
    }

    if (errorMessage.includes('authentication') || errorMessage.includes('api key')) {
      return NextResponse.json(
        {
          error: "Error de autenticación con OpenRouter",
          details: "Verifica que OPENROUTER_API_KEY esté configurada correctamente"
        },
        { status: 401 }
      )
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return NextResponse.json(
        {
          error: "Límite de peticiones alcanzado",
          details: "Has excedido el límite de requests. Espera un momento e intenta de nuevo."
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: errorMessage || "Error procesando la consulta",
        type: error.name || 'Error',
        fallbacksAvailable: GUARANTEED_FALLBACKS
      },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT GET PARA VERIFICAR ESTADO
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  const serperConfig = checkSerperConfig()

  return NextResponse.json({
    status: "ok",
    endpoint: "Legal Agent",
    version: "2.1",
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
    note: "Solo modelos M están disponibles vía OpenRouter"
  })
}
