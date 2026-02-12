type AuthErrorLike = {
  status?: number
  code?: string
  message?: string
}

const UPSTREAM_AUTH_STATUSES = new Set([
  502,
  503,
  504,
  520,
  521,
  522,
  523,
  524,
  525,
  526
])

function toAuthErrorLike(error: unknown): AuthErrorLike {
  if (!error || typeof error !== "object") return {}
  const record = error as Record<string, unknown>
  return {
    status: typeof record.status === "number" ? record.status : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined
  }
}

export function isSupabaseAuthUpstreamUnavailable(error: unknown): boolean {
  const { status, code, message } = toAuthErrorLike(error)
  const normalizedMessage = (message || "").toLowerCase()

  if (status && UPSTREAM_AUTH_STATUSES.has(status)) return true
  if (code === "SUPABASE_AUTH_UPSTREAM_NON_JSON") return true
  if (code === "SUPABASE_AUTH_UPSTREAM_UNAVAILABLE") return true
  if (normalizedMessage.includes("upstream")) return true
  if (normalizedMessage.includes("non-json")) return true
  if (normalizedMessage.includes("temporarily unavailable")) return true

  return false
}

export function mapFriendlyAuthMessage(
  error: unknown,
  fallbackMessage: string
): string {
  if (isSupabaseAuthUpstreamUnavailable(error)) {
    return "Servicio de autenticacion temporalmente no disponible. Intenta de nuevo en 1-2 minutos."
  }

  const { message } = toAuthErrorLike(error)
  if (message && message.trim()) return message

  return fallbackMessage
}
