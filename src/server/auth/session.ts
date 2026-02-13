import { createClient } from "@/lib/supabase/server"
import { isSupabaseAuthUpstreamError } from "@/lib/supabase/auth-resilience"
import { cookies } from "next/headers"
import type { User } from "@supabase/supabase-js"

export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data.user ?? null
  } catch (error) {
    if (isSupabaseAuthUpstreamError(error)) return null
    throw error
  }
}

