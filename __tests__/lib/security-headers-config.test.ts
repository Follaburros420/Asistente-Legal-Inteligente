const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
const originalVercelUrl = process.env.VERCEL_URL

describe("security headers config", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
    process.env.VERCEL_URL = originalVercelUrl
  })

  test("builds valid supabase wildcard source", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://*.supabase.co"
    const { buildCSP } = require("../../lib/security-headers-config")
    const csp = buildCSP()

    expect(csp).toContain("https://*.supabase.co")
    expect(csp).not.toContain("https://*supabase.co")
  })

  test("includes form-action for app and vercel origins", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://aliado.pro"
    process.env.VERCEL_URL = "ali-jade.vercel.app"
    const { buildCSP } = require("../../lib/security-headers-config")
    const csp = buildCSP()

    expect(csp).toContain("form-action")
    expect(csp).toContain("https://aliado.pro")
    expect(csp).toContain("https://ali-jade.vercel.app")
  })
})
