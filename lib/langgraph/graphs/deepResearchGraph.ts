/**
 * Deep Research Graph for LangGraph
 * 
 * Implements the INVESTIGATE mode with plan-and-execute pattern.
 * Adjusts depth based on complexity (1-5 scale).
 */

import { StateGraph, END, START } from "@langchain/langgraph"
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { RunnableConfig } from "@langchain/core/runnables"
import { v4 as uuidv4 } from "uuid"

import {
  AgentState,
  AgentStateAnnotation,
  ResearchPlan,
  EvidenceChunk,
  GraphReference,
  WebReference,
  Citation,
  TodoItem,
  ResearchDepth,
  ToolCallRecord
} from "../state/schema"

import {
  vectorSearchTool,
  multiQueryVectorSearchTool,
  graphQueryTool,
  entitySearchTool,
  webSearchTool,
  legalArticleSearchTool,
  jurisprudenceSearchTool,
  searchResultToChunk,
  nodeToGraphRef,
  webResultToReference,
  INVESTIGATE_TOOLS
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
    apiKey: apiKey,  // Use 'apiKey' not 'openAIApiKey' for proper configuration passing
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
// DEPTH MAPPING
// ============================================================================

/**
 * Map complexity (1-5) to research depth and parameters
 */
function getDepthParams(complexity: number): {
  depth: ResearchDepth
  topK: number
  useWeb: boolean
  useMultiQuery: boolean
  maxIterations: number
} {
  if (complexity <= 2) {
    return {
      depth: "low",
      topK: 3,
      useWeb: false,
      useMultiQuery: false,
      maxIterations: 1
    }
  } else if (complexity === 3) {
    return {
      depth: "medium",
      topK: 5,
      useWeb: false,
      useMultiQuery: true,
      maxIterations: 2
    }
  } else {
    return {
      depth: "high",
      topK: 10,
      useWeb: true,
      useMultiQuery: true,
      maxIterations: 3
    }
  }
}

// ============================================================================
// NODE: MAKE RESEARCH PLAN
// ============================================================================

/**
 * Create a research plan based on the user's question and complexity
 */
async function makeResearchPlan(state: typeof AgentStateAnnotation.State) {
  console.log("[DeepResearch] Node: makeResearchPlan")
  
  const llm = getLLM()
  const depthParams = getDepthParams(state.complexity)
  
  const systemPrompt = `Eres un planificador de investigación legal experto.
Tu tarea es crear un plan de investigación estructurado para responder una pregunta legal.

Complejidad detectada: ${state.complexity}/5
Profundidad: ${depthParams.depth}

Genera un plan con:
1. Pasos específicos de investigación
2. Áreas legales relevantes
3. Preguntas clave a responder

Responde en formato JSON:
{
  "steps": ["paso 1", "paso 2", ...],
  "areas": ["área 1", "área 2", ...],
  "questions": ["pregunta 1", "pregunta 2", ...]
}`

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Pregunta del usuario: ${state.user_goal}
Contexto del caso: ${JSON.stringify(state.case_context)}`)
  ])

  // Parse the response
  let planData
  try {
    const content = response.content.toString()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      planData = JSON.parse(jsonMatch[0])
    } else {
      planData = { steps: ["Investigar la pregunta"], areas: [], questions: [] }
    }
  } catch {
    planData = { steps: ["Investigar la pregunta"], areas: [], questions: [] }
  }

  const researchPlan: ResearchPlan = {
    steps: planData.steps || [],
    depth: depthParams.depth,
    areas: planData.areas || [],
    questions: planData.questions || []
  }

  // Create todo items
  const todo: TodoItem[] = [
    { id: uuidv4(), label: "Planificar investigación", status: "done" },
    { id: uuidv4(), label: "Buscar en documentos internos", status: "pending" },
    { id: uuidv4(), label: "Consultar knowledge graph", status: "pending" }
  ]
  
  if (depthParams.useWeb) {
    todo.push({ id: uuidv4(), label: "Buscar en fuentes web", status: "pending" })
  }
  
  todo.push({ id: uuidv4(), label: "Sintetizar respuesta con citas", status: "pending" })
  todo.push({ id: uuidv4(), label: "Revisión de calidad", status: "pending" })

  return {
    research_plan: researchPlan,
    todo: todo,
    messages: [new AIMessage(`Plan de investigación creado con ${researchPlan.steps.length} pasos.`)]
  }
}

// ============================================================================
// NODE: RETRIEVE VECTOR
// ============================================================================

/**
 * Search the vector store for relevant document chunks
 */
async function retrieveVector(state: typeof AgentStateAnnotation.State) {
  console.log("[DeepResearch] Node: retrieveVector")
  
  const depthParams = getDepthParams(state.complexity)
  const startTime = Date.now()
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Buscar en documentos internos" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  try {
    let results: any[] = []
    
    // Expand query with legal synonyms
    const expandedQueries = expandLegalQuery(state.user_goal)
    
    if (depthParams.useMultiQuery && expandedQueries.length > 1) {
      // Use multi-query search
      const multiResult = await multiQueryVectorSearchTool.invoke({
        queries: expandedQueries,
        processId: state.case_context.case_id,
        topKPerQuery: Math.ceil(depthParams.topK / expandedQueries.length),
        deduplicate: true
      })
      
      if (multiResult.success) {
        results = multiResult.results
      }
    } else {
      // Single query search
      const searchResult = await vectorSearchTool.invoke({
        query: state.user_goal,
        processId: state.case_context.case_id,
        topK: depthParams.topK
      })
      
      if (searchResult.success) {
        results = searchResult.results
      }
    }
    
    // Convert to evidence chunks
    const chunks: EvidenceChunk[] = results.map(r => ({
      id: r.id,
      text: r.content,
      source_id: r.source_id,
      doc_id: r.doc_id,
      case_id: r.case_id,
      score: r.score,
      metadata: r.metadata
    }))
    
    const duration = Date.now() - startTime
    
    // Record tool call
    const toolCall: ToolCallRecord = {
      id: uuidv4(),
      tool_name: depthParams.useMultiQuery ? "multi_query_vector_search" : "vector_search",
      input: { query: state.user_goal, topK: depthParams.topK },
      output: { total: chunks.length },
      timestamp: new Date().toISOString(),
      duration_ms: duration
    }
    
    // Update todo
    const updatedTodo = todo.map(t => 
      t.label === "Buscar en documentos internos" 
        ? { ...t, status: "done" as const }
        : t
    )
    
    return {
      evidence: { chunks, graph_refs: [], web_refs: [] },
      last_tool_calls: [toolCall],
      todo: updatedTodo,
      messages: [new AIMessage(`Encontrados ${chunks.length} fragmentos relevantes en documentos internos.`)]
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    const toolCall: ToolCallRecord = {
      id: uuidv4(),
      tool_name: "vector_search",
      input: { query: state.user_goal },
      output: { error: error.message },
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      error: error.message
    }
    
    const updatedTodo = todo.map(t => 
      t.label === "Buscar en documentos internos" 
        ? { ...t, status: "error" as const, details: error.message }
        : t
    )
    
    return {
      last_tool_calls: [toolCall],
      todo: updatedTodo,
      errors: [`Error en búsqueda vectorial: ${error.message}`]
    }
  }
}

// ============================================================================
// NODE: RETRIEVE GRAPH
// ============================================================================

/**
 * Query the knowledge graph for entities and relationships
 */
async function retrieveGraph(state: typeof AgentStateAnnotation.State) {
  console.log("[DeepResearch] Node: retrieveGraph")
  
  const startTime = Date.now()
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Consultar knowledge graph" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  try {
    const caseId = state.case_context.case_id
    
    if (!caseId) {
      // Skip if no case context
      const updatedTodo = todo.map(t => 
        t.label === "Consultar knowledge graph" 
          ? { ...t, status: "done" as const, details: "Sin case_id, omitido" }
          : t
      )
      
      return {
        todo: updatedTodo,
        messages: [new AIMessage("No hay expediente específico para consultar el knowledge graph.")]
      }
    }
    
    // Query the graph
    const graphResult = await graphQueryTool.invoke({
      caseId: caseId,
      queryType: "full_graph",
      limit: 50
    })
    
    // Convert nodes to graph references
    const graphRefs: GraphReference[] = graphResult.nodes?.map((n: any) => ({
      node_id: n.id,
      entity_type: n.type || n.labels?.[0] || "Entity",
      name: n.name || n.id,
      properties: n.properties
    })) || []
    
    const duration = Date.now() - startTime
    
    const toolCall: ToolCallRecord = {
      id: uuidv4(),
      tool_name: "graph_query",
      input: { caseId, queryType: "full_graph" },
      output: { node_count: graphRefs.length, edge_count: graphResult.edges?.length || 0 },
      timestamp: new Date().toISOString(),
      duration_ms: duration
    }
    
    const updatedTodo = todo.map(t => 
      t.label === "Consultar knowledge graph" 
        ? { ...t, status: "done" as const }
        : t
    )
    
    return {
      evidence: { chunks: [], graph_refs: graphRefs, web_refs: [] },
      last_tool_calls: [toolCall],
      todo: updatedTodo,
      messages: [new AIMessage(`Encontradas ${graphRefs.length} entidades en el knowledge graph.`)]
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    const toolCall: ToolCallRecord = {
      id: uuidv4(),
      tool_name: "graph_query",
      input: { caseId: state.case_context.case_id },
      output: { error: error.message },
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      error: error.message
    }
    
    const updatedTodo = todo.map(t => 
      t.label === "Consultar knowledge graph" 
        ? { ...t, status: "error" as const, details: error.message }
        : t
    )
    
    return {
      last_tool_calls: [toolCall],
      todo: updatedTodo,
      errors: [`Error en consulta del knowledge graph: ${error.message}`]
    }
  }
}

// ============================================================================
// NODE: MAYBE WEB SEARCH
// ============================================================================

/**
 * Perform web search if needed based on depth and query type
 */
async function maybeWebSearch(state: typeof AgentStateAnnotation.State) {
  console.log("[DeepResearch] Node: maybeWebSearch")
  
  const depthParams = getDepthParams(state.complexity)
  
  // Check if web search is needed
  if (!depthParams.useWeb) {
    return {
      messages: [new AIMessage("Búsqueda web no necesaria para esta complejidad.")]
    }
  }
  
  // Check if query requires current info
  const requiresCurrentInfo = checkIfRequiresCurrentInfo(state.user_goal)
  
  if (!requiresCurrentInfo && state.evidence.chunks.length > 0) {
    return {
      messages: [new AIMessage("Información interna suficiente, búsqueda web omitida.")]
    }
  }
  
  const startTime = Date.now()
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Buscar en fuentes web" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  try {
    // Determine search type
    const searchType = determineSearchType(state.user_goal)
    
    let webRefs: WebReference[] = []
    
    if (searchType === "article") {
      // Search for specific legal article
      const articleInfo = extractArticleInfo(state.user_goal)
      const result = await legalArticleSearchTool.invoke({
        articleNumber: articleInfo.articleNumber,
        legalBody: articleInfo.legalBody,
        jurisdiction: state.case_context.jurisdiction || "Colombia"
      })
      
      if (result.success) {
        webRefs = result.results.map((r: any) => webResultToReference(r))
      }
    } else if (searchType === "jurisprudence") {
      // Search for jurisprudence
      const keywords = extractKeywords(state.user_goal)
      const result = await jurisprudenceSearchTool.invoke({
        keywords: keywords,
        court: "all"
      })
      
      if (result.success) {
        webRefs = result.results.map((r: any) => webResultToReference(r))
      }
    } else {
      // General web search
      const result = await webSearchTool.invoke({
        query: state.user_goal,
        jurisdiction: state.case_context.jurisdiction || "Colombia",
        sourceType: "all",
        maxResults: depthParams.topK
      })
      
      if (result.success) {
        webRefs = result.results.map((r: any) => webResultToReference(r))
      }
    }
    
    const duration = Date.now() - startTime
    
    const toolCall: ToolCallRecord = {
      id: uuidv4(),
      tool_name: searchType === "article" ? "legal_article_search" : 
                 searchType === "jurisprudence" ? "jurisprudence_search" : "web_search",
      input: { query: state.user_goal },
      output: { total: webRefs.length },
      timestamp: new Date().toISOString(),
      duration_ms: duration
    }
    
    const updatedTodo = todo.map(t => 
      t.label === "Buscar en fuentes web" 
        ? { ...t, status: "done" as const }
        : t
    )
    
    return {
      evidence: { chunks: [], graph_refs: [], web_refs: webRefs },
      last_tool_calls: [toolCall],
      todo: updatedTodo,
      messages: [new AIMessage(`Encontradas ${webRefs.length} fuentes web relevantes.`)]
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    const toolCall: ToolCallRecord = {
      id: uuidv4(),
      tool_name: "web_search",
      input: { query: state.user_goal },
      output: { error: error.message },
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      error: error.message
    }
    
    const updatedTodo = todo.map(t => 
      t.label === "Buscar en fuentes web" 
        ? { ...t, status: "error" as const, details: error.message }
        : t
    )
    
    return {
      last_tool_calls: [toolCall],
      todo: updatedTodo,
      errors: [`Error en búsqueda web: ${error.message}`]
    }
  }
}

// ============================================================================
// NODE: SYNTHESIZE ANSWER
// ============================================================================

/**
 * Synthesize the answer with citations
 */
async function synthesizeAnswer(state: typeof AgentStateAnnotation.State) {
  console.log("[DeepResearch] Node: synthesizeAnswer")
  
  const llm = getLLM()
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Sintetizar respuesta con citas" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  // Build context from evidence
  const context = buildContextFromEvidence(state.evidence)
  
  const systemPrompt = `Eres un abogado experto en derecho colombiano.
Tu tarea es sintetizar una respuesta legal basada EXCLUSIVAMENTE en la evidencia proporcionada.

REGLAS ESTRICTAS:
1. NUNCA inventes información legal
2. CADA afirmación material DEBE tener una cita
3. Si no hay evidencia suficiente, indícalo claramente
4. Usa el formato: [Afirmación] (Fuente: tipo/id)

Formato de respuesta:
## Hechos
[Hechos relevantes con citas]

## Normas Aplicables
[Artículos, leyes con citas]

## Análisis
[Aplicación de normas a hechos]

## Conclusión
[Respuesta directa a la pregunta]

## Fuentes
[Lista de fuentes utilizadas]

## Información Faltante
[Si algo no se pudo responder por falta de evidencia]`

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Pregunta: ${state.user_goal}

Evidencia disponible:
${context}

Responde basándote SOLO en esta evidencia.`)
  ])

  // Extract citations from the response
  const citations = extractCitationsFromResponse(response.content.toString(), state.evidence)
  
  const updatedTodo = todo.map(t => 
    t.label === "Sintetizar respuesta con citas" 
      ? { ...t, status: "done" as const }
      : t
  )
  
  return {
    messages: [response],
    citations: citations,
    todo: updatedTodo
  }
}

// ============================================================================
// NODE: QUALITY REVIEW
// ============================================================================

/**
 * Review the answer for quality and completeness
 */
async function qualityReview(state: typeof AgentStateAnnotation.State) {
  console.log("[DeepResearch] Node: qualityReview")
  
  const llm = getLLM()
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Revisión de calidad" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  const lastMessage = state.messages[state.messages.length - 1]
  const responseText = lastMessage?.content?.toString() || ""
  
  const systemPrompt = `Eres un revisor de calidad legal.
Verifica que la respuesta cumpla con:
1. Afirmaciones con citas
2. Sin contradicciones
3. Sin información inventada
4. Respuesta directa a la pregunta

Responde en JSON:
{
  "passed": true/false,
  "issues": ["problema 1", "problema 2"],
  "missing_evidence": ["evidencia faltante 1"],
  "needs_more_research": true/false
}`

  const reviewResponse = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Pregunta original: ${state.user_goal}

Respuesta a revisar:
${responseText}

Evidencia disponible:
- Chunks: ${state.evidence.chunks.length}
- Graph refs: ${state.evidence.graph_refs.length}
- Web refs: ${state.evidence.web_refs.length}`)
  ])

  // Parse review
  let review
  try {
    const content = reviewResponse.content.toString()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      review = JSON.parse(jsonMatch[0])
    } else {
      review = { passed: true, issues: [], missing_evidence: [], needs_more_research: false }
    }
  } catch {
    review = { passed: true, issues: [], missing_evidence: [], needs_more_research: false }
  }
  
  const updatedTodo = todo.map(t => 
    t.label === "Revisión de calidad" 
      ? { ...t, status: review.passed ? "done" as const : "error" as const, details: review.issues?.join(", ") }
      : t
  )
  
  // If issues found, add to errors
  const errors = review.passed ? [] : review.issues || []
  
  return {
    todo: updatedTodo,
    errors: errors,
    messages: review.passed 
      ? [new AIMessage("Revisión de calidad completada: respuesta aprobada.")]
      : [new AIMessage(`Revisión de calidad: problemas encontrados - ${review.issues?.join(", ")}`)]
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function expandLegalQuery(query: string): string[] {
  const queries = [query]
  
  // Add legal synonyms
  const synonyms: Record<string, string[]> = {
    "contrato": ["acuerdo", "convenio", "pacto"],
    "demanda": ["demanda judicial", "acción judicial", "reclamación"],
    "tutela": ["acción de tutela", "amparo", "derecho fundamental"],
    "nulidad": ["nulidad procesal", "ineficacia", "invalidación"],
    "responsabilidad": ["responsabilidad civil", "indemnización", "daños"]
  }
  
  for (const [term, syns] of Object.entries(synonyms)) {
    if (query.toLowerCase().includes(term)) {
      for (const syn of syns) {
        queries.push(query.replace(new RegExp(term, "gi"), syn))
      }
    }
  }
  
  return [...new Set(queries)].slice(0, 3)
}

function checkIfRequiresCurrentInfo(query: string): boolean {
  const currentIndicators = [
    "vigente", "actual", "reciente", "última", "modificación",
    "reforma", "nueva", "jurisprudencia", "sentencia"
  ]
  
  return currentIndicators.some(ind => query.toLowerCase().includes(ind))
}

function determineSearchType(query: string): "article" | "jurisprudence" | "general" {
  const lower = query.toLowerCase()
  
  if (lower.includes("artículo") || lower.includes("articulo")) {
    return "article"
  }
  
  if (lower.includes("jurisprudencia") || lower.includes("sentencia") || lower.includes("fallo")) {
    return "jurisprudence"
  }
  
  return "general"
}

function extractArticleInfo(query: string): { articleNumber: string; legalBody?: string } {
  const match = query.match(/art[ií]culo\s*(\d+[a-z]?)/i)
  const articleNumber = match ? match[1] : ""
  
  const bodyMatch = query.match(/(constituci[oó]n|c[oó]digo\s*(civil|penal|procesal)|ley\s*\d+)/i)
  const legalBody = bodyMatch ? bodyMatch[1] : undefined
  
  return { articleNumber, legalBody }
}

function extractKeywords(query: string): string[] {
  // Remove stop words and extract meaningful terms
  const stopWords = ["el", "la", "los", "las", "de", "del", "en", "es", "que", "cómo", "cuál", "qué"]
  
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word))
    .slice(0, 5)
}

function buildContextFromEvidence(evidence: typeof AgentStateAnnotation.State["evidence"]): string {
  const parts: string[] = []
  
  if (evidence.chunks.length > 0) {
    parts.push("=== DOCUMENTOS INTERNOS ===")
    evidence.chunks.forEach((chunk, i) => {
      parts.push(`[${i + 1}] (Doc: ${chunk.doc_id}, Score: ${chunk.score.toFixed(2)})`)
      parts.push(chunk.text.substring(0, 500))
      parts.push("")
    })
  }
  
  if (evidence.graph_refs.length > 0) {
    parts.push("=== KNOWLEDGE GRAPH ===")
    evidence.graph_refs.forEach((ref, i) => {
      parts.push(`[${i + 1}] ${ref.entity_type}: ${ref.name}`)
      if (ref.properties?.summary) {
        parts.push(`  Resumen: ${ref.properties.summary}`)
      }
    })
    parts.push("")
  }
  
  if (evidence.web_refs.length > 0) {
    parts.push("=== FUENTES WEB ===")
    evidence.web_refs.forEach((ref, i) => {
      parts.push(`[${i + 1}] ${ref.title}`)
      parts.push(`  URL: ${ref.url}`)
      parts.push(`  Extracto: ${ref.snippet.substring(0, 300)}`)
      parts.push("")
    })
  }
  
  return parts.join("\n")
}

function extractCitationsFromResponse(
  response: string, 
  evidence: typeof AgentStateAnnotation.State["evidence"]
): Citation[] {
  const citations: Citation[] = []
  
  // Extract citations from format like (Fuente: vector/123)
  const citationRegex = /\(Fuente:\s*(\w+)\/(\d+)\)/g
  let match
  
  while ((match = citationRegex.exec(response)) !== null) {
    const type = match[1] as "vector" | "graph" | "web"
    const index = parseInt(match[2]) - 1
    
    if (type === "vector" && evidence.chunks[index]) {
      const chunk = evidence.chunks[index]
      citations.push({
        id: uuidv4(),
        type: "vector",
        ref: `Documento interno: ${chunk.doc_id}`,
        excerpt: chunk.text.substring(0, 200),
        source_url: undefined
      })
    } else if (type === "graph" && evidence.graph_refs[index]) {
      const ref = evidence.graph_refs[index]
      citations.push({
        id: uuidv4(),
        type: "graph",
        ref: `${ref.entity_type}: ${ref.name}`,
        excerpt: ref.properties?.summary || ""
      })
    } else if (type === "web" && evidence.web_refs[index]) {
      const webRef = evidence.web_refs[index]
      citations.push({
        id: uuidv4(),
        type: "web",
        ref: webRef.title,
        excerpt: webRef.snippet.substring(0, 200),
        source_url: webRef.url
      })
    }
  }
  
  return citations
}

// ============================================================================
// BUILD THE GRAPH
// ============================================================================

/**
 * Create the Deep Research subgraph
 */
export function createDeepResearchGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)
  
  // Add nodes
  workflow.addNode("make_research_plan", makeResearchPlan)
  workflow.addNode("retrieve_vector", retrieveVector)
  workflow.addNode("retrieve_graph", retrieveGraph)
  workflow.addNode("maybe_web_search", maybeWebSearch)
  workflow.addNode("synthesize_answer", synthesizeAnswer)
  workflow.addNode("quality_review", qualityReview)
  
  // Add edges
  workflow.addEdge(START, "make_research_plan")
  workflow.addEdge("make_research_plan", "retrieve_vector")
  workflow.addEdge("retrieve_vector", "retrieve_graph")
  workflow.addEdge("retrieve_graph", "maybe_web_search")
  workflow.addEdge("maybe_web_search", "synthesize_answer")
  workflow.addEdge("synthesize_answer", "quality_review")
  workflow.addEdge("quality_review", END)
  
  return workflow.compile()
}

// Export the compiled graph
export const deepResearchGraph = createDeepResearchGraph()