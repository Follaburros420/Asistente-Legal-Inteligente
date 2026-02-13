import { isSupabaseAuthUpstreamUnavailable } from "@/lib/supabase/auth-errors"
import { isSupabaseAuthHtmlParseError } from "@/lib/supabase/safe-fetch"

const warnedScopes = new Set<string>()

type MinimalAuthError = {
  __isAuthError: true
  code?: string
  message: string
  name: string
  status?: number
}

function toAuthErrorRecord(error: unknown): Record<string, unknown> {
  return error && typeof error === "object" ? (error as Record<string, unknown>) : {}
}

function normalizeAuthError(error: unknown): MinimalAuthError {
  const record = toAuthErrorRecord(error)
  const status = typeof record.status === "number" ? record.status : 503
  const code =
    typeof record.code === "string" && record.code
      ? record.code
      : "SUPABASE_AUTH_UPSTREAM_UNAVAILABLE"

  const baseMessage =
    typeof record.message === "string" && record.message.trim()
      ? record.message
      : error instanceof Error
        ? error.message
        : "Supabase auth upstream is temporarily unavailable"

  return {
    __isAuthError: true,
    name: "AuthApiError",
    message: baseMessage,
    status,
    code
  }
}

function warnOnce(scope: string, error: MinimalAuthError) {
  if (warnedScopes.has(scope)) return
  warnedScopes.add(scope)
  console.warn(`[supabase/auth-resilience:${scope}] auth degraded mode`, {
    status: error.status,
    code: error.code
  })
}

export function isSupabaseAuthUpstreamError(error: unknown): boolean {
  return isSupabaseAuthHtmlParseError(error) || isSupabaseAuthUpstreamUnavailable(error)
}

export function applySupabaseAuthResilience<TClient extends { auth?: unknown }>(
  client: TClient,
  scope: string
): TClient {
  const auth = (client as any)?.auth
  if (!auth || typeof auth !== "object") return client
  if ((auth as any).__resilienceWrapped) return client

  ;(auth as any).__resilienceWrapped = true

  const wrapMethod = (
    methodName: "getUser" | "getSession",
    fallbackData: () => Record<string, unknown>
  ) => {
    const original = (auth as any)[methodName]
    if (typeof original !== "function") return

    ;(auth as any)[methodName] = async (...args: unknown[]) => {
      try {
        return await original.apply(auth, args)
      } catch (error) {
        if (!isSupabaseAuthUpstreamError(error)) {
          throw error
        }

        const normalized = normalizeAuthError(error)
        warnOnce(`${scope}:${methodName}`, normalized)
        return {
          data: fallbackData(),
          error: normalized
        }
      }
    }
  }

  wrapMethod("getUser", () => ({ user: null }))
  wrapMethod("getSession", () => ({ session: null }))

  return client
}
