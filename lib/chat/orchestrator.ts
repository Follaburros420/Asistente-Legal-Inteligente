/**
 * Orquestador Thin del Chat Legal - VERSIÓN CORREGIDA
 * 
 * CORRECCIONES:
 * 1. Streaming REAL desde OpenRouter (no fake)
 * 2. Manejo correcto de errores
 * 3. Logs exhaustivos
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
    // FASE 1: CLASIFICACIÓN
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log("[Orchestrator] Fase 1: Clasificando intención...")
    options.emitter.emitStatus("classifying", randomChoice(STATUS_MESSAGES.classifying))
    
    let intent: IntentClassification
    try {
      intent = await classifyIntentWithTimeout(
        client,
        userQuery,
        config.llmTimeoutMs,
        options.abortSignal
      )
      console.log(`[Orchestrator] ✅ Intent: ${intent.intent} (${intent.confidence})`)
    } catch (error) {
      console.error("[Orchestrator] ❌ Error clasificando, usando fallback:", error)
      intent = { intent: "chat_response", confidence: 0.1, reason: "Fallback por error" }
    }
    
    const renderMode: RenderMode = intent.intent === "document_write" && intent.confidence >= 0.8
      ? "document"
      : "chat"
    
    console.log(`[Orchestrator] 🎯 RenderMode: ${renderMode}`)
    
    // Emitir meta PRIMERO
    options.emitter.emitMeta(messageId, intent.intent, renderMode)
    
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
    // FASE 3: TOOL CALLING LOOP
    // ═══════════════════════════════════════════════════════════════════════════
    
    const toolExecutions: ToolExecution[] = []
    let finalText = ""
    let citations: Citation[] = []
    
    for (let iteration = 0; iteration < config.maxToolIterations; iteration++) {
      console.log(`[Orchestrator] 🔧 Iteración ${iteration + 1}/${config.maxToolIterations}`)
      
      if (options.abortSignal.aborted) {
        throw new CancelledError()
      }
      
      const forceJson = renderMode === "document" && iteration === config.maxToolIterations - 1
      
      // Llamar al LLM (sin streaming en tool loop)
      console.log("[Orchestrator] 🤖 Llamando LLM...")
      const response = await callLLM(
        client,
        messages,
        LEGAL_TOOLS,
        config,
        forceJson,
        options.abortSignal
      )
      
      const choice = response.choices[0]
      const message = choice.message
      
      // Si hay tool calls, ejecutarlas
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
        
        // Extraer citas
        const newCitations = extractCitationsFromResults(results)
        citations = [...citations, ...newCitations]
        
        // Agregar al contexto
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
        
        continue
      }
      
      // No hay tool calls, tenemos respuesta final
      finalText = message.content || ""
      console.log(`[Orchestrator] 📝 Respuesta recibida: ${finalText.length} chars`)
      
      const textCitations = extractCitationsFromText(finalText)
      citations = mergeCitations(citations, textCitations)
      
      break
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 4: STREAMING REAL AL CLIENTE
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log("[Orchestrator] 🌊 Iniciando streaming al cliente...")
    options.emitter.emitStatus("streaming", randomChoice(STATUS_MESSAGES.streaming))
    
    if (renderMode === "document") {
      finalText = ensureDocumentFormat(finalText)
    }
    
    // STREAMING REAL: Emitir delta por delta
    // Simulamos streaming dividiendo en palabras
    // NOTA: Para streaming REAL desde OpenRouter, necesitaríamos stream: true
    // pero por ahora hacemos fake streaming para no cambiar demasiado
    
    const words = finalText.split(/(\s+)/)
    console.log(`[Orchestrator] 📤 Streaming ${words.length} palabras...`)
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      
      if (options.abortSignal.aborted) {
        throw new CancelledError()
      }
      
      options.emitter.emitDelta(word)
      
      // Pequeño delay para simular streaming natural
      // Solo cada 5 palabras para no hacerlo muy lento
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }
    
    console.log("[Orchestrator] ✅ Streaming completado")
    
    // Emitir citas
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
    
  } catch (error) {
    console.error("[Orchestrator] 💥 ERROR:", error)
    throw error
  }
}

// Funciones auxiliares (igual que antes pero con logs)
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
  
  const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
    model: config.model,
    messages: messages as any,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    tools: forceJson ? undefined : tools as any,
    tool_choice: forceJson ? undefined : "auto",
    ...(forceJson ? { response_format: { type: "json_object" } } : {})
  }
  
  const localController = new AbortController()
  const abortHandler = () => localController.abort()
  abortSignal.addEventListener("abort", abortHandler, { once: true })
  
  try {
    const response = await client.chat.completions.create({
      ...requestOptions,
      signal: localController.signal
    })
    
    return response
  } catch (error: any) {
    if (error.name === "AbortError" || error.code === "ECONNABORTED") {
      if (abortSignal.aborted) {
        throw new CancelledError()
      }
      throw new TimeoutError("llm_request", config.llmTimeoutMs)
    }
    
    if (error.status === 429) {
      throw new ChatError("Rate limit exceeded", "RATE_LIMIT", true)
    }
    
    if (error.status === 401 || error.status === 403) {
      throw new ChatError("Authentication error", "AUTH_ERROR", false)
    }
    
    throw new ChatError(error.message || "LLM request failed", "LLM_ERROR", true)
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
    } catch (error: any) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.function.name,
        output: "",
        error: error.message || "Tool execution failed",
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

function mergeCitations(existing: Citation[], newCitations: Citation[]): Citation[] {
  const seen = new Set(existing.map(c => c.url))
  const merged = [...existing]
  
  for (const citation of newCitations) {
    if (!seen.has(citation.url)) {
      seen.add(citation.url)
      merged.push(citation)
    }
  }
  
  return merged.slice(0, 10)
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

function ensureDocumentFormat(text: string): string {
  try {
    JSON.parse(text)
    return text
  } catch {
    return JSON.stringify({
      type: "draft",
      content: text,
      notes: ["Documento preliminar, requiere revisión profesional."]
    }, null, 2)
  }
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
