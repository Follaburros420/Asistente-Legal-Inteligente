export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/supabase/types"
import { env } from "@/lib/env/runtime-env"
import { assertProcessAccess } from "@/lib/server/access/processes"
import { ForbiddenError, NotFoundError } from "@/lib/server/errors"
import {
  retryProcessIngestionJob,
  scheduleQueuedIngestionJob
} from "@/lib/server/jobs/process-ingestion-jobs"

export async function POST(
  _request: Request,
  { params }: { params: { processId: string; jobId: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const supabaseAdmin = createSupabaseClient<Database>(
      env.supabaseUrl(),
      env.supabaseServiceRole()
    )

    try {
      await assertProcessAccess(supabaseAdmin, params.processId, user.id)
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: "No tienes acceso a este proceso" },
          { status: 403 }
        )
      }
      throw error
    }

    const job = await retryProcessIngestionJob({
      processId: params.processId,
      jobId: params.jobId,
      ownerUserId: user.id
    })

    if (!job) {
      return NextResponse.json(
        { error: "Job no encontrado o no reintentable" },
        { status: 404 }
      )
    }

    scheduleQueuedIngestionJob(job.id)
    return NextResponse.json({ success: true, job })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error reintentando job de ingestion",
        details: error.message
      },
      { status: 500 }
    )
  }
}
