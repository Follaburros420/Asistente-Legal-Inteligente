const warnedScopes = new Set<string>()
const authCircuitOpenUntil = new Map<string, number>()

const RETRYABLE_AUTH_STATUSES = new Set([
  408,
  429,
  500,
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

const AUTH_MAX_ATTEMPTS = 3
const AUTH_RETRY_BACKOFF_MS = [150, 500]
const AUTH_CIRCUIT_TTL_MS = 20_000

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function isJsonContentType(contentType: string): boolean {
  const normalized = (contentType || "").toLowerCase()
  return normalized.includes("application/json") || normalized.includes("+json")
}

function shouldNormalizeAuthResponse(url: string): boolean {
  return url.includes("/auth/v1/")
}

function shouldRetryAuthStatus(status: number): boolean {
  return RETRYABLE_AUTH_STATUSES.has(status)
}

function getRetryDelayMs(attempt: number): number {
  return AUTH_RETRY_BACKOFF_MS[Math.max(0, attempt - 1)] ?? 800
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isAbortError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes("aborted")
}

function openAuthCircuit(scope: string) {
  authCircuitOpenUntil.set(scope, Date.now() + AUTH_CIRCUIT_TTL_MS)
}

function isAuthCircuitOpen(scope: string): boolean {
  const until = authCircuitOpenUntil.get(scope)
  if (!until) return false
  if (Date.now() < until) return true
  authCircuitOpenUntil.delete(scope)
  return false
}

function warnOnce(scope: string, payload: Record<string, unknown>) {
  if (warnedScopes.has(scope)) return
  warnedScopes.add(scope)
  console.error(`[supabase/safe-fetch:${scope}] non-json auth upstream response`, payload)
}

export function isSupabaseAuthHtmlParseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("Unexpected token '<'") ||
    message.includes("<!DOCTYPE") ||
    message.includes("is not valid JSON") ||
    message.includes("SUPABASE_AUTH_UPSTREAM_NON_JSON")
  )
}

/**
 * Wraps fetch for Supabase auth endpoints and normalizes non-JSON upstream responses
 * to JSON so Supabase client doesn't throw parse errors that break routes.
 */
export function createSupabaseSafeFetch(scope: string) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = getRequestUrl(input)
    const shouldHandleAuthResponse = shouldNormalizeAuthResponse(url)

    if (shouldHandleAuthResponse && isAuthCircuitOpen(scope)) {
      return new Response(
        JSON.stringify({
          code: "SUPABASE_AUTH_UPSTREAM_UNAVAILABLE",
          message: "Supabase auth upstream is temporarily unavailable",
          status: 503,
          upstreamStatus: 522,
          source: "circuit-breaker"
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" }
        }
      )
    }

    let lastRetryableStatus: number | null = null

    for (let attempt = 1; attempt <= AUTH_MAX_ATTEMPTS; attempt++) {
      let response: Response
      try {
        response = await fetch(input, init)
      } catch (error) {
        if (!shouldHandleAuthResponse || isAbortError(error) || attempt >= AUTH_MAX_ATTEMPTS) {
          throw error
        }
        await sleep(getRetryDelayMs(attempt))
        continue
      }

      if (!shouldHandleAuthResponse) {
        return response
      }

      if (shouldRetryAuthStatus(response.status)) {
        lastRetryableStatus = response.status
        if (attempt < AUTH_MAX_ATTEMPTS) {
          response.body?.cancel()
          await sleep(getRetryDelayMs(attempt))
          continue
        }
      }

      const contentType = response.headers.get("content-type") || ""
      if (isJsonContentType(contentType)) {
        return response
      }

      let sample = ""
      try {
        const raw = await response.text()
        sample = raw.slice(0, 180)
      } catch {
        sample = ""
      }

      warnOnce(scope, {
        status: response.status,
        url,
        contentType,
        sample
      })

      const status = response.status >= 400 ? response.status : 503
      if (shouldRetryAuthStatus(status) || status >= 500) {
        openAuthCircuit(scope)
      }

      const payload = {
        code: "SUPABASE_AUTH_UPSTREAM_NON_JSON",
        message: "Supabase auth upstream returned non-JSON response",
        status,
        contentType
      }

      return new Response(JSON.stringify(payload), {
        status,
        headers: {
          "content-type": "application/json"
        }
      })
    }

    openAuthCircuit(scope)
    return new Response(
      JSON.stringify({
        code: "SUPABASE_AUTH_UPSTREAM_UNAVAILABLE",
        message: "Supabase auth upstream is temporarily unavailable",
        status: 503,
        upstreamStatus: lastRetryableStatus ?? 522
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json"
        }
      }
    )
  }
}
