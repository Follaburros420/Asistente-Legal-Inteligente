import { env, getEnvVar } from "@/lib/env/runtime-env"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/supabase/types"
import { validateAndNormalizeSupabaseUrl } from "@/lib/supabase/url-validation"
import { createSupabaseSafeFetch } from "@/lib/supabase/safe-fetch"

/**
 * Create a Supabase client for Server Components
 * Uses ANON_KEY for user authentication flows
 */
export const createClient = (cookieStore: ReturnType<typeof cookies>) => {
  const rawUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const normalized = validateAndNormalizeSupabaseUrl(rawUrl)

  if (!rawUrl || !anonKey || !normalized.ok) {
    // Enhanced error message with diagnostic information
    const missing = []
    if (!rawUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (!normalized.ok) missing.push(`NEXT_PUBLIC_SUPABASE_URL invalida: ${normalized.reason}`)
    
    const errorMessage = `Missing Supabase configuration. Please check environment variables:\n` +
      `- ${missing.join('\n- ')}\n\n` +
      `Diagnostic info:\n` +
      `- NODE_ENV: ${process.env.NODE_ENV || 'not set'}\n` +
      `- URL present: ${!!rawUrl}\n` +
      `- AnonKey present: ${!!anonKey}\n` +
      `- URL length: ${rawUrl?.length || 0}\n` +
      `- AnonKey length: ${anonKey?.length || 0}`
    
    console.error('[Supabase] Configuration error:', errorMessage)
    throw new Error(errorMessage)
  }

  return createServerClient<Database>(normalized.url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from Server Component - ignore
        }
      }
    },
    global: {
      fetch: createSupabaseSafeFetch("server")
    }
  })
}
