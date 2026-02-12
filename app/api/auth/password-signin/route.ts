import { env } from '@/lib/env/runtime-env'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIdentifierFromRequest, formatRateLimitHeaders, authRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

function redirect303(path: string, request: NextRequest) {
  const origin = request.nextUrl.origin || env.appUrl()
  return NextResponse.redirect(new URL(path, origin), 303)
}

function sanitizeRedirect(path: string | null): string | null {
  const value = (path || "").trim()
  if (!value) return null
  if (!value.startsWith("/")) return null
  if (value.startsWith("//")) return null
  if (value.includes("\\")) return null
  return value
}

export async function POST(req: NextRequest) {
  // Rate limiting check
  const identifier = getIdentifierFromRequest(req);
  const rateLimitResult = await checkRateLimit(identifier, authRateLimit);

  if (!rateLimitResult.success) {
    const headers = formatRateLimitHeaders(rateLimitResult);
    return NextResponse.json(
      {
        error: 'Too many login attempts. Please try again later.',
        retryAfter: headers['Retry-After'],
      },
      {
        status: 429,
        headers,
      }
    );
  }

  const cookieStore = cookies()
  const formData = await req.formData()

  const locale =
    (formData.get('locale') as string | null) ||
    cookieStore.get('NEXT_LOCALE')?.value ||
    'es'
  const email = (formData.get('email') as string | null)?.trim() || ''
  const password = (formData.get('password') as string | null) || ''
  const redirectPath = sanitizeRedirect(formData.get('redirect') as string | null)

  if (!email || !password) {
    return redirect303(
      `/${locale}/login?message=${encodeURIComponent('Correo y contraseña son obligatorios')}`,
      req
    )
  }

  const supabase = createClient(cookieStore)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error || !data.user) {
    return redirect303(
      `/${locale}/login?message=${encodeURIComponent(error?.message || 'Error de autenticación')}`,
      req
    )
  }

  const userId = data.user.id

  // Log location
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")
    if (ip && ip !== "::1") {
      // Use fire-and-forget or short timeout fetch if possible, but for reliability await it.
      // We accept a small delay for the first login.
      fetch(`https://ipapi.co/${ip}/json/`)
        .then(res => res.json())
        .then(geoData => {
          if (geoData && !geoData.error) {
            supabase.from("user_locations" as any).insert({
              user_id: userId,
              ip_address: ip,
              country: geoData.country_name,
              city: geoData.city,
              region: geoData.region,
              latitude: geoData.latitude,
              longitude: geoData.longitude,
              user_agent: req.headers.get("user-agent")
            }).then()
          }
        }).catch(err => console.error("Geo log error", err))
    }
  } catch (e) {
    // Ignore errors to not block login
  }

  // If user is coming from an invitation link, send them back to accept it (no subscription/home-workspace required)
  if (redirectPath?.startsWith('/invite/')) {
    return redirect303(redirectPath, req)
  }

  const { data: homeWorkspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('user_id', userId)
    .eq('is_home', true)
    .maybeSingle()

  if (!homeWorkspace) {
    return redirect303(`/${locale}/onboarding`, req)
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  if (!subscription) {
    return redirect303(`/${locale}/onboarding`, req)
  }

  await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      onboarding_step: 'completed',
      has_onboarded: true
    })
    .eq('user_id', userId)

  if (redirectPath) {
    return redirect303(redirectPath, req)
  }

  return redirect303(`/${locale}/${homeWorkspace.id}/chat`, req)
}
