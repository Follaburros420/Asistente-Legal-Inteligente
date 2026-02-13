import {
  isSupabaseAuthUpstreamUnavailable,
  isSupabaseRefreshTokenNotFound,
  mapFriendlyAuthMessage
} from "@/lib/supabase/auth-errors"

describe("supabase auth error mapping", () => {
  test("detects upstream unavailable from status", () => {
    expect(isSupabaseAuthUpstreamUnavailable({ status: 522 })).toBe(true)
  })

  test("detects upstream unavailable from code", () => {
    expect(
      isSupabaseAuthUpstreamUnavailable({
        code: "SUPABASE_AUTH_UPSTREAM_NON_JSON"
      })
    ).toBe(true)
  })

  test("returns friendly upstream message", () => {
    const message = mapFriendlyAuthMessage(
      { status: 503, message: "upstream unavailable" },
      "fallback"
    )
    expect(message).toContain("temporalmente no disponible")
  })

  test("detects refresh token not found", () => {
    expect(
      isSupabaseRefreshTokenNotFound({
        status: 400,
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found"
      })
    ).toBe(true)
  })

  test("returns friendly refresh token message", () => {
    const message = mapFriendlyAuthMessage(
      {
        status: 400,
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found"
      },
      "fallback"
    )
    expect(message).toContain("sesion expiro")
  })

  test("falls back to upstream message when not upstream outage", () => {
    const message = mapFriendlyAuthMessage(
      { status: 400, message: "Invalid login credentials" },
      "fallback"
    )
    expect(message).toBe("Invalid login credentials")
  })
})
