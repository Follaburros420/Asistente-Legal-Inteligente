/**
 * LangChain Integration - Índice Principal
 * 
 * Sistema de agentes con LangChain para el Asistente Legal Inteligente.
 * 
 * Arquitectura:
 * ├── config/
 * │   ├── models.ts    - Configuración de modelos LLM
 * │   └── prompts.ts   - Prompts del sistema
 * ├── tools/
 * │   ├── search-tools.ts   - Herramientas de búsqueda
 * │   ├── content-tools.ts  - Herramientas de contenido
 * │   └── index.ts          - Exportaciones de tools
 * └── agents/
 *     ├── legal-agent.ts    - Agente legal principal
 *     └── index.ts          - Exportaciones de agentes
 * 
 * Uso básico:
 * ```typescript
 * import { LegalAgent } from '@/lib/langchain'
 * 
 * const agent = await LegalAgent.create({
 *   modelId: 'deepseek/deepseek-v3.2'
 * })
 * 
 * const response = await agent.invoke({
 *   input: '¿Cuáles son los requisitos de la prescripción adquisitiva?'
 * })
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createModel,
  modelSupportsTools,
  getModelConfig,
  getToolCapableModels,
  MODEL_REGISTRY,
  RESEARCH_MODELS,
  type ModelConfig,
  type ModelId,
  type CreateModelOptions
} from "./config/models"

export {
  LEGAL_AGENT_SYSTEM_PROMPT
} from "./config/prompts"

// ═══════════════════════════════════════════════════════════════════════════════
// HERRAMIENTAS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  ALL_TOOLS,
  TOOL_CATEGORIES,
  getToolsByNames,
  getToolsInfo,
  getToolByName,
  // Search tools
  searchTools,
  searchLegalOfficialTool,
  searchLegalAcademicTool,
  searchGeneralWebTool,
  // Content tools
  contentTools,
  extractWebContentTool,
  verifySourcesTool,
  // Types
  type SearchResult
} from "./tools"

// ═══════════════════════════════════════════════════════════════════════════════
// AGENTES
// ═══════════════════════════════════════════════════════════════════════════════

export {
  LegalAgent,
  createDefaultLegalAgent,
  convertToLangChainMessages,
  type AgentConfig,
  type AgentInput,
  type AgentResponse,
  type ConversationMessage
} from "./agents"

// ═══════════════════════════════════════════════════════════════════════════════
// VERSIÓN
// ═══════════════════════════════════════════════════════════════════════════════

export const LANGCHAIN_INTEGRATION_VERSION = '1.0.0'

