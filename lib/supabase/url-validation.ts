type SupabaseUrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; reason: string }

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "")
}

/**
 * Validates and normalizes Supabase URL values to prevent auth calls to wrong HTML endpoints.
 */
export function validateAndNormalizeSupabaseUrl(rawUrl: string): SupabaseUrlValidationResult {
  const input = (rawUrl || "").trim()
  if (!input) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL esta vacia" }
  }

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL no es una URL valida" }
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL debe usar http o https" }
  }

  if (parsed.pathname && parsed.pathname !== "/") {
    return {
      ok: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL no debe incluir rutas (ej. /auth/v1)"
    }
  }

  const urlHost = normalizeHost(parsed.host)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
  const vercelHost = process.env.VERCEL_URL

  if (appUrl) {
    try {
      const appHost = normalizeHost(new URL(appUrl).host)
      if (urlHost === appHost) {
        return {
          ok: false,
          reason: "NEXT_PUBLIC_SUPABASE_URL apunta al dominio de la app y no al proyecto de Supabase"
        }
      }
    } catch {
      // Ignore invalid app URL
    }
  }

  if (vercelHost && urlHost === normalizeHost(vercelHost)) {
    return {
      ok: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL coincide con VERCEL_URL (configuracion incorrecta)"
    }
  }

  return { ok: true, url: parsed.origin }
}
