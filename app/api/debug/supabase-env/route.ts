import { getEnvVar } from '@/lib/env/runtime-env';
import { NextResponse } from 'next/server';
import { blockIfDebugRouteDisabled } from '@/lib/server/debug-route-gate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const blocked = blockIfDebugRouteDisabled();
  if (blocked) return blocked;

  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

  return NextResponse.json({
    success: true,
    supabase: {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!serviceRoleKey,
    },
    nodeEnv: process.env.NODE_ENV,
    message: supabaseUrl
      ? 'Supabase variables configured'
      : 'ERROR: NEXT_PUBLIC_SUPABASE_URL not configured'
  });
}
