import type { NextRequest, NextResponse } from "next/server"

function isSupabaseAuthCookieName(name: string): boolean {
  return (
    name.startsWith("sb-") ||
    name.includes("supabase-auth-token") ||
    name.includes("code-verifier")
  )
}

export function clearSupabaseAuthCookiesInResponse(
  response: NextResponse,
  request: NextRequest
) {
  const cookies = request.cookies.getAll()
  for (const cookie of cookies) {
    if (!isSupabaseAuthCookieName(cookie.name)) continue
    response.cookies.set(cookie.name, "", {
      path: "/",
      maxAge: 0
    })
  }
}

export function clearSupabaseAuthCookiesInStore(
  cookieStore: { getAll: () => Array<{ name: string }>; set: (name: string, value: string, options?: Record<string, unknown>) => void }
) {
  const cookies = cookieStore.getAll()
  for (const cookie of cookies) {
    if (!isSupabaseAuthCookieName(cookie.name)) continue
    cookieStore.set(cookie.name, "", {
      path: "/",
      maxAge: 0
    })
  }
}
