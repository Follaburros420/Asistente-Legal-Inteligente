const REQUEST_ID_HEADER = "x-request-id"
const DEBUG_LOGS = process.env.NODE_ENV === "development"

function normalizeRequestId(input: string | null): string | null {
  if (!input) return null
  const normalized = input.trim()
  if (!normalized) return null
  if (normalized.length > 128) return null
  if (!/^[a-zA-Z0-9._:-]+$/.test(normalized)) return null
  return normalized
}

export type RequestContext = {
  requestId: string
  route: string
  startedAt: number
}

function createFallbackRequestId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `req_${Date.now().toString(36)}_${randomPart}`
}

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    const generated = globalThis.crypto.randomUUID()
    if (typeof generated === "string" && generated.trim().length > 0) {
      return generated
    }
  }
  return createFallbackRequestId()
}

export function createRequestContext(request: Request, route: string): RequestContext {
  const incoming = normalizeRequestId(request.headers.get(REQUEST_ID_HEADER))
  return {
    requestId: incoming || createRequestId(),
    route,
    startedAt: Date.now()
  }
}

export function withRequestIdHeaders(headers: HeadersInit | undefined, requestId: string): Headers {
  const result = new Headers(headers || {})
  result.set("X-Request-Id", requestId)
  return result
}

function emit(level: "info" | "warn" | "error" | "debug", context: RequestContext, event: string, data?: Record<string, unknown>) {
  if (level === "debug" && !DEBUG_LOGS) return

  const payload = {
    level,
    route: context.route,
    requestId: context.requestId,
    event,
    ...data
  }

  const message = JSON.stringify(payload)
  if (level === "error") {
    console.error(message)
    return
  }
  if (level === "warn") {
    console.warn(message)
    return
  }
  console.log(message)
}

export function logRequestDebug(context: RequestContext, event: string, data?: Record<string, unknown>) {
  emit("debug", context, event, data)
}

export function logRequestInfo(context: RequestContext, event: string, data?: Record<string, unknown>) {
  emit("info", context, event, data)
}

export function logRequestWarn(context: RequestContext, event: string, data?: Record<string, unknown>) {
  emit("warn", context, event, data)
}

export function logRequestError(context: RequestContext, event: string, error: unknown, data?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error)
  emit("error", context, event, {
    error: message,
    ...data
  })
}

export function getElapsedMs(context: RequestContext): number {
  return Date.now() - context.startedAt
}
