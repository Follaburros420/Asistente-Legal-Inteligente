// app/api/debug/workspace/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceById } from '@/db/workspaces';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { blockIfDebugRouteDisabled } from '@/lib/server/debug-route-gate';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const blocked = blockIfDebugRouteDisabled();
  if (blocked) return blocked;

  const supabase = getSupabaseServer();
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing workspace_id parameter' 
        },
        { status: 400 }
      );
    }

    // Try to get workspace using our function
    try {
      const workspace = await getWorkspaceById(workspaceId);
      return NextResponse.json({
        success: true,
        workspace,
        method: 'getWorkspaceById'
      });
    } catch (error) {
      // If our function fails, try direct query
      const { data: workspace, error: dbError } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (dbError) {
        return NextResponse.json({
          success: false,
          error: 'Workspace not found',
          dbError: dbError.message,
          method: 'direct_query'
        });
      }

      return NextResponse.json({
        success: true,
        workspace,
        method: 'direct_query'
      });
    }

  } catch (error) {
    console.error('Error in debug workspace endpoint:', error);
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




