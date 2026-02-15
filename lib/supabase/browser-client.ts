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

/**
 * Reset the cached Supabase client (useful when schema changes)
 */
export function resetSupabaseClient() {
  _supabaseInstance = null
  console.log('[Supabase] Client cache reset')
}

/**
 * Create a fresh Supabase client (bypassing cache)
 */
export function createFreshClient() {
  const { url, anonKey } = getSupabaseEnv()
  _supabaseInstance = createBrowserClient<Database>(url, anonKey, {
    db: { schema: 'public' }
  })
  return applyRefreshDeduping(_supabaseInstance, "browser-fresh")
}

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
 * Check if error is a schema cache error
 */
function isSchemaCacheError(error: any): boolean {
  if (!error) return false
  const message = error.message || String(error)
  return message.includes('schema cache') || 
         (message.includes('column') && message.includes('in the schema cache'))
}

/**
 * Execute a Supabase query with automatic retry on schema cache errors
 * 
 * NOTE: Schema cache errors are typically resolved by hard-refreshing the browser (Ctrl+F5)
 * or restarting the dev server. This function will retry once after resetting the client.
 */
export async function executeWithSchemaRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  let result = await queryFn()
  
  // If we get a schema cache error, try to recover
  if (result.error && isSchemaCacheError(result.error)) {
    console.warn('[Supabase] Schema cache error detected:', result.error.message)
    console.warn('[Supabase] Try hard-refreshing the browser (Ctrl+F5) or clearing site data')
    
    // Try resetting client first
    resetSupabaseClient()
    
    // Small delay to ensure clean state
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Retry the query
    result = await queryFn()
    
    // If still failing, return error with helpful message
    if (result.error && isSchemaCacheError(result.error)) {
      return {
        data: null,
        error: {
          ...result.error,
          message: `Schema cache error: The database schema has changed. Please hard-refresh the page (Ctrl+F5) or clear browser cache and reload.`
        }
      }
    }
  }
  
  return result
}

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
