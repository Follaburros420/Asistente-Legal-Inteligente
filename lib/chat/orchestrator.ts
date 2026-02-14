/**
 * Orquestador Thin del Chat Legal
 * 
 * Implementación sin LangChain/Glanchain:
 * - OpenRouter SDK directo
 * - Streaming real (no simulado)
 * - Tool calling manual
 * - Cancelación end-to-end con AbortController
 */

import OpenAI from "openai"
import { v4 as uuidv4 } from "uuid"
import {
  ChatConfig,
  DEFAULT_CHAT_CONFIG,
  ChatMessage,
  ToolDefinition,
  ToolExecutor,
  ToolCall,
  ToolResult,
  IntentClassification,
  RenderMode,
  OrchestratorState,
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

// System prompts por modo
const SYSTEM_PROMPTS: Record<RenderMode, string> = {
  chat: `Eres un Asistente Legal Especializado en Derecho Colombiano de élite.

REGLAS FUNDAMENTALES:
1. SIEMPRE asume jurisdicción Colombia. NUNCA preguntes por jurisdicción.
2. USA las herramientas de búsqueda legal cuando necesites verificar normas o jurisprudencia.
3. NUNCA inventes artículos, leyes ni sentencias.
4. Cita fuentes oficiales (.gov.co) con enlaces directos.
5. Prioriza: Corte Constitucional, Corte Suprema, Consejo de Estado, Rama Judicial.

FORMATO DE RESPUESTA:
- Respuesta directa y conversacional
- Contexto legal natural (sin títulos como "Marco Normativo")
- Detalles específicos: artículos, sentencias, normas
- Bibliografía al final con enlaces reales

IMPORTANTE: Para consultas legales, USA SIEMPRE la herramienta search_legal_official.`,

  document: `Eres un redactor legal experto en documentos jurídicos colombianos.

ESTÁS EN MODO GENERADOR DE DOCUMENTOS.

REGLAS CRÍTICAS:
1. ANTES de redactar, USA search_legal_official para verificar normativa aplicable.
2. NO inventes artículos, fundamentos ni jurisprudencia.
3. Usa placeholders {{NOMBRE}} para datos faltantes.
4. Estructura el documento con formato profesional.
5. Incluye cláusulas estándar del tipo de documento solicitado.

El documento debe ser válido jurídicamente en Colombia.
Si falta información, indica claramente qué datos son necesarios.`
}

// Mensajes por fase para status
const STATUS_MESSAGES = {
  classifying: ["Analizando tu consulta legal…", "Identificando el tipo de solicitud…"],
  searching: ["Investigando normas oficiales…", "Contrastando jurisprudencia aplicable…", "Verificando texto literal de artículos…"],
  drafting: ["Sintetizando hallazgos…", "Preparando respuesta estructurada…"],
  streaming: ["Redactando respuesta…", "Generando contenido…"]
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORQUESTADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

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
  
  // Verificar cancelación inmediata
  if (options.abortSignal.aborted) {
    throw new CancelledError("Cancelled before start")
  }

  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: OPENROUTER_BASE_URL
  })

  const requestId = uuidv4()
  const messageId = uuidv4()
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 1: CLASIFICACIÓN DE INTENCIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  
  options.emitter.emitStatus("classifying", randomChoice(STATUS_MESSAGES.classifying))
  
  const intent = await classifyIntentWithTimeout(
    client,
    userQuery,
    config.llmTimeoutMs,
    options.abortSignal
  )
  
  // Determinar render mode estricto
  const renderMode: RenderMode = intent.intent === "document_write" && intent.confidence >= 0.8
    ? "document"
    : "chat"
  
  // Emitir meta (SIEMPRE primero)
  options.emitter.emitMeta(messageId, intent.intent, renderMode)
  
  // Log de decisión
  console.log(`[${requestId}] Intent: ${intent.intent} (${intent.confidence.toFixed(2)}) | Mode: ${renderMode} | Reason: ${intent.reason}`)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 2: PREPARAR MENSAJES
  // ═══════════════════════════════════════════════════════════════════════════
  
  const systemPrompt = buildSystemPrompt(renderMode, intent)
  
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10),  // Últimos 10 mensajes de contexto
    { role: "user", content: userQuery }
  ]
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 3: EJECUCIÓN CON TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const toolExecutions: ToolExecution[] = []
  let finalText = ""
  let citations: Citation[] = []
  
  for (let iteration = 0; iteration < config.maxToolIterations; iteration++) {
    // Verificar cancelación
    if (options.abortSignal.aborted) {
      throw new CancelledError()
    }
    
    // Determinar si forzar JSON en última iteración para documentos
    const forceJson = renderMode === "document" && iteration === config.maxToolIterations - 1
    
    // Llamar al LLM
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
      const toolCalls = message.tool_calls as ToolCall[]
      
      options.emitter.emitStatus("searching", randomChoice(STATUS_MESSAGES.searching))
      
      // Ejecutar tools en paralelo
      const toolStartTime = Date.now()
      const results = await executeTools(
        toolCalls,
        config.toolTimeoutMs,
        options.abortSignal
      )
      
      toolExecutions.push({
        iteration,
        toolCalls,
        results,
        startTime: toolStartTime,
        endTime: Date.now()
      })
      
      // Extraer citas de los resultados
      const newCitations = extractCitationsFromResults(results)
      citations = [...citations, ...newCitations]
      
      // Agregar mensajes al contexto
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
      
      continue  // Siguiente iteración
    }
    
    // No hay tool calls, tenemos respuesta final
    finalText = message.content || ""
    
    // Extraer citas adicionales del texto
    const textCitations = extractCitationsFromText(finalText)
    citations = mergeCitations(citations, textCitations)
    
    break
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 4: STREAMING REAL DE LA RESPUESTA
  // ═══════════════════════════════════════════════════════════════════════════
  
  options.emitter.emitStatus("streaming", randomChoice(STATUS_MESSAGES.streaming))
  
  // Si es modo documento y no es JSON válido, intentar formatear
  if (renderMode === "document") {
    finalText = ensureDocumentFormat(finalText)
  }
  
  // Stream carácter por carácter (o palabra por palabra para eficiencia)
  const words = finalText.split(/(\s+)/)  // Conservar espacios
  for (const word of words) {
    if (options.abortSignal.aborted) {
      throw new CancelledError()
    }
    options.emitter.emitDelta(word)
  }
  
  // Emitir citas
  if (citations.length > 0) {
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
  
  return {
    text: finalText,
    citations,
    toolExecutions,
    modelUsed: config.model,
    processingTimeMs
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

async function classifyIntentWithTimeout(
  client: OpenAI,
  query: string,
  timeoutMs: number,
  abortSignal: AbortSignal
): Promise<IntentClassification> {
  // Verificar cancelación
  if (abortSignal.aborted) {
    throw new CancelledError()
  }
  
  // Usar Promise.race para timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError("intent_classification", timeoutMs))
    }, timeoutMs)
    
    // Limpiar timer si se cancela
    abortSignal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new CancelledError())
    }, { once: true })
  })
  
  const classifyPromise = classifyIntent(client, query)
  
  return Promise.race([classifyPromise, timeoutPromise])
}

async function callLLM(
  client: OpenAI,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  config: ChatConfig,
  forceJson: boolean,
  abortSignal: AbortSignal
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  // Verificar cancelación antes de llamar
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
  
  // Crear un AbortController local que combine con el externo
  const localController = new AbortController()
  
  // Si el signal externo se dispara, cancelar el local
  const abortHandler = () => localController.abort()
  abortSignal.addEventListener("abort", abortHandler, { once: true })
  
  try {
    const response = await client.chat.completions.create({
      ...requestOptions,
      signal: localController.signal
    })
    
    return response
  } catch (error: any) {
    // Manejar errores específicos
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
      throw new ChatError("Authentication error with OpenRouter", "AUTH_ERROR", false)
    }
    
    throw new ChatError(error.message || "LLM request failed", "LLM_ERROR", true)
  } finally {
    // Limpiar listener
    abortSignal.removeEventListener("abort", abortHandler)
  }
}

async function executeTools(
  toolCalls: ToolCall[],
  timeoutMs: number,
  abortSignal: AbortSignal
): Promise<ToolResult[]> {
  // Ejecutar todas las tools en paralelo
  const promises = toolCalls.map(async (toolCall): Promise<ToolResult> => {
    const startTime = Date.now()
    
    try {
      // Parsear argumentos
      const args = JSON.parse(toolCall.function.arguments)
      
      // Ejecutar con timeout
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
    return basePrompt + `

IMPORTANTE: La intención del usuario es AMBIGUA entre consulta y redacción de documento.
NO generes un documento completo todavía.
PREGUNTA cortésmente si desea que redactes el documento formalmente o si solo busca información sobre el tema.`
  }
  
  return basePrompt
}

function extractCitationsFromResults(results: ToolResult[]): Citation[] {
  const citations: Citation[] = []
  
  for (const result of results) {
    // Buscar URLs en el output de la tool
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
  
  return merged.slice(0, 10)  // Máximo 10 citas
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
      "ramajudicial.gov.co": "Rama Judicial",
      "minjusticia.gov.co": "MinJusticia",
      "dian.gov.co": "DIAN"
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
  // Si ya es JSON válido, devolverlo
  try {
    JSON.parse(text)
    return text
  } catch {
    // No es JSON, envolver en estructura básica
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
