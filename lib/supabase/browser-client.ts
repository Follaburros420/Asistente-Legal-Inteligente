import { createBrowserClient } from "@supabase/ssr"
import { Database } from "@/supabase/types"
import {
  getClientEnv,
  initClientEnv,
  checkClientEnv
} from "@/lib/env/client-env"
import { applyRefreshDeduping } from "@/lib/supabase/auth-refresh-dedupe"

/**
 * Initialize environment before creating client
 */
function ensureEnv(): void {
  initClientEnv()

  const check = checkClientEnv()
  if (!check.valid) {
    console.error("[supabase/browser-client] Missing environment variables:", {
      missing: check.missing,
      cache: Object.entries(check.present).map(([k]) => k)
    })
    throw new Error(
      "Missing Supabase configuration. Please check environment variables:\n" +
        "- NEXT_PUBLIC_SUPABASE_URL\n" +
        "- NEXT_PUBLIC_SUPABASE_ANON_KEY\n\n" +
        "If you're seeing this in production, ensure the environment variables " +
        "are properly configured in your deployment platform."
    )
  }
}

/**
 * Get Supabase environment variables
 */
function getSupabaseEnv() {
  ensureEnv()

  const url = getClientEnv("NEXT_PUBLIC_SUPABASE_URL", { required: true })
  const anonKey = getClientEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", {
    required: true
  })

  return { url, anonKey }
}

/**
 * Create a Supabase browser client with refresh deduplication
 */
export const createClient = () => {
  const { url, anonKey } = getSupabaseEnv()
  const client = createBrowserClient<Database>(url, anonKey)
  return applyRefreshDeduping(client, "browser")
}

// Lazy-initialized singleton instance
let _supabaseInstance: ReturnType<
  typeof createBrowserClient<Database>
> | null = null

export const supabase = new Proxy(
  {} as ReturnType<typeof createBrowserClient<Database>>,
  {
    get(target, prop) {
      if (!_supabaseInstance) {
        _supabaseInstance = createClient()
      }
      const value = (_supabaseInstance as any)[prop]
      return typeof value === "function"
        ? value.bind(_supabaseInstance)
        : value
    }
  }
)

/**
 * Check if Supabase client can be created (for diagnostics)
 */
export function canCreateSupabaseClient(): {
  canCreate: boolean
  error?: string
  url?: string
  hasKey?: boolean
} {
  try {
    initClientEnv()
    const check = checkClientEnv()

    if (!check.valid) {
      return {
        canCreate: false,
        error: `Missing variables: ${check.missing.join(", ")}`,
        url: getClientEnv("NEXT_PUBLIC_SUPABASE_URL"),
        hasKey: !!getClientEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
      }
    }

    const url = getClientEnv("NEXT_PUBLIC_SUPABASE_URL")
    const hasKey = !!getClientEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    return {
      canCreate: true,
      url,
      hasKey
    }
  } catch (error) {
    return {
      canCreate: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
