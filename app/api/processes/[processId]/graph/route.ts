export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { neo4jGraphService } from "@/lib/services/neo4j-graph-service"
import { supabaseVectorStore } from "@/lib/services/supabase-vector-store"

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
        source: string
    }
}

// GET /api/processes/[processId]/graph - Get knowledge graph for a process
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ processId: string }> }
) {
    try {
        const { processId } = await params
        const { searchParams } = new URL(request.url)

        const limit = parseInt(searchParams.get("limit") || "100")
        const includeDocuments = searchParams.get("includeDocuments") === "true"

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
            // Check workspace access
            if (process.workspace_id) {
                const { data: membership } = await supabase
                    .from("workspace_members")
                    .select("id")
                    .eq("workspace_id", process.workspace_id)
                    .eq("user_id", user.id)
                    .single()

                if (!membership) {
                    return NextResponse.json(
                        { error: "No tienes acceso a este proceso" },
                        { status: 403 }
                    )
                }
            } else {
                return NextResponse.json(
                    { error: "No tienes acceso a este proceso" },
                    { status: 403 }
                )
            }
        }

        // Try to get graph from Neo4j first
        let graphData
        let source = "neo4j"

        if (neo4jGraphService.isConfigured()) {
            console.log(`📊 Fetching graph from Neo4j for process: ${processId}`)
            graphData = await neo4jGraphService.getProcessGraph(processId, {
                limit,
                includeDocuments
            })
            
            // If no specific process data, get all graph data
            if (graphData.nodes.length === 0) {
                console.log(`📊 No specific process data found, fetching all graph data`)
                graphData = await neo4jGraphService.getAllGraphData({ limit })
            }
            
            console.log(`✅ Neo4j returned ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`)
        } else {
            console.log(`⚠️ Neo4j not configured, falling back to Supabase`)
            source = "supabase"

            // Fallback: Get entities from Supabase
            const entities = await supabaseVectorStore.getProcessEntities(processId)
            const relations = await supabaseVectorStore.getProcessRelations(processId)

            graphData = {
                nodes: entities.map(e => ({
                    id: e.id || '',
                    labels: ['Entity'],
                    properties: {
                        name: e.name,
                        type: e.entity_type,
                        summary: e.summary,
                        metadata: e.metadata
                    }
                })),
                edges: relations.map((r, i) => ({
                    id: `edge-${i}`,
                    type: r.relation_type,
                    source: r.source_entity_id || '',
                    target: r.target_entity_id || '',
                    properties: r.metadata || {}
                }))
            }
        }

        // Transform to frontend format
        const nodes: GraphNode[] = graphData.nodes.map(node => ({
            id: node.id,
            label: node.properties?.name || node.id,
            type: node.properties?.type || node.labels?.[0]?.toLowerCase() || 'entity',
            properties: node.properties
        }))

        const edges: GraphEdge[] = graphData.edges.map((edge, index) => ({
            id: edge.id || `edge-${index}`,
            source: edge.source,
            target: edge.target,
            label: edge.type,
            properties: edge.properties
        }))

        const response: GraphResponse = {
            nodes,
            edges,
            meta: {
                nodeCount: nodes.length,
                edgeCount: edges.length,
                appliedFilters: {
                    limit: limit.toString(),
                    includeDocuments: includeDocuments.toString()
                },
                source
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

// DELETE /api/processes/[processId]/graph - Delete graph data for a process
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ processId: string }> }
) {
    try {
        const { processId } = await params

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

        // Verify user owns this process
        const { data: process } = await supabase
            .from("processes")
            .select("user_id, workspace_id")
            .eq("id", processId)
            .single()

        if (!process || process.user_id !== user.id) {
            return NextResponse.json(
                { error: "No tienes acceso a este proceso" },
                { status: 403 }
            )
        }

        // Delete from Neo4j
        if (neo4jGraphService.isConfigured()) {
            await neo4jGraphService.deleteProcessGraph(processId)
        }

        // Delete from Supabase Vector Store
        await supabaseVectorStore.deleteProcessChunks(processId)

        return NextResponse.json({
            success: true,
            message: "Datos del grafo eliminados correctamente"
        })
    } catch (error: any) {
        console.error("Error deleting graph:", error)
        return NextResponse.json(
            { error: error.message || "Error al eliminar el grafo" },
            { status: 500 }
        )
    }
}
