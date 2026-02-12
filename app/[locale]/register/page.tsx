import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { createClient } from "@/lib/supabase/server"
import { Metadata } from "next"
import Link from "next/link"
import { ShaderCanvas } from "@/components/shader-canvas"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { OAuthButtons } from "@/components/auth/oauth-buttons"
import { AnimatedTitle } from "@/components/auth/animated-title"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Registro"
}

export default async function Register({
  params,
  searchParams
}: {
  params: { locale: string }
  searchParams: { message?: string; redirect?: string }
}) {
  const { locale } = params
  const redirectPath =
    typeof searchParams.redirect === "string" ? searchParams.redirect : ""
  const requestHeaders = headers()
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host")
  const proto = requestHeaders.get("x-forwarded-proto") || "https"
  const currentOrigin = host ? `${proto}://${host}` : ""
  const signupAction = currentOrigin
    ? `${currentOrigin}/api/auth/signup`
    : "/api/auth/signup"
  const loginHref = redirectPath
    ? `/${locale}/login?redirect=${encodeURIComponent(redirectPath)}`
    : `/${locale}/login`
  const cookieStore = cookies()
  let supabase = null as ReturnType<typeof createClient> | null
  let user: { id: string; email?: string | null; app_metadata?: Record<string, unknown> } | null = null
  let authError: unknown = null

  try {
    supabase = createClient(cookieStore)
    const authResult = await supabase.auth.getUser()
    user = authResult.data.user as any
    authError = authResult.error
  } catch (error) {
    authError = error
    console.error("[register/page] Supabase auth check failed:", error)
  }

  if (!authError && user && supabase) {
    if (redirectPath.startsWith("/invite/")) {
      return redirect(redirectPath)
    }

    const { data: homeWorkspace } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_home", true)
      .maybeSingle()

    if (!homeWorkspace) {
      return redirect(`/${locale}/onboarding`)
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .maybeSingle()

    if (!subscription) {
      return redirect(`/${locale}/onboarding`)
    }

    await supabase
      .from("profiles")
      .update({
        onboarding_completed: true,
        onboarding_step: "completed",
        has_onboarded: true
      })
      .eq("user_id", user.id)

    return redirect(`/${locale}/${homeWorkspace.id}/chat`)
  }

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      <div className="relative hidden md:flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="relative" style={{ width: 480, height: 480 }}>
            <ShaderCanvas size={480} shaderId={2} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-9xl font-extrabold tracking-wide bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                ALI
              </span>
            </div>
          </div>
          <AnimatedTitle />
        </div>
      </div>

      <div className="flex w-full flex-1 flex-col justify-center gap-2 px-6 md:px-8 sm:max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center mb-4 md:hidden">
          <div className="relative" style={{ width: 200, height: 200 }}>
            <ShaderCanvas size={200} shaderId={2} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-6xl font-extrabold tracking-wide bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                ALI
              </span>
            </div>
          </div>
          <AnimatedTitle size="sm" />
        </div>

        <div className="relative w-full rounded-2xl border border-white/10 bg-gradient-to-b from-background/60 to-background/30 backdrop-blur-xl p-6 md:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_60px_-20px_rgba(124,58,237,0.5)]">
          <form
            className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2"
            action={signupAction}
            method="post"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="redirect" value={redirectPath} />

            <Label className="text-md mt-2" htmlFor="register-email">
              Correo electronico
            </Label>
            <Input
              id="register-email"
              className="mb-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-foreground placeholder:text-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0"
              name="email"
              autoComplete="email"
              placeholder="tu@ejemplo.com"
              required
            />

            <Label className="text-md" htmlFor="register-password">
              Contrasena
            </Label>
            <Input
              id="register-password"
              className="mb-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-foreground placeholder:text-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
            />

            <Label className="text-md" htmlFor="register-confirm-password">
              Confirmar contrasena
            </Label>
            <Input
              id="register-confirm-password"
              className="mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-foreground placeholder:text-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={8}
              required
            />

            <SubmitButton className="mb-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2 text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,0.7)] hover:from-fuchsia-500 hover:to-indigo-500">
              Crear cuenta
            </SubmitButton>

            <div className="text-muted-foreground mt-1 flex justify-center text-sm">
              <span className="mr-1">Ya tienes cuenta?</span>
              <Link href={loginHref} className="text-primary ml-1 underline hover:opacity-80">
                Iniciar sesion
              </Link>
            </div>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full bg-gradient-to-r from-transparent via-white/10 to-transparent h-px" />
            </div>
            <div className="relative flex justify-center text-[10px] tracking-widest uppercase">
              <span className="bg-background/70 px-3 text-muted-foreground rounded-full border border-white/10">
                O continua con
              </span>
            </div>
          </div>

          <OAuthButtons />
        </div>

        {searchParams?.message && (
          <p className="bg-foreground/10 text-foreground mt-4 p-4 text-center">
            {searchParams.message}
          </p>
        )}
      </div>
    </div>
  )
}
