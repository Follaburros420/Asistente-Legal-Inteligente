/**
 * High-Quality Ingestion Pipeline
 * 
 * This module exports all components of the ingestion pipeline:
 * - Types and interfaces
 * - Stable ID generation
 * - Semantic chunking
 * - Mention extraction
 * - Entity linking
 * - Relation extraction
 * - Pipeline orchestrator
 * - Storage services (Supabase + Neo4j)
 */

// Types
export * from './types'

// Stable ID generation
export * from './stable-id'

// Chunking
export * from './semantic-chunker'

// Extraction
export * from './mention-extractor'
export * from './entity-linker'
export * from './relation-extractor'

// Pipeline
export * from './pipeline'

// Storage
export * from './vector-store'
export * from './graph-writer'

// Convenience re-exports
import { IngestionPipeline, createPipeline, ingestDocument } from './pipeline'
import { SemanticChunker, chunkDocument } from './semantic-chunker'
import { MentionExtractor } from './mention-extractor'
import { EntityLinker } from './entity-linker'
import { RelationExtractor } from './relation-extractor'
import { SupabaseVectorStore, vectorStore } from './vector-store'
import { Neo4jGraphWriter, graphWriter } from './graph-writer'

/**
 * Complete ingestion service that orchestrates the full pipeline
 */
export class IngestionService {
  private pipeline: IngestionPipeline
  private vectorStore: SupabaseVectorStore
  private graphWriter: Neo4jGraphWriter

  constructor(config?: {
    skipGraph?: boolean
    skipExtraction?: boolean
  }) {
    this.pipeline = createPipeline(config)
    this.vectorStore = vectorStore
    this.graphWriter = graphWriter
  }

  /**
   * Ingest a document from a buffer (e.g., from file upload)
   */
  async ingestFromBuffer(
    buffer: Buffer,
    metadata: {
      fileName: string
      mimeType: string
      processId: string
      workspaceId: string
      userId: string
    },
    content?: string // Pre-parsed content if available
  ): Promise<{
    success: boolean
    documentId?: string
    chunksCreated: number
    entitiesCreated: number
    relationsCreated: number
    error?: string
  }> {
    try {
      // Use provided content or convert buffer to string
      const documentContent = content || buffer.toString('utf-8')

      // Run the pipeline
      const result = await this.pipeline.ingestDocument(documentContent, {
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        processId: metadata.processId,
        workspaceId: metadata.workspaceId,
        userId: metadata.userId,
        sizeBytes: buffer.length
      })

      return {
        success: result.success,
        documentId: result.documentId,
        chunksCreated: result.chunksCreated,
        entitiesCreated: result.entitiesCreated,
        relationsCreated: result.relationsCreated,
        error: result.error
      }
    } catch (error: any) {
      return {
        success: false,
        chunksCreated: 0,
        entitiesCreated: 0,
        relationsCreated: 0,
        error: error.message
      }
    }
  }

  /**
   * Ingest a document from text content
   */
  async ingestFromText(
    content: string,
    metadata: {
      fileName: string
      mimeType: string
      processId: string
      workspaceId: string
      userId: string
    }
  ): Promise<{
    success: boolean
    documentId?: string
    chunksCreated: number
    entitiesCreated: number
    relationsCreated: number
    error?: string
  }> {
    const result = await this.pipeline.ingestDocument(content, metadata)

    return {
      success: result.success,
      documentId: result.documentId,
      chunksCreated: result.chunksCreated,
      entitiesCreated: result.entitiesCreated,
      relationsCreated: result.relationsCreated,
      error: result.error
    }
  }

  /**
   * Delete a document and all its data
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete from vector store
      await this.vectorStore.deleteDocumentChunks(documentId)

      // Delete from graph
      await this.graphWriter.deleteDocument(documentId)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete all data for a process
   */
  async deleteProcess(processId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete from vector store
      await this.vectorStore.deleteProcessData(processId)

      // Delete from graph
      await this.graphWriter.deleteProcessGraph(processId)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.vectorStore.isConfigured()
  }
}

/**
 * Create default ingestion service instance
 */
export const ingestionService = new IngestionService()
