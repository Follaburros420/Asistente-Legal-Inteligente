/**
 * General Chat Research Graph for LangGraph
 * 
 * Implements a simplified research pipeline for general chat (/chat).
 * Uses ONLY web search - no vector store or knowledge graph.
 * 
 * This provides a user-friendly "Investigando..." experience without
 * exposing technical implementation details.
 */

import { StateGraph, END, START } from "@langchain/langgraph"
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { v4 as uuidv4 } from "uuid"

import {
  AgentState,
  AgentStateAnnotation,
  WebReference,
  TodoItem,
  ToolCallRecord
} from "../state/schema"

import {
  webSearchTool,
  legalArticleSearchTool,
  jurisprudenceSearchTool,
  webResultToReference
} from "../tools"

// ============================================================================
// LLM CONFIGURATION
// ============================================================================

const DEFAULT_MODEL = process.env.INVESTIGATE_MODEL || "openai/gpt-4o-mini"

function getLLM() {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  const useOpenRouter = !!process.env.OPENROUTER_API_KEY
  
  return new ChatOpenAI({
    modelName: DEFAULT_MODEL,
    temperature: 0.1,
    apiKey: apiKey,
    ...(useOpenRouter ? {
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Asistente Legal Inteligente"
        }
      }
    } : {})
  })
}

// ============================================================================
// NODE: ANALYZE QUERY
// ============================================================================

/**
 * Analyze the user's query to determine search strategy
 */
async function analyzeQuery(state: typeof AgentStateAnnotation.State) {
  console.log("[GeneralChatResearch] Node: analyzeQuery")
  
  const llm = getLLM()
  
  // Create user-friendly todo items (no technical jargon)
  const todo: TodoItem[] = [
    { id: uuidv4(), label: "Analizando consulta...", status: "done" },
    { id: uuidv4(), label: "Investigando en fuentes externas...", status: "pending" },
    { id: uuidv4(), label: "Sintetizando hallazgos...", status: "pending" },
    { id: uuidv4(), label: "Finalizando respuesta...", status: "pending" }
  ]
  
  const systemPrompt = `Eres un analista de consultas legales colombianas.
Analiza la pregunta del usuario y determina el mejor tipo de búsqueda.

Tipos de búsqueda disponibles:
- "general": Búsqueda web general sobre temas legales
- "article": Búsqueda de un artículo específico de una ley o código
- "jurisprudence": Búsqueda de sentencias y jurisprudencia

Responde SOLO en JSON:
{
  "searchType": "general" | "article" | "jurisprudence",
  "keywords": ["palabra1", "palabra2"],
  "articleNumber": "123" | null,
  "legalBody": "Código Civil" | null,
  "court": "constitutional" | "supreme" | "council_state" | "all"
}`

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(state.user_goal)
  ])

  // Parse response
  let analysis
  try {
    const content = response.content.toString()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0])
    } else {
      analysis = { searchType: "general", keywords: [], court: "all" }
    }
  } catch {
    analysis = { searchType: "general", keywords: [], court: "all" }
  }

  console.log(`[GeneralChatResearch] Analysis: ${JSON.stringify(analysis)}`)

  return {
    todo,
    search_analysis: analysis,
    messages: [new AIMessage("Consulta analizada. Iniciando investigación...")]
  }
}

// ============================================================================
// NODE: PERFORM WEB SEARCH
// ============================================================================

/**
 * Perform web search based on query analysis
 */
async function performWebSearchNode(state: typeof AgentStateAnnotation.State) {
  console.log("[GeneralChatResearch] Node: performWebSearch")
  
  const startTime = Date.now()
  const analysis = state.search_analysis || { searchType: "general", keywords: [], court: "all" }
  
  // Update todo - show "Investigando..." status
  const todo = state.todo.map(t => 
    t.label === "Investigando en fuentes externas..." 
      ? { ...t, status: "running" as const }
      : t
  )
  
  let webRefs: WebReference[] = []
  let toolName = "web_search"
  
  try {
    if (analysis.searchType === "article" && analysis.articleNumber) {
      // Search for specific legal article
      toolName = "legal_article_search"
      
      const result = await legalArticleSearchTool.invoke({
        articleNumber: analysis.articleNumber,
        legalBody: analysis.legalBody,
        jurisdiction: "Colombia"
      })
      
      if (result.success && result.results) {
        webRefs = result.results.map((r: any) => webResultToReference(r))
      }
    } else if (analysis.searchType === "jurisprudence") {
      // Search for jurisprudence
      toolName = "jurisprudence_search"
      
      const keywords = analysis.keywords?.length > 0 
        ? analysis.keywords 
        : state.user_goal.split(" ").filter((w: string) => w.length > 3).slice(0, 5)
      
      const result = await jurisprudenceSearchTool.invoke({
        keywords: keywords,
        court: analysis.court || "all"
      })
      
      if (result.success && result.results) {
        webRefs = result.results.map((r: any) => webResultToReference(r))
      }
    } else {
      // General web search
      const result = await webSearchTool.invoke({
        query: state.user_goal,
        jurisdiction: "Colombia",
        sourceType: "all",
        maxResults: 5
      })
      
      if (result.success && result.results) {
        webRefs = result.results.map((r: any) => webResultToReference(r))
      }
    }
    
    const duration = Date.now() - startTime
    console.log(`[GeneralChatResearch] Web search completed: ${webRefs.length} results in ${duration}ms`)
    
    // Record tool call
    const toolCall: ToolCallRecord = {
      id: uuidv4(),
      tool_name: toolName,
      input: { query: state.user_goal, analysis },
      output: { total: webRefs.length },
      timestamp: new Date().toISOString(),
      duration_ms: duration
    }
    
    // Update todo
    const updatedTodo = todo.map(t => 
      t.label === "Investigando en fuentes externas..." 
        ? { ...t, status: "done" as const }
        : t
    )
    
    // If no results, still provide a meaningful message
    const message = webRefs.length > 0
      ? `Investigación completada: ${webRefs.length} fuentes encontradas.`
      : "Investigación completada. No se encontraron fuentes externas relevantes."
    
    return {
      evidence: { chunks: [], graph_refs: [], web_refs: webRefs },
      last_tool_calls: [toolCall],
      todo: updatedTodo,
      messages: [new AIMessage(message)]
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[GeneralChatResearch] Web search failed: ${error.message}`)
    
    const toolCall: ToolCallRecord = {
      id: uuidv4(),
      tool_name: toolName,
      input: { query: state.user_goal },
      output: { error: error.message },
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      error: error.message
    }
    
    const updatedTodo = todo.map(t => 
      t.label === "Investigando en fuentes externas..." 
        ? { ...t, status: "error" as const, details: error.message }
        : t
    )
    
    return {
      last_tool_calls: [toolCall],
      todo: updatedTodo,
      errors: [`Error en investigación: ${error.message}`]
    }
  }
}

// ============================================================================
// NODE: SYNTHESIZE ANSWER
// ============================================================================

/**
 * Synthesize the answer from web search results
 */
async function synthesizeAnswer(state: typeof AgentStateAnnotation.State) {
  console.log("[GeneralChatResearch] Node: synthesizeAnswer")
  
  const llm = getLLM()
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Sintetizando hallazgos..." 
      ? { ...t, status: "running" as const }
      : t
  )
  
  // Build context from web references
  const webContext = state.evidence.web_refs.length > 0
    ? state.evidence.web_refs.map((ref, i) => 
        `[${i + 1}] ${ref.title}\nURL: ${ref.url}\nExtracto: ${ref.snippet}`
      ).join("\n\n")
    : "No se encontraron fuentes externas relevantes."
  
  const systemPrompt = `Eres un abogado experto en derecho colombiano.
Tu tarea es responder la pregunta del usuario basándote en la información encontrada.

REGLAS:
1. Si hay fuentes web, úsalas para fundamentar tu respuesta
2. Cita las fuentes usando el formato: [1], [2], etc.
3. Si no hay fuentes, indica que no se encontró información específica
4. Sé claro y conciso
5. Si la información es insuficiente, indícalo claramente

Formato de respuesta:
## Respuesta
[Tu respuesta fundamentada]

## Fuentes Consultadas
[Lista de fuentes utilizadas, si las hay]

## Nota
[Si la información es limitada, indícalo aquí]`

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Pregunta: ${state.user_goal}

Fuentes encontradas:
${webContext}

Responde basándote en esta información.`)
  ])

  // Update todo
  const updatedTodo = todo.map(t => 
    t.label === "Sintetizando hallazgos..." 
      ? { ...t, status: "done" as const }
      : t
  )
  
  return {
    messages: [response],
    todo: updatedTodo
  }
}

// ============================================================================
// NODE: FINALIZE RESPONSE
// ============================================================================

/**
 * Finalize the response and prepare for streaming
 */
async function finalizeResponse(state: typeof AgentStateAnnotation.State) {
  console.log("[GeneralChatResearch] Node: finalizeResponse")
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Finalizando respuesta..." 
      ? { ...t, status: "done" as const }
      : t
  )
  
  return {
    todo,
    messages: [new AIMessage("Investigación completada.")]
  }
}

// ============================================================================
// BUILD THE GRAPH
// ============================================================================

/**
 * Create the General Chat Research subgraph
 * 
 * This is a simplified pipeline for general chat:
 * 1. Analyze query
 * 2. Perform web search only
 * 3. Synthesize answer
 * 4. Finalize
 */
export function createGeneralChatResearchGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)
  
  // Add nodes
  workflow.addNode("analyze_query", analyzeQuery)
  workflow.addNode("perform_web_search", performWebSearchNode)
  workflow.addNode("synthesize_answer", synthesizeAnswer)
  workflow.addNode("finalize_response", finalizeResponse)
  
  // Add edges - linear pipeline
  workflow.addEdge(START, "analyze_query")
  workflow.addEdge("analyze_query", "perform_web_search")
  workflow.addEdge("perform_web_search", "synthesize_answer")
  workflow.addEdge("synthesize_answer", "finalize_response")
  workflow.addEdge("finalize_response", END)
  
  return workflow.compile()
}

// Export the compiled graph
export const generalChatResearchGraph = createGeneralChatResearchGraph()

// Export a function to check if this graph should be used
export function shouldUseGeneralChatResearch(caseContext: any): boolean {
  // Use general chat research when:
  // 1. No case_id is provided (general chat)
  // 2. case_id is empty or "general"
  return !caseContext?.case_id || 
         caseContext.case_id === "" || 
         caseContext.case_id === "general"
}