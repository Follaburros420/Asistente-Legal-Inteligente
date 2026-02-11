export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { ragBackendService } from "@/lib/services/rag-backend"
import { reenqueueProcessForRecovery } from "@/lib/server/jobs/process-ingestion-jobs"

interface GraphNode {
    id: string
    label: string
    type: string
    properties?: Record<string, any>
}

interface GraphEdge {
    id: string
    source: string
    target: string
    label: string
    properties?: Record<string, any>
}

interface GraphResponse {
    nodes: GraphNode[]
    edges: GraphEdge[]
    meta?: {
        nodeCount: number
        edgeCount: number
        appliedFilters: Record<string, string>
    }
}

function shouldTriggerRecovery(error: any): boolean {
    const status = Number(error?.status || error?.response?.status || 0)
    const message = String(error?.message || "").toLowerCase()
    return (
        status === 404 ||
        status === 409 ||
        status === 422 ||
        message.includes("vector") ||
        message.includes("graph") ||
        message.includes("index") ||
        message.includes("qdrant") ||
        message.includes("neo4j") ||
        message.includes("not found")
    )
}

// GET /api/processes/[processId]/graph - Get knowledge graph for a process
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ processId: string }> }
) {
    try {
        const { processId } = await params
        const { searchParams } = new URL(request.url)

        const status = searchParams.get("status") || "active"
        const limit = parseInt(searchParams.get("limit") || "100")
        const maxDepth = parseInt(searchParams.get("maxDepth") || "3")

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

        // Verify user owns this process (BOLA protection)
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

        if (process.user_id !== user.id) {
            return NextResponse.json(
                { error: "No tienes acceso a este proceso" },
                { status: 403 }
            )
        }

        if (!ragBackendService.isConfigured()) {
            return NextResponse.json(
                { error: "RAG backend no configurado (Falta RAG_BACKEND_URL)" },
                { status: 503 }
            )
        }

        let graphData: any
        try {
            graphData = await ragBackendService.getGraph(
                process.workspace_id || "",
                processId,
                status,
                limit,
                maxDepth
            )
        } catch (error: any) {
            if (shouldTriggerRecovery(error)) {
                const recoveryJobs = await reenqueueProcessForRecovery({
                    processId,
                    ownerUserId: process.user_id,
                    workspaceId: process.workspace_id,
                    reason: "graph_request_missing_vectors_or_graph"
                }).catch(() => [])

                return NextResponse.json(
                    {
                        error: "El grafo no estaba disponible. Se relanzó la ingesta.",
                        recoveryTriggered: recoveryJobs.length > 0,
                        queuedJobs: recoveryJobs.length
                    },
                    { status: 409 }
                )
            }
            throw error
        }

        const nodeCount = graphData.nodes?.length || 0
        const edgeCount = graphData.edges?.length || 0
        let recoveryTriggered = false
        let queuedJobs = 0

        if (nodeCount === 0 && edgeCount === 0) {
            const { count: docCount } = await supabase
                .from("process_documents")
                .select("id", { count: "exact", head: true })
                .eq("process_id", processId)
                .in("status", ["indexed", "pending", "error"])

            if ((docCount || 0) > 0) {
                const recoveryJobs = await reenqueueProcessForRecovery({
                    processId,
                    ownerUserId: process.user_id,
                    workspaceId: process.workspace_id,
                    reason: "graph_empty_response_recovery"
                }).catch(() => [])

                recoveryTriggered = recoveryJobs.length > 0
                queuedJobs = recoveryJobs.length
            }
        }

        // Add meta information
        const response: GraphResponse = {
            nodes: graphData.nodes || [],
            edges: graphData.edges || [],
            meta: {
                nodeCount,
                edgeCount,
                recoveryTriggered: recoveryTriggered ? "true" : "false",
                queuedJobs: queuedJobs.toString(),
                appliedFilters: {
                    status,
                    limit: limit.toString(),
                    maxDepth: maxDepth.toString()
                }
            }
        }

        return NextResponse.json(response)
    } catch (error: any) {
        console.error("Error fetching graph:", error)
        return NextResponse.json(
            { error: error.message || "Error al obtener el grafo" },
            { status: 500 }
        )
    }
}
