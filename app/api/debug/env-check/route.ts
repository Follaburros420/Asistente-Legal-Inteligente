// app/api/debug/env-check/route.ts
import { getEnvVar } from '@/lib/env/runtime-env';
import { NextRequest, NextResponse } from 'next/server';
import { blockIfDebugRouteDisabled } from '@/lib/server/debug-route-gate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const blocked = blockIfDebugRouteDisabled();
  if (blocked) return blocked;

  try {
    // #region agent log
    const fs = require('fs');
    const path = require('path');
    try {
      const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
      const logEntry = JSON.stringify({
        location: 'app/api/debug/env-check/route.ts:GET',
        message: 'Debug endpoint - env vars check',
        data: {
          hasSupabaseUrl: !!getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
          hasSupabaseAnonKey: !!getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
          hasServiceKey: !!getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
          supabaseUrlLength: getEnvVar('NEXT_PUBLIC_SUPABASE_URL').length,
          supabaseAnonKeyLength: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY').length,
          nodeEnv: process.env.NODE_ENV
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'D'
      }) + '\n';
      fs.appendFileSync(logPath, logEntry);
    } catch (e) {
      // Ignore if log file doesn't exist
    }
    // #endregion

    const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
    const wompiPublicKey = getEnvVar('NEXT_PUBLIC_WOMPI_PUBLIC_KEY');
    const wompiBaseUrl = getEnvVar('NEXT_PUBLIC_WOMPI_BASE_URL');
    const publicAppUrl = getEnvVar('NEXT_PUBLIC_APP_URL');

    const envVars = {
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'Set' : 'Missing',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Set' : 'Missing',
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? 'Set' : 'Missing',
      // Wompi
      WOMPI_ENVIRONMENT: process.env.WOMPI_ENVIRONMENT,
      NEXT_PUBLIC_WOMPI_PUBLIC_KEY: wompiPublicKey ? 'Set' : 'Missing',
      WOMPI_PRIVATE_KEY: process.env.WOMPI_PRIVATE_KEY ? 'Set' : 'Missing',
      WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET ? 'Set' : 'Missing',
      WOMPI_WEBHOOK_SECRET: process.env.WOMPI_WEBHOOK_SECRET ? 'Set' : 'Missing',
      NEXT_PUBLIC_WOMPI_BASE_URL: wompiBaseUrl,
      NEXT_PUBLIC_APP_URL: publicAppUrl,
    };

    return NextResponse.json({
      success: true,
      environmentVariables: envVars,
      lengths: {
        supabaseUrl: supabaseUrl?.length || 0,
        supabaseAnonKey: supabaseAnonKey?.length || 0,
        wompiPublicKey: wompiPublicKey?.length || 0,
        wompiPrivateKey: process.env.WOMPI_PRIVATE_KEY?.length || 0,
        wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET?.length || 0,
        wompiWebhookSecret: process.env.WOMPI_WEBHOOK_SECRET?.length || 0,
      },
      nodeEnv: process.env.NODE_ENV,
    });

  } catch (error) {
    console.error('Error checking environment variables:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error checking environment variables',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


