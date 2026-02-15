/**
 * Orquestador Thin del Chat Legal - VERSIÓN CORREGIDA V3
 * 
 * CORRECCIONES:
 * 1. Solo UN streaming (no doble)
 * 2. Tool calling funcional con respuesta final garantizada
 * 3. Manejo de errores robusto
 */

import OpenAI from "openai"
import { v4 as uuidv4 } from "uuid"
import {
  ChatConfig,
  DEFAULT_CHAT_CONFIG,
  ChatMessage,
  ToolDefinition,
  ToolCall,
  ToolResult,
  IntentClassification,
  RenderMode,
  ToolExecution,
  ChatResult,
  Citation,
  StreamEmitter,
  ChatError,
  TimeoutError,
  CancelledError
} from "./types"
import { LEGAL_TOOLS } from "./tools/definitions"
import { executeLegalTool } from "./tools/executor"
import { classifyIntent } from "./intent-classifier"
import { getErrorMessage, logError } from "@/lib/errors/error-utils"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

const SYSTEM_PROMPTS: Record<RenderMode, string> = {
  chat: `Eres un Asistente Legal Especializado en Derecho Colombiano.
REGLAS:
1. SIEMPRE asume jurisdicción Colombia
2. USA herramientas de búsqueda para verificar normas
3. NUNCA inventes artículos ni leyes
4. Cita fuentes oficiales (.gov.co)`,

  document: `Eres un redactor legal experto en documentos jurídicos colombianos.
MODO GENERADOR DE DOCUMENTOS.
REGLAS:
1. USA search_legal_official para verificar normativa
2. NO inventes artículos ni fundamentos
3. Usa placeholders {{NOMBRE}} para datos faltantes`
}

const STATUS_MESSAGES = {
  classifying: ["Analizando tu consulta legal…", "Identificando el tipo de solicitud…"],
  searching: ["Investigando normas oficiales…", "Contrastando jurisprudencia…"],
  drafting: ["Sintetizando hallazgos…", "Preparando respuesta…"],
  streaming: ["Generando respuesta…"]
}

export interface OrchestratorOptions {
  config?: Partial<ChatConfig>
  apiKey: string
  emitter: StreamEmitter
  abortSignal: AbortSignal
}

export async function orchestrateChat(
  userQuery: string,
  history: ChatMessage[],
  options: OrchestratorOptions
): Promise<ChatResult> {
  const startTime = Date.now()
  const config = { ...DEFAULT_CHAT_CONFIG, ...options.config }
  
  console.log(`[Orchestrator] 🚀 START - Query: "${userQuery.substring(0, 50)}..."`)
  
  if (options.abortSignal.aborted) {
    throw new CancelledError("Cancelled before start")
  }

  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: OPENROUTER_BASE_URL
  })

  const requestId = uuidv4()
  const messageId = uuidv4()
  
  console.log(`[Orchestrator] 📋 RequestID: ${requestId}, MessageID: ${messageId}`)
  
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 1: CLASIFICACIÓN (con optimización para mensajes simples)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const isSimpleMessage = detectSimpleMessage(userQuery)
    
    let intent: IntentClassification
    let renderMode: RenderMode
    
    if (isSimpleMessage) {
      console.log("[Orchestrator] ⚡ Mensaje simple detectado, saltando clasificación")
      intent = { intent: "chat_response", confidence: 1.0, reason: "Simple message optimization" }
      renderMode = "chat"
      options.emitter.emitMeta(messageId, "chat_response", "chat")
    } else {
      console.log("[Orchestrator] Fase 1: Clasificando intención...")
      options.emitter.emitStatus("classifying", randomChoice(STATUS_MESSAGES.classifying))
      
      try {
        intent = await classifyIntentWithTimeout(
          client,
          userQuery,
          3000,
          options.abortSignal
        )
        console.log(`[Orchestrator] ✅ Intent: ${intent.intent} (${intent.confidence})`)
      } catch (error: unknown) {
        const errorMsg = getErrorMessage(error, "Error en clasificación")
        console.error(`[Orchestrator] ❌ Error clasificando, usando fallback:`, errorMsg)
        intent = { intent: "chat_response", confidence: 0.1, reason: `Fallback: ${errorMsg}` }
      }
      
      renderMode = intent.intent === "document_write" && intent.confidence >= 0.8
        ? "document"
        : "chat"
      
      console.log(`[Orchestrator] 🎯 RenderMode: ${renderMode}`)
      options.emitter.emitMeta(messageId, intent.intent, renderMode)
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 2: PREPARAR MENSAJES
    // ═══════════════════════════════════════════════════════════════════════════
    
    const systemPrompt = buildSystemPrompt(renderMode, intent)
    
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10),
      { role: "user", content: userQuery }
    ]
    
    console.log(`[Orchestrator] 📝 Mensajes preparados: ${messages.length}`)
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 3: TOOL CALLING LOOP (máximo 3 iteraciones para evitar loops infinitos)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const toolExecutions: ToolExecution[] = []
    const citations: Citation[] = []
    const MAX_ITERATIONS = 2
    
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`[Orchestrator] 🔧 Iteración ${iteration + 1}/${MAX_ITERATIONS} (máx 2)`)
      
      if (options.abortSignal.aborted) {
        throw new CancelledError()
      }
      
      // Llamar al LLM CON tools
      console.log("[Orchestrator] 🤖 Llamando LLM con tools...")
      const response = await callLLM(
        client,
        messages,
        LEGAL_TOOLS,
        config,
        false,
        options.abortSignal
      )
      
      const message = response.choices[0].message
      
      // Si hay tool calls, ejecutarlas y continuar
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[Orchestrator] 🔨 Tool calls detectadas: ${message.tool_calls.length}`)
        const toolCalls = message.tool_calls as ToolCall[]
        
        options.emitter.emitStatus("searching", randomChoice(STATUS_MESSAGES.searching))
        
        const toolStartTime = Date.now()
        const results = await executeTools(
          toolCalls,
          config.toolTimeoutMs,
          options.abortSignal
        )
        
        console.log(`[Orchestrator] ✅ Tools ejecutadas: ${results.length}`)
        
        toolExecutions.push({
          iteration,
          toolCalls,
          results,
          startTime: toolStartTime,
          endTime: Date.now()
        })
        
        // Extraer citas de los resultados
        const newCitations = extractCitationsFromResults(results)
        citations.push(...newCitations)
        
        // Agregar al contexto para la siguiente iteración
        messages.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: toolCalls
        })
        
        for (const result of results) {
          messages.push({
            role: "tool",
            tool_call_id: result.toolCallId,
            name: result.name,
            content: result.error ? `Error: ${result.error}` : result.output
          })
        }
        
        // Si es la última iteración, salir del loop para hacer la llamada final
        if (iteration === MAX_ITERATIONS - 1) {
          console.log("[Orchestrator] ⚠️ Última iteración alcanzada")
          break
        }
        
        continue
      }
      
      // No hay tool calls, tenemos respuesta final con texto
      if (message.content) {
        console.log(`[Orchestrator] 📝 Respuesta recibida directamente: ${message.content.length} chars`)
        
        // HACER STREAMING de la respuesta
        options.emitter.emitStatus("streaming", randomChoice(STATUS_MESSAGES.streaming))
        
        // Simular streaming dividiendo en palabras (para que el usuario vea el progreso)
        const words = message.content.split(/(\s+)/)
        for (let i = 0; i < words.length; i++) {
          if (options.abortSignal.aborted) throw new CancelledError()
          options.emitter.emitDelta(words[i])
          // Pequeño delay cada 5 palabras para simular streaming natural
          if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1))
          }
        }
        
        // Extraer citas del texto
        const textCitations = extractCitationsFromText(message.content)
        citations.push(...textCitations)
        
        // Emitir citas si hay
        if (citations.length > 0) {
          console.log(`[Orchestrator] 📚 Emitiendo ${citations.length} citas`)
          options.emitter.emitCitations(citations)
        }
        
        // Completar
        const processingTimeMs = Date.now() - startTime
        options.emitter.emitDone({
          model: config.model,
          processingTime: `${(processingTimeMs / 1000).toFixed(1)}s`,
          sourcesCount: citations.length,
          toolExecutions: toolExecutions.length
        })
        
        console.log(`[Orchestrator] 🏁 COMPLETED in ${processingTimeMs}ms`)
        
        return {
          text: message.content,
          citations,
          toolExecutions,
          modelUsed: config.model,
          processingTimeMs
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 4: RESPUESTA FINAL (después de tool calls)
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log("[Orchestrator] 🌊 Generando respuesta final después de tools...")
    options.emitter.emitStatus("streaming", randomChoice(STATUS_MESSAGES.streaming))
    
    // Preparar mensajes SIN el historial de tool calls para evitar que el LLM
    // devuelva más tool calls o texto con formato de tool calls
    const contextFromTools = toolExecutions
      .flatMap(te => te.results)
      .map(r => r.output)
      .join("\n\n")
      .substring(0, 8000) // Limitar contexto
    
    const messagesForFinal: ChatMessage[] = [
      { 
        role: "system", 
        content: SYSTEM_PROMPTS[renderMode] + "\n\nResponde de manera clara y estructurada basándote en la información proporcionada. NO uses formato de tool calls."
      },
      {
        role: "user",
        content: `Consulta: "${userQuery}"\n\nInformación encontrada:\n${contextFromTools}\n\nPor favor, responde a la consulta del usuario basándote en esta información. Sé claro y conciso.`
      }
    ]
    
    // Llamar al LLM SIN tools para forzar respuesta de texto
    const finalResponse = await client.chat.completions.create(
      {
        model: config.model,
        messages: messagesForFinal as any,
        temperature: config.temperature,
        max_tokens: config.maxTokens
        // NOTA: No pasamos tools aquí
      },
      { signal: options.abortSignal }
    )
    
    const finalMessage = finalResponse.choices[0].message
    let finalText = finalMessage.content || ""
    
    // Limpiar cualquier formato de tool calls que pueda haber quedado
    finalText = finalText.replace(/<tool_calls_section_begin>.*?<tool_calls_section_end>/gs, "")
    finalText = finalText.replace(/<tool_call_begin>.*?<tool_call_end>/gs, "")
    finalText = finalText.trim()
    
    if (!finalText) {
      console.error("[Orchestrator] ❌ No se recibió texto, usando fallback")
      finalText = "Lo siento, no pude generar una respuesta completa. Por favor, intenta reformular tu pregunta."
    }
    
    console.log(`[Orchestrator] 📝 Respuesta final: ${finalText.length} chars`)
    
    // Streaming de la respuesta final
    const words = finalText.split(/(\s+)/)
    for (let i = 0; i < words.length; i++) {
      if (options.abortSignal.aborted) throw new CancelledError()
      options.emitter.emitDelta(words[i])
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }
    
    // Extraer citas
    const textCitations = extractCitationsFromText(finalText)
    citations.push(...textCitations)
    
    // Emitir citas si hay
    if (citations.length > 0) {
      console.log(`[Orchestrator] 📚 Emitiendo ${citations.length} citas`)
      options.emitter.emitCitations(citations)
    }
    
    // Completar
    const processingTimeMs = Date.now() - startTime
    options.emitter.emitDone({
      model: config.model,
      processingTime: `${(processingTimeMs / 1000).toFixed(1)}s`,
      sourcesCount: citations.length,
      toolExecutions: toolExecutions.length
    })
    
    console.log(`[Orchestrator] 🏁 COMPLETED in ${processingTimeMs}ms`)
    
    return {
      text: finalText,
      citations,
      toolExecutions,
      modelUsed: config.model,
      processingTimeMs
    }
    
  } catch (error: unknown) {
    logError("Orchestrator", error, { 
      requestId,
      messageId,
      query: userQuery.substring(0, 50)
    })
    
    if (error instanceof CancelledError || error instanceof TimeoutError || error instanceof ChatError) {
      throw error
    }
    
    throw new ChatError(
      getErrorMessage(error, "Error desconocido en el orquestador"),
      "ORCHESTRATOR_ERROR",
      true
    )
  }
}

// Funciones auxiliares

async function classifyIntentWithTimeout(
  client: OpenAI,
  query: string,
  timeoutMs: number,
  abortSignal: AbortSignal
): Promise<IntentClassification> {
  return Promise.race([
    classifyIntent(client, query),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError("intent_classification", timeoutMs))
      }, timeoutMs)
      
      abortSignal.addEventListener("abort", () => {
        clearTimeout(timer)
        reject(new CancelledError())
      }, { once: true })
    })
  ])
}

async function callLLM(
  client: OpenAI,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  config: ChatConfig,
  forceJson: boolean,
  abortSignal: AbortSignal
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  
  if (abortSignal.aborted) {
    throw new CancelledError()
  }
  
  const localController = new AbortController()
  const abortHandler = () => localController.abort()
  abortSignal.addEventListener("abort", abortHandler, { once: true })
  
  try {
    const response = await client.chat.completions.create(
      {
        model: config.model,
        messages: messages as any,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        tools: forceJson ? undefined : tools as any,
        tool_choice: forceJson ? undefined : "auto",
        ...(forceJson ? { response_format: { type: "json_object" } } : {})
      },
      { signal: localController.signal }
    )
    
    return response
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      if (abortSignal.aborted) {
        throw new CancelledError()
      }
      throw new TimeoutError("llm_request", config.llmTimeoutMs)
    }
    
    if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>
      if (errObj.status === 429) {
        throw new ChatError("Rate limit exceeded", "RATE_LIMIT", true)
      }
      if (errObj.status === 401 || errObj.status === 403) {
        throw new ChatError("Authentication error", "AUTH_ERROR", false)
      }
    }
    
    throw new ChatError(getErrorMessage(error, "LLM request failed"), "LLM_ERROR", true)
  } finally {
    abortSignal.removeEventListener("abort", abortHandler)
  }
}

async function executeTools(
  toolCalls: ToolCall[],
  timeoutMs: number,
  abortSignal: AbortSignal
): Promise<ToolResult[]> {
  const promises = toolCalls.map(async (toolCall): Promise<ToolResult> => {
    const startTime = Date.now()
    
    try {
      const args = JSON.parse(toolCall.function.arguments)
      
      const output = await Promise.race([
        executeLegalTool(toolCall.function.name, args),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new TimeoutError(`tool_${toolCall.function.name}`, timeoutMs)), timeoutMs)
        })
      ])
      
      return {
        toolCallId: toolCall.id,
        name: toolCall.function.name,
        output,
        executionTimeMs: Date.now() - startTime
      }
    } catch (error: unknown) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.function.name,
        output: "",
        error: getErrorMessage(error, "Tool execution failed"),
        executionTimeMs: Date.now() - startTime
      }
    }
  })
  
  return Promise.all(promises)
}

function buildSystemPrompt(renderMode: RenderMode, intent: IntentClassification): string {
  const basePrompt = SYSTEM_PROMPTS[renderMode]
  
  if (intent.intent === "ambiguous") {
    return basePrompt + `\n\nNOTA: La intención del usuario es AMBIGUA. NO generes documento todavía. PREGUNTA si quiere redactar o información.`
  }
  
  return basePrompt
}

function extractCitationsFromResults(results: ToolResult[]): Citation[] {
  const citations: Citation[] = []
  
  for (const result of results) {
    const urlRegex = /https?:\/\/[^\s\)\]\>"]+/g
    const urls = result.output.match(urlRegex) || []
    
    for (const url of urls) {
      const cleanUrl = url.replace(/[,.}\]]+$/, "")
      citations.push({
        title: extractTitleFromUrl(cleanUrl),
        url: cleanUrl,
        snippet: result.output.slice(0, 200),
        source: result.name
      })
    }
  }
  
  return citations
}

function extractCitationsFromText(text: string): Citation[] {
  const citations: Citation[] = []
  const urlRegex = /https?:\/\/[^\s\)\]\>"]+/g
  const urls = text.match(urlRegex) || []
  
  for (const url of urls) {
    const cleanUrl = url.replace(/[,.}\]]+$/, "")
    citations.push({
      title: extractTitleFromUrl(cleanUrl),
      url: cleanUrl
    })
  }
  
  return citations
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace("www.", "")
    
    const domainNames: Record<string, string> = {
      "corteconstitucional.gov.co": "Corte Constitucional",
      "consejodeestado.gov.co": "Consejo de Estado",
      "cortesuprema.gov.co": "Corte Suprema",
      "suin-juriscol.gov.co": "SUIN-Juriscol",
      "secretariasenado.gov.co": "Secretaría del Senado",
      "funcionpublica.gov.co": "Función Pública",
      "ramajudicial.gov.co": "Rama Judicial"
    }
    
    for (const [domain, name] of Object.entries(domainNames)) {
      if (hostname.includes(domain)) return name
    }
    
    return hostname
  } catch {
    return "Fuente legal"
  }
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function detectSimpleMessage(query: string): boolean {
  const normalized = query.toLowerCase().trim()
  
  const greetings = [
    "hola", "buenos dias", "buenas tardes", "buenas noches",
    "hey", "saludos", "que tal", "como estas", "hi", "hello"
  ]
  
  const farewells = [
    "adios", "chao", "hasta luego", "nos vemos", "bye"
  ]
  
  const thanks = [
    "gracias", "muchas gracias", "te agradezco", "ok gracias"
  ]
  
  const simpleResponses = [
    "si", "no", "ok", "vale", "esta bien", "perfecto", "entendido",
    "claro", "exacto", "correcto", "listo", "dale", "bueno"
  ]
  
  if (normalized.length < 20 && !normalized.includes(" ")) {
    return true
  }
  
  const allPatterns = [...greetings, ...farewells, ...thanks, ...simpleResponses]
  
  for (const pattern of allPatterns) {
    if (normalized === pattern || normalized.startsWith(pattern + " ")) {
      return true
    }
  }
  
  return false
}
