import { NextRequest, NextResponse } from "next/server"
import { LegalWritingAgent } from "@/lib/agents/legal-writing-agent"
import { parseLegalWritingRequest } from "@/lib/server/chat-payload"
import {
  createRequestContext,
  getElapsedMs,
  logRequestError,
  logRequestInfo,
  withRequestIdHeaders
} from "@/lib/server/request-context"
import { toWindowedTextHistory } from "@/lib/server/chat-history-window"
import { TimeoutError, withTimeout } from "@/lib/server/async-timeout"
import {
  ALLOWED_M_MODELS,
  isKnownMModelInput,
  M1_MODEL_ID,
  normalizeMModel
} from "@/lib/models/m1-models"
import { requireChatAuthAndRateLimit } from "@/lib/server/chat-auth-guard"
import { canContinueChat, canUseModel } from "@/lib/billing/plan-access"

export const maxDuration = 120 // Mayor tiempo para proceso iterativo
const MAX_HISTORY_MESSAGES = 14
const MAX_HISTORY_TOTAL_CHARS = 12_000
const MAX_HISTORY_MESSAGE_CHARS = 1_800
const LEGAL_WRITING_TIMEOUT_MS = 45_000

function jsonWithRequestId(
  requestId: string,
  payload: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(payload, {
    status,
    headers: withRequestIdHeaders(undefined, requestId)
  })
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, "api/chat/legal-writing")
  logRequestInfo(context, "request_started")

  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = parseLegalWritingRequest(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalido: chatSettings.model y messages son requeridos" },
        {
          status: 400,
          headers: withRequestIdHeaders(undefined, context.requestId)
        }
      )
    }
    const body = parsed.data
    const windowedMessages = toWindowedTextHistory(body.messages, {
      maxMessages: MAX_HISTORY_MESSAGES,
      maxTotalChars: MAX_HISTORY_TOTAL_CHARS,
      maxMessageChars: MAX_HISTORY_MESSAGE_CHARS
    }).map(message => ({
      role: message.role,
      content: message.content
    }))

    if (windowedMessages.length === 0) {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "No se encontraron mensajes validos para procesar",
          code: "EMPTY_CHAT_HISTORY"
        },
        400
      )
    }

    const guard = await requireChatAuthAndRateLimit()
    if (!guard.ok) {
      guard.response.headers.set("X-Request-Id", context.requestId)
      return guard.response
    }
    const effectiveUserId = guard.userId

    const requestedModel = body.chatSettings.model
    if (requestedModel && !isKnownMModelInput(requestedModel)) {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "Modelo no permitido para este asistente",
          code: "MODEL_NOT_ALLOWED",
          allowedModels: ALLOWED_M_MODELS
        },
        400
      )
    }

    if (process.env.NEXT_PUBLIC_BILLING_ENABLED === "true") {
      const canChat = await canContinueChat(effectiveUserId)
      if (!canChat.allowed) {
        return jsonWithRequestId(
          context.requestId,
          {
            error: canChat.reason || "Has alcanzado el limite de tu plan",
            code: "USAGE_LIMIT_EXCEEDED",
            needsUpgrade: true
          },
          402
        )
      }

      const modelId = normalizeMModel(requestedModel || M1_MODEL_ID)
      const modelCheck = await canUseModel(effectiveUserId, modelId)
      if (!modelCheck.allowed) {
        return jsonWithRequestId(
          context.requestId,
          {
            error: modelCheck.reason || "Has alcanzado el limite de uso de este modelo",
            code: "MODEL_LIMIT_EXCEEDED",
            needsUpgrade: true
          },
          402
        )
      }
    }

    const agent = new LegalWritingAgent({
      model: normalizeMModel(requestedModel || M1_MODEL_ID),
      chatId: body.chatId,
      userId: effectiveUserId
    })

    const stream = await withTimeout(
      agent.processWithStreaming(windowedMessages),
      LEGAL_WRITING_TIMEOUT_MS,
      "Timeout en generacion de redaccion legal"
    )

    const truncated = windowedMessages.length < body.messages.length
    logRequestInfo(context, "request_completed", {
      latencyMs: getElapsedMs(context),
      inputMessages: body.messages.length,
      usedMessages: windowedMessages.length,
      contextTruncated: truncated
    })

    return new Response(stream, {
      headers: withRequestIdHeaders(
        {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Context-Truncated": truncated ? "true" : "false",
        "X-History-Messages": String(windowedMessages.length)
        },
        context.requestId
      )
    })
  } catch (error) {
    logRequestError(context, "request_failed", error, {
      latencyMs: getElapsedMs(context)
    })
    if (error instanceof TimeoutError || (error as Error)?.name === "TimeoutError") {
      return jsonWithRequestId(
        context.requestId,
        {
          error: "La redaccion legal excedio el tiempo maximo",
          code: "LEGAL_WRITING_TIMEOUT"
        },
        504
      )
    }
    return NextResponse.json(
      {
        error: "Error procesando solicitud de redaccion",
        details: error instanceof Error ? error.message : String(error)
      },
      {
        status: 500,
        headers: withRequestIdHeaders(undefined, context.requestId)
      }
    )
  }
}
