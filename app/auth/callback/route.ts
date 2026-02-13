import { env, getEnvVar } from "@/lib/env/runtime-env"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { validateAndNormalizeSupabaseUrl } from "@/lib/supabase/url-validation"
import { createSupabaseSafeFetch } from "@/lib/supabase/safe-fetch"
import { applySupabaseAuthResilience } from "@/lib/supabase/auth-resilience"

// Get the correct app URL for redirects
function getAppUrl(): string {
  return env.appUrl();
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next")
  const error_description = requestUrl.searchParams.get("error_description")
  
  // Get the correct base URL for redirects - ALWAYS use production URL
  const appUrl = getAppUrl();

  console.log('[Auth Callback] Received request:', { 
    hasCode: !!code, 
    next,
    appUrl,
    envAppUrl: getEnvVar('NEXT_PUBLIC_APP_URL') || 'NOT SET',
    error_description: error_description || 'none'
  })

  // Handle OAuth errors
  if (error_description) {
    console.error('[Auth Callback] OAuth error:', error_description)
    return NextResponse.redirect(new URL(`/login?message=${encodeURIComponent(error_description)}`, appUrl))
  }

  const cookieStore = cookies()
  const supabaseUrlEnv = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKeyEnv = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const supabaseUrlValidation = validateAndNormalizeSupabaseUrl(supabaseUrlEnv || '')
  
  // Log available cookies for debugging PKCE issues
  const allCookies = cookieStore.getAll()
  const pkceCookies = allCookies.filter(cookie => 
    cookie.name.includes('code-verifier') || 
    cookie.name.includes('pkce') ||
    cookie.name.includes('sb-')
  )
  console.log('[Auth Callback] Available cookies:', {
    total: allCookies.length,
    pkceRelated: pkceCookies.length,
    cookieNames: allCookies.map(c => c.name).slice(0, 10) // Limit to first 10 for logging
  })
  
  // #region agent log
  const fs = require('fs');
  const path = require('path');
  try {
    const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
    const logEntry = JSON.stringify({
      location: 'app/auth/callback/route.ts:GET',
      message: 'Creating Supabase client for callback',
      data: {
        hasCode: !!code,
        hasSupabaseUrl: !!supabaseUrlEnv,
        hasSupabaseAnonKey: !!supabaseAnonKeyEnv,
        urlLength: supabaseUrlEnv?.length || 0,
        anonKeyLength: supabaseAnonKeyEnv?.length || 0,
        appUrl,
        nodeEnv: process.env.NODE_ENV
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'G'
    }) + '\n';
    fs.appendFileSync(logPath, logEntry);
  } catch (e) {
    // Ignore if log file doesn't exist
  }
  // #endregion

  // Create Supabase client with proper cookie handling using getAll/setAll/removeAll
  if (!supabaseUrlEnv || !supabaseAnonKeyEnv || !supabaseUrlValidation.ok) {
    console.error('[Auth Callback] Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrlEnv,
      hasAnonKey: !!supabaseAnonKeyEnv,
      urlValidation: supabaseUrlValidation.ok ? 'ok' : supabaseUrlValidation.reason
    })
    return NextResponse.redirect(
      new URL('/login?message=Error de configuración del servidor. Por favor contacta al administrador.', appUrl)
    )
  }

  const rawSupabase = createServerClient(
    supabaseUrlValidation.url,
    supabaseAnonKeyEnv,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
            console.warn('[Auth Callback] Error setting cookies:', error)
          }
        },
        removeAll(cookiesToRemove) {
          try {
            cookiesToRemove.forEach(({ name, options }) => {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            })
          } catch (error) {
            // The `removeAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
            console.warn('[Auth Callback] Error removing cookies:', error)
          }
        }
      },
      global: {
        fetch: createSupabaseSafeFetch('auth-callback')
      }
    }
  )
  const supabase = applySupabaseAuthResilience(rawSupabase, "auth-callback")

  if (code) {
    // Exchange the code for a session
    // Note: PKCE code verifier should be in cookies from the initial OAuth request
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('[Auth Callback] Error exchanging code:', {
        message: error.message,
        code: error.code,
        status: error.status
      })
      
      // PKCE error typically happens when code verifier is missing
      // This can occur if:
      // 1. Cookies were cleared between OAuth start and callback
      // 2. User is on a different device/browser
      // 3. Cookies are not being read correctly
      if (error.message?.includes('code verifier') || 
          error.message?.includes('code_verifier') ||
          error.code === 'validation_failed' ||
          error.status === 400) {
        console.log('[Auth Callback] PKCE error detected - checking for existing user')

        // Avoid getSession() here (it can trigger refresh_token_not_found if cookies are stale).
        const { data: { user: existingUser }, error: existingUserError } = await supabase.auth.getUser()

        if (existingUserError) {
          console.error('[Auth Callback] Error getting user:', existingUserError)
        }

        if (existingUser) {
          console.log('[Auth Callback] Found existing user for:', existingUser.email)
          return await handleAuthenticatedUser(supabase, existingUser, next, appUrl)
        }
        
        // No existing session - PKCE flow failed
        // This usually means the code verifier cookie was lost
        // Redirect to login with a helpful message
        console.log('[Auth Callback] No session found - PKCE flow incomplete')
        return NextResponse.redirect(
          new URL('/login?message=La sesión expiró durante la autenticación. Por favor intenta iniciar sesión nuevamente.', appUrl)
        )
      }
      
      // Generic auth error
      console.error('[Auth Callback] Unexpected auth error:', error)
      return NextResponse.redirect(
        new URL(`/login?message=${encodeURIComponent(error.message || 'Error de autenticación. Por favor intenta nuevamente.')}`, appUrl)
      )
    }

    if (!data.user) {
      console.error('[Auth Callback] No user after code exchange')
      return NextResponse.redirect(new URL('/login?message=No se pudo obtener usuario', appUrl))
    }

    console.log('[Auth Callback] User authenticated successfully:', data.user.email)
    return await handleAuthenticatedUser(supabase, data.user, next, appUrl)
  }

  // No code provided - try to get existing user
  console.log('[Auth Callback] No code provided, checking for existing user')

  const { data: { user: existingUser } } = await supabase.auth.getUser()

  if (existingUser) {
    console.log('[Auth Callback] Found existing user:', existingUser.email)
    return await handleAuthenticatedUser(supabase, existingUser, next, appUrl)
  }
  
  if (next) {
    return NextResponse.redirect(new URL(next, appUrl))
  }
  return NextResponse.redirect(new URL('/', appUrl))
}

// Helper function to handle authenticated user redirect
async function handleAuthenticatedUser(
  supabase: any, 
  user: any, 
  next: string | null, 
  appUrl: string
): Promise<NextResponse> {
  // If there's a specific next URL, redirect there
  if (next && !next.includes('callback')) {
    return NextResponse.redirect(new URL(next, appUrl))
  }

  // Check for active subscription
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  if (subError) {
    console.error('[Auth Callback] Error checking subscription:', subError)
  }

  // Get home workspace
  const { data: homeWorkspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_home', true)
    .maybeSingle()

  if (workspaceError) {
    console.error('[Auth Callback] Error checking workspace:', workspaceError)
  }

  // Update profile for OAuth users - CRITICAL: set onboarding_completed for middleware check
  // Also ensure email_confirmed_at is set for OAuth users
  const profileUpdate = {
    email_verified: true,
    onboarding_completed: subscription ? true : false,
    onboarding_step: subscription ? 'completed' : 'plan_selection',
    has_onboarded: true
  }
  
  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('user_id', user.id)
  
  if (profileError) {
    console.error('[Auth Callback] Error updating profile:', profileError)
  }
  
  // For OAuth users, ensure email_confirmed_at is set in auth.users
  // This is handled automatically by Supabase, but we log it for debugging
  if (!user.email_confirmed_at && user.app_metadata?.provider && user.app_metadata.provider !== 'email') {
    console.log('[Auth Callback] OAuth user without email_confirmed_at - this should be set by Supabase')
  }

  // Redirect based on subscription status
  if (subscription && homeWorkspace) {
    console.log('[Auth Callback] User has subscription, redirecting to chat')
    return NextResponse.redirect(new URL(`/${homeWorkspace.id}/chat`, appUrl))
  }

  console.log('[Auth Callback] No subscription, redirecting to onboarding')
  return NextResponse.redirect(new URL('/onboarding', appUrl))
}
