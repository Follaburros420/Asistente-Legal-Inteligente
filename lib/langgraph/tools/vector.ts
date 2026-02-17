/**
 * Vector Store Tool for LangGraph
 * 
 * Wraps the Supabase Vector Store for semantic search over legal documents.
 */

import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { SupabaseVectorStore, SearchResult } from "@/lib/services/supabase-vector-store"
import { EvidenceChunk } from "../state/schema"

// Singleton instance
let vectorStoreInstance: SupabaseVectorStore | null = null

function getVectorStore(): SupabaseVectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new SupabaseVectorStore()
  }
  return vectorStoreInstance
}

/**
 * Input schema for vector search
 */
const VectorSearchInputSchema = z.object({
  query: z.string().describe("The search query text"),
  processId: z.string().optional().describe("Filter by process/case ID"),
  workspaceId: z.string().optional().describe("Filter by workspace ID"),
  topK: z.number().min(1).max(20).default(5).describe("Number of results to return"),
  threshold: z.number().min(0).max(1).default(0.7).describe("Minimum similarity threshold")
})

/**
 * Output schema for vector search
 */
const VectorSearchOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    id: z.string(),
    content: z.string(),
    source_id: z.string(),
    doc_id: z.string(),
    case_id: z.string().optional(),
    score: z.number(),
    metadata: z.record(z.any()).optional()
  })),
  total: z.number(),
  error: z.string().optional()
})

/**
 * Convert SearchResult to EvidenceChunk
 */
export function searchResultToChunk(result: SearchResult): EvidenceChunk {
  return {
    id: result.id,
    text: result.content,
    source_id: result.metadata?.source_id || result.document_id,
    doc_id: result.document_id,
    case_id: result.process_id,
    score: result.similarity,
    metadata: result.metadata
  }
}

/**
 * Vector Search Tool
 * 
 * Performs semantic search over the document vector store.
 * Use this to find relevant chunks from legal documents, precedents, and templates.
 */
export const vectorSearchTool = tool(
  async (input: z.infer<typeof VectorSearchInputSchema>) => {
    const startTime = Date.now()
    
    try {
      console.log(`[VectorTool] Searching: "${input.query.substring(0, 50)}..."`)
      
      const store = getVectorStore()
      
      const results = await store.similaritySearch(input.query, {
        processId: input.processId,
        workspaceId: input.workspaceId,
        limit: input.topK,
        threshold: input.threshold
      })
      
      const duration = Date.now() - startTime
      console.log(`[VectorTool] Found ${results.length} results in ${duration}ms`)
      
      // Transform results
      const transformedResults = results.map(r => ({
        id: r.id,
        content: r.content,
        source_id: r.metadata?.source_id || r.document_id,
        doc_id: r.document_id,
        case_id: r.process_id,
        score: r.similarity,
        metadata: r.metadata
      }))
      
      return {
        success: true,
        results: transformedResults,
        total: results.length,
        duration_ms: duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error(`[VectorTool] Error after ${duration}ms:`, error.message)
      
      return {
        success: false,
        results: [],
        total: 0,
        error: error.message || "Unknown error during vector search",
        duration_ms: duration
      }
    }
  },
  {
    name: "vector_search",
    description: `Search the vector store for relevant legal document chunks.
Use this tool to find:
- Relevant sections from legal documents
- Similar precedents or cases
- Template clauses and provisions
- Internal knowledge base content

Returns chunks with similarity scores and source metadata.`,
    schema: VectorSearchInputSchema
  }
)

/**
 * Multi-query vector search input schema
 */
const MultiQueryVectorSearchInputSchema = z.object({
  queries: z.array(z.string()).describe("Multiple search queries for broader coverage"),
  processId: z.string().optional(),
  workspaceId: z.string().optional(),
  topKPerQuery: z.number().default(3).describe("Results per query"),
  deduplicate: z.boolean().default(true).describe("Remove duplicate results")
})

/**
 * Multi-query vector search for comprehensive retrieval
 */
export const multiQueryVectorSearchTool = tool(
  async (input: z.infer<typeof MultiQueryVectorSearchInputSchema>) => {
    const startTime = Date.now()
    
    try {
      console.log(`[VectorTool] Multi-query search with ${input.queries.length} queries`)
      
      const store = getVectorStore()
      const allResults: Map<string, SearchResult> = new Map()
      
      for (const query of input.queries) {
        const results = await store.similaritySearch(query, {
          processId: input.processId,
          workspaceId: input.workspaceId,
          limit: input.topKPerQuery,
          threshold: 0.65
        })
        
        for (const result of results) {
          if (input.deduplicate) {
            allResults.set(result.id, result)
          } else {
            // Use composite key for non-deduplicated
            const key = `${result.id}-${allResults.size}`
            allResults.set(key, result)
          }
        }
      }
      
      const uniqueResults = Array.from(allResults.values())
        .sort((a, b) => b.similarity - a.similarity)
      
      const duration = Date.now() - startTime
      console.log(`[VectorTool] Multi-query found ${uniqueResults.length} unique results in ${duration}ms`)
      
      return {
        success: true,
        results: uniqueResults.map(r => ({
          id: r.id,
          content: r.content,
          source_id: r.metadata?.source_id || r.document_id,
          doc_id: r.document_id,
          case_id: r.process_id,
          score: r.similarity,
          metadata: r.metadata
        })),
        total: uniqueResults.length,
        queries_used: input.queries.length,
        duration_ms: duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      return {
        success: false,
        results: [],
        total: 0,
        error: error.message,
        duration_ms: duration
      }
    }
  },
  {
    name: "multi_query_vector_search",
    description: "Perform multiple vector searches with different query formulations for broader coverage. Useful for comprehensive research.",
    schema: MultiQueryVectorSearchInputSchema
  }
)

/**
 * Export types for external use
 */
export type VectorSearchInput = z.infer<typeof VectorSearchInputSchema>
export type VectorSearchOutput = z.infer<typeof VectorSearchOutputSchema>