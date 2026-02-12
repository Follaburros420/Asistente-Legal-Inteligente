import { getEnvVar } from '@/lib/env/runtime-env';
import { NextResponse } from 'next/server';
import { validateAndNormalizeSupabaseUrl } from '@/lib/supabase/url-validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  const urlValidation = validateAndNormalizeSupabaseUrl(supabaseUrl || '');

  return NextResponse.json({
    success: true,
    supabase: {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!serviceRoleKey,
      urlValidation
    },
    nodeEnv: process.env.NODE_ENV,
    message: supabaseUrl
      ? 'Supabase variables configured'
      : 'ERROR: NEXT_PUBLIC_SUPABASE_URL not configured'
  });
}
