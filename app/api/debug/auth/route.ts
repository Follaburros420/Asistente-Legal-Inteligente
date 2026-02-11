// app/api/debug/auth/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { blockIfDebugRouteDisabled } from '@/lib/server/debug-route-gate';

export async function GET(req: NextRequest) {
  const blocked = blockIfDebugRouteDisabled();
  if (blocked) return blocked;

  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    return NextResponse.json({
      success: true,
      data: {
        user: user ? {
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at
        } : null,
        error: error?.message || null,
        hasSession: !!user
      }
    });

  } catch (error) {
    console.error('Debug auth error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const blocked = blockIfDebugRouteDisabled();
  if (blocked) return blocked;

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Test signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/auth/verify-email`
      }
    });

    return NextResponse.json({
      success: !error,
      data: {
        user: data.user ? {
          id: data.user.id,
          email: data.user.email,
          email_confirmed_at: data.user.email_confirmed_at,
          created_at: data.user.created_at
        } : null,
        session: data.session ? {
          access_token: data.session.access_token ? 'present' : 'missing',
          refresh_token: data.session.refresh_token ? 'present' : 'missing'
        } : null,
        error: error?.message || null,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/auth/verify-email`
      }
    });

  } catch (error) {
    console.error('Debug signup error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}





