/**
 * Índice de Agentes
 *
 * Exporta los agentes disponibles del sistema.
 */

export {
  LegalAgent,
  createSmartLegalAgent as createDefaultLegalAgent, // Alias para compatibilidad
  convertToLangChainMessages,
  type AgentConfig,
  type AgentInput,
  type AgentResponse,
  type ConversationMessage
} from "./legal-agent"

