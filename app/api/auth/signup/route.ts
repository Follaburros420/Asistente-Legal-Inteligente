import { env } from '@/lib/env/runtime-env'
import { createClient } from '@/lib/supabase/server'
import { mapFriendlyAuthMessage } from '@/lib/supabase/auth-errors'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function redirect303(path: string, request: NextRequest) {
  const origin = request.nextUrl.origin || env.appUrl()
  return NextResponse.redirect(new URL(path, origin), 303)
}

function splitCsv(value: string | undefined) {
  return value
    ? value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
    : []
}

function sanitizeRedirect(path: string | null): string | null {
  const value = (path || '').trim()
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  if (value.includes('\\')) return null
  return value
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const formData = await req.formData()

  const locale =
    (formData.get('locale') as string | null) ||
    cookieStore.get('NEXT_LOCALE')?.value ||
    'es'

  const email = (formData.get('email') as string | null)?.trim() || ''
  const password = (formData.get('password') as string | null) || ''
  const confirmPassword = (formData.get('confirmPassword') as string | null) || ''
  const redirectPath = sanitizeRedirect(formData.get('redirect') as string | null)

  if (!email || !password) {
    return redirect303(
      `/${locale}/register?message=${encodeURIComponent('Correo y contrasena son obligatorios')}`,
      req
    )
  }

  if (!confirmPassword) {
    return redirect303(
      `/${locale}/register?message=${encodeURIComponent('Debes confirmar la contrasena')}`,
      req
    )
  }

  if (password !== confirmPassword) {
    return redirect303(
      `/${locale}/register?message=${encodeURIComponent('Las contrasenas no coinciden')}`,
      req
    )
  }

  const emailDomainWhitelist = splitCsv(process.env['EMAIL_DOMAIN_WHITELIST'])
  const emailWhitelist = splitCsv(process.env['EMAIL_WHITELIST'])

  if (emailDomainWhitelist.length > 0 || emailWhitelist.length > 0) {
    const domain = email.split('@')[1] || ''
    const domainMatch = emailDomainWhitelist.includes(domain)
    const emailMatch = emailWhitelist.includes(email)

    if (!domainMatch && !emailMatch) {
      return redirect303(
        `/${locale}/register?message=${encodeURIComponent(`Email ${email} no esta permitido para registrarse.`)}`,
        req
      )
    }
  }

  const supabase = createClient(cookieStore)
  const appUrl = env.appUrl()
  const nextAfterVerify =
    redirectPath?.startsWith('/invite/') ? redirectPath : `/${locale}/auth/verify-email`

  let error: unknown = null
  try {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(nextAfterVerify)}`
      }
    })
    error = result.error
  } catch (signUpError) {
    error = signUpError
  }

  if (error) {
    const message = mapFriendlyAuthMessage(
      error,
      'Error al registrar la cuenta'
    )
    return redirect303(
      `/${locale}/register?message=${encodeURIComponent(message)}`,
      req
    )
  }

  return redirect303(
    `/${locale}/auth/verify-email?message=${encodeURIComponent('Revisa tu correo para verificar tu cuenta')}`,
    req
  )
}
