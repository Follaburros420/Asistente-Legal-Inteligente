
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env/runtime-env'
import { Database } from '@/supabase/types'
import { assertProcessAccess } from '@/lib/server/access/processes'
import { ForbiddenError, NotFoundError } from '@/lib/server/errors'
import {
    enqueueProcessDocumentIngestionJob,
    scheduleQueuedIngestionJob
} from '@/lib/server/jobs/process-ingestion-jobs'

export async function POST(
    _req: NextRequest,
    { params }: { params: { processId: string; documentId: string } }
) {
    try {
        const { processId, documentId } = params

        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Admin client for full access (needed for storage download sometimes)
        const supabaseAdmin = createSupabaseClient<Database>(
            env.supabaseUrl(),
            env.supabaseServiceRole()
        )

        try {
            await assertProcessAccess(supabaseAdmin, processId, user.id)
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })
            }
            if (error instanceof ForbiddenError) {
                return NextResponse.json({ error: 'No tienes acceso a este proceso' }, { status: 403 })
            }
            throw error
        }

        const { data: doc, error: docError } = await supabaseAdmin
            .from('process_documents')
            .select('id,process_id,metadata')
            .eq('id', documentId)
            .eq('process_id', processId)
            .single()

        if (docError || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        const { data: processRecord } = await supabaseAdmin
            .from('processes')
            .select('workspace_id')
            .eq('id', processId)
            .single()

        if (!processRecord) {
            return NextResponse.json({ error: 'Process not found' }, { status: 404 })
        }

        const job = await enqueueProcessDocumentIngestionJob({
            processId,
            documentId,
            ownerUserId: user.id,
            workspaceId: processRecord.workspace_id,
            metadata: (doc.metadata as Record<string, any>) || {}
        })

        scheduleQueuedIngestionJob(job.id)

        return NextResponse.json(
            {
                success: true,
                message: 'Ingestion encolada',
                job: {
                    id: job.id,
                    status: job.status
                }
            },
            { status: 202 }
        )

    } catch (error: any) {
        console.error(`❌ Ingestion enqueue failed for doc ${params.documentId}:`, error)

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
