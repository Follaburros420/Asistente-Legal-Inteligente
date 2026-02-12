import { NextRequest, NextResponse } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { DOCUMENT_SYSTEM_PROMPT } from "@/lib/prompts/document-system-prompt"
import { requireChatAuthAndRateLimit } from "@/lib/server/chat-auth-guard"
import { M1_MODEL_ID, isKnownMModelInput, normalizeMModel } from "@/lib/models/m1-models"
import {
  createRequestContext,
  getElapsedMs,
  logRequestError,
  logRequestInfo,
  withRequestIdHeaders
} from "@/lib/server/request-context"
import { TimeoutError, withTimeout } from "@/lib/server/async-timeout"

export const runtime = "edge"

const MAX_INSTRUCTION_LENGTH = 2_000
const MAX_DOCUMENT_LENGTH = 50_000
const REFINE_TIMEOUT_MS = 40_000
const DEFAULT_REFINE_MODEL = "gpt-4o-mini"
const EXTRA_ALLOWED_MODELS = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "openai/gpt-4o",
  "openai/gpt-4o-mini"
])

interface RequestBody {
  document: unknown
  instruction: unknown
  model?: unknown
}

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

function getModelTextContent(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map(item => {
      if (typeof item === "string") return item
      if (item && typeof item === "object" && "text" in item) {
        return typeof (item as { text?: unknown }).text === "string"
          ? (item as { text: string }).text
          : ""
      }
      return ""
    })
    .filter(Boolean)
    .join("\n")
    .trim()
}

function parseJsonOutput(output: string): unknown {
  const fencedJsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fencedJsonMatch?.[1]) {
    return JSON.parse(fencedJsonMatch[1])
  }

  const trimmed = output.trim()
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed)
  }

  throw new Error("El modelo no devolvio un JSON valido")
}

function resolveRefineModel(model: unknown): string {
  if (typeof model !== "string") return DEFAULT_REFINE_MODEL
  const normalized = model.trim()
  if (!normalized) return DEFAULT_REFINE_MODEL

  if (EXTRA_ALLOWED_MODELS.has(normalized)) {
    return normalized
  }

  if (isKnownMModelInput(normalized)) {
    return normalizeMModel(normalized)
  }

  return DEFAULT_REFINE_MODEL
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, "api/chat/refine-document")
  logRequestInfo(context, "request_started")

  try {
    const guard = await requireChatAuthAndRateLimit()
    if (!guard.ok) {
      guard.response.headers.set("X-Request-Id", context.requestId)
      return guard.response
    }

    const body = (await request.json().catch(() => null)) as RequestBody | null
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(context.requestId, { error: "Payload invalido" }, 400)
    }

    const { document, instruction } = body
    if (!document || typeof document !== "object") {
      return jsonWithRequestId(
        context.requestId,
        { error: "Se requiere documento JSON valido" },
        400
      )
    }

    if (typeof instruction !== "string" || instruction.trim().length === 0) {
      return jsonWithRequestId(context.requestId, { error: "Se requiere instruccion valida" }, 400)
    }

    const normalizedInstruction = instruction.trim()

    if (normalizedInstruction.length > MAX_INSTRUCTION_LENGTH) {
      return jsonWithRequestId(
        context.requestId,
        { error: `La instruccion supera el maximo permitido (${MAX_INSTRUCTION_LENGTH})` },
        400
      )
    }

    const serializedDocument = JSON.stringify(document)
    if (serializedDocument.length > MAX_DOCUMENT_LENGTH) {
      return jsonWithRequestId(
        context.requestId,
        { error: `El documento supera el maximo permitido (${MAX_DOCUMENT_LENGTH})` },
        400
      )
    }

    const modelName = resolveRefineModel(body.model ?? M1_MODEL_ID)

    const openrouterApiKey = process.env.OPENROUTER_API_KEY
    if (!openrouterApiKey) {
      return jsonWithRequestId(
        context.requestId,
        { error: "OPENROUTER_API_KEY no configurada" },
        500
      )
    }

    const systemPrompt = `${DOCUMENT_SYSTEM_PROMPT}

TAREA ACTUAL: REFINAMIENTO DE DOCUMENTO
Debes devolver solo JSON valido manteniendo la estructura del documento.
No agregues markdown, explicaciones ni texto fuera del JSON.
No inventes normativa ni citas.
`

    const userPrompt = `Documento actual (JSON):
\`\`\`json
${serializedDocument}
\`\`\`

Instruccion de cambio:
${normalizedInstruction}

Devuelve unicamente el JSON final actualizado.`

    const chat = new ChatOpenAI({
      modelName,
      temperature: 0.2,
      openAIApiKey: openrouterApiKey,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1"
      }
    })

    const response = await withTimeout(
      chat.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]),
      REFINE_TIMEOUT_MS,
      "Timeout refinando documento legal"
    )
    const output = getModelTextContent(response.content)
    const refinedDraft = parseJsonOutput(output)
    if (!refinedDraft || typeof refinedDraft !== "object" || Array.isArray(refinedDraft)) {
      throw new Error("El modelo no devolvio un objeto JSON valido")
    }

    logRequestInfo(context, "request_completed", {
      latencyMs: getElapsedMs(context),
      modelName,
      instructionChars: normalizedInstruction.length,
      documentChars: serializedDocument.length
    })

    return NextResponse.json(refinedDraft, {
      headers: withRequestIdHeaders(
        {
          "Cache-Control": "no-store"
        },
        context.requestId
      )
    })
  } catch (error: any) {
    logRequestError(context, "request_failed", error, {
      latencyMs: getElapsedMs(context)
    })
    if (error instanceof TimeoutError || error?.name === "TimeoutError") {
      return jsonWithRequestId(
        context.requestId,
        { error: "El refinamiento excedio el tiempo maximo", code: "REFINE_TIMEOUT" },
        504
      )
    }
    return jsonWithRequestId(
      context.requestId,
      { error: error.message || "Error procesando la solicitud" },
      500
    )
  }
}
