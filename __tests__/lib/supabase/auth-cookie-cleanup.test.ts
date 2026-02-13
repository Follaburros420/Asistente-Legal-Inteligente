import { clearSupabaseAuthCookiesInStore } from "@/lib/supabase/auth-cookie-cleanup"

describe("supabase auth cookie cleanup", () => {
  test("clears only supabase auth related cookies", () => {
    const setCalls: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []
    const cookieStore = {
      getAll: () => [
        { name: "sb-abc-auth-token" },
        { name: "sb-abc-auth-token.0" },
        { name: "next-locale" },
        { name: "some-app-cookie" }
      ],
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        setCalls.push({ name, value, options })
      }
    }

    clearSupabaseAuthCookiesInStore(cookieStore)

    expect(setCalls.map(call => call.name)).toEqual([
      "sb-abc-auth-token",
      "sb-abc-auth-token.0"
    ])
    expect(setCalls.every(call => call.value === "")).toBe(true)
  })
})
