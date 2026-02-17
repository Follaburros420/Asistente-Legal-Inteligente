/**
 * LangGraph State Schema for Legal Assistant Pipeline
 * 
 * This defines the shared state that flows through all nodes in the graph.
 * The state is used for both INVESTIGATE (Deep Research) and DRAFT (Document Writing) modes.
 */

import { BaseMessage } from "@langchain/core/messages"

// ============================================================================
// CORE TYPES
// ============================================================================

export type AgentMode = "investigate" | "draft"

export type ResearchDepth = "low" | "medium" | "high"

export type TodoStatus = "pending" | "running" | "done" | "error"

export type QuestionType = "yes_no" | "text" | "select"

// ============================================================================
// CASE CONTEXT
// ============================================================================

export interface CaseContext {
  /** ID del expediente/proceso legal */
  case_id?: string
  /** Jurisdicción (ej: Colombia, España) */
  jurisdiction?: string
  /** Tribunal/Juzgado */
  court?: string
  /** Partes involucradas */
  parties?: {
    plaintiff?: string
    defendant?: string
    others?: string[]
  }
  /** Tipo de proceso */
  process_type?: string
}

// ============================================================================
// CONSTRAINTS
// ============================================================================

export interface Constraints {
  /** Tono del documento (formal, técnico, simple) */
  tone?: "formal" | "tecnico" | "simple"
  /** Formato de salida */
  format?: "markdown" | "docx" | "pdf" | "html"
  /** Idioma */
  language?: "es" | "en"
  /** Plantilla a usar */
  template?: string
  /** Longitud máxima aproximada */
  max_length?: number
}

// ============================================================================
// RESEARCH STATE
// ============================================================================

export interface ResearchPlan {
  /** Pasos del plan de investigación */
  steps: string[]
  /** Profundidad de la investigación */
  depth: ResearchDepth
  /** Áreas a investigar */
  areas?: string[]
  /** Preguntas específicas a responder */
  questions?: string[]
}

export interface EvidenceChunk {
  /** ID del chunk */
  id: string
  /** Contenido del texto */
  text: string
  /** ID del documento fuente */
  source_id: string
  /** ID del documento */
  doc_id: string
  /** ID del caso/expediente */
  case_id?: string
  /** Score de similitud */
  score: number
  /** Metadatos adicionales */
  metadata?: Record<string, any>
}

export interface GraphReference {
  /** ID del nodo */
  node_id: string
  /** Tipo de entidad */
  entity_type: string
  /** Nombre de la entidad */
  name: string
  /** Tipo de relación si aplica */
  relation_type?: string
  /** Propiedades del nodo */
  properties?: Record<string, any>
}

export interface WebReference {
  /** URL de la fuente */
  url: string
  /** Título */
  title: string
  /** Fragmento relevante */
  snippet: string
  /** Fecha de publicación o acceso */
  date?: string
  /** Score de relevancia */
  score?: number
  /** Tipo de fuente */
  source_type?: string
}

export interface Citation {
  /** ID único de la cita */
  id: string
  /** Tipo de fuente: vector, graph, web */
  type: "vector" | "graph" | "web"
  /** Referencia legible */
  ref: string
  /** Extracto citado */
  excerpt: string
  /** URL o identificador de la fuente original */
  source_url?: string
}

export interface Evidence {
  /** Chunks del vector store */
  chunks: EvidenceChunk[]
  /** Referencias al knowledge graph */
  graph_refs: GraphReference[]
  /** Referencias web */
  web_refs: WebReference[]
}

// ============================================================================
// DRAFTING STATE
// ============================================================================

export interface DocSection {
  /** ID de la sección */
  id: string
  /** Título de la sección */
  title: string
  /** Propósito de la sección */
  purpose?: string
  /** Si requiere investigación profunda */
  needs_research?: boolean
  /** Orden en el documento */
  order: number
  /** Estado de la sección */
  status?: TodoStatus
}

export interface DocOutline {
  /** Secciones del documento */
  sections: DocSection[]
  /** Estructura completa en markdown */
  structure_md?: string
}

export interface Question {
  /** ID único de la pregunta */
  id: string
  /** Texto de la pregunta */
  label: string
  /** Tipo de pregunta */
  type: QuestionType
  /** Valor por defecto */
  default?: string | boolean
  /** Si esta pregunta depende de otra */
  depends_on?: {
    question_id: string
    value: any
  }
  /** Sección a la que pertenece */
  section?: string
  /** Si es obligatoria */
  required?: boolean
  /** Ayuda o explicación */
  help?: string
  /** Opciones para tipo select */
  options?: string[]
}

export interface MissingInfo {
  /** Preguntas pendientes */
  questions: Question[]
  /** Campos requeridos */
  required_fields: string[]
  /** Explicación de por qué se necesita */
  reason?: string
}

export interface AuditIssue {
  /** ID del issue */
  id: string
  /** Tipo de problema */
  type: "contradiction" | "missing_citation" | "inconsistency" | "format_error"
  /** Descripción del problema */
  description: string
  /** Sección afectada */
  section_id?: string
  /** Severidad */
  severity: "low" | "medium" | "high"
  /** Sugerencia de corrección */
  suggestion?: string
}

export interface AuditResult {
  /** Issues encontrados */
  issues: AuditIssue[]
  /** Correcciones aplicadas */
  fixes: string[]
  /** Si pasó la auditoría */
  passed: boolean
  /** Score de calidad */
  quality_score?: number
}

// ============================================================================
// TODO / CHECKLIST
// ============================================================================

export interface TodoItem {
  /** ID del item */
  id: string
  /** Etiqueta visible */
  label: string
  /** Estado actual */
  status: TodoStatus
  /** Detalles adicionales */
  details?: string
  /** Timestamp de inicio */
  started_at?: string
  /** Timestamp de finalización */
  completed_at?: string
}

// ============================================================================
// TOOL CALLS
// ============================================================================

export interface ToolCallRecord {
  /** ID de la llamada */
  id: string
  /** Nombre de la herramienta */
  tool_name: string
  /** Parámetros de entrada */
  input: Record<string, any>
  /** Resultado */
  output: any
  /** Timestamp */
  timestamp: string
  /** Duración en ms */
  duration_ms?: number
  /** Si hubo error */
  error?: string
}

// ============================================================================
// INTERRUPT PAYLOAD
// ============================================================================

export interface InterruptPayload {
  /** Tipo de UI a renderizar */
  ui_type: "yes_no_list" | "text_input" | "document_preview"
  /** Título del interrupt */
  title: string
  /** Explicación de por qué se necesita */
  why_needed: string
  /** Qué pasará después */
  what_happens_next?: string
  /** Lista de preguntas */
  questions: Question[]
  /** Información adicional */
  explain?: string
}

// ============================================================================
// MAIN AGENT STATE
// ============================================================================

export interface AgentState {
  // ===== CORE =====
  /** Historial de mensajes */
  messages: BaseMessage[]
  /** Modo actual del agente */
  mode: AgentMode
  /** Objetivo del usuario */
  user_goal: string
  
  // ===== CONTEXT =====
  /** Contexto del caso/expediente */
  case_context: CaseContext
  /** Restricciones del documento/respuesta */
  constraints: Constraints
  
  // ===== RESEARCH =====
  /** Plan de investigación */
  research_plan: ResearchPlan | null
  /** Evidencia recolectada */
  evidence: Evidence
  /** Citas generadas */
  citations: Citation[]
  
  // ===== DRAFTING =====
  /** Tipo de documento a redactar */
  doc_type: string | null
  /** Estructura del documento */
  doc_outline: DocOutline | null
  /** Información faltante */
  missing_info: MissingInfo | null
  /** Respuestas del usuario a preguntas */
  answers: Record<string, any>
  /** Secciones redactadas */
  draft_sections: Record<string, string>
  /** Documento final */
  final_document: string
  /** Resultado de auditoría */
  audit: AuditResult | null
  
  // ===== CONTROL =====
  /** Lista de tareas/progress */
  todo: TodoItem[]
  /** Últimas llamadas a herramientas */
  last_tool_calls: ToolCallRecord[]
  /** Errores encontrados */
  errors: string[]
  /** Payload de interrupción si aplica */
  interrupt_payload: InterruptPayload | null
  /** Complejidad detectada (1-5) */
  complexity: number
  /** Si necesita case_id */
  needs_case_id: boolean
  /** Contador de iteraciones para prevenir loops */
  iteration_count: number
}

// ============================================================================
// STATE DEFAULTS
// ============================================================================

export const DEFAULT_AGENT_STATE: Omit<AgentState, 'messages' | 'user_goal'> = {
  mode: "investigate",
  case_context: {},
  constraints: {
    tone: "formal",
    format: "markdown",
    language: "es"
  },
  research_plan: null,
  evidence: {
    chunks: [],
    graph_refs: [],
    web_refs: []
  },
  citations: [],
  doc_type: null,
  doc_outline: null,
  missing_info: null,
  answers: {},
  draft_sections: {},
  final_document: "",
  audit: null,
  todo: [],
  last_tool_calls: [],
  errors: [],
  interrupt_payload: null,
  complexity: 3,
  needs_case_id: false,
  iteration_count: 0
}

// ============================================================================
// STATE CHANNELS FOR LANGGRAPH
// ============================================================================

import { Annotation } from "@langchain/langgraph"

/**
 * State annotation for LangGraph
 * This defines how state fields are merged/updated between nodes
 * 
 * Using Annotation.Root<T>() pattern for LangGraph v1.x compatibility
 */
export const AgentStateAnnotation = Annotation.Root({
  // Messages are appended (not replaced)
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next]
  }),
  
  // Mode is replaced
  mode: Annotation<AgentMode>({
    default: () => "investigate",
    reducer: (_, next) => next
  }),
  
  // User goal is replaced
  user_goal: Annotation<string>({
    default: () => "",
    reducer: (_, next) => next
  }),
  
  // Case context is merged
  case_context: Annotation<CaseContext>({
    default: () => ({}),
    reducer: (prev, next) => ({ ...prev, ...next })
  }),
  
  // Constraints are merged
  constraints: Annotation<Constraints>({
    default: () => ({ tone: "formal", format: "markdown", language: "es" }),
    reducer: (prev, next) => ({ ...prev, ...next })
  }),
  
  // Research plan is replaced
  research_plan: Annotation<ResearchPlan | null>({
    default: () => null,
    reducer: (_, next) => next
  }),
  
  // Evidence is merged (accumulated)
  evidence: Annotation<Evidence>({
    default: () => ({ chunks: [], graph_refs: [], web_refs: [] }),
    reducer: (prev, next) => ({
      chunks: [...prev.chunks, ...next.chunks],
      graph_refs: [...prev.graph_refs, ...next.graph_refs],
      web_refs: [...prev.web_refs, ...next.web_refs]
    })
  }),
  
  // Citations are appended
  citations: Annotation<Citation[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next]
  }),
  
  // Doc type is replaced
  doc_type: Annotation<string | null>({
    default: () => null,
    reducer: (_, next) => next
  }),
  
  // Doc outline is replaced
  doc_outline: Annotation<DocOutline | null>({
    default: () => null,
    reducer: (_, next) => next
  }),
  
  // Missing info is replaced
  missing_info: Annotation<MissingInfo | null>({
    default: () => null,
    reducer: (_, next) => next
  }),
  
  // Answers are merged
  answers: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (prev, next) => ({ ...prev, ...next })
  }),
  
  // Draft sections are merged
  draft_sections: Annotation<Record<string, string>>({
    default: () => ({}),
    reducer: (prev, next) => ({ ...prev, ...next })
  }),
  
  // Final document is replaced
  final_document: Annotation<string>({
    default: () => "",
    reducer: (_, next) => next
  }),
  
  // Audit is replaced
  audit: Annotation<AuditResult | null>({
    default: () => null,
    reducer: (_, next) => next
  }),
  
  // Todo is replaced (UI updates)
  todo: Annotation<TodoItem[]>({
    default: () => [],
    reducer: (_, next) => next
  }),
  
  // Last tool calls are appended
  last_tool_calls: Annotation<ToolCallRecord[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next]
  }),
  
  // Errors are appended
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next]
  }),
  
  // Interrupt payload is replaced
  interrupt_payload: Annotation<InterruptPayload | null>({
    default: () => null,
    reducer: (_, next) => next
  }),
  
  // Complexity is replaced
  complexity: Annotation<number>({
    default: () => 3,
    reducer: (_, next) => next
  }),
  
  // Needs case id is replaced
  needs_case_id: Annotation<boolean>({
    default: () => false,
    reducer: (_, next) => next
  }),
  
  // Iteration count is incremented
  iteration_count: Annotation<number>({
    default: () => 0,
    reducer: (prev, next) => Math.max(prev, next) + 1
  })
})