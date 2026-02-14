"use client"

/**
 * Hook useStreamState
 * 
 * Máquina de estados para gestionar el streaming de mensajes.
 * Reemplaza las heurísticas booleanas (firstTokenReceived, isGenerating)
 * con un estado explícito y predecible.
 */

import { useReducer, useCallback, useRef, useEffect } from "react"
import {
  StreamState,
  StreamPhase,
  StreamEvent,
  INITIAL_STREAM_STATE,
  isValidPhaseTransition,
  mapEventToPhase,
  getStatusMessageForPhase,
  logStreamEvent,
  logStreamError
} from "@/lib/stream-protocol"

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DE ACCIONES
// ═══════════════════════════════════════════════════════════════════════════════

type StreamAction =
  | { type: "START_STREAM"; messageId: string }
  | { type: "PROCESS_EVENT"; event: StreamEvent }
  | { type: "TRANSITION_PHASE"; phase: StreamPhase; message?: string }
  | { type: "APPEND_TEXT"; text: string }
  | { type: "SET_CITATIONS"; citations: StreamState["citations"] }
  | { type: "SET_ERROR"; error: string }
  | { type: "CANCEL" }
  | { type: "RESET" }
  | { type: "SET_STATUS_MESSAGE"; message: string }
  | { type: "SET_PROGRESS"; progress: number }

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════════════════

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case "START_STREAM":
      return {
        ...INITIAL_STREAM_STATE,
        phase: "classifying",
        messageId: action.messageId,
        startedAt: Date.now(),
        statusMessage: getStatusMessageForPhase("classifying")
      }

    case "PROCESS_EVENT": {
      const { event } = action
      const newPhase = mapEventToPhase(event)
      
      // Validar transición
      if (!isValidPhaseTransition(state.phase, newPhase)) {
        logStreamError(
          `Transición de fase inválida: ${state.phase} → ${newPhase}`,
          { event, currentState: state }
        )
        return state
      }

      // Procesar según tipo de evento
      switch (event.type) {
        case "meta":
          return {
            ...state,
            phase: "classifying",
            messageId: event.message_id,
            renderMode: event.render_mode,
            intent: event.intent,
            statusMessage: getStatusMessageForPhase("classifying")
          }

        case "status":
          return {
            ...state,
            phase: event.phase,
            statusMessage: event.message || getStatusMessageForPhase(event.phase),
            progress: event.progress ?? state.progress
          }

        case "delta":
          return {
            ...state,
            phase: "streaming",
            textBuffer: state.textBuffer + event.text,
            statusMessage: getStatusMessageForPhase("streaming", state.statusMessage)
          }

        case "citations":
          return {
            ...state,
            citations: [...state.citations, ...event.items]
          }

        case "done":
          return {
            ...state,
            phase: "completed",
            completedAt: Date.now(),
            statusMessage: "Respuesta completa",
            progress: 100
          }

        case "error":
          return {
            ...state,
            phase: "error",
            error: event.message,
            statusMessage: `Error: ${event.message}`,
            completedAt: Date.now()
          }

        case "cancelled":
          return {
            ...state,
            phase: "cancelled",
            statusMessage: "Cancelado por usuario",
            completedAt: Date.now()
          }

        default:
          return state
      }
    }

    case "TRANSITION_PHASE":
      if (!isValidPhaseTransition(state.phase, action.phase)) {
        return state
      }
      return {
        ...state,
        phase: action.phase,
        statusMessage: action.message || getStatusMessageForPhase(action.phase)
      }

    case "APPEND_TEXT":
      return {
        ...state,
        textBuffer: state.textBuffer + action.text
      }

    case "SET_CITATIONS":
      return {
        ...state,
        citations: action.citations
      }

    case "SET_ERROR":
      return {
        ...state,
        phase: "error",
        error: action.error,
        completedAt: Date.now()
      }

    case "CANCEL":
      return {
        ...state,
        phase: "cancelled",
        completedAt: Date.now()
      }

    case "RESET":
      return INITIAL_STREAM_STATE

    case "SET_STATUS_MESSAGE":
      return {
        ...state,
        statusMessage: action.message
      }

    case "SET_PROGRESS":
      return {
        ...state,
        progress: Math.max(0, Math.min(100, action.progress))
      }

    default:
      return state
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseStreamStateReturn {
  /** Estado actual del stream */
  state: StreamState
  
  /** Iniciar un nuevo stream */
  startStream: (messageId: string) => void
  
  /** Procesar un evento del stream */
  processEvent: (event: StreamEvent) => void
  
  /** Transicionar a una fase específica */
  transitionPhase: (phase: StreamPhase, message?: string) => void
  
  /** Agregar texto al buffer */
  appendText: (text: string) => void
  
  /** Establecer citas */
  setCitations: (citations: StreamState["citations"]) => void
  
  /** Marcar como error */
  setError: (error: string) => void
  
  /** Cancelar el stream */
  cancel: () => void
  
  /** Resetear el estado */
  reset: () => void
  
  /** Actualizar mensaje de status */
  setStatusMessage: (message: string) => void
  
  /** Actualizar progreso */
  setProgress: (progress: number) => void
  
  /** Si el stream está activo (no idle, completed, error, cancelled) */
  isActive: boolean
  
  /** Si el stream está completado */
  isCompleted: boolean
  
  /** Si el stream está en error */
  isError: boolean
  
  /** Si el stream fue cancelado */
  isCancelled: boolean
  
  /** Si se debe mostrar el thinking indicator */
  shouldShowThinking: boolean
  
  /** Si se deben mostrar las citas */
  shouldShowCitations: boolean
}

export function useStreamState(): UseStreamStateReturn {
  const [state, dispatch] = useReducer(streamReducer, INITIAL_STREAM_STATE)
  
  // Ref para tracking de eventos en desarrollo
  const eventCountRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)

  // Log en desarrollo cuando cambia la fase
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[StreamState] Fase: ${state.phase} | Mensaje: ${state.statusMessage}`)
    }
  }, [state.phase, state.statusMessage])

  const startStream = useCallback((messageId: string) => {
    eventCountRef.current = 0
    startTimeRef.current = Date.now()
    dispatch({ type: "START_STREAM", messageId })
  }, [])

  const processEvent = useCallback((event: StreamEvent) => {
    eventCountRef.current++
    logStreamEvent("RX", event, { 
      eventCount: eventCountRef.current,
      elapsedMs: startTimeRef.current ? Date.now() - startTimeRef.current : 0
    })
    dispatch({ type: "PROCESS_EVENT", event })
  }, [])

  const transitionPhase = useCallback((phase: StreamPhase, message?: string) => {
    dispatch({ type: "TRANSITION_PHASE", phase, message })
  }, [])

  const appendText = useCallback((text: string) => {
    dispatch({ type: "APPEND_TEXT", text })
  }, [])

  const setCitations = useCallback((citations: StreamState["citations"]) => {
    dispatch({ type: "SET_CITATIONS", citations })
  }, [])

  const setError = useCallback((error: string) => {
    dispatch({ type: "SET_ERROR", error })
  }, [])

  const cancel = useCallback(() => {
    dispatch({ type: "CANCEL" })
  }, [])

  const reset = useCallback(() => {
    eventCountRef.current = 0
    startTimeRef.current = null
    dispatch({ type: "RESET" })
  }, [])

  const setStatusMessage = useCallback((message: string) => {
    dispatch({ type: "SET_STATUS_MESSAGE", message })
  }, [])

  const setProgress = useCallback((progress: number) => {
    dispatch({ type: "SET_PROGRESS", progress })
  }, [])

  // Computed values
  const isActive = state.phase !== "idle" && 
                   state.phase !== "completed" && 
                   state.phase !== "error" && 
                   state.phase !== "cancelled"
  
  const isCompleted = state.phase === "completed"
  const isError = state.phase === "error"
  const isCancelled = state.phase === "cancelled"
  
  // Thinking indicator: visible durante todas las fases activas excepto completed/error/cancelled
  const shouldShowThinking = isActive && state.phase !== "streaming"
  
  // Citas: solo visibles cuando el stream está completado
  const shouldShowCitations = state.phase === "completed" && state.citations.length > 0

  return {
    state,
    startStream,
    processEvent,
    transitionPhase,
    appendText,
    setCitations,
    setError,
    cancel,
    reset,
    setStatusMessage,
    setProgress,
    isActive,
    isCompleted,
    isError,
    isCancelled,
    shouldShowThinking,
    shouldShowCitations
  }
}

export default useStreamState
