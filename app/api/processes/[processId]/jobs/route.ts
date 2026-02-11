export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/supabase/types"
import { env } from "@/lib/env/runtime-env"
import { assertProcessAccess } from "@/lib/server/access/processes"
import { ForbiddenError, NotFoundError } from "@/lib/server/errors"
import { getProcessIngestionJobs } from "@/lib/server/jobs/process-ingestion-jobs"

export async function GET(
  request: Request,
  { params }: { params: { processId: string } }
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

    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get("limit") || "25", 10)
    const jobs = await getProcessIngestionJobs({
      processId: params.processId,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 25
    })

    return NextResponse.json({ jobs })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error al consultar jobs de ingestion",
        details: error.message
      },
      { status: 500 }
    )
  }
}
