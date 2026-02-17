/**
 * Knowledge Graph Tool for LangGraph
 * 
 * Wraps the Neo4j Graph Service for querying the legal knowledge graph.
 */

import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { Neo4jGraphService, Neo4jNode, Neo4jEdge } from "@/lib/services/neo4j-graph-service"
import { GraphReference } from "../state/schema"

// Singleton instance
let graphServiceInstance: Neo4jGraphService | null = null

function getGraphService(): Neo4jGraphService {
  if (!graphServiceInstance) {
    graphServiceInstance = new Neo4jGraphService()
  }
  return graphServiceInstance
}

/**
 * Convert Neo4jNode to GraphReference
 */
export function nodeToGraphRef(node: Neo4jNode): GraphReference {
  return {
    node_id: node.id,
    entity_type: node.labels?.[0] || node.properties?.type || "Entity",
    name: node.properties?.name || node.id,
    relation_type: undefined,
    properties: node.properties
  }
}

/**
 * Input schema for graph query
 */
const GraphQueryInputSchema = z.object({
  caseId: z.string().describe("The case/process ID to query"),
  queryType: z.enum([
    "entities",
    "relationships", 
    "people",
    "norms",
    "facts",
    "evidence",
    "timeline",
    "full_graph"
  ]).describe("Type of graph query to perform"),
  entityTypes: z.array(z.string()).optional().describe("Filter by entity types"),
  limit: z.number().min(1).max(100).default(50).describe("Maximum results to return")
})

/**
 * Input schema for entity search
 */
const EntitySearchInputSchema = z.object({
  caseId: z.string().describe("The case/process ID"),
  searchTerm: z.string().describe("Name or term to search for"),
  entityType: z.string().optional().describe("Filter by entity type (Person, Norm, Fact, etc.)"),
  fuzzy: z.boolean().default(true).describe("Use fuzzy matching")
})

/**
 * Input schema for relationship traversal
 */
const RelationshipTraversalSchema = z.object({
  caseId: z.string().describe("The case/process ID"),
  startEntityId: z.string().describe("Starting entity ID"),
  relationType: z.string().optional().describe("Filter by relation type"),
  maxDepth: z.number().min(1).max(3).default(2).describe("Maximum traversal depth"),
  direction: z.enum(["outgoing", "incoming", "both"]).default("both")
})

/**
 * Graph Query Tool
 * 
 * Queries the Neo4j knowledge graph for legal entities and relationships.
 */
export const graphQueryTool = tool(
  async (input: z.infer<typeof GraphQueryInputSchema>) => {
    const startTime = Date.now()
    
    try {
      console.log(`[GraphTool] Query type: ${input.queryType} for case: ${input.caseId}`)
      
      const service = getGraphService()
      
      let result: { nodes: Neo4jNode[]; edges: Neo4jEdge[] }
      
      switch (input.queryType) {
        case "full_graph":
          result = await service.getProcessGraph(input.caseId, {
            limit: input.limit,
            includeDocuments: true
          })
          break
          
        case "entities":
        case "people":
        case "norms":
        case "facts":
        case "evidence":
          // Get full graph and filter by type
          const fullGraph = await service.getProcessGraph(input.caseId, {
            limit: input.limit
          })
          
          const typeMap: Record<string, string[]> = {
            people: ["Person", "Persona", "Actor"],
            norms: ["Norm", "Norma", "Law", "Article", "Ley"],
            facts: ["Fact", "Hecho", "Event"],
            evidence: ["Evidence", "Prueba", "Document"]
          }
          
          const allowedTypes = input.queryType === "entities" 
            ? (input.entityTypes || undefined)
            : typeMap[input.queryType]
          
          if (allowedTypes) {
            result = {
              nodes: fullGraph.nodes.filter(n => 
                n.labels?.some(l => allowedTypes.includes(l)) ||
                allowedTypes.includes(n.properties?.type)
              ),
              edges: fullGraph.edges
            }
          } else {
            result = fullGraph
          }
          break
          
        case "relationships":
          result = await service.getProcessGraph(input.caseId, {
            limit: input.limit
          })
          // Focus on edges
          break
          
        case "timeline":
          // Get all entities and sort by date if available
          const graphData = await service.getProcessGraph(input.caseId, {
            limit: input.limit
          })
          
          result = {
            nodes: graphData.nodes
              .filter(n => n.properties?.date || n.properties?.fecha)
              .sort((a, b) => {
                const dateA = new Date(a.properties?.date || a.properties?.fecha || 0)
                const dateB = new Date(b.properties?.date || b.properties?.fecha || 0)
                return dateA.getTime() - dateB.getTime()
              }),
            edges: graphData.edges
          }
          break
          
        default:
          result = await service.getProcessGraph(input.caseId, {
            limit: input.limit
          })
      }
      
      const duration = Date.now() - startTime
      console.log(`[GraphTool] Found ${result.nodes.length} nodes, ${result.edges.length} edges in ${duration}ms`)
      
      // Transform to serializable format
      const transformedNodes = result.nodes.map(n => ({
        id: n.id,
        labels: n.labels,
        name: n.properties?.name,
        type: n.properties?.type,
        summary: n.properties?.summary,
        properties: n.properties
      }))
      
      const transformedEdges = result.edges.map(e => ({
        id: e.id,
        type: e.type,
        source: e.source,
        target: e.target,
        properties: e.properties
      }))
      
      return {
        success: true,
        query_type: input.queryType,
        nodes: transformedNodes,
        edges: transformedEdges,
        node_count: result.nodes.length,
        edge_count: result.edges.length,
        duration_ms: duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error(`[GraphTool] Error after ${duration}ms:`, error.message)
      
      return {
        success: false,
        query_type: input.queryType,
        nodes: [],
        edges: [],
        node_count: 0,
        edge_count: 0,
        error: error.message || "Unknown error during graph query",
        duration_ms: duration
      }
    }
  },
  {
    name: "graph_query",
    description: `Query the Neo4j knowledge graph for legal case information.
Query types:
- entities: Get all entities (optionally filtered by type)
- relationships: Focus on relationships between entities
- people: Get persons/actors involved
- norms: Get laws, articles, regulations mentioned
- facts: Get facts/events in the case
- evidence: Get evidence/documents
- timeline: Get entities sorted by date
- full_graph: Get complete graph data

Returns nodes and edges with metadata.`,
    schema: GraphQueryInputSchema
  }
)

/**
 * Entity Search Tool
 * 
 * Search for specific entities in the knowledge graph.
 */
export const entitySearchTool = tool(
  async (input: z.infer<typeof EntitySearchInputSchema>) => {
    const startTime = Date.now()
    
    try {
      console.log(`[GraphTool] Searching for: "${input.searchTerm}"`)
      
      const service = getGraphService()
      const graphData = await service.getProcessGraph(input.caseId, {
        limit: 100
      })
      
      // Filter by search term
      const searchTermLower = input.searchTerm.toLowerCase()
      
      let matchingNodes = graphData.nodes.filter(node => {
        const name = (node.properties?.name || "").toLowerCase()
        const summary = (node.properties?.summary || "").toLowerCase()
        
        if (input.fuzzy) {
          return name.includes(searchTermLower) || summary.includes(searchTermLower)
        } else {
          return name === searchTermLower
        }
      })
      
      // Filter by entity type if specified
      if (input.entityType) {
        matchingNodes = matchingNodes.filter(n => 
          n.labels?.includes(input.entityType!) ||
          n.properties?.type === input.entityType
        )
      }
      
      const duration = Date.now() - startTime
      console.log(`[GraphTool] Found ${matchingNodes.length} matching entities in ${duration}ms`)
      
      return {
        success: true,
        search_term: input.searchTerm,
        results: matchingNodes.map(n => ({
          id: n.id,
          name: n.properties?.name,
          type: n.properties?.type || n.labels?.[0],
          summary: n.properties?.summary,
          labels: n.labels
        })),
        total: matchingNodes.length,
        duration_ms: duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      return {
        success: false,
        search_term: input.searchTerm,
        results: [],
        total: 0,
        error: error.message,
        duration_ms: duration
      }
    }
  },
  {
    name: "entity_search",
    description: "Search for specific entities (people, norms, facts) in the knowledge graph by name or term.",
    schema: EntitySearchInputSchema
  }
)

/**
 * Relationship Traversal Tool
 * 
 * Traverse relationships from a starting entity.
 */
export const relationshipTraversalTool = tool(
  async (input: z.infer<typeof RelationshipTraversalSchema>) => {
    const startTime = Date.now()
    
    try {
      console.log(`[GraphTool] Traversing from: ${input.startEntityId}`)
      
      const service = getGraphService()
      const graphData = await service.getProcessGraph(input.caseId, {
        limit: 200
      })
      
      // Find connected entities
      const connectedNodes = new Set<string>()
      const relevantEdges: Neo4jEdge[] = []
      
      connectedNodes.add(input.startEntityId)
      
      // BFS traversal
      let frontier = [input.startEntityId]
      
      for (let depth = 0; depth < input.maxDepth; depth++) {
        const nextFrontier: string[] = []
        
        for (const nodeId of frontier) {
          // Find edges connected to this node
          for (const edge of graphData.edges) {
            let matches = false
            let nextNode: string | null = null
            
            if (input.direction === "outgoing" || input.direction === "both") {
              if (edge.source === nodeId) {
                matches = true
                nextNode = edge.target
              }
            }
            
            if (input.direction === "incoming" || input.direction === "both") {
              if (edge.target === nodeId) {
                matches = true
                nextNode = edge.source
              }
            }
            
            if (matches && nextNode && !connectedNodes.has(nextNode)) {
              // Filter by relation type if specified
              if (!input.relationType || edge.type === input.relationType) {
                relevantEdges.push(edge)
                connectedNodes.add(nextNode)
                nextFrontier.push(nextNode)
              }
            }
          }
        }
        
        frontier = nextFrontier
      }
      
      // Get nodes in the traversal
      const traversalNodes = graphData.nodes.filter(n => connectedNodes.has(n.id))
      
      const duration = Date.now() - startTime
      console.log(`[GraphTool] Traversal found ${traversalNodes.length} nodes, ${relevantEdges.length} edges in ${duration}ms`)
      
      return {
        success: true,
        start_entity: input.startEntityId,
        depth_reached: input.maxDepth,
        nodes: traversalNodes.map(n => ({
          id: n.id,
          name: n.properties?.name,
          type: n.properties?.type || n.labels?.[0]
        })),
        edges: relevantEdges.map(e => ({
          id: e.id,
          type: e.type,
          source: e.source,
          target: e.target
        })),
        duration_ms: duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      return {
        success: false,
        start_entity: input.startEntityId,
        nodes: [],
        edges: [],
        error: error.message,
        duration_ms: duration
      }
    }
  },
  {
    name: "relationship_traversal",
    description: "Traverse relationships from a starting entity to find connected entities. Useful for understanding connections between people, facts, and evidence.",
    schema: RelationshipTraversalSchema
  }
)

/**
 * Export types
 */
export type GraphQueryInput = z.infer<typeof GraphQueryInputSchema>
export type EntitySearchInput = z.infer<typeof EntitySearchInputSchema>
export type RelationshipTraversalInput = z.infer<typeof RelationshipTraversalSchema>