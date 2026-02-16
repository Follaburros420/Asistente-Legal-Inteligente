export const dynamic = 'force-dynamic'

import { env } from "@/lib/env/runtime-env"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Database } from "@/supabase/types"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { assertWorkspaceAccess } from "@/lib/server/workspaces/access"
import { documentIngestionService } from "@/lib/services/document-ingestion-service"
import { supabaseVectorStore } from "@/lib/services/supabase-vector-store"
import { neo4jGraphService } from "@/lib/services/neo4j-graph-service"
import { doclingService } from "@/lib/services/docling-service"

export async function POST(
  request: Request,
  { params }: { params: { processId: string } }
) {
  try {
    console.log("📥 Starting ingestion process...")

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const supabaseAdmin = createSupabaseClient<Database>(
      env.supabaseUrl(),
      env.supabaseServiceRole()
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("❌ Auth error:", authError)
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    console.log("✅ User authenticated:", user.id)

    const { processId } = params
    const body = await request.json()
    const documentId = body.document_id as string | undefined
    const skipProcessing = body.skip_processing as boolean | undefined
    const providedMarkdown = body.markdown as string | undefined

    // Verify user has access to the process using admin client
    const { data: processRecord, error: processError } = await supabaseAdmin
      .from("processes")
      .select("id,user_id,workspace_id,name,indexing_status")
      .eq("id", processId)
      .single()

    if (processError || !processRecord) {
      return NextResponse.json(
        { error: "Proceso no encontrado", details: processError?.message },
        { status: 404 }
      )
    }

    if (processRecord.workspace_id) {
      const access = await assertWorkspaceAccess(
        supabaseAdmin,
        processRecord.workspace_id,
        user.id
      ).catch(() => null)

      if (!access) {
        return NextResponse.json(
          { error: "No tienes acceso a este proceso" },
          { status: 403 }
        )
      }
    } else if (processRecord.user_id !== user.id) {
      return NextResponse.json(
        { error: "No tienes acceso a este proceso" },
        { status: 403 }
      )
    }

    // Get documents to process using admin client
    let documentsToProcess
    if (documentId) {
      const { data: doc, error: docError } = await supabaseAdmin
        .from("process_documents")
        .select("*")
        .eq("id", documentId)
        .single()

      if (docError || !doc) {
        return NextResponse.json(
          { error: "Documento no encontrado", details: docError?.message },
          { status: 404 }
        )
      }

      if (doc.process_id !== processId) {
        return NextResponse.json(
          { error: "El documento no pertenece a este proceso" },
          { status: 400 }
        )
      }
      documentsToProcess = [doc]
    } else {
      // Process all pending documents
      const { data: pendingDocs, error: pendingError } = await supabaseAdmin
        .from("process_documents")
        .select("*")
        .eq("process_id", processId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (pendingError) {
        console.error("❌ Error fetching pending documents:", pendingError)
        throw new Error(`Error obteniendo documentos pendientes: ${pendingError.message}`)
      }

      documentsToProcess = pendingDocs || []
    }

    console.log(`📄 Found ${documentsToProcess.length} document(s) to process`)

    if (documentsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay documentos pendientes de procesar"
      })
    }

    // Check if services are configured
    if (!documentIngestionService.isConfigured()) {
      console.warn("⚠️ Document ingestion service not fully configured")
      return NextResponse.json(
        { error: "Servicio de ingestión no configurado (falta OPENAI_API_KEY)" },
        { status: 503 }
      )
    }

    // Process each document
    const results = []
    for (const document of documentsToProcess) {
      try {
        console.log(`📄 Processing document: ${document.file_name} (${document.id})`)

        // Update status to processing
        const { error: updateError } = await supabaseAdmin
          .from("process_documents")
          .update({ status: "processing" })
          .eq("id", document.id)

        if (updateError) {
          console.error(`❌ Error updating document status:`, updateError)
          throw new Error(`Error actualizando estado: ${updateError.message}`)
        }

        // Skip processing if requested (for external RAG status)
        if (skipProcessing) {
          console.log(`⏩ Skipping processing for document: ${document.file_name}`)

          if (providedMarkdown) {
            // Store the provided markdown
            const result = await documentIngestionService.ingestDocument(
              providedMarkdown,
              {
                process_id: processId,
                document_id: document.id,
                workspace_id: processRecord.workspace_id,
                user_id: user.id,
                file_name: document.file_name,
                mime_type: document.mime_type || "text/markdown"
              }
            )

            if (!result.success) {
              throw new Error(result.error || "Error en ingestión")
            }

            results.push(result)
          }

          // Update status to indexed
          await supabaseAdmin
            .from("process_documents")
            .update({
              status: "indexed",
              error_message: null,
              metadata: {
                ...(document.metadata || {}),
                processed_with: "supabase_vector_neo4j",
                processed_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq("id", document.id)

          continue
        }

        // Download file from Supabase Storage (Wasabi)
        console.log(`🔗 Downloading file from storage: ${document.storage_path}`)

        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from("files")
          .download(document.storage_path)

        if (downloadError || !fileData) {
          console.error(`❌ Error downloading file:`, downloadError)
          throw new Error(`Error descargando archivo: ${downloadError?.message}`)
        }

        console.log(`✅ File downloaded successfully, size: ${fileData.size} bytes`)

        // Convert file content to buffer
        const fileBuffer = Buffer.from(await fileData.arrayBuffer())
        const mimeType = document.mime_type || "application/octet-stream"

        // Ingest document using Docling for parsing
        // For processes, we use both vector store AND graph (skipGraph: false)
        const result = await documentIngestionService.ingestDocumentFromBuffer(
          fileBuffer,
          {
            process_id: processId,
            document_id: document.id,
            workspace_id: processRecord.workspace_id,
            user_id: user.id,
            file_name: document.file_name,
            mime_type: mimeType
          },
          {
            skipGraph: false, // Processes use both vector store and graph
            useDocling: true
          }
        )

        if (!result.success) {
          throw new Error(result.error || "Error en ingestión")
        }

        results.push(result)

        // Update status to indexed
        const { error: indexedError } = await supabaseAdmin
          .from("process_documents")
          .update({
            status: "indexed",
            error_message: null,
            metadata: {
              ...(document.metadata || {}),
              processed_with: "supabase_vector_neo4j",
              chunks_created: result.chunksCreated,
              entities_extracted: result.entitiesExtracted,
              processed_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq("id", document.id)

        if (indexedError) {
          throw new Error(`Error actualizando estado a indexed: ${indexedError.message}`)
        }

        console.log(`✅ Documento ${document.file_name} indexado correctamente`)

      } catch (error: any) {
        console.error(`❌ Error procesando documento ${document.file_name}:`, error)

        // Provide user-friendly error message
        let userFriendlyMessage = error.message || "Error desconocido al procesar el documento"

        if (userFriendlyMessage.includes("OPENAI_API_KEY")) {
          userFriendlyMessage = "Error de configuración del servicio de embeddings"
        } else if (userFriendlyMessage.includes("Timeout")) {
          userFriendlyMessage = "El documento tardó demasiado en procesarse. Intenta con un archivo más pequeño."
        }

        // Update document status to error
        await supabaseAdmin
          .from("process_documents")
          .update({
            status: "error",
            error_message: userFriendlyMessage,
            updated_at: new Date().toISOString()
          })
          .eq("id", document.id)

        results.push({
          success: false,
          documentId: document.id,
          error: userFriendlyMessage
        })
      }
    }

    // Update process indexing_status
    const { data: allDocuments } = await supabaseAdmin
      .from("process_documents")
      .select("*")
      .eq("process_id", processId)

    const indexedCount = allDocuments?.filter(d => d.status === "indexed").length || 0
    const errorCount = allDocuments?.filter(d => d.status === "error").length || 0
    const pendingCount = allDocuments?.filter(d => d.status === "pending").length || 0
    const processingCount = allDocuments?.filter(d => d.status === "processing").length || 0

    let newIndexingStatus = "ready"
    if (errorCount > 0 && indexedCount === 0) {
      newIndexingStatus = "error"
    } else if (processingCount > 0 || pendingCount > 0) {
      newIndexingStatus = "processing"
    } else if (indexedCount > 0) {
      newIndexingStatus = "ready"
    } else {
      newIndexingStatus = "pending"
    }

    await supabaseAdmin
      .from("processes")
      .update({
        indexing_status: newIndexingStatus,
        last_indexed_at: newIndexingStatus === "ready" ? new Date().toISOString() : undefined
      })
      .eq("id", processId)

    console.log(`📊 Ingestion complete: ${indexedCount} indexed, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      message: `Procesamiento completado. ${indexedCount} documento(s) indexado(s).`,
      indexed: indexedCount,
      errors: errorCount,
      pending: pendingCount,
      processing: processingCount,
      results
    })

  } catch (error: any) {
    console.error("❌ Error en ingestión:", error)
    return NextResponse.json(
      {
        error: "Error al procesar documentos",
        details: error.message
      },
      { status: 500 }
    )
  }
}
