/**
 * Archivo de compatibilidad - Redirige al nuevo Legal Search Toolkit
 * 
 * Este archivo mantiene compatibilidad con imports antiguos.
 * Todo el código nuevo debe importar desde 'legal-search-toolkit'
 * 
 * @deprecated Use legal-search-toolkit.ts instead
 */

// Re-exportar todo desde el nuevo archivo
export {
  // Funciones principales
  searchLegalColombia,
  searchJurisprudencia,
  searchArticuloLey,
  formatSearchResultsForLLM,
  checkSerperConfig,
  
  // Toolkit
  LEGAL_TOOLS_DEFINITIONS,
  executeTool,
  
  // Types
  type SerperSearchResult,
  type SerperResponse,
  type LegalSearchResult
} from './legal-search-toolkit'

// Mantener compatibilidad con nombre antiguo
export { LEGAL_TOOLS_DEFINITIONS as LEGAL_TOOLS } from './legal-search-toolkit'

// Type alias para compatibilidad
export type Tool = {
  name: string
  description: string
  parameters: Record<string, any>
}
