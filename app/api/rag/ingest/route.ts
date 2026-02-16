export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { documentIngestionService } from '@/lib/services/document-ingestion-service'
import { doclingService } from '@/lib/services/docling-service'

/**
 * API Route: POST /api/rag/ingest
 * Ingesta de documentos para el chat general
 * 
 * Este endpoint es para el chat general y SOLO usa vector store (no grafo)
 * Para procesos legales, usar /api/processes/[processId]/ingest
 */
export async function POST(req: NextRequest) {
    try {
        // Verificar autenticación
        const supabase = await createClient(cookies())
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            )
        }

        // Parsear FormData
        const formData = await req.formData()
        const file = formData.get('file') as File
        const workspaceId = formData.get('workspace_id') as string
        const metadataStr = formData.get('metadata') as string

        if (!file) {
            return NextResponse.json(
                { error: 'Archivo requerido' },
                { status: 400 }
            )
        }

        // Parsear metadata si existe
        let metadata: Record<string, any> = {}
        if (metadataStr) {
            try {
                metadata = JSON.parse(metadataStr)
            } catch (e) {
                console.warn('⚠️ Error parseando metadata:', e)
            }
        }

        // Generate a unique document ID
        const documentId = metadata.document_id || crypto.randomUUID()

        console.log(`📄 Processing document for chat ingestion: ${file.name}`)

        // Convert File to Buffer
        const fileBuffer = Buffer.from(await file.arrayBuffer())
        const mimeType = file.type || 'application/octet-stream'

        // Ingest document using Docling for parsing
        // For chat, we ONLY use vector store (skipGraph: true)
        const result = await documentIngestionService.ingestDocumentFromBuffer(
            fileBuffer,
            {
                process_id: metadata.process_id || 'chat-general',
                document_id: documentId,
                workspace_id: workspaceId,
                user_id: user.id,
                file_name: file.name,
                mime_type: mimeType
            },
            {
                skipGraph: true, // Chat general only uses vector store, not graph
                useDocling: true
            }
        )

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error || 'Error al procesar documento'
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Documento ingestado correctamente en el vector store',
            document_id: documentId,
            chunks_created: result.chunksCreated,
            processed_with: 'docling + supabase_vector'
        })

    } catch (error: any) {
        console.error('❌ Error en /api/rag/ingest:', error)

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Error al ingestar documento',
                details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
            },
            { status: 500 }
        )
    }
}
