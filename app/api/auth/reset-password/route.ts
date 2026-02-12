import { env } from '@/lib/env/runtime-env'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function redirect303(path: string, request: NextRequest) {
  const origin = request.nextUrl.origin || env.appUrl()
  return NextResponse.redirect(new URL(path, origin), 303)
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const formData = await req.formData()

  const locale =
    (formData.get('locale') as string | null) ||
    cookieStore.get('NEXT_LOCALE')?.value ||
    'es'
  const email = (formData.get('email') as string | null)?.trim() || ''

  if (!email) {
    return redirect303(
      `/${locale}/login?message=${encodeURIComponent('El correo es obligatorio')}`,
      req
    )
  }

  const supabase = createClient(cookieStore)
  const appUrl = env.appUrl()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/${locale}/login/password`
  })

  if (error) {
    return redirect303(
      `/${locale}/login?message=${encodeURIComponent(error.message)}`,
      req
    )
  }

  return redirect303(
    `/${locale}/login?message=${encodeURIComponent('Revisa tu correo para restablecer la contraseña')}`,
    req
  )
}
