export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { deleteObjectFromBucket } from "@/lib/server/storage/object-storage"
import { markObjectInventoryDeleted } from "@/lib/server/storage/object-inventory"

// DELETE /api/processes/[processId]/documents/[documentId] - Delete a document from a process
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ processId: string; documentId: string }> }
) {
    try {
        const { processId, documentId } = await params

        if (!processId || !documentId) {
            return NextResponse.json(
                { error: "Process ID and Document ID are required" },
                { status: 400 }
            )
        }

        // Validate user is authenticated
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: "No autorizado" },
                { status: 401 }
            )
        }

        // Verify user owns this document and get storage path
        const { data: existingDoc, error: fetchError } = await supabase
            .from("process_documents")
            .select("user_id, process_id, storage_path")
            .eq("id", documentId)
            .single()

        if (fetchError || !existingDoc) {
            return NextResponse.json(
                { error: "Documento no encontrado" },
                { status: 404 }
            )
        }

        if (existingDoc.user_id !== user.id) {
            return NextResponse.json(
                { error: "No tienes permisos para eliminar este documento" },
                { status: 403 }
            )
        }

        // Verify document belongs to the specified process
        if (existingDoc.process_id !== processId) {
            return NextResponse.json(
                { error: "El documento no pertenece a este proceso" },
                { status: 400 }
            )
        }

        // Delete document sections first (embeddings)
        try {
            await supabase
                .from("process_document_sections")
                .delete()
                .eq("document_id", documentId)
        } catch (e) {
            console.log("Error cleaning up document sections (ignoring):", e)
        }

        // Delete the file from storage if it exists
        if (existingDoc.storage_path) {
            try {
                await deleteObjectFromBucket(existingDoc.storage_path, "files")
                await markObjectInventoryDeleted("files", existingDoc.storage_path)
            } catch (storageError) {
                console.error("Error deleting file from storage:", storageError)
                // Continue even if storage deletion fails
            }
        }

        // Delete the document record
        const { error: deleteError } = await supabase
            .from("process_documents")
            .delete()
            .eq("id", documentId)

        if (deleteError) {
            throw new Error(deleteError.message)
        }

        return NextResponse.json({
            success: true,
            message: "Documento eliminado correctamente"
        })
    } catch (error: any) {
        console.error("Error deleting document:", error)
        return NextResponse.json(
            { error: error.message || "Error al eliminar el documento" },
            { status: 500 }
        )
    }
}
