/**
 * Tipos del Core del Chat - Orquestador Thin
 * 
 * Contratos de datos puros, sin dependencias de frameworks.
 */

import { StreamEvent } from "@/lib/stream-protocol"

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatConfig {
  model: string
  temperature: number
  maxTokens: number
  maxToolIterations: number
  toolTimeoutMs: number
  llmTimeoutMs: number
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  model: "openai/gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 4000,
  maxToolIterations: 5,
  toolTimeoutMs: 15000,
  llmTimeoutMs: 60000
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENSAJES
// ═══════════════════════════════════════════════════════════════════════════════

export type MessageRole = "system" | "user" | "assistant" | "tool"

export interface ChatMessage {
  role: MessageRole
  content: string
  name?: string  // Para mensajes de tool
  tool_calls?: ToolCall[]  // Para assistant que llama tools
  tool_call_id?: string  // Para respuestas de tool
}

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string  // JSON string
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export interface ToolResult {
  toolCallId: string
  name: string
  output: string
  error?: string
  executionTimeMs: number
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<string>

// ═══════════════════════════════════════════════════════════════════════════════
// CLASIFICACIÓN DE INTENCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

export type IntentType = "chat_response" | "document_write" | "ambiguous"
export type RenderMode = "chat" | "document"

export interface IntentClassification {
  intent: IntentType
  confidence: number
  docType?: string
  reason: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADO DEL ORQUESTADOR
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrchestratorState {
  requestId: string
  messageId: string
  userQuery: string
  intent: IntentClassification
  renderMode: RenderMode
  messages: ChatMessage[]
  toolExecutions: ToolExecution[]
  startTime: number
  abortSignal: AbortSignal
}

export interface ToolExecution {
  iteration: number
  toolCalls: ToolCall[]
  results: ToolResult[]
  startTime: number
  endTime: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMISOR DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface StreamEmitter {
  emit(event: StreamEvent): void
  emitMeta(messageId: string, intent: IntentType, renderMode: RenderMode): void
  emitStatus(phase: "classifying" | "searching" | "drafting" | "streaming", message: string): void
  emitDelta(text: string): void
  emitCitations(items: Citation[]): void
  emitDone(metadata?: Record<string, unknown>): void
  emitError(message: string, code?: string): void
  emitCancelled(reason?: string): void
}

export interface Citation {
  title: string
  url: string
  snippet?: string
  source?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTADO
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatResult {
  text: string
  citations: Citation[]
  toolExecutions: ToolExecution[]
  modelUsed: string
  processingTimeMs: number
  tokenCount?: {
    prompt: number
    completion: number
    total: number
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORES
// ═══════════════════════════════════════════════════════════════════════════════

export class ChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false,
    public metadata?: Record<string, unknown>
  ) {
    super(message)
    this.name = "ChatError"
  }
}

export class TimeoutError extends ChatError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      "TIMEOUT",
      false,
      { operation, timeoutMs }
    )
    this.name = "TimeoutError"
  }
}

export class CancelledError extends ChatError {
  constructor(reason?: string) {
    super(reason || "Request cancelled by user", "CANCELLED", true)
    this.name = "CancelledError"
  }
}
