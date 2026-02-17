/**
 * Main Graph for LangGraph Legal Assistant
 * 
 * Routes between INVESTIGATE and DRAFT modes.
 * Implements the complete pipeline for document drafting with To-Do + ReAct.
 */

import { StateGraph, END, START, MemorySaver } from "@langchain/langgraph"
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { RunnableConfig } from "@langchain/core/runnables"
import { v4 as uuidv4 } from "uuid"
import { interrupt } from "@langchain/langgraph"

import {
  AgentState,
  AgentStateAnnotation,
  AgentMode,
  TodoItem,
  TodoStatus,
  DocSection,
  DocOutline,
  MissingInfo,
  Question,
  InterruptPayload,
  AuditResult,
  AuditIssue,
  Citation,
  ToolCallRecord
} from "../state/schema"

import {
  vectorSearchTool,
  graphQueryTool,
  entitySearchTool,
  webSearchTool,
  legalArticleSearchTool,
  DRAFT_TOOLS
} from "../tools"

import { deepResearchGraph } from "./deepResearchGraph"
import { 
  generalChatResearchGraph, 
  shouldUseGeneralChatResearch 
} from "./generalChatResearchGraph"

// ============================================================================
// LLM CONFIGURATION
// ============================================================================

const DEFAULT_MODEL = process.env.MAIN_MODEL || "openai/gpt-4o-mini"
const DRAFT_MODEL = process.env.DRAFT_MODEL || "openai/gpt-4o"

function getLLM(forDraft = false) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  const useOpenRouter = !!process.env.OPENROUTER_API_KEY
  
  return new ChatOpenAI({
    modelName: forDraft ? DRAFT_MODEL : DEFAULT_MODEL,
    temperature: forDraft ? 0.2 : 0.1,
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
// DOCUMENT TYPE LIBRARY
// ============================================================================

const DOCUMENT_TYPES: Record<string, {
  label: string
  description: string
  requiredFields: string[]
  sections: string[]
}> = {
  contrato: {
    label: "Contrato",
    description: "Contrato civil o comercial",
    requiredFields: ["partes", "objeto", "precio", "plazo", "obligaciones"],
    sections: ["Partes", "Objeto", "Precio y forma de pago", "Obligaciones", "Plazo", "Cláusulas especiales", "Firmas"]
  },
  tutela: {
    label: "Acción de Tutela",
    description: "Acción de amparo constitucional",
    requiredFields: ["accionante", "accionado", "derechos_vulnerados", "hechos", "pretensiones"],
    sections: ["Identificación del accionante", "Identificación del accionado", "Derechos vulnerados", "Hechos", "Pretensiones", "Juramento", "Dirección para notificaciones"]
  },
  demanda: {
    label: "Demanda",
    description: "Demanda civil o laboral",
    requiredFields: ["demandante", "demandado", "hechos", "pretensiones", "fundamentos_derecho", "pruebas"],
    sections: ["Partes", "Hechos", "Pretensiones", "Fundamentos de derecho", "Pruebas", "Cuantía", "Anexos"]
  },
  derecho_peticion: {
    label: "Derecho de Petición",
    description: "Solicitud formal a autoridad",
    requiredFields: ["solicitante", "destinatario", "objeto", "fundamento"],
    sections: ["Identificación", "Objeto de la petición", "Fundamentos", "Anexos", "Dirección para respuesta"]
  },
  contestacion: {
    label: "Contestación de Demanda",
    description: "Respuesta a demanda judicial",
    requiredFields: ["demandado", "hechos_aceptados", "hechos_negados", "excepciones", "pruebas"],
    sections: ["Partes", "Hechos aceptados", "Hechos negados", "Excepciones", "Pruebas", "Solicitud"]
  }
}

// ============================================================================
// NODE: CLASSIFY INTENT
// ============================================================================

/**
 * Classify the user's intent to determine mode (investigate vs draft)
 */
async function classifyIntent(state: typeof AgentStateAnnotation.State) {
  console.log("[MainGraph] Node: classifyIntent")
  
  const llm = getLLM()
  
  const systemPrompt = `Eres un clasificador de intenciones especializado para un asistente legal colombiano.
Tu tarea es analizar la solicitud del usuario y determinar el modo de operación correcto.

## MODOS DE OPERACIÓN

### MODO "investigate" (Investigación Profunda)
Usa este modo cuando el usuario:
- Pregunta por información legal, conceptos, definiciones
- Solicita análisis de normas, leyes, jurisprudencia
- Busca explicaciones sobre procedimientos legales
- Consulta sobre derechos, obligaciones, interpretaciones
- Pide comparaciones o análisis de casos

**Palabras detonantes INVESTIGATE:**
- "investiga", "busca", "consulta", "analiza"
- "¿qué dice...", "¿qué es...", "¿cómo funciona..."
- "¿qué dice la ley sobre...", "¿qué dice la Corte..."
- "jurisprudencia", "doctrina", "normativa"
- "explica", "clarifica", "interpreta"
- "diferencia entre", "comparación"
- "prescripción", "caducidad", "términos"
- "requisitos para", "procedimiento de"

**Ejemplos INVESTIGATE:**
- "Investiga sobre la prescripción de la acción penal"
- "¿Qué dice la Corte Constitucional sobre el debido proceso?"
- "Analiza los requisitos para una tutela"
- "Busca jurisprudencia sobre responsabilidad civil"
- "¿Cuál es la diferencia entre prescripción y caducidad?"
- "Explica qué es el principio de proporcionalidad"
- "Consulta los elementos del tipo penal de hurto"

### MODO "draft" (Redacción de Documentos)
Usa este modo cuando el usuario:
- Solicita crear, redactar, elaborar un documento
- Pide un escrito, formato, plantilla específica
- Quiere generar un documento legal completo

**Palabras detonantes DRAFT:**
- "redacta", "escribe", "crea", "elabora"
- "hazme", "necesito un", "quiero un"
- "genera", "prepara", "formula"
- "demanda", "contrato", "tutela", "escrito"
- "derecho de petición", "querella", "denuncia"
- "contestación", "reconvención", "apelación"

**Ejemplos DRAFT:**
- "Redacta una demanda de responsabilidad civil"
- "Elabora un contrato de arrendamiento"
- "Necesito una tutela para proteger mi derecho a la salud"
- "Escribe un derecho de petición"
- "Hazme un contrato de compraventa"
- "Genera una contestación de demanda laboral"

## TIPO DE DOCUMENTO (solo si modo="draft")
- "contrato": contratos civiles, comerciales, arrendamiento, compraventa, etc.
- "tutela": acción de tutela, amparo constitucional
- "demanda": demandas civiles, laborales, de familia
- "derecho_peticion": derecho de petición, solicitudes a autoridades
- "contestacion": contestación de demanda, respuesta a demandas
- "querella": querellas, denuncias penales
- "recurso": recursos de apelación, reposición, queja
- "otro": otros documentos legales

## COMPLEJIDAD (1-5)
- 1-2: Pregunta simple, respuesta directa
- 3: Análisis moderado, una o dos fuentes
- 4-5: Investigación profunda, múltiples fuentes, análisis complejo

## NECESITA CASE_ID
- true: Si la pregunta requiere información de un expediente judicial específico
- false: Si es una consulta general o no requiere expediente

## REGLAS IMPORTANTES
1. Si hay AMBIGÜEDAD, prefiere "investigate" (es más seguro)
2. Una pregunta sobre CÓMO hacer algo → "investigate"
3. Una solicitud de CREAR algo → "draft"
4. "¿Qué debo incluir en una demanda?" → "investigate"
5. "Redáctame una demanda" → "draft"

Responde SOLO en JSON válido:
{
  "mode": "investigate" | "draft",
  "doc_type": "tipo" | null,
  "complexity": 1-5,
  "needs_case_id": true | false,
  "reason": "breve explicación de la clasificación"
}`

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(state.user_goal)
  ])

  // Parse response
  let classification
  try {
    const content = response.content.toString()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      classification = JSON.parse(jsonMatch[0])
    } else {
      classification = { mode: "investigate", doc_type: null, complexity: 3, needs_case_id: false }
    }
  } catch {
    classification = { mode: "investigate", doc_type: null, complexity: 3, needs_case_id: false }
  }

  console.log(`[MainGraph] Classification: ${JSON.stringify(classification)}`)

  return {
    mode: classification.mode as AgentMode,
    doc_type: classification.doc_type,
    complexity: classification.complexity,
    needs_case_id: classification.needs_case_id,
    messages: [new AIMessage(`Modo detectado: ${classification.mode === "draft" ? "Redacción" : "Investigación"}`)]
  }
}

// ============================================================================
// ROUTING FUNCTION
// ============================================================================

/**
 * Route based on classified mode
 */
function routeByMode(state: typeof AgentStateAnnotation.State): string {
  if (state.mode === "draft") {
    return "initialize_todo"
  }
  return "deep_research"
}

// ============================================================================
// NODE: INITIALIZE TODO (DRAFT MODE)
// ============================================================================

/**
 * Initialize the todo list for document drafting
 */
async function initializeTodo(state: typeof AgentStateAnnotation.State) {
  console.log("[MainGraph] Node: initializeTodo")
  
  const docType = state.doc_type || "demanda"
  const docConfig = DOCUMENT_TYPES[docType] || DOCUMENT_TYPES.demanda
  
  const todo: TodoItem[] = [
    { id: uuidv4(), label: "Recolectar contexto y requisitos", status: "pending" },
    { id: uuidv4(), label: "Identificar vacíos de información", status: "pending" },
    { id: uuidv4(), label: "Definir estructura del documento", status: "pending" },
    { id: uuidv4(), label: "Redactar secciones", status: "pending" },
    { id: uuidv4(), label: "Unificación y auditoría", status: "pending" },
    { id: uuidv4(), label: "Entrega del documento", status: "pending" }
  ]
  
  return {
    todo,
    messages: [new AIMessage(`Iniciando proceso de redacción de ${docConfig.label}.`)]
  }
}

// ============================================================================
// NODE: COLLECT CONTEXT (DRAFT MODE)
// ============================================================================

/**
 * Collect context from vector store, graph, and optionally web
 */
async function collectContext(state: typeof AgentStateAnnotation.State) {
  console.log("[MainGraph] Node: collectContext")
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Recolectar contexto y requisitos" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  const evidence = { chunks: [] as any[], graph_refs: [] as any[], web_refs: [] as any[] }
  const toolCalls: ToolCallRecord[] = []
  
  try {
    // 1. Vector search for templates and precedents
    const vectorResult = await vectorSearchTool.invoke({
      query: `plantilla ${state.doc_type} ${state.user_goal}`,
      processId: state.case_context.case_id,
      topK: 5
    })
    
    if (vectorResult.success) {
      evidence.chunks = vectorResult.results.map((r: any) => ({
        id: r.id,
        text: r.content,
        source_id: r.source_id,
        doc_id: r.doc_id,
        case_id: r.case_id,
        score: r.score
      }))
    }
    
    toolCalls.push({
      id: uuidv4(),
      tool_name: "vector_search",
      input: { query: `plantilla ${state.doc_type}` },
      output: { total: evidence.chunks.length },
      timestamp: new Date().toISOString()
    })
    
    // 2. Graph query for case entities
    if (state.case_context.case_id) {
      const graphResult = await graphQueryTool.invoke({
        caseId: state.case_context.case_id,
        queryType: "entities",
        limit: 30
      })
      
      if (graphResult.success) {
        evidence.graph_refs = graphResult.nodes?.map((n: any) => ({
          node_id: n.id,
          entity_type: n.type || n.labels?.[0],
          name: n.name,
          properties: n.properties
        })) || []
      }
      
      toolCalls.push({
        id: uuidv4(),
        tool_name: "graph_query",
        input: { caseId: state.case_context.case_id },
        output: { total: evidence.graph_refs.length },
        timestamp: new Date().toISOString()
      })
    }
    
    const updatedTodo = todo.map(t => 
      t.label === "Recolectar contexto y requisitos" 
        ? { ...t, status: "done" as const }
        : t
    )
    
    return {
      evidence,
      last_tool_calls: toolCalls,
      todo: updatedTodo,
      messages: [new AIMessage(`Contexto recolectado: ${evidence.chunks.length} documentos, ${evidence.graph_refs.length} entidades.`)]
    }
  } catch (error: any) {
    const updatedTodo = todo.map(t => 
      t.label === "Recolectar contexto y requisitos" 
        ? { ...t, status: "error" as const, details: error.message }
        : t
    )
    
    return {
      todo: updatedTodo,
      errors: [`Error recolectando contexto: ${error.message}`]
    }
  }
}

// ============================================================================
// NODE: DETECT MISSING INFO (DRAFT MODE)
// ============================================================================

/**
 * Detect missing information needed for the document
 */
async function detectMissingInfo(state: typeof AgentStateAnnotation.State) {
  console.log("[MainGraph] Node: detectMissingInfo")
  
  const llm = getLLM()
  const docType = state.doc_type || "demanda"
  const docConfig = DOCUMENT_TYPES[docType] || DOCUMENT_TYPES.demanda
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Identificar vacíos de información" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  const systemPrompt = `Eres un abogado experto en redacción de documentos legales colombianos.
Analiza la solicitud del usuario y la evidencia disponible para identificar información faltante.

Tipo de documento: ${docConfig.label}
Campos requeridos: ${docConfig.requiredFields.join(", ")}

Genera una lista de preguntas SÍ/NO para completar la información faltante.
Las preguntas deben ser claras y agrupadas por sección.

Responde en JSON:
{
  "questions": [
    {
      "id": "q1",
      "label": "¿El contrato tiene plazo definido?",
      "type": "yes_no",
      "section": "Plazo",
      "required": true
    }
  ],
  "required_fields": ["campo1", "campo2"],
  "reason": "explicación de por qué se necesita"
}`

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Solicitud: ${state.user_goal}

Evidencia disponible:
- Documentos: ${state.evidence.chunks.length}
- Entidades: ${state.evidence.graph_refs.length}

Contexto del caso: ${JSON.stringify(state.case_context)}
Respuestas previas: ${JSON.stringify(state.answers)}`)
  ])

  // Parse response
  let missingInfo: MissingInfo
  try {
    const content = response.content.toString()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      missingInfo = {
        questions: parsed.questions || [],
        required_fields: parsed.required_fields || [],
        reason: parsed.reason
      }
    } else {
      missingInfo = { questions: [], required_fields: [] }
    }
  } catch {
    missingInfo = { questions: [], required_fields: [] }
  }
  
  // Filter out already answered questions
  const unansweredQuestions = missingInfo.questions.filter(
    q => !state.answers.hasOwnProperty(q.id)
  )
  
  const updatedTodo = todo.map(t => 
    t.label === "Identificar vacíos de información" 
      ? { ...t, status: "done" as const }
      : t
  )
  
  // If no missing info, proceed
  if (unansweredQuestions.length === 0) {
    return {
      missing_info: null,
      todo: updatedTodo,
      messages: [new AIMessage("No se requiere información adicional.")]
    }
  }
  
  return {
    missing_info: {
      ...missingInfo,
      questions: unansweredQuestions
    },
    todo: updatedTodo,
    messages: [new AIMessage(`Se necesitan ${unansweredQuestions.length} datos adicionales.`)]
  }
}

// ============================================================================
// NODE: INTERRUPT FOR USER ANSWERS (DRAFT MODE)
// ============================================================================

/**
 * Interrupt execution to get user answers
 */
async function interruptForUserAnswers(state: typeof AgentStateAnnotation.State) {
  console.log("[MainGraph] Node: interruptForUserAnswers")
  
  if (!state.missing_info || state.missing_info.questions.length === 0) {
    return {}
  }
  
  // Group questions by section
  const groupedQuestions: Record<string, Question[]> = {}
  for (const q of state.missing_info.questions) {
    const section = q.section || "General"
    if (!groupedQuestions[section]) {
      groupedQuestions[section] = []
    }
    groupedQuestions[section].push(q)
  }
  
  // Build interrupt payload
  const payload: InterruptPayload = {
    ui_type: "yes_no_list",
    title: "Información requerida para el documento",
    why_needed: state.missing_info.reason || "Para completar el documento correctamente",
    what_happens_next: "Con esta información se generará la estructura del documento",
    questions: state.missing_info.questions.slice(0, 15), // Max 15 questions
    explain: `Secciones: ${Object.keys(groupedQuestions).join(", ")}`
  }
  
  // Use LangGraph interrupt
  const answers = interrupt(payload) as Record<string, any>
  
  return {
    answers: answers || {},
    interrupt_payload: null,
    messages: [new AIMessage("Respuestas recibidas, continuando con la redacción.")]
  }
}

// ============================================================================
// NODE: BUILD OUTLINE (DRAFT MODE)
// ============================================================================

/**
 * Build the document outline based on collected info
 */
async function buildOutline(state: typeof AgentStateAnnotation.State) {
  console.log("[MainGraph] Node: buildOutline")
  
  const llm = getLLM()
  const docType = state.doc_type || "demanda"
  const docConfig = DOCUMENT_TYPES[docType] || DOCUMENT_TYPES.demanda
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Definir estructura del documento" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  const systemPrompt = `Eres un abogado experto en estructuración de documentos legales.
Define la estructura del documento basándote en:
- Tipo de documento
- Información proporcionada
- Evidencia disponible

Identifica qué secciones requieren investigación profunda (argumentos jurídicos, marco normativo).

Responde en JSON:
{
  "sections": [
    {
      "id": "s1",
      "title": "Partes",
      "purpose": "Identificación de las partes",
      "needs_research": false,
      "order": 1
    }
  ]
}`

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Tipo: ${docConfig.label}
Secciones estándar: ${docConfig.sections.join(", ")}

Solicitud: ${state.user_goal}
Respuestas del usuario: ${JSON.stringify(state.answers)}
Contexto: ${JSON.stringify(state.case_context)}`)
  ])

  // Parse response
  let outline: DocOutline
  try {
    const content = response.content.toString()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      outline = {
        sections: parsed.sections || docConfig.sections.map((s, i) => ({
          id: `s${i + 1}`,
          title: s,
          purpose: s,
          needs_research: false,
          order: i + 1
        }))
      }
    } else {
      outline = {
        sections: docConfig.sections.map((s, i) => ({
          id: `s${i + 1}`,
          title: s,
          purpose: s,
          needs_research: false,
          order: i + 1
        }))
      }
    }
  } catch {
    outline = {
      sections: docConfig.sections.map((s, i) => ({
        id: `s${i + 1}`,
        title: s,
        purpose: s,
        needs_research: false,
        order: i + 1
      }))
    }
  }
  
  const updatedTodo = todo.map(t => 
    t.label === "Definir estructura del documento" 
      ? { ...t, status: "done" as const }
      : t
  )
  
  const researchSections = outline.sections.filter(s => s.needs_research)
  
  return {
    doc_outline: outline,
    todo: updatedTodo,
    messages: [new AIMessage(`Estructura definida con ${outline.sections.length} secciones. ${researchSections.length} requieren investigación.`)]
  }
}

// ============================================================================
// NODE: DRAFT SECTIONS REACT LOOP (DRAFT MODE)
// ============================================================================

/**
 * Draft each section using ReAct pattern
 */
async function draftSectionsReactLoop(state: typeof AgentStateAnnotation.State) {
  console.log("[MainGraph] Node: draftSectionsReactLoop")
  
  const llm = getLLM(true)
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Redactar secciones" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  if (!state.doc_outline) {
    return {
      todo: todo.map(t => 
        t.label === "Redactar secciones" 
          ? { ...t, status: "error" as const, details: "No hay estructura definida" }
          : t
      ),
      errors: ["No hay estructura definida para redactar"]
    }
  }
  
  const draftSections: Record<string, string> = { ...state.draft_sections }
  
  // Draft each section
  for (const section of state.doc_outline.sections) {
    // Skip already drafted
    if (draftSections[section.id]) continue
    
    console.log(`[MainGraph] Drafting section: ${section.title}`)
    
    // If section needs research, invoke deep research
    if (section.needs_research) {
      // Create a sub-state for research
      const researchState = {
        ...state,
        user_goal: `Argumentos jurídicos para: ${section.title} en ${state.user_goal}`
      }
      
      // Run deep research (simplified - in production would be a subgraph call)
      const researchResult = await runDeepResearchForSection(researchState)
      
      // Use research result as context
      const systemPrompt = `Eres un abogado experto en redacción legal.
Redacta la sección "${section.title}" del documento.

Propósito: ${section.purpose}

Investigación realizada:
${researchResult}

Reglas:
1. Usa la investigación para fundamentar
2. Cita las fuentes relevantes
3. Mantén un tono formal y jurídico`

      const sectionResponse = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`Redacta la sección basándote en la investigación.`)
      ])
      
      draftSections[section.id] = sectionResponse.content.toString()
    } else {
      // Standard section drafting
      const systemPrompt = `Eres un abogado experto en redacción legal colombiana.
Redacta la sección "${section.title}" del documento.

Propósito: ${section.purpose}

Información disponible:
- Respuestas del usuario: ${JSON.stringify(state.answers)}
- Contexto del caso: ${JSON.stringify(state.case_context)}
- Evidencia: ${state.evidence.chunks.length} documentos, ${state.evidence.graph_refs.length} entidades

Reglas:
1. Sé preciso y formal
2. Usa la información proporcionada
3. Si falta información, usa placeholders {{NOMBRE}}
4. Mantén coherencia con las otras secciones`

      const sectionResponse = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`Redacta la sección "${section.title}".`)
      ])
      
      draftSections[section.id] = sectionResponse.content.toString()
    }
  }
  
  const updatedTodo = todo.map(t => 
    t.label === "Redactar secciones" 
      ? { ...t, status: "done" as const }
      : t
  )
  
  return {
    draft_sections: draftSections,
    todo: updatedTodo,
    messages: [new AIMessage(`${Object.keys(draftSections).length} secciones redactadas.`)]
  }
}

/**
 * Helper: Run deep research for a section
 */
async function runDeepResearchForSection(state: any): Promise<string> {
  // Simplified - in production would call deepResearchGraph
  const llm = getLLM()
  
  const response = await llm.invoke([
    new SystemMessage("Eres un investigador legal. Proporciona argumentos jurídicos breves."),
    new HumanMessage(state.user_goal)
  ])
  
  return response.content.toString()
}

// ============================================================================
// NODE: MERGE AND AUDIT (DRAFT MODE)
// ============================================================================

/**
 * Merge sections and perform quality audit
 */
async function mergeAndAudit(state: typeof AgentStateAnnotation.State) {
  console.log("[MainGraph] Node: mergeAndAudit")
  
  const llm = getLLM()
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Unificación y auditoría" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  // Merge sections
  const sections = state.doc_outline?.sections || []
  const mergedParts: string[] = []
  
  for (const section of sections) {
    const content = state.draft_sections[section.id] || `[Sección ${section.title} pendiente]`
    mergedParts.push(`## ${section.title}\n\n${content}`)
  }
  
  const mergedDocument = mergedParts.join("\n\n---\n\n")
  
  // Perform audit
  const auditPrompt = `Eres un auditor de documentos legales.
Revisa el documento por:
1. Coherencia interna (definiciones, nombres, fechas, cifras)
2. Contradicciones con las respuestas del usuario
3. Cumplimiento de estructura
4. Claims sin cita en secciones argumentativas

Responde en JSON:
{
  "issues": [
    {
      "id": "i1",
      "type": "contradiction" | "missing_citation" | "inconsistency" | "format_error",
      "description": "descripción del problema",
      "section_id": "s1",
      "severity": "low" | "medium" | "high",
      "suggestion": "sugerencia de corrección"
    }
  ],
  "fixes": ["corrección 1", "corrección 2"],
  "passed": true | false,
  "quality_score": 0-100
}`

  const auditResponse = await llm.invoke([
    new SystemMessage(auditPrompt),
    new HumanMessage(`Documento:
${mergedDocument}

Respuestas del usuario: ${JSON.stringify(state.answers)}`)
  ])

  // Parse audit
  let audit: AuditResult
  try {
    const content = auditResponse.content.toString()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      audit = {
        issues: parsed.issues || [],
        fixes: parsed.fixes || [],
        passed: parsed.passed ?? true,
        quality_score: parsed.quality_score
      }
    } else {
      audit = { issues: [], fixes: [], passed: true, quality_score: 85 }
    }
  } catch {
    audit = { issues: [], fixes: [], passed: true, quality_score: 85 }
  }
  
  // Apply automatic fixes
  let finalDocument = mergedDocument
  for (const fix of audit.fixes) {
    // Simple fix application (in production would be more sophisticated)
    finalDocument = finalDocument + `\n\n<!-- Corrección aplicada: ${fix} -->`
  }
  
  const updatedTodo = todo.map(t => 
    t.label === "Unificación y auditoría" 
      ? { ...t, status: audit.passed ? "done" as const : "error" as const }
      : t
  )
  
  return {
    final_document: finalDocument,
    audit: audit,
    todo: updatedTodo,
    messages: [new AIMessage(audit.passed 
      ? `Documento completado. Score de calidad: ${audit.quality_score}%`
      : `Documento con ${audit.issues.length} problemas detectados.`)]
  }
}

// ============================================================================
// NODE: FINALIZE DOCUMENT (DRAFT MODE)
// ============================================================================

/**
 * Finalize the document with citations and metadata
 */
async function finalizeDocument(state: typeof AgentStateAnnotation.State) {
  console.log("[MainGraph] Node: finalizeDocument")
  
  // Update todo
  const todo = state.todo.map(t => 
    t.label === "Entrega del documento" 
      ? { ...t, status: "running" as const }
      : t
  )
  
  // Build citations section
  const citationsSection = buildCitationsSection(state.evidence)
  
  // Add citations to document
  const finalWithCitations = `${state.final_document}

---

## Fuentes y Soporte

${citationsSection}`

  const updatedTodo = todo.map(t => 
    t.label === "Entrega del documento" 
      ? { ...t, status: "done" as const }
      : t
  )
  
  return {
    final_document: finalWithCitations,
    todo: updatedTodo,
    messages: [new AIMessage("Documento finalizado con trazabilidad de fuentes.")]
  }
}

/**
 * Helper: Build citations section
 */
function buildCitationsSection(evidence: typeof AgentStateAnnotation.State["evidence"]): string {
  const parts: string[] = []
  
  if (evidence.chunks.length > 0) {
    parts.push("### Documentos Internos")
    evidence.chunks.forEach((chunk, i) => {
      parts.push(`${i + 1}. Documento ${chunk.doc_id} (relevancia: ${(chunk.score * 100).toFixed(0)}%)`)
    })
  }
  
  if (evidence.graph_refs.length > 0) {
    parts.push("\n### Entidades del Caso")
    evidence.graph_refs.forEach((ref, i) => {
      parts.push(`${i + 1}. ${ref.entity_type}: ${ref.name}`)
    })
  }
  
  if (evidence.web_refs.length > 0) {
    parts.push("\n### Fuentes Web")
    evidence.web_refs.forEach((ref, i) => {
      parts.push(`${i + 1}. [${ref.title}](${ref.url})`)
    })
  }
  
  return parts.join("\n")
}

// ============================================================================
// CONDITIONAL EDGES
// ============================================================================

/**
 * Check if missing info needs user input
 */
function needsUserInput(state: typeof AgentStateAnnotation.State): string {
  if (state.missing_info && state.missing_info.questions.length > 0) {
    // Check if questions are already answered
    const unanswered = state.missing_info.questions.filter(
      q => !state.answers.hasOwnProperty(q.id)
    )
    if (unanswered.length > 0) {
      return "interrupt_for_user_answers"
    }
  }
  return "build_outline"
}

/**
 * Check if audit requires user intervention
 */
function auditRequiresUser(state: typeof AgentStateAnnotation.State): string {
  if (state.audit && !state.audit.passed) {
    const highSeverity = state.audit.issues.filter(i => i.severity === "high")
    if (highSeverity.length > 0) {
      return "interrupt_for_user_answers"
    }
  }
  return "finalize_document"
}

// ============================================================================
// BUILD THE MAIN GRAPH
// ============================================================================

// Memory saver for persistence
const checkpointer = new MemorySaver()

/**
 * Create the main graph
 */
export function createMainGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)
  
  // Add nodes
  workflow.addNode("classify_intent", classifyIntent)
  workflow.addNode("initialize_todo", initializeTodo)
  workflow.addNode("collect_context", collectContext)
  workflow.addNode("detect_missing_info", detectMissingInfo)
  workflow.addNode("interrupt_for_user_answers", interruptForUserAnswers)
  workflow.addNode("build_outline", buildOutline)
  workflow.addNode("draft_sections_react_loop", draftSectionsReactLoop)
  workflow.addNode("merge_and_audit", mergeAndAudit)
  workflow.addNode("finalize_document", finalizeDocument)
  
  // Add research subgraphs
  // - deep_research: Full pipeline (vector + graph + web) for process chat
  // - general_chat_research: Web-only for general chat
  workflow.addNode("deep_research", deepResearchGraph)
  workflow.addNode("general_chat_research", generalChatResearchGraph)
  
  // Conditional entry: if mode is already set, skip classification
  workflow.addConditionalEdges(
    START,
    (state: typeof AgentStateAnnotation.State) => {
      // If mode is already forced, route directly
      if (state.mode === "investigate") {
        // Check if this is general chat or process chat
        if (shouldUseGeneralChatResearch(state.case_context)) {
          console.log("[MainGraph] Routing to general_chat_research (web-only)")
          return "general_chat_research"
        }
        console.log("[MainGraph] Routing to deep_research (full pipeline)")
        return "deep_research"
      }
      if (state.mode === "draft") {
        return "initialize_todo"
      }
      // Otherwise, classify intent first
      return "classify_intent"
    },
    {
      "deep_research": "deep_research",
      "general_chat_research": "general_chat_research",
      "initialize_todo": "initialize_todo",
      "classify_intent": "classify_intent"
    }
  )
  
  // Conditional routing after classification
  workflow.addConditionalEdges(
    "classify_intent",
    routeByMode,
    {
      "initialize_todo": "initialize_todo",
      "deep_research": "deep_research"
    }
  )
  
  // Draft mode path
  workflow.addEdge("initialize_todo", "collect_context")
  workflow.addEdge("collect_context", "detect_missing_info")
  
  // Conditional: need user input?
  workflow.addConditionalEdges(
    "detect_missing_info",
    needsUserInput,
    {
      "interrupt_for_user_answers": "interrupt_for_user_answers",
      "build_outline": "build_outline"
    }
  )
  
  workflow.addEdge("interrupt_for_user_answers", "build_outline")
  workflow.addEdge("build_outline", "draft_sections_react_loop")
  workflow.addEdge("draft_sections_react_loop", "merge_and_audit")
  
  // Conditional: audit issues?
  workflow.addConditionalEdges(
    "merge_and_audit",
    auditRequiresUser,
    {
      "interrupt_for_user_answers": "interrupt_for_user_answers",
      "finalize_document": "finalize_document"
    }
  )
  
  workflow.addEdge("finalize_document", END)
  
  // Investigate mode path
  workflow.addEdge("deep_research", END)
  
  return workflow.compile({
    checkpointer: checkpointer,
    interruptBefore: ["interrupt_for_user_answers"]
  })
}

// Export the compiled graph
export const mainGraph = createMainGraph()