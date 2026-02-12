import { validateAndNormalizeSupabaseUrl } from "@/lib/supabase/url-validation"

describe("supabase url validation", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const originalVercelUrl = process.env.VERCEL_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
    process.env.VERCEL_URL = originalVercelUrl
  })

  test("accepts valid supabase origin and strips pathless trailing slash", () => {
    const result = validateAndNormalizeSupabaseUrl("https://abcxyz.supabase.co/")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.url).toBe("https://abcxyz.supabase.co")
    }
  })

  test("rejects url with path", () => {
    const result = validateAndNormalizeSupabaseUrl("https://abcxyz.supabase.co/auth/v1")
    expect(result.ok).toBe(false)
  })

  test("rejects app host collision", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://miapp.vercel.app"
    const result = validateAndNormalizeSupabaseUrl("https://miapp.vercel.app")
    expect(result.ok).toBe(false)
  })

  test("rejects vercel host collision", () => {
    process.env.VERCEL_URL = "miapp.vercel.app"
    const result = validateAndNormalizeSupabaseUrl("https://miapp.vercel.app")
    expect(result.ok).toBe(false)
  })
})
