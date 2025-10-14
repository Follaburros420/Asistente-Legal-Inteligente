import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getServerSupabaseConfig } from "@/lib/supabase/robust-client"

export const createClient = (cookieStore: ReturnType<typeof cookies>) => {
  const { url, serviceRoleKey } = getServerSupabaseConfig()
  
  return createServerClient(url, serviceRoleKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options })
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      }
    }
  })
}
