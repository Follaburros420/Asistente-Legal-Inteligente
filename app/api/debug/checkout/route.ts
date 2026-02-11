// app/api/debug/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPlanById } from '@/db/plans';
import { getWorkspaceById } from '@/db/workspaces';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { blockIfDebugRouteDisabled } from '@/lib/server/debug-route-gate';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const blocked = blockIfDebugRouteDisabled();
  if (blocked) return blocked;

  const supabase = getSupabaseServer();
  try {
    const { plan_id, workspace_id } = await req.json();

    if (!plan_id || !workspace_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: plan_id and workspace_id' 
        },
        { status: 400 }
      );
    }

    const debugInfo: any = {};

    // Step 1: Get plan details
    try {
      const plan = await getPlanById(plan_id);
      debugInfo.plan = plan;
    } catch (error) {
      debugInfo.planError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Step 2: Get workspace details
    try {
      const workspace = await getWorkspaceById(workspace_id);
      debugInfo.workspace = workspace;
    } catch (error) {
      debugInfo.workspaceError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Step 3: Get user profile
    if (debugInfo.workspace) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', debugInfo.workspace.user_id)
          .single();

        if (profileError) {
          debugInfo.profileError = profileError.message;
        } else {
          debugInfo.profile = profile;
        }
      } catch (error) {
        debugInfo.profileError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Step 4: Get user email from auth
    if (debugInfo.workspace) {
      try {
        const { data: user, error: userError } = await supabase.auth.admin.getUserById(debugInfo.workspace.user_id);
        
        if (userError) {
          debugInfo.userError = userError.message;
        } else {
          debugInfo.user = {
            id: user.user?.id,
            email: user.user?.email,
            email_confirmed_at: user.user?.email_confirmed_at
          };
        }
      } catch (error) {
        debugInfo.userError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return NextResponse.json({
      success: true,
      debugInfo
    });

  } catch (error) {
    console.error('Error in debug checkout endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}




