export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { neo4jGraphService } from "@/lib/services/neo4j-graph-service"
import { supabaseVectorStore } from "@/lib/services/supabase-vector-store"
import { vectorStore as newVectorStore } from "@/lib/ingestion/vector-store"

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
            
            // Query specifically for this process's entities
            graphData = await getProcessGraphFromNeo4j(processId, limit)
            
            console.log(`✅ Neo4j returned ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`)
        } 
        
        if (!graphData || graphData.nodes.length === 0) {
            console.log(`📊 No Neo4j data, trying Supabase`)
            source = "supabase"

            // Fallback: Get entities from Supabase (try new tables first)
            const entities = await newVectorStore.getProcessEntities(processId)
            
            if (entities.length === 0) {
                // Try old tables
                const oldEntities = await supabaseVectorStore.getProcessEntities(processId)
                
                graphData = {
                    nodes: oldEntities.map(e => ({
                        id: e.id || '',
                        labels: ['Entity'],
                        properties: {
                            name: e.name,
                            type: e.entity_type,
                            summary: e.summary,
                            metadata: e.metadata
                        }
                    })),
                    edges: []
                }
            } else {
                graphData = {
                    nodes: entities.map(e => ({
                        id: e.id,
                        labels: ['Entity'],
                        properties: {
                            name: e.nombreCanonico,
                            type: e.tipo,
                            summary: e.summary,
                            aliases: e.aliases
                        }
                    })),
                    edges: []
                }
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
            label: edge.type || edge.properties?.rel_code || 'RELATES_TO',
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

/**
 * Get process graph directly from Neo4j with proper query
 */
async function getProcessGraphFromNeo4j(processId: string, limit: number) {
    const neo4j = require('neo4j-driver')
    
    const uri = process.env.NEO4J_URI
    const user = process.env.NEO4J_USER || 'neo4j'
    const password = process.env.NEO4J_PASSWORD
    
    if (!uri || !password) {
        return { nodes: [], edges: [] }
    }
    
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
        disableLosslessIntegers: true
    })
    
    const session = driver.session()
    
    try {
        // Query entities for this process
        const entityQuery = `
            MATCH (e:Entity)
            WHERE e.process_id = $processId
            RETURN e.id as id, labels(e) as labels, 
                   e.name as name, e.nombre_canonico as nombre_canonico,
                   e.type as type, e.tipo as tipo,
                   e.summary as summary, e.aliases as aliases
            LIMIT $limit
        `
        
        const entityResult = await session.run(entityQuery, { processId, limit: neo4j.int(limit) })
        
        const nodes = entityResult.records.map((record: any) => ({
            id: record.get('id'),
            labels: record.get('labels') || ['Entity'],
            properties: {
                name: record.get('name') || record.get('nombre_canonico'),
                type: record.get('type') || record.get('tipo'),
                summary: record.get('summary'),
                aliases: record.get('aliases')
            }
        }))
        
        // Query relations for this process
        const relationQuery = `
            MATCH (source:Entity)-[r:RELATES_TO]->(target:Entity)
            WHERE r.process_id = $processId 
               OR (source.process_id = $processId AND target.process_id = $processId)
            RETURN source.id as sourceId, target.id as targetId,
                   r.rel_code as relCode, r.type as type,
                   r.confidence as confidence, r.evidence_text as evidenceText
            LIMIT $limit
        `
        
        const relationResult = await session.run(relationQuery, { processId, limit: neo4j.int(limit) })
        
        const edges = relationResult.records.map((record: any, index: number) => ({
            id: `edge-${index}`,
            source: record.get('sourceId'),
            target: record.get('targetId'),
            type: record.get('relCode') || record.get('type') || 'RELATES_TO',
            properties: {
                confidence: record.get('confidence'),
                evidenceText: record.get('evidenceText')
            }
        }))
        
        return { nodes, edges }
    } catch (error: any) {
        console.error('Error querying Neo4j:', error)
        return { nodes: [], edges: [] }
    } finally {
        await session.close()
        await driver.close()
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
