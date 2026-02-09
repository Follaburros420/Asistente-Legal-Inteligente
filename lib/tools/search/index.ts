/**
 * Exportaciones centrales del sistema de búsqueda
 * 
 * Sistema de Búsqueda Legal - v2.0
 * - Única herramienta: Serper
 * - Modelos: Gemini 3 Pro (complejas) + GPT-5 Mini (simples)
 */

// Búsqueda Serper (NUEVA IMPLEMENTACIÓN PRINCIPAL)
export {
  searchLegalColombia,
  searchJurisprudencia,
  searchArticuloLey,
  formatSearchResultsForLLM,
  checkSerperConfig,
  type SerperSearchResult,
  type SerperResponse,
  type LegalSearchResult as SerperLegalResult
} from './serper-legal-search'

// Búsqueda especializada (COMPATIBILIDAD)
export {
  searchLegalSpecialized,
  enrichLegalResults,
  type LegalSearchResult,
  type LegalSearchResponse
} from '../legal/legal-search-specialized'

// Toolkit legal (HERRAMIENTAS PARA LANGCHAIN)
export {
  LEGAL_TOOLS_DEFINITIONS,
  executeTool,
  searchLegalColombia as serperSearch,
  searchJurisprudencia as serperJurisprudencia,
  searchArticuloLey as serperArticulo
} from '../legal/legal-search-toolkit'
