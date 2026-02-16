/**
 * Types for RAG (Retrieval Augmented Generation) functionality
 * 
 * These types are used by:
 * - Supabase Vector Store for embeddings
 * - Neo4j for knowledge graph
 * - Document ingestion pipeline
 */

// Document chunk with embedding
export interface DocumentChunk {
  id: string
  process_id: string
  document_id: string
  workspace_id?: string
  user_id: string
  content: string
  chunk_index: number
  embedding?: number[]
  metadata?: Record<string, any>
  created_at?: string
  updated_at?: string
}

// Graph entity (synced with Neo4j)
export interface GraphEntity {
  id: string
  process_id: string
  workspace_id?: string
  user_id?: string
  name: string
  entity_type?: string
  summary?: string
  neo4j_id?: string
  neo4j_labels?: string[]
  metadata?: Record<string, any>
  created_at?: string
  updated_at?: string
}

// Graph relation (synced with Neo4j)
export interface GraphRelation {
  id: string
  process_id: string
  source_entity_id?: string
  target_entity_id?: string
  relation_type: string
  neo4j_id?: string
  metadata?: Record<string, any>
  created_at?: string
}

// Search result from vector store
export interface SearchResult {
  id: string
  content: string
  metadata: Record<string, any>
  similarity: number
  process_id: string
  document_id: string
}

// Graph node for visualization
export interface GraphNode {
  id: string
  label: string
  type: string
  properties?: Record<string, any>
}

// Graph edge for visualization
export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  properties?: Record<string, any>
}

// Complete graph data
export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  meta?: {
    nodeCount: number
    edgeCount: number
    source: string
  }
}

// Ingestion result
export interface IngestionResult {
  success: boolean
  documentId: string
  chunksCreated: number
  entitiesExtracted: number
  error?: string
}

// Document metadata for ingestion
export interface DocumentMetadata {
  process_id: string
  document_id: string
  workspace_id?: string
  user_id: string
  file_name: string
  mime_type: string
}

// Entity extraction result
export interface EntityExtraction {
  name: string
  type: string
  summary?: string
  metadata?: Record<string, any>
}

// Relation extraction result
export interface RelationExtraction {
  sourceEntity: string
  targetEntity: string
  relationType: string
  metadata?: Record<string, any>
}

// Process insights derived from graph
export interface ProcessInsights {
  keyPeople: Array<{
    name: string
    role: string
    mentions: number
  }>
  keyDates: Array<{
    date: string
    description: string
  }>
  keyDocuments: Array<{
    name: string
    type: string
    relevance: number
  }>
  legalBasis: Array<{
    norm: string
    article: string
    relevance: string
  }>
  contradictions: Array<{
    description: string
    severity: 'low' | 'medium' | 'high'
  }>
  summary?: string
}

// Search options
export interface SearchOptions {
  processId?: string
  workspaceId?: string
  limit?: number
  threshold?: number
}

// Graph query options
export interface GraphQueryOptions {
  limit?: number
  includeDocuments?: boolean
  maxDepth?: number
}
