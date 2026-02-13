import {
  applySupabaseAuthResilience,
  isSupabaseAuthUpstreamError,
  isSupabaseRecoverableAuthError
} from "@/lib/supabase/auth-resilience"

describe("supabase auth resilience", () => {
  test("detects known upstream auth errors", () => {
    expect(isSupabaseAuthUpstreamError({ status: 522 })).toBe(true)
    expect(
      isSupabaseAuthUpstreamError(
        new Error("Unexpected token '<', \"<!DOCTYPE\" is not valid JSON")
      )
    ).toBe(true)
  })

  test("detects refresh token not found as recoverable auth error", () => {
    expect(
      isSupabaseRecoverableAuthError({
        status: 400,
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found"
      })
    ).toBe(true)
  })

  test("wraps getUser and returns controlled error instead of throw", async () => {
    const client = {
      auth: {
        getUser: jest.fn(async () => {
          throw { status: 522, message: "upstream timeout" }
        }),
        getSession: jest.fn(async () => ({ data: { session: null }, error: null }))
      }
    }

    const wrapped = applySupabaseAuthResilience(client, "test")
    const result = await (wrapped as any).auth.getUser()

    expect(result.data.user).toBeNull()
    expect(result.error).toBeTruthy()
    expect(result.error.status).toBe(522)
  })

  test("wraps refresh_token_not_found as controlled auth error", async () => {
    const client = {
      auth: {
        getUser: jest.fn(async () => {
          throw {
            status: 400,
            code: "refresh_token_not_found",
            message: "Invalid Refresh Token: Refresh Token Not Found"
          }
        }),
        getSession: jest.fn(async () => ({ data: { session: null }, error: null }))
      }
    }

    const wrapped = applySupabaseAuthResilience(client, "test")
    const result = await (wrapped as any).auth.getUser()

    expect(result.data.user).toBeNull()
    expect(result.error).toBeTruthy()
    expect(result.error.code).toBe("refresh_token_not_found")
    expect(result.error.status).toBe(400)
  })
})
