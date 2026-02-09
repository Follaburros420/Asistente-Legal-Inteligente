/**
 * Endpoint del Agente Legal con Tool Calling
 * 
 * Usa:
 * - Gemini 3 Pro Preview (M1 Pro) para tareas complejas
 * - GPT-5 Mini (M1) para tareas simples
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
import { routeModel, DEFAULT_MODEL, SIMPLE_TASK_MODEL } from "@/lib/langchain/config/models"
import { LEGAL_AGENT_SYSTEM_PROMPT } from "@/lib/langchain/config/prompts"

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
    role: "system" | "user" | "assistant"
    content: string
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

function extractLastUserMessage(messages: Array<{ role: string; content: string }>): string {
  const userMessages = messages.filter(m => m.role === 'user')
  return userMessages[userMessages.length - 1]?.content || ""
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

function selectModel(userQuery: string, requestedModel: string): string {
  // Si el modelo solicitado es válido, usarlo
  const validModels = [
    'google/gemini-3-pro-preview',
    'openai/gpt-5-mini',
    'google/gemini-2.0-flash-thinking-exp:free'
  ]
  
  if (validModels.includes(requestedModel)) {
    return requestedModel
  }
  
  // Usar router inteligente
  const routerConfig = routeModel(userQuery)
  console.log(`🎯 Router seleccionó: ${routerConfig.model}`)
  
  return routerConfig.model
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

    // Seleccionar modelo
    const modelName = selectModel(userQuery, chatSettings.model)

    console.log(`📝 Query: "${userQuery.substring(0, 100)}..."`)
    console.log(`🤖 Modelo: ${modelName}`)
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
        currentMessages.push({
          role: "assistant",
          content: message.content || null,
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
        'X-Model-Used': modelName
      }
    })

  } catch (error: any) {
    console.error(`❌ Error en Legal Agent:`, error)

    return NextResponse.json(
      {
        error: error.message || "Error procesando la consulta",
        details: error.toString()
      },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT GET PARA VERIFICAR ESTADO
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "Legal Agent",
    models: {
      complex: "google/gemini-3-pro-preview",
      simple: "openai/gpt-5-mini"
    },
    search: "Serper (única herramienta)",
    tools: LEGAL_TOOLS_DEFINITIONS.map(t => t.function.name),
    requiredEnvVars: ["OPENROUTER_API_KEY", "SERPER_API_KEY"]
  })
}
