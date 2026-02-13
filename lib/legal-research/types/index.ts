/**
 * Tipos para el sistema de investigación legal refactorizado
 */

export interface ResearchContext {
  userId: string
  chatId: string
  messageId: string
  previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
  modelId: string
  temperature: number
}

export interface ResearchProgress {
  phase: ResearchPhase
  progress: number // 0-100
  message: string
  detail?: string // Información adicional específica
}

export type ResearchPhase = 
  | 'analyzing'      // Analizando la consulta
  | 'planning'       // Planificando investigación
  | 'searching'      // Buscando fuentes
  | 'synthesizing'   // Sintetizando respuesta
  | 'validating'     // Validando calidad
  | 'completed'      // Completado
  | 'error'          // Error

export interface QueryAnalysis {
  intent: 'article_lookup' | 'norm_query' | 'jurisprudence' | 'case_analysis' | 'general' | 'document_draft'
  legalArea?: string
  entities: LegalEntity[]
  complexity: 'low' | 'medium' | 'high'
  requiresJurisprudence: boolean
  requiresDoctrinal: boolean
  keywords: string[]
  suggestedSearches: string[]
}

export interface LegalEntity {
  type: 'article' | 'law' | 'code' | 'court' | 'legal_concept' | 'procedure'
  value: string
  normalized: string
}

export interface SearchPlan {
  primarySearches: SearchTask[]
  secondarySearches?: SearchTask[]
  jurisprudenceSearches?: SearchTask[]
  parallel: boolean
  maxTotalTime: number
}

export interface SearchTask {
  id: string
  type: 'official' | 'jurisprudence' | 'article' | 'academic'
  query: string
  priority: number
  timeout: number
}

export interface SearchResult {
  taskId: string
  success: boolean
  source: string
  results: LegalSource[]
  error?: string
  executionTime: number
}

export interface LegalSource {
  title: string
  url: string
  snippet: string
  sourceType: 'official' | 'jurisprudence' | 'academic' | 'general'
  authority?: string // Ej: "Corte Constitucional", "Senado"
  date?: string
  relevance: number
}

export interface SynthesisResult {
  thesis: string
  legalFramework: LegalFramework[]
  analysis: string
  conclusion: string
  sources: LegalSource[]
  confidence: number
}

export interface LegalFramework {
  type: 'constitution' | 'law' | 'decree' | 'jurisprudence' | 'doctrine'
  citation: string
  text: string
  article?: string
  law?: string
}

export interface ResearchResult {
  success: boolean
  response: string
  structuredResponse: SynthesisResult
  sources: LegalSource[]
  metadata: {
    executionTime: number
    searchesPerformed: number
    phase: ResearchPhase
    modelUsed: string
  }
  error?: string
}

export type ProgressCallback = (progress: ResearchProgress) => void
export type TokenCallback = (token: string) => void
