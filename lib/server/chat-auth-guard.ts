import { NextResponse } from "next/server"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { chatRateLimit, checkRateLimit, formatRateLimitHeaders } from "@/lib/rate-limit"

type GuardSuccess = {
  ok: true
  userId: string
}

type GuardFailure = {
  ok: false
  response: NextResponse
}

export type ChatAuthGuardResult = GuardSuccess | GuardFailure

/**
 * Enforces authenticated session and per-user chat rate limiting.
 */
export async function requireChatAuthAndRateLimit(): Promise<ChatAuthGuardResult> {
  const profile = await getServerProfile().catch(() => null)
  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
  }

  const userId = profile.user_id
  const rateLimitResult = await checkRateLimit(userId, chatRateLimit)

  if (!rateLimitResult.success) {
    const headers = formatRateLimitHeaders(rateLimitResult) as Record<string, string>
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Demasiadas solicitudes de chat. Intenta nuevamente en unos segundos.",
          retryAfter: headers["Retry-After"]
        },
        {
          status: 429,
          headers
        }
      )
    }
  }

  return {
    ok: true,
    userId
  }
}
