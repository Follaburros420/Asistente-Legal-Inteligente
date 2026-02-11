/**
 * Prompts Module - Exports centralizados
 * Sistema Legal Core v3.0
 */

export {
  // Configuración
  ALI_CONFIG,
  
  // Prompt principal
  LEGAL_CORE_SYSTEM_PROMPT as SYSTEM_PROMPT,
  
  // Funciones de análisis y construcción
  buildSystemMessage,
  analyzeQuery,
  getComplexityInstructions,
  requiresSearch,
  getQueryMetadata,
  
  // Tipos
  type QueryComplexity,
  type QueryAnalysis,
  type SystemMessageConfig
} from './legal-core'

// Prompts especializados
export { SPECIALIZED_PROMPTS } from './legal-core'
