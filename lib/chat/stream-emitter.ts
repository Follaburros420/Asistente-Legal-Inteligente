/**
 * Emisor de Eventos del Stream
 * 
 * Implementa el protocolo v2 de streaming.
 * Convierte eventos internos a formato SSE (Server-Sent Events).
 */

import { StreamEmitter, Citation } from "./types"
import {
  StreamEvent,
  StreamEventMeta,
  StreamEventStatus,
  StreamEventDelta,
  StreamEventCitations,
  StreamEventDone,
  StreamEventError,
  StreamEventCancelled
} from "@/lib/stream-protocol"

export interface SSEController {
  enqueue(data: Uint8Array): void
  close(): void
  error(error: Error): void
}

export function createStreamEmitter(controller: SSEController): StreamEmitter {
  const encoder = new TextEncoder()
  
  // Helper para enviar evento SSE
  const sendEvent = (event: StreamEvent) => {
    const data = JSON.stringify(event)
    const sse = `event: ${event.type}\ndata: ${data}\n\n`
    controller.enqueue(encoder.encode(sse))
  }
  
  return {
    emit(event: StreamEvent) {
      sendEvent(event)
    },
    
    emitMeta(messageId: string, intent: string, renderMode: "chat" | "document") {
      const event: StreamEventMeta = {
        type: "meta",
        message_id: messageId,
        intent: intent as any,
        render_mode: renderMode,
        confidence: 1.0
      }
      sendEvent(event)
    },
    
    emitStatus(phase: "classifying" | "searching" | "drafting" | "streaming", message: string) {
      const event: StreamEventStatus = {
        type: "status",
        phase,
        message
      }
      sendEvent(event)
    },
    
    emitDelta(text: string) {
      const event: StreamEventDelta = {
        type: "delta",
        text
      }
      sendEvent(event)
    },
    
    emitCitations(items: Citation[]) {
      const event: StreamEventCitations = {
        type: "citations",
        items: items.map(c => ({
          title: c.title,
          url: c.url,
          snippet: c.snippet,
          source: c.source
        }))
      }
      sendEvent(event)
    },
    
    emitDone(metadata?: Record<string, unknown>) {
      const event: StreamEventDone = {
        type: "done",
        ok: true,
        metadata: metadata as any
      }
      sendEvent(event)
      controller.close()
    },
    
    emitError(message: string, code?: string) {
      const event: StreamEventError = {
        type: "error",
        message,
        code,
        recoverable: code === "RATE_LIMIT" || code === "TIMEOUT"
      }
      sendEvent(event)
      controller.close()
    },
    
    emitCancelled(reason?: string) {
      const event: StreamEventCancelled = {
        type: "cancelled",
        reason
      }
      sendEvent(event)
      controller.close()
    }
  }
}

/**
 * Crea un emitter que solo loguea (útil para debugging)
 */
export function createLoggingEmitter(requestId: string): StreamEmitter {
  return {
    emit(event: StreamEvent) {
      console.log(`[${requestId}] 📤 ${event.type}:`, event)
    },
    emitMeta(messageId: string, intent: string, renderMode: "chat" | "document") {
      console.log(`[${requestId}] 📤 meta:`, { messageId, intent, renderMode })
    },
    emitStatus(phase: string, message: string) {
      console.log(`[${requestId}] 📤 status:`, { phase, message })
    },
    emitDelta(text: string) {
      console.log(`[${requestId}] 📤 delta:`, text.slice(0, 50) + (text.length > 50 ? "..." : ""))
    },
    emitCitations(items: Citation[]) {
      console.log(`[${requestId}] 📤 citations:`, items.length, "items")
    },
    emitDone(metadata?: Record<string, unknown>) {
      console.log(`[${requestId}] 📤 done:`, metadata)
    },
    emitError(message: string, code?: string) {
      console.error(`[${requestId}] 📤 error:`, { message, code })
    },
    emitCancelled(reason?: string) {
      console.log(`[${requestId}] 📤 cancelled:`, reason)
    }
  }
}
