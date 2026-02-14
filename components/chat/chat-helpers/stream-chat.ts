/**
 * Chat Streaming Real - Protocolo v3
 * 
 * Usa /api/chat/stream con:
 * - Streaming real (no fake)
 * - Eventos del protocolo v2
 * - Cancelación end-to-end
 */

import { ChatMessage } from "@/types"
import { BibliographyItem } from "@/types/chat-message"
import { StreamEvent, parseStreamEvent, isValidStreamEvent } from "@/lib/stream-protocol"
import { toast } from "sonner"

export interface StreamCallbacks {
  onMeta?: (messageId: string, intent: string, renderMode: "chat" | "document") => void
  onStatus?: (phase: string, message: string) => void
  onDelta?: (text: string) => void
  onCitations?: (items: BibliographyItem[]) => void
  onDone?: (metadata?: Record<string, unknown>) => void
  onError?: (message: string, code?: string) => void
  onCancelled?: (reason?: string) => void
}

export interface StreamChatResult {
  text: string
  citations: BibliographyItem[]
  cancelled: boolean
  error?: string
}

export async function streamChat(
  message: string,
  history: Array<{ role: string; content: string }>,
  config: {
    model?: string
    temperature?: number
    maxTokens?: number
  },
  abortController: AbortController,
  callbacks: StreamCallbacks
): Promise<StreamChatResult> {
  console.log("[streamChat] 🚀 Starting stream...")
  
  let fullText = ""
  let citations: BibliographyItem[] = []
  let cancelled = false
  let error: string | undefined
  
  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        history,
        config: {
          model: config.model || "openai/gpt-4o-mini",
          temperature: config.temperature ?? 0.3,
          maxTokens: config.maxTokens ?? 4000
        }
      }),
      signal: abortController.signal
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }
    
    if (!response.body) {
      throw new Error("No response body")
    }
    
    // Leer el stream SSE
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        console.log("[streamChat] ✅ Stream completed")
        break
      }
      
      // Decodificar chunk
      buffer += decoder.decode(value, { stream: true })
      
      // Procesar eventos SSE completos (separados por \n\n)
      const events = buffer.split("\n\n")
      buffer = events.pop() || ""  // Mantener el último incompleto
      
      for (const eventText of events) {
        if (!eventText.trim()) continue
        
        const event = parseSSEEvent(eventText)
        if (!event) continue
        
        console.log("[streamChat] 📥 Event:", event.type)
        
        switch (event.type) {
          case "meta":
            callbacks.onMeta?.(
              (event as any).message_id,
              (event as any).intent,
              (event as any).render_mode
            )
            break
            
          case "status":
            callbacks.onStatus?.(
              (event as any).phase,
              (event as any).message
            )
            break
            
          case "delta":
            fullText += event.text
            callbacks.onDelta?.(event.text)
            break
            
          case "citations":
            const items = (event as any).items || []
            citations = items.map((item: any) => ({
              id: item.url || Math.random().toString(),
              title: item.title || "Fuente legal",
              url: item.url,
              type: item.source || "legal"
            }))
            callbacks.onCitations?.(citations)
            break
            
          case "done":
            callbacks.onDone?.((event as any).metadata)
            break
            
          case "error":
            error = (event as any).message
            callbacks.onError?.(error, (event as any).code)
            break
            
          case "cancelled":
            cancelled = true
            callbacks.onCancelled?.((event as any).reason)
            break
        }
      }
    }
    
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("[streamChat] 🛑 Cancelled by user")
      cancelled = true
    } else {
      console.error("[streamChat] ❌ Error:", err)
      error = err.message || "Stream error"
      callbacks.onError?.(error)
      toast.error(error)
    }
  }
  
  return {
    text: fullText,
    citations,
    cancelled,
    error
  }
}

function parseSSEEvent(text: string): StreamEvent | null {
  const lines = text.split("\n")
  let eventType: string | null = null
  let eventData: string | null = null
  
  for (const line of lines) {
    if (line.startsWith("event: ")) {
      eventType = line.slice(7).trim()
    } else if (line.startsWith("data: ")) {
      eventData = line.slice(6).trim()
    }
  }
  
  if (!eventType || !eventData) {
    // Intentar parsear como JSON directo
    try {
      const parsed = JSON.parse(text)
      if (isValidStreamEvent(parsed)) {
        return parsed
      }
    } catch {
      return null
    }
    return null
  }
  
  try {
    const parsed = JSON.parse(eventData)
    parsed.type = eventType
    if (isValidStreamEvent(parsed)) {
      return parsed
    }
  } catch {
    // No es JSON válido
  }
  
  return null
}
