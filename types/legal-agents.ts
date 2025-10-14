/**
 * Sistema de Agentes Legales con Sequential Thinking
 * Basado en mejores prácticas de LegalTech y cumplimiento NIST AI RMF + ISO 27001
 */

// ═══════════════════════════════════════════════
// STEP 1: PLANNER - Schemas
// ═══════════════════════════════════════════════

export interface RequiredSource {
  tipo: "NORMA" | "SENTENCIA" | "DOCTRINA"
  query: string
  prefer: "SUIN" | "CC" | "CSJ" | "CE"
}

export interface Claim {
  id: string
  texto: string
  jurisdiccion: "CO"
  required_sources: RequiredSource[]
  status: "PENDING" | "SUPPORTED" | "UNSUPPORTED"
  riesgos: Array<"confidencialidad" | "conflicto_normativo" | "ninguno">
  fuentes?: FuenteOficial[] // Poblado por Retriever
}

export interface OutlineSection {
  h2: string
  h3?: string[]
}

export interface PlannerOutput {
  objetivo: string
  audiencia: string
  outline: OutlineSection[]
  claims: Claim[]
  style_rules: {
    tono: string
    longitud: string
  }
  risk_checks: Array<"PII" | "confidencialidad" | "exactitud_citas">
}

// ═══════════════════════════════════════════════
// STEP 2: RETRIEVER - Fuentes Oficiales
// ═══════════════════════════════════════════════

export interface FuenteOficial {
  id: string
  tipo: "NORMA" | "SENTENCIA" | "DOCTRINA"
  corporacion?: "Corte Constitucional" | "Corte Suprema de Justicia" | "Consejo de Estado"
  numero?: string
  fecha: string
  texto: string
  url: string
  sala?: string
  magistrado_ponente?: string
}

export interface RetrieverResult {
  claim_id: string
  status: "SUPPORTED" | "UNSUPPORTED"
  fuentes: FuenteOficial[]
  pii_redacted: boolean
  redaction_report?: any
}

// ═══════════════════════════════════════════════
// STEP 3: DRAFTER - Redacción
// ═══════════════════════════════════════════════

export interface DrafterOutput {
  texto_completo: string
  secciones: Array<{
    titulo: string
    contenido: string
    citas_usadas: string[] // IDs de fuentes
  }>
  claims_excluidos: string[] // Claims sin fuente
}

// ═══════════════════════════════════════════════
// STEP 4: VERIFIER - Guardrails y Evaluación
// ═══════════════════════════════════════════════

export interface GuardrailCheck {
  regla: string
  passed: boolean
  detalles?: string
}

export interface RAGEvaluation {
  faithfulness: number // 0-1
  context_relevance: number // 0-1
  answer_relevance: number // 0-1
}

export interface VerifierOutput {
  guardrails: GuardrailCheck[]
  eval_rag: RAGEvaluation
  aprobado: boolean
  observaciones: string[]
}

// ═══════════════════════════════════════════════
// STEP 5: FINALIZER - Trazabilidad
// ═══════════════════════════════════════════════

export interface FuenteTrazable {
  id: string
  url: string
  tipo: "NORMA" | "SENTENCIA" | "DOCTRINA"
  corporacion?: string
  fecha: string
  hash?: string
}

export interface Trazabilidad {
  prompts_version: string
  modelo: string
  timestamp: string
  hash_evidencias: string[]
  fuentes: FuenteTrazable[]
  eval: RAGEvaluation
  logs: string[]
  nist_compliance: {
    govern: boolean
    map: boolean
    measure: boolean
    manage: boolean
  }
  iso27001_controls: {
    access_control: boolean
    logging: boolean
    retention: boolean
  }
}

export interface FinalizerOutput {
  trazabilidad: Trazabilidad
  status: "COMPLETO" | "INCOMPLETO"
  faltantes?: string[]
}

// ═══════════════════════════════════════════════
// Sistema Completo
// ═══════════════════════════════════════════════

export interface LegalAgentRequest {
  objetivo: string
  audiencia: string
  jurisdiccion: "CO"
  tema: string
  restricciones?: string[]
}

export interface LegalAgentResponse {
  planner: PlannerOutput
  retriever: RetrieverResult[]
  drafter: DrafterOutput
  verifier: VerifierOutput
  finalizer: FinalizerOutput
  texto_final: string
}

// ═══════════════════════════════════════════════
// Herramientas (Tool Calling)
// ═══════════════════════════════════════════════

export interface ToolCall {
  name: string
  parameters: Record<string, any>
}

export type LegalTool =
  | "fetch_norma_suin"
  | "fetch_juris_cc"
  | "fetch_juris_csj"
  | "fetch_juris_ce"
  | "consulta_procesos"
  | "pii_redact"
  | "log_trace"
  | "eval_rag"








