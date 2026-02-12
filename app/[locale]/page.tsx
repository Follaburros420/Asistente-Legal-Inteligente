import { getEnvVar } from "@/lib/env/runtime-env"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import i18nConfig from "@/i18nConfig"

// Force dynamic rendering - required for Supabase auth
export const dynamic = 'force-dynamic'

let _warnedMissingSupabaseEnv = false

// Valid locales from i18n config
const VALID_LOCALES = i18nConfig.locales as string[]

// Routes that should NOT be treated as locales (handled by their own pages)
const RESERVED_ROUTES = [
  'onboarding', 'login', 'setup', 'billing', 'landing', 'admin',
  'account', 'help', 'auth', 'debug-auth', 'test-signup'
]

interface PageProps {
  params: { locale: string }
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = params

  // If this route is a reserved route, return 404
  if (RESERVED_ROUTES.includes(locale)) {
    notFound()
  }

  // If locale is not valid, redirect to default locale
  if (!VALID_LOCALES.includes(locale)) {
    redirect(`/${i18nConfig.defaultLocale}`)
  }

  // If Supabase isn't configured in this environment, don't crash the app shell.
  // This avoids repeated server errors in misconfigured deployments.
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!_warnedMissingSupabaseEnv) {
      _warnedMissingSupabaseEnv = true
      console.error(
        "Missing Supabase configuration in runtime env. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      )
    }
    redirect(`/${locale}/landing`)
  }

  const cookieStore = cookies()
  let user: { id: string; email?: string | null } | null = null
  let authError: unknown = null

  try {
    const supabase = createClient(cookieStore)
    const result = await supabase.auth.getUser()
    user = result.data.user as any
    authError = result.error
  } catch (error) {
    authError = error
    console.error("[home/page] Supabase auth check failed:", error)
  }

  // Si no hay usuario autenticado, mostrar landing
  if (authError || !user) {
    redirect(`/${locale}/landing`)
  }

  const supabase = createClient(cookieStore)

  // Usuario autenticado - verificar workspace
  const { data: homeWorkspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_home", true)
    .maybeSingle()

  if (!homeWorkspace) {
    // Use /onboarding without locale - handled by (auth) route group
    redirect('/onboarding')
  }

  // Verificar suscripción activa
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing"])
    .maybeSingle()

  if (!subscription) {
    // Use /onboarding without locale - handled by (auth) route group
    redirect('/onboarding')
  }

  // Usuario con workspace y suscripción - ir al chat
  redirect(`/${homeWorkspace.id}/chat`)
}
