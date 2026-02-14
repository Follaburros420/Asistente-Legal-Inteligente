/**
 * Protocolo de Streaming Estándar
 * 
 * Define los tipos de eventos y la máquina de estados para el streaming
 * de respuestas del chatbot legal.
 * 
 * @version 2.0.0
 */

import { BibliographyItem } from "@/types/chat-message"

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════

export type StreamEventType = 
  | "meta"
  | "status" 
  | "delta"
  | "citations"
  | "done"
  | "error"
  | "cancelled"

export type StreamPhase =
  | "idle"           // Sin actividad
  | "classifying"    // Analizando consulta e intención
  | "searching"      // Buscando fuentes legales
  | "drafting"       // Preparando respuesta
  | "streaming"      // Emitiendo tokens de respuesta
  | "completed"      // Stream finalizado exitosamente
  | "error"          // Error ocurrido
  | "cancelled"      // Cancelado por usuario

export type RenderMode = "chat" | "document"
export type IntentType = "chat_response" | "document_write" | "ambiguous" | "unknown"

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface StreamEventMeta {
  type: "meta"
  message_id: string
  render_mode: RenderMode
  intent: IntentType
  confidence: number
}

export interface StreamEventStatus {
  type: "status"
  phase: Exclude<StreamPhase, "idle" | "completed" | "error" | "cancelled">
  message: string
  progress?: number
}

export interface StreamEventDelta {
  type: "delta"
  text: string
}

export interface StreamEventCitations {
  type: "citations"
  items: BibliographyItem[]
}

export interface StreamEventDone {
  type: "done"
  ok: true
  metadata?: {
    model: string
    processingTime: string
    sourcesCount: number
  }
}

export interface StreamEventError {
  type: "error"
  message: string
  code?: string
  recoverable?: boolean
}

export interface StreamEventCancelled {
  type: "cancelled"
  reason?: string
}

export type StreamEvent =
  | StreamEventMeta
  | StreamEventStatus
  | StreamEventDelta
  | StreamEventCitations
  | StreamEventDone
  | StreamEventError
  | StreamEventCancelled

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADO DEL STREAM
// ═══════════════════════════════════════════════════════════════════════════════

export interface StreamState {
  /** Fase actual del stream */
  phase: StreamPhase
  
  /** ID del mensaje en proceso */
  messageId: string | null
  
  /** Buffer de texto acumulado */
  textBuffer: string
  
  /** Citas/bibliografía acumuladas */
  citations: BibliographyItem[]
  
  /** Modo de renderizado */
  renderMode: RenderMode
  
  /** Intención detectada */
  intent: IntentType
  
  /** Mensaje de status actual (para UI) */
  statusMessage: string
  
  /** Progreso 0-100 (opcional) */
  progress: number
  
  /** Error si existe */
  error: string | null
  
  /** Timestamp de inicio */
  startedAt: number | null
  
  /** Timestamp de finalización */
  completedAt: number | null
}

export const INITIAL_STREAM_STATE: StreamState = {
  phase: "idle",
  messageId: null,
  textBuffer: "",
  citations: [],
  renderMode: "chat",
  intent: "unknown",
  statusMessage: "",
  progress: 0,
  error: null,
  startedAt: null,
  completedAt: null
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÁQUINA DE ESTADOS - TRANSICIONES VÁLIDAS
// ═══════════════════════════════════════════════════════════════════════════════

export const VALID_PHASE_TRANSITIONS: Record<StreamPhase, StreamPhase[]> = {
  idle: ["classifying", "error"],
  classifying: ["searching", "drafting", "streaming", "error", "cancelled"],
  searching: ["drafting", "streaming", "error", "cancelled"],
  drafting: ["streaming", "error", "cancelled"],
  streaming: ["completed", "error", "cancelled"],
  completed: ["idle"],
  error: ["idle"],
  cancelled: ["idle"]
}

/**
 * Valida si una transición de fase es válida
 */
export function isValidPhaseTransition(from: StreamPhase, to: StreamPhase): boolean {
  if (from === to) return true
  return VALID_PHASE_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Obtiene la fase correspondiente a un evento
 */
export function mapEventToPhase(event: StreamEvent): StreamPhase {
  switch (event.type) {
    case "meta":
      return "classifying"
    case "status":
      return event.phase
    case "delta":
      return "streaming"
    case "citations":
      // Las citas pueden llegar en cualquier fase, mantener la actual
      return "streaming"
    case "done":
      return "completed"
    case "error":
      return "error"
    case "cancelled":
      return "cancelled"
    default:
      return "idle"
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENSAJES DE STATUS POR FASE
// ═══════════════════════════════════════════════════════════════════════════════

export const PHASE_STATUS_MESSAGES: Record<Exclude<StreamPhase, "idle" | "completed" | "error" | "cancelled">, string[]> = {
  classifying: [
    "Analizando tu consulta legal…",
    "Identificando el tipo de solicitud…",
    "Evaluando el alcance de tu consulta…"
  ],
  searching: [
    "Investigando normas oficiales…",
    "Contrastando jurisprudencia aplicable…",
    "Verificando texto literal de artículos…",
    "Explorando fuentes complementarias…"
  ],
  drafting: [
    "Sintetizando hallazgos…",
    "Preparando respuesta estructurada…",
    "Organizando fundamentos legales…"
  ],
  streaming: [
    "Redactando respuesta…",
    "Generando contenido…",
    "Finalizando respuesta…"
  ]
}

/**
 * Obtiene un mensaje de status aleatorio para una fase
 */
export function getStatusMessageForPhase(phase: StreamPhase, customMessage?: string): string {
  if (customMessage) return customMessage
  
  const messages = PHASE_STATUS_MESSAGES[phase as keyof typeof PHASE_STATUS_MESSAGES]
  if (!messages || messages.length === 0) return "Procesando…"
  
  return messages[Math.floor(Math.random() * messages.length)]
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER DE EVENTOS SSE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parsea una línea de evento SSE (Server-Sent Events)
 * Soporta dos formatos:
 * 1. JSON Lines: `{ "type": "...", ... }\n`
 * 2. SSE estándar: `event: type\ndata: { ... }\n\n`
 */
export function parseStreamEvent(line: string): StreamEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Intentar parsear como JSON directo (JSON Lines)
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (isValidStreamEvent(parsed)) {
        return parsed as StreamEvent
      }
    } catch {
      // No es JSON válido, continuar con otros formatos
    }
  }

  // Intentar parsear como SSE estándar
  if (trimmed.startsWith("event:")) {
    const lines = trimmed.split("\n")
    let eventType: string | null = null
    let eventData: string | null = null

    for (const l of lines) {
      if (l.startsWith("event:")) {
        eventType = l.slice(6).trim()
      } else if (l.startsWith("data:")) {
        eventData = l.slice(5).trim()
      }
    }

    if (eventType && eventData) {
      try {
        const parsed = JSON.parse(eventData)
        parsed.type = eventType
        if (isValidStreamEvent(parsed)) {
          return parsed as StreamEvent
        }
      } catch {
        // Ignorar errores de parseo
      }
    }
  }

  return null
}

/**
 * Type guard para validar eventos de stream
 */
export function isValidStreamEvent(event: unknown): event is StreamEvent {
  if (!event || typeof event !== "object") return false
  
  const e = event as Record<string, unknown>
  if (!e.type || typeof e.type !== "string") return false
  
  const validTypes: StreamEventType[] = ["meta", "status", "delta", "citations", "done", "error", "cancelled"]
  return validTypes.includes(e.type as StreamEventType)
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER DE DEBUG
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = process.env.NODE_ENV === "development"

export function logStreamEvent(direction: "TX" | "RX", event: StreamEvent, extra?: Record<string, unknown>) {
  if (!DEBUG) return
  
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0]
  const arrow = direction === "TX" ? "→" : "←"
  const color = direction === "TX" ? "#4ade80" : "#60a5fa"
  
  console.log(
    `%c[${timestamp}] ${arrow} ${event.type.toUpperCase()}`,
    `color: ${color}; font-weight: bold`,
    { ...event, ...extra }
  )
}

export function logStreamError(message: string, error: unknown) {
  if (!DEBUG) return
  
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0]
  console.error(
    `%c[${timestamp}] ✖ ERROR`,
    "color: #f87171; font-weight: bold",
    message,
    error
  )
}
