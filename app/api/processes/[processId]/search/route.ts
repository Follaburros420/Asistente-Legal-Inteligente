export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { supabaseVectorStore } from "@/lib/services/supabase-vector-store"

interface SearchResult {
    id: string
    content: string
    metadata: Record<string, any>
    similarity: number
    process_id: string
    document_id: string
}

interface SearchResponse {
    results: SearchResult[]
    query: string
    meta?: {
        resultCount: number
        threshold: number
        processId: string
    }
}

// POST /api/processes/[processId]/search - Vector similarity search
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ processId: string }> }
) {
    try {
        const { processId } = await params
        const body = await request.json()

        const query = body.query as string
        const limit = body.limit || 5
        const threshold = body.threshold || 0.7

        if (!processId) {
            return NextResponse.json(
                { error: "Process ID is required" },
                { status: 400 }
            )
        }

        if (!query) {
            return NextResponse.json(
                { error: "Query is required" },
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

        // Verify user has access to this process
        const { data: process, error: fetchError } = await supabase
            .from("processes")
            .select("id, user_id, workspace_id")
            .eq("id", processId)
            .single()

        if (fetchError || !process) {
            return NextResponse.json(
                { error: "Proceso no encontrado" },
                { status: 404 }
            )
        }

        // Check access
        const hasAccess = process.user_id === user.id || 
            (process.workspace_id && await checkWorkspaceAccess(supabase, process.workspace_id, user.id))

        if (!hasAccess) {
            return NextResponse.json(
                { error: "No tienes acceso a este proceso" },
                { status: 403 }
            )
        }

        // Check if vector store is configured
        if (!supabaseVectorStore.isConfigured()) {
            return NextResponse.json(
                { error: "Vector store no configurado" },
                { status: 503 }
            )
        }

        // Perform vector search
        console.log(`🔍 Searching in process ${processId}: "${query.substring(0, 50)}..."`)

        const results = await supabaseVectorStore.similaritySearch(query, {
            processId,
            workspaceId: process.workspace_id,
            limit,
            threshold
        })

        console.log(`✅ Found ${results.length} results`)

        const response: SearchResponse = {
            results,
            query,
            meta: {
                resultCount: results.length,
                threshold,
                processId
            }
        }

        return NextResponse.json(response)
    } catch (error: any) {
        console.error("Error in search:", error)
        return NextResponse.json(
            { error: error.message || "Error en la búsqueda" },
            { status: 500 }
        )
    }
}

// Helper function to check workspace access
async function checkWorkspaceAccess(supabase: any, workspaceId: string, userId: string): Promise<boolean> {
    try {
        const { data: membership } = await supabase
            .from("workspace_members")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("user_id", userId)
            .single()

        return !!membership
    } catch {
        return false
    }
}

// GET /api/processes/[processId]/search - Get document chunks for a process
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ processId: string }> }
) {
    try {
        const { processId } = await params
        const { searchParams } = new URL(request.url)
        const documentId = searchParams.get("documentId")

        if (!processId) {
            return NextResponse.json(
                { error: "Process ID is required" },
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

        // Verify user has access to this process
        const { data: process } = await supabase
            .from("processes")
            .select("user_id, workspace_id")
            .eq("id", processId)
            .single()

        if (!process) {
            return NextResponse.json(
                { error: "Proceso no encontrado" },
                { status: 404 }
            )
        }

        const hasAccess = process.user_id === user.id || 
            (process.workspace_id && await checkWorkspaceAccess(supabase, process.workspace_id, user.id))

        if (!hasAccess) {
            return NextResponse.json(
                { error: "No tienes acceso a este proceso" },
                { status: 403 }
            )
        }

        // Get chunks
        const chunks = await supabaseVectorStore.getProcessChunks(processId)

        // Filter by document if specified
        const filteredChunks = documentId 
            ? chunks.filter(c => c.document_id === documentId)
            : chunks

        return NextResponse.json({
            chunks: filteredChunks,
            meta: {
                totalChunks: chunks.length,
                filteredChunks: filteredChunks.length,
                processId,
                documentId
            }
        })
    } catch (error: any) {
        console.error("Error getting chunks:", error)
        return NextResponse.json(
            { error: error.message || "Error obteniendo chunks" },
            { status: 500 }
        )
    }
}
