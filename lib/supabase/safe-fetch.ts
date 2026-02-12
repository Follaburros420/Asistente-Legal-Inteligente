const warnedScopes = new Set<string>()

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
    message.includes("is not valid JSON")
  )
}

/**
 * Wraps fetch for Supabase auth endpoints and normalizes non-JSON upstream responses
 * to JSON so Supabase client doesn't throw parse errors that break routes.
 */
export function createSupabaseSafeFetch(scope: string) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = getRequestUrl(input)
    const response = await fetch(input, init)

    if (!shouldNormalizeAuthResponse(url)) {
      return response
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
}
