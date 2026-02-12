// app/api/sessions/route.ts
// API endpoint for user session management (device limit)

export const dynamic = 'force-dynamic'

import { env, getEnvVar } from '@/lib/env/runtime-env';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  checkDeviceLimit,
  createUserSession,
  getUserSessions,
  deactivateSessionById,
  deactivateAllSessions,
  updateSessionActivity,
  parseDeviceInfo,
  validateSession
} from '@/db/user-sessions';

const isSessionsDebugEnabled =
  process.env.NODE_ENV !== 'production' && process.env.SESSIONS_DEBUG === 'true';

// Helper to get authenticated user
async function getAuthenticatedUser(req: NextRequest) {
  const cookieStore = cookies();

  const rawSupabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const rawSupabaseKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (isSessionsDebugEnabled) {
    console.log('[Sessions API] Supabase env status', {
      urlPresent: Boolean(rawSupabaseUrl),
      keyPresent: Boolean(rawSupabaseKey)
    });
  }
  
  if (!rawSupabaseUrl || !rawSupabaseKey) {
    const missing = [];
    if (!rawSupabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!rawSupabaseKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const errorMsg = `Missing Supabase configuration: ${missing.join(', ')}.`;
    console.error(`[Sessions API] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  const supabaseUrl = rawSupabaseUrl;
  const supabaseKey = rawSupabaseKey;
  
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from API route - may not be able to set cookies
          }
        },
        removeAll(cookiesToRemove) {
          try {
            cookiesToRemove.forEach(({ name, options }) => {
              cookieStore.set(name, '', { ...options, maxAge: 0 });
            });
          } catch {
            // Called from API route - may not be able to remove cookies
          }
        }
      }
    }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// GET - Get user's active sessions
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const sessions = await getUserSessions(user.id);
    const deviceLimit = await checkDeviceLimit(user.id);
    
    return NextResponse.json({
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        deviceName: s.device_name || 'Dispositivo desconocido',
        deviceType: s.device_type || 'unknown',
        browser: s.browser || 'Unknown',
        lastActivity: s.last_activity_at,
        createdAt: s.created_at,
        isCurrent: false // Will be determined client-side
      })),
      deviceLimit: {
        current: deviceLimit.activeSessionsCount,
        max: 2,
        canAddMore: deviceLimit.canCreateSession
      }
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Create a new session (login)
export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    
    // Get environment variables with trimming and validation
    const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      console.error(`[Sessions API] Missing Supabase env vars: ${missing.join(', ')}`);
      return NextResponse.json(
        { 
          error: `Missing Supabase configuration: ${missing.join(', ')}`
        },
        { status: 500 }
      );
    }
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Called from API route - may not be able to set cookies
            }
          },
          removeAll(cookiesToRemove) {
            try {
              cookiesToRemove.forEach(({ name, options }) => {
                cookieStore.set(name, '', { ...options, maxAge: 0 });
              });
            } catch {
              // Called from API route - may not be able to remove cookies
            }
          }
        }
      }
    );
    
    // Get user AND session info
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { sessionToken, fingerprint, forceCreate } = body;
    
    // Get device info from headers
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    
    const deviceInfo = parseDeviceInfo(userAgent);
    
    // Check device limit first
    const limitCheck = await checkDeviceLimit(user.id);
    
    if (!limitCheck.canCreateSession && !forceCreate) {
      return NextResponse.json({
        success: false,
        error: 'device_limit_reached',
        message: 'Has alcanzado el límite de 2 dispositivos. Por favor cierra sesión en otro dispositivo.',
        activeSessionsCount: limitCheck.activeSessionsCount,
        requiresAction: true
      }, { status: 403 });
    }
    
    // Get the auth session ID from the JWT claims if available
    // This is the REAL Supabase session ID that we need to invalidate later
    let authSessionId: string | undefined;
    if (session?.access_token) {
      try {
        // Decode JWT to get session_id claim
        const payload = JSON.parse(
          Buffer.from(session.access_token.split('.')[1], 'base64').toString()
        );
        authSessionId = payload.session_id;
        if (isSessionsDebugEnabled) {
          console.log('[Sessions API] Extracted auth session_id from JWT');
        }
      } catch (err) {
        if (isSessionsDebugEnabled) {
          console.warn('[Sessions API] Could not decode JWT for session_id');
        }
      }
    }
    
    // Create session with the auth_session_id for later invalidation
    const result = await createUserSession({
      userId: user.id,
      sessionToken: sessionToken || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      authSessionId, // THIS IS KEY - store the real auth session ID
      deviceFingerprint: fingerprint,
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      ipAddress,
      userAgent,
      forceCreate: forceCreate || false
    });
    
    if (!result.created) {
      return NextResponse.json({
        success: false,
        error: 'session_creation_failed',
        message: result.errorMessage || 'No se pudo crear la sesión'
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      removedSessionId: result.removedSessionId,
      message: result.removedSessionId 
        ? 'Sesión creada. Se cerró la sesión más antigua en otro dispositivo.'
        : 'Sesión creada exitosamente.'
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate a session
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const logoutAll = searchParams.get('all') === 'true';
    
    if (logoutAll) {
      // Logout from all devices
      const success = await deactivateAllSessions(user.id);
      
      return NextResponse.json({
        success,
        message: success 
          ? 'Se cerró sesión en todos los dispositivos'
          : 'Error al cerrar sesiones'
      });
    }
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Se requiere sessionId o all=true' },
        { status: 400 }
      );
    }
    
    // Logout from specific session
    const success = await deactivateSessionById(sessionId, user.id);
    
    return NextResponse.json({
      success,
      message: success 
        ? 'Sesión cerrada exitosamente'
        : 'No se encontró la sesión o ya estaba cerrada'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PATCH - Update session activity (heartbeat)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionToken } = body;
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Se requiere sessionToken' },
        { status: 400 }
      );
    }
    
    const isValid = await validateSession(sessionToken);
    
    if (!isValid) {
      return NextResponse.json({
        success: false,
        valid: false,
        message: 'Sesión inválida o expirada'
      }, { status: 401 });
    }
    
    const updated = await updateSessionActivity(sessionToken);
    
    return NextResponse.json({
      success: updated,
      valid: true,
      message: updated ? 'Actividad actualizada' : 'No se pudo actualizar'
    });
  } catch (error) {
    console.error('Error updating session activity:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
