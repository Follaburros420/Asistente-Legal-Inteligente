/**
 * Document Ingestion Service (Refactored)
 * 
 * This service handles document ingestion using the new high-quality pipeline:
 * - Docling for document parsing and text extraction
 * - Supabase Vector Store for embeddings and similarity search
 * - Neo4j for knowledge graph
 * - Wasabi (S3) for object storage
 * 
 * Architecture:
 * 1. Document uploaded to Wasabi (S3-compatible storage)
 * 2. Document parsed with Docling (PDF, DOCX, images, etc.)
 * 3. Document processed with high-quality pipeline:
 *    - Semantic chunking with structure preservation
 *    - Stable IDs for idempotency
 *    - Mention extraction with offsets
 *    - Entity linking
 *    - Relation extraction with evidence
 * 4. Embeddings generated and stored in Supabase Vector Store
 * 5. Entities and relations stored in Neo4j knowledge graph
 * 6. Run tracking for auditing
 */

import { 
  IngestionService,
  ingestionService,
  IngestionResultDTO,
  ChunkDTO,
  EntityDTO,
  RelationDTO,
  MentionDTO,
  RunExtraccionDTO,
  EntityType,
  RelCode
} from '@/lib/ingestion'
import { doclingService } from './docling-service'
import { neo4jGraphService } from './neo4j-graph-service'
import { supabaseVectorStore } from './supabase-vector-store'

export interface IngestionResult {
  success: boolean
  documentId: string
  chunksCreated: number
  entitiesExtracted: number
  error?: string
}

export interface DocumentMetadata {
  process_id: string
  document_id: string
  workspace_id?: string
  user_id: string
  file_name: string
  mime_type: string
}

export interface IngestionOptions {
  /** Skip Neo4j graph storage (for chat-only ingestion) */
  skipGraph?: boolean
  /** Use Docling for document parsing */
  useDocling?: boolean
  /** File buffer for Docling parsing */
  fileBuffer?: Buffer
}

/**
 * Refactored Document Ingestion Service
 * Uses the new high-quality pipeline with:
 * - Stable IDs for idempotency
 * - Semantic chunking
 * - Mention extraction with offsets
 * - Entity linking
 * - Relation extraction with evidence
 * - Run tracking for auditing
 */
class DocumentIngestionService {
  private ingestionService: IngestionService

  constructor() {
    this.ingestionService = ingestionService
  }

  /**
   * Process and ingest a document from a file buffer using Docling
   * This is the preferred method for PDFs and other binary formats
   */
  async ingestDocumentFromBuffer(
    fileBuffer: Buffer,
    metadata: DocumentMetadata,
    options: IngestionOptions = {}
  ): Promise<IngestionResult> {
    try {
      console.log(`📄 Starting ingestion from buffer for document: ${metadata.file_name}`)

      // Step 1: Parse document with Docling
      let content: string
      
      if (doclingService.isConfigured() && doclingService.isSupported(metadata.mime_type)) {
        console.log(`📄 Parsing document with Docling: ${metadata.file_name}`)
        const parseResult = await doclingService.parseDocument(fileBuffer, metadata.file_name, {
          outputFormat: 'markdown',
          ocrEnabled: true,
          ocrLang: ['es', 'en']
        })

        console.log(`📄 Parse result - success: ${parseResult.success}, hasMarkdown: ${!!parseResult.markdown}, error: ${parseResult.error}`)

        if (!parseResult.success) {
          throw new Error(`Failed to parse document: ${parseResult.error || 'Unknown error'}`)
        }

        if (!parseResult.markdown && !parseResult.text) {
          throw new Error(`Failed to parse document: No content extracted`)
        }

        content = parseResult.markdown || parseResult.text || ''
        console.log(`✅ Docling parsed document: ${parseResult.pages} pages, ${content.length} chars`)
      } else {
        // Fallback to text extraction
        console.log(`⚠️ Docling not available or unsupported type, using fallback text extraction`)
        content = fileBuffer.toString('utf-8')
      }

      // Step 2: Ingest the parsed content using the new pipeline
      return this.ingestDocument(content, metadata, options)
    } catch (error: any) {
      console.error('❌ Error in ingestDocumentFromBuffer:', error)
      return {
        success: false,
        documentId: metadata.document_id,
        chunksCreated: 0,
        entitiesExtracted: 0,
        error: error.message
      }
    }
  }

  /**
   * Process and ingest a document using the high-quality pipeline
   */
  async ingestDocument(
    content: string,
    metadata: DocumentMetadata,
    options: IngestionOptions = {}
  ): Promise<IngestionResult> {
    try {
      console.log(`📄 Starting ingestion for document: ${metadata.file_name}`)

      // Use the new high-quality pipeline
      const result = await this.ingestionService.ingestFromText(content, {
        fileName: metadata.file_name,
        mimeType: metadata.mime_type,
        processId: metadata.process_id,
        workspaceId: metadata.workspace_id || '',
        userId: metadata.user_id
      })

      if (!result.success) {
        return {
          success: false,
          documentId: metadata.document_id,
          chunksCreated: 0,
          entitiesExtracted: 0,
          error: result.error
        }
      }

      console.log(`✅ Ingestion complete: ${result.chunksCreated} chunks, ${result.entitiesCreated} entities`)

      return {
        success: true,
        documentId: result.documentId || metadata.document_id,
        chunksCreated: result.chunksCreated,
        entitiesExtracted: result.entitiesCreated
      }
    } catch (error: any) {
      console.error('❌ Error in ingestDocument:', error)
      return {
        success: false,
        documentId: metadata.document_id,
        chunksCreated: 0,
        entitiesExtracted: 0,
        error: error.message
      }
    }
  }

  /**
   * Delete a document and all its data
   */
  async deleteDocument(documentId: string, processId: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.ingestionService.deleteDocument(documentId)
    } catch (error: any) {
      console.error('❌ Error deleting document:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete all data for a process
   */
  async deleteProcess(processId: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.ingestionService.deleteProcess(processId)
    } catch (error: any) {
      console.error('❌ Error deleting process:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.ingestionService.isConfigured()
  }

  /**
   * Get entities for a process (for backward compatibility)
   */
  async getProcessEntities(processId: string): Promise<any[]> {
    try {
      // Use the old neo4j service for backward compatibility
      return await neo4jGraphService.getProcessGraph(processId).then(graph => graph.nodes)
    } catch (error: any) {
      console.error('❌ Error getting process entities:', error)
      return []
    }
  }

  /**
   * Get the knowledge graph for a process (for backward compatibility)
   */
  async getProcessGraph(processId: string): Promise<{ nodes: any[]; edges: any[] }> {
    try {
      return await neo4jGraphService.getProcessGraph(processId)
    } catch (error: any) {
      console.error('❌ Error getting process graph:', error)
      return { nodes: [], edges: [] }
    }
  }
}

// Export singleton instance
export const documentIngestionService = new DocumentIngestionService()

// Re-export types for backward compatibility
export type { IngestionResult as IngestionResultType }
