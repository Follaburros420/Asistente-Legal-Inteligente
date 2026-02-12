import { requireChatAuthAndRateLimit } from "@/lib/server/chat-auth-guard"

jest.mock("@/lib/server/server-chat-helpers", () => ({
  getServerProfile: jest.fn(),
  isServerProfileError: jest.fn()
}))

jest.mock("@/lib/rate-limit", () => ({
  chatRateLimit: { type: "chat" },
  checkRateLimit: jest.fn(),
  formatRateLimitHeaders: jest.fn()
}))

const { getServerProfile, isServerProfileError } = jest.requireMock(
  "@/lib/server/server-chat-helpers"
) as {
  getServerProfile: jest.Mock
  isServerProfileError: jest.Mock
}

const { checkRateLimit, formatRateLimitHeaders } = jest.requireMock(
  "@/lib/rate-limit"
) as {
  checkRateLimit: jest.Mock
  formatRateLimitHeaders: jest.Mock
}

describe("chat-auth-guard", () => {
  beforeEach(() => {
    getServerProfile.mockReset()
    isServerProfileError.mockReset()
    checkRateLimit.mockReset()
    formatRateLimitHeaders.mockReset()
  })

  test("returns 401 when profile error indicates unauthorized", async () => {
    const unauthorizedError = { status: 401, code: "UNAUTHORIZED" }
    getServerProfile.mockRejectedValue(unauthorizedError)
    isServerProfileError.mockReturnValue(true)

    const result = await requireChatAuthAndRateLimit()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      const payload = await result.response.json()
      expect(payload.code).toBe("UNAUTHORIZED")
    }
  })

  test("returns 503 when profile error indicates auth upstream failure", async () => {
    const upstreamError = { status: 503, code: "SUPABASE_AUTH_UPSTREAM_ERROR" }
    getServerProfile.mockRejectedValue(upstreamError)
    isServerProfileError.mockReturnValue(true)

    const result = await requireChatAuthAndRateLimit()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(503)
      const payload = await result.response.json()
      expect(payload.code).toBe("SUPABASE_AUTH_UPSTREAM_ERROR")
    }
  })

  test("returns 500 for unexpected auth errors", async () => {
    getServerProfile.mockRejectedValue(new Error("boom"))
    isServerProfileError.mockReturnValue(false)

    const result = await requireChatAuthAndRateLimit()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(500)
      const payload = await result.response.json()
      expect(payload.code).toBe("AUTH_GUARD_UNEXPECTED_ERROR")
    }
  })

  test("returns 429 with rate limit headers", async () => {
    getServerProfile.mockResolvedValue({ user_id: "user-1" })
    checkRateLimit.mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: Date.now() + 5000 })
    formatRateLimitHeaders.mockReturnValue({
      "Retry-After": "5",
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "0"
    })

    const result = await requireChatAuthAndRateLimit()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(429)
      expect(result.response.headers.get("retry-after")).toBe("5")
      const payload = await result.response.json()
      expect(payload.retryAfter).toBe("5")
    }
  })

  test("returns ok with user id when profile and rate limit pass", async () => {
    getServerProfile.mockResolvedValue({ user_id: "user-1" })
    checkRateLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: Date.now() + 5000 })

    const result = await requireChatAuthAndRateLimit()

    expect(result).toEqual({ ok: true, userId: "user-1" })
  })
})
