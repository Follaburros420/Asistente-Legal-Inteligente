/**
 * Chat Streaming Real - Protocolo v3
 *
 * Usa /api/chat/stream con:
 * - Streaming real (no fake)
 * - Eventos del protocolo v2
 * - Cancelación end-to-end
 * - Manejo de errores robusto
 */

import { BibliographyItem } from "@/types/chat-message";
import { StreamEvent, isValidStreamEvent } from "@/lib/stream-protocol";
import { toast } from "sonner";
import {
  getErrorMessage,
  isCancellationError,
  logError,
} from "@/lib/errors/error-utils";

export interface StreamCallbacks {
  onMeta?: (
    messageId: string,
    intent: string,
    renderMode: "chat" | "document",
  ) => void;
  onStatus?: (phase: string, message: string) => void;
  onDelta?: (text: string) => void;
  onCitations?: (items: BibliographyItem[]) => void;
  onDone?: (metadata?: Record<string, unknown>) => void;
  onError?: (message: string, code?: string) => void;
  onCancelled?: (reason?: string) => void;
}

export interface StreamChatResult {
  text: string;
  citations: BibliographyItem[];
  cancelled: boolean;
  error?: string;
}

export async function streamChat(
  message: string,
  history: Array<{ role: string; content: string }>,
  config: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
  abortController: AbortController,
  callbacks: StreamCallbacks,
): Promise<StreamChatResult> {
  console.log("[streamChat] 🚀 Starting stream...");

  let fullText = "";
  let citations: BibliographyItem[] = [];
  let cancelled = false;
  let error: string | undefined;

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
        config: {
          model: config.model || "openai/gpt-4o-mini",
          temperature: config.temperature ?? 0.3,
          maxTokens: config.maxTokens ?? 4000,
        },
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = getErrorMessage(
          errorData.error,
          `HTTP ${response.status}`,
        );
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error("No response body from server");
    }

    // Leer el stream SSE
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log("[streamChat] ✅ Stream completed");
        break;
      }

      // Decodificar chunk
      buffer += decoder.decode(value, { stream: true });

      // Procesar eventos SSE completos (separados por \n\n)
      const events = buffer.split("\n\n");
      buffer = events.pop() || ""; // Mantener el último incompleto

      for (const eventText of events) {
        if (!eventText.trim()) continue;

        const event = parseSSEEvent(eventText);
        if (!event) continue;

        console.log("[streamChat] 📥 Event:", event.type);

        switch (event.type) {
          case "meta":
            callbacks.onMeta?.(
              (event as any).message_id,
              (event as any).intent,
              (event as any).render_mode,
            );
            break;

          case "status":
            callbacks.onStatus?.((event as any).phase, (event as any).message);
            break;

          case "delta":
            fullText += event.text;
            callbacks.onDelta?.(event.text);
            break;

          case "citations":
            const items = (event as any).items || [];
            citations = items.map((item: any) => ({
              id: item.url || Math.random().toString(),
              title: item.title || "Fuente legal",
              url: item.url,
              type: inferCitationType(item.url),
              source: resolveSourceLabel(item.source, item.url),
            }));
            callbacks.onCitations?.(citations);
            break;

          case "done":
            callbacks.onDone?.((event as any).metadata);
            break;

          case "error":
            error = (event as any).message;
            callbacks.onError?.(error, (event as any).code);
            break;

          case "cancelled":
            cancelled = true;
            callbacks.onCancelled?.((event as any).reason);
            break;
        }
      }
    }
  } catch (err: unknown) {
    // Usar el sistema de manejo de errores robusto
    if (isCancellationError(err)) {
      console.log("[streamChat] 🛑 Cancelled by user");
      cancelled = true;
    } else {
      const errorMessage = getErrorMessage(
        err,
        "Error en la comunicación con el servidor",
      );
      logError("streamChat", err, { messageLength: message.length });

      error = errorMessage;
      callbacks.onError?.(errorMessage);
      toast.error(errorMessage);
    }
  }

  return {
    text: fullText,
    citations,
    cancelled,
    error,
  };
}

function parseSSEEvent(text: string): StreamEvent | null {
  const lines = text.split("\n");
  let eventType: string | null = null;
  let eventData: string | null = null;

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      eventData = line.slice(6).trim();
    }
  }

  if (!eventType || !eventData) {
    // Intentar parsear como JSON directo
    try {
      const parsed = JSON.parse(text);
      if (isValidStreamEvent(parsed)) {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }

  try {
    const parsed = JSON.parse(eventData);
    parsed.type = eventType;
    if (isValidStreamEvent(parsed)) {
      return parsed;
    }
  } catch {
    // No es JSON válido
  }

  return null;
}

const SOURCE_LABELS_BY_DOMAIN: Record<string, string> = {
  "corteconstitucional.gov.co": "Corte Constitucional",
  "cortesuprema.gov.co": "Corte Suprema de Justicia",
  "consejodeestado.gov.co": "Consejo de Estado",
  "ramajudicial.gov.co": "Rama Judicial",
  "suin-juriscol.gov.co": "SUIN-Juriscol",
  "funcionpublica.gov.co": "Funcion Publica",
  "secretariasenado.gov.co": "Secretaria del Senado",
  "minjusticia.gov.co": "Ministerio de Justicia",
  "leyes.co": "Leyes.co",
};

function resolveSourceLabel(source?: string, url?: string): string | undefined {
  if (source && !looksTechnicalSource(source)) {
    return source;
  }

  return getSourceLabelFromUrl(url) || source;
}

function inferCitationType(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (hostname.endsWith(".gov.co")) return "fuente oficial";
    if (hostname.includes("wikipedia.org")) return "referencia general";
    return "fuente web";
  } catch {
    return undefined;
  }
}

function looksTechnicalSource(source: string): boolean {
  const normalized = source.trim();
  if (!normalized) return false;

  return (
    /^[a-z0-9_]+$/i.test(normalized) &&
    (normalized.includes("_") ||
      normalized.startsWith("search") ||
      normalized.startsWith("buscar"))
  );
}

function getSourceLabelFromUrl(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");

    for (const [domain, label] of Object.entries(SOURCE_LABELS_BY_DOMAIN)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return label;
      }
    }

    return hostname;
  } catch {
    return undefined;
  }
}
