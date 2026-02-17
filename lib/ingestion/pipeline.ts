/**
 * High-Quality Ingestion Pipeline
 * 
 * This is the main orchestrator for the document ingestion pipeline.
 * It coordinates all phases:
 * 1. Document parsing (Docling)
 * 2. Semantic chunking
 * 3. Embedding generation
 * 4. Mention extraction
 * 5. Entity linking
 * 6. Relation extraction
 * 7. Storage (Supabase + Neo4j)
 * 8. Run tracking
 */

import OpenAI from 'openai'
import {
  DocumentDTO,
  ChunkDTO,
  MentionDTO,
  EntityDTO,
  RelationDTO,
  RunExtraccionDTO,
  IngestionResultDTO,
  RunStatus,
  ChunkMetadata,
  DEFAULT_CHUNKING_CONFIG
} from './types'
import {
  stableDocumentId,
  stableRunId,
  contentHash
} from './stable-id'
import { SemanticChunker, chunkDocument } from './semantic-chunker'
import { MentionExtractor, mentionExtractor } from './mention-extractor'
import { EntityLinker, entityLinker } from './entity-linker'
import { RelationExtractor, relationExtractor } from './relation-extractor'
import { Neo4jGraphWriter, graphWriter } from './graph-writer'
import { SupabaseVectorStore, vectorStore } from './vector-store'

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Skip Neo4j graph storage */
  skipGraph?: boolean
  /** Skip entity/relation extraction */
  skipExtraction?: boolean
  /** Chunking configuration */
  chunkingConfig?: Partial<typeof DEFAULT_CHUNKING_CONFIG>
  /** Model name for extraction */
  extractionModel?: string
  /** Prompt version for extraction */
  promptVersion?: string
  /** Batch size for embedding generation */
  embeddingBatchSize?: number
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  skipGraph: false,
  skipExtraction: false,
  chunkingConfig: DEFAULT_CHUNKING_CONFIG,
  extractionModel: 'gpt-4o-mini',
  promptVersion: 'v1',
  embeddingBatchSize: 100
}

/**
 * Callbacks for pipeline events
 */
export interface PipelineCallbacks {
  /** Called when a phase starts */
  onPhaseStart?: (phase: string, metadata?: Record<string, any>) => void
  /** Called when a phase completes */
  onPhaseComplete?: (phase: string, result: Record<string, any>) => void
  /** Called on error */
  onError?: (phase: string, error: Error) => void
  /** Called for progress updates */
  onProgress?: (phase: string, progress: number, total: number) => void
}

/**
 * Internal result from pipeline execution
 */
interface PipelineInternalResult {
  document: DocumentDTO
  chunks: ChunkDTO[]
  mentions: MentionDTO[]
  entities: EntityDTO[]
  relations: RelationDTO[]
  mentionToEntityMap: Map<string, string>
  run: RunExtraccionDTO
}

/**
 * Ingestion Pipeline class
 */
export class IngestionPipeline {
  private openai: OpenAI | null = null
  private chunker: SemanticChunker
  private mentionExtractor: MentionExtractor
  private entityLinker: EntityLinker
  private relationExtractor: RelationExtractor
  private graphWriter: Neo4jGraphWriter
  private vectorStore: SupabaseVectorStore
  private config: PipelineConfig
  private callbacks: PipelineCallbacks

  constructor(
    config: Partial<PipelineConfig> = {},
    callbacks: PipelineCallbacks = {}
  ) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config }
    this.callbacks = callbacks

    // Initialize OpenAI
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      this.openai = new OpenAI({ apiKey })
    }

    // Initialize components
    this.chunker = new SemanticChunker(this.config.chunkingConfig)
    this.mentionExtractor = new MentionExtractor()
    this.entityLinker = new EntityLinker()
    this.relationExtractor = new RelationExtractor()
    this.graphWriter = graphWriter
    this.vectorStore = vectorStore
  }

  /**
   * Run the full ingestion pipeline on a document
   * 
   * @param content - Document content (markdown)
   * @param metadata - Document metadata
   * @returns Ingestion result
   */
  async ingestDocument(
    content: string,
    metadata: {
      fileName: string
      mimeType: string
      processId: string
      workspaceId: string
      userId: string
      sizeBytes?: number
      pageCount?: number
    }
  ): Promise<IngestionResultDTO> {
    const startTime = Date.now()
    
    // Create stable document ID
    const docHash = contentHash(content)
    const documentId = stableDocumentId(
      metadata.workspaceId,
      metadata.processId,
      metadata.fileName,
      docHash
    )

    // Create run ID
    const runId = stableRunId(
      metadata.workspaceId,
      metadata.processId,
      new Date().toISOString()
    )

    // Initialize run tracking
    const run: RunExtraccionDTO = {
      id: runId,
      workspaceId: metadata.workspaceId,
      processId: metadata.processId,
      documentId,
      modelName: this.config.extractionModel || 'gpt-4o-mini',
      promptVersion: this.config.promptVersion || 'v1',
      startedAt: new Date(),
      status: RunStatus.RUNNING,
      mentionsCreated: 0,
      entitiesCreated: 0,
      relationsCreated: 0,
      relationsRejected: 0,
      metadata: {}
    }

    try {
      // Execute all phases and get internal result
      const internalResult = await this.executePipeline(
        content,
        metadata,
        documentId,
        docHash,
        runId,
        run
      )

      // Store everything to databases
      await this.storeResults(internalResult)

      // Finalize run
      run.status = RunStatus.COMPLETED
      run.finishedAt = new Date()
      run.metadata.processingTimeMs = Date.now() - startTime
      run.mentionsCreated = internalResult.mentions.length
      run.entitiesCreated = internalResult.entities.length
      run.relationsCreated = internalResult.relations.length

      // Save run for auditing
      await this.vectorStore.saveRun(run)

      return {
        success: true,
        documentId,
        chunksCreated: internalResult.chunks.length,
        mentionsExtracted: internalResult.mentions.length,
        entitiesCreated: internalResult.entities.length,
        relationsCreated: internalResult.relations.length,
        relationsRejected: run.relationsRejected,
        runId
      }
    } catch (error: any) {
      run.status = RunStatus.FAILED
      run.finishedAt = new Date()
      run.errorMessage = error.message
      run.metadata.processingTimeMs = Date.now() - startTime

      this.emitError('pipeline', error)

      return {
        success: false,
        documentId,
        chunksCreated: 0,
        mentionsExtracted: 0,
        entitiesCreated: 0,
        relationsCreated: 0,
        relationsRejected: 0,
        runId,
        error: error.message
      }
    }
  }

  /**
   * Execute all pipeline phases
   */
  private async executePipeline(
    content: string,
    metadata: {
      fileName: string
      mimeType: string
      processId: string
      workspaceId: string
      userId: string
      sizeBytes?: number
      pageCount?: number
    },
    documentId: string,
    docHash: string,
    runId: string,
    run: RunExtraccionDTO
  ): Promise<PipelineInternalResult> {
    // PHASE 1: Create document DTO
    this.emitPhaseStart('document_creation', { documentId })
    
    const document: DocumentDTO = {
      id: documentId,
      title: metadata.fileName,
      source: metadata.fileName,
      content,
      contentHash: docHash,
      processId: metadata.processId,
      workspaceId: metadata.workspaceId,
      userId: metadata.userId,
      metadata: {
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        pageCount: metadata.pageCount
      }
    }
    
    this.emitPhaseComplete('document_creation', { documentId })

    // PHASE 2: Semantic chunking
    this.emitPhaseStart('chunking', { contentLength: content.length })
    
    const chunkingResult = this.chunker.chunkDocument(
      content,
      documentId,
      metadata.processId,
      metadata.workspaceId,
      {
        fileName: metadata.fileName,
        mimeType: metadata.mimeType
      }
    )
    
    let chunks = chunkingResult.chunks
    run.metadata.chunksProcessed = chunks.length
    run.metadata.chunkingConfig = this.config.chunkingConfig
    
    this.emitPhaseComplete('chunking', { 
      chunkCount: chunks.length, 
      totalTokens: chunkingResult.totalTokens 
    })

    // PHASE 3: Generate embeddings
    this.emitPhaseStart('embedding', { chunkCount: chunks.length })
    
    chunks = await this.generateEmbeddings(chunks)
    
    this.emitPhaseComplete('embedding', { 
      embeddedCount: chunks.filter(c => c.embedding).length 
    })

    // PHASE 4: Extract mentions (if not skipped)
    let mentions: MentionDTO[] = []
    let entities: EntityDTO[] = []
    let relations: RelationDTO[] = []
    const mentionToEntityMap = new Map<string, string>()

    if (!this.config.skipExtraction) {
      this.emitPhaseStart('mention_extraction', { chunkCount: chunks.length })
      
      const mentionResult = await this.mentionExtractor.extractMentionsBatch(
        chunks.map(c => ({
          content: c.content,
          id: c.id,
          documentId: c.documentId,
          processId: c.processId,
          workspaceId: c.workspaceId
        })),
        runId
      )
      
      mentions = mentionResult.mentions
      run.mentionsCreated = mentions.length
      
      this.emitPhaseComplete('mention_extraction', {
        totalExtracted: mentionResult.totalExtracted,
        verified: mentionResult.verifiedCount,
        unverified: mentionResult.unverifiedCount
      })

      // PHASE 5: Entity linking
      this.emitPhaseStart('entity_linking', { mentionCount: mentions.length })
      
      const linkingResult = this.entityLinker.linkMentions(
        mentions,
        metadata.processId,
        metadata.workspaceId,
        runId
      )
      
      entities = linkingResult.entities
      for (const [mentionId, entityId] of linkingResult.mentionToEntityMap) {
        mentionToEntityMap.set(mentionId, entityId)
      }
      run.entitiesCreated = entities.length
      
      this.emitPhaseComplete('entity_linking', {
        entityCount: entities.length,
        stats: linkingResult.stats
      })

      // PHASE 6: Relation extraction
      if (!this.config.skipGraph && entities.length >= 2) {
        this.emitPhaseStart('relation_extraction', { entityCount: entities.length })
        
        const relationResult = await this.relationExtractor.extractRelationsBatch(
          chunks,
          entities,
          mentions,
          mentionToEntityMap,
          metadata.processId,
          metadata.workspaceId,
          runId
        )
        
        relations = relationResult.relations
        run.relationsCreated = relations.length
        run.relationsRejected = relationResult.rejectedCount
        
        this.emitPhaseComplete('relation_extraction', {
          created: relationResult.createdCount,
          rejected: relationResult.rejectedCount,
          reasons: Object.fromEntries(relationResult.rejectionReasons)
        })
      }
    }

    return {
      document,
      chunks,
      mentions,
      entities,
      relations,
      mentionToEntityMap,
      run
    }
  }

  /**
   * Store all results to databases
   */
  private async storeResults(result: PipelineInternalResult): Promise<void> {
    this.emitPhaseStart('storage', {
      chunks: result.chunks.length,
      mentions: result.mentions.length,
      entities: result.entities.length,
      relations: result.relations.length
    })

    try {
      // Store document in Supabase
      await this.vectorStore.upsertDocument(result.document)

      // Store chunks in Supabase
      if (result.chunks.length > 0) {
        await this.vectorStore.upsertChunks(result.chunks)
      }

      // Store entities in Supabase
      if (result.entities.length > 0) {
        await this.vectorStore.upsertEntities(result.entities)
      }

      // Store mentions in Supabase
      if (result.mentions.length > 0) {
        await this.vectorStore.upsertMentions(result.mentions)
      }

      // Store relations in Supabase
      if (result.relations.length > 0) {
        await this.vectorStore.upsertRelations(result.relations)
      }

      // Store in Neo4j if not skipped
      if (!this.config.skipGraph) {
        // Store structural nodes
        await this.graphWriter.upsertStructuralNodes(result.document, result.chunks)

        // Store entities
        if (result.entities.length > 0) {
          await this.graphWriter.upsertEntities(result.entities)
        }

        // Store mentions
        if (result.mentions.length > 0) {
          await this.graphWriter.upsertMentions(result.mentions)
        }

        // Link mentions to entities
        if (result.mentionToEntityMap.size > 0) {
          await this.graphWriter.linkMentionsToEntities(result.mentionToEntityMap)
        }

        // Store relations
        if (result.relations.length > 0) {
          await this.graphWriter.upsertRelations(result.relations)
        }
      }

      this.emitPhaseComplete('storage', { success: true })
    } catch (error: any) {
      this.emitError('storage', error)
      throw error
    }
  }

  /**
   * Generate embeddings for chunks
   */
  private async generateEmbeddings(chunks: ChunkDTO[]): Promise<ChunkDTO[]> {
    if (!this.openai) {
      console.warn('WARNING: OpenAI not configured, skipping embeddings')
      return chunks
    }

    const batchSize = this.config.embeddingBatchSize || 100
    const chunksWithEmbeddings: ChunkDTO[] = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      // Prepare texts for embedding
      const texts = batch.map(c => 
        c.content.replace(/\n/g, ' ').substring(0, 8191)
      )

      try {
        // Generate embeddings in batch
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts,
          dimensions: 1536
        })

        // Map embeddings back to chunks
        for (let j = 0; j < batch.length; j++) {
          const embedding = response.data[j]?.embedding
          chunksWithEmbeddings.push({
            ...batch[j],
            embedding: embedding ? Array.from(embedding) : undefined
          })
        }

        this.emitProgress('embedding', i + batch.length, chunks.length)

        // Rate limiting delay
        if (i + batchSize < chunks.length) {
          await this.delay(100)
        }
      } catch (error: any) {
        console.error(`Error generating embeddings for batch ${i}:`, error)
        // Add chunks without embeddings
        chunksWithEmbeddings.push(...batch)
      }
    }

    return chunksWithEmbeddings
  }

  /**
   * Get the run data for storage
   */
  getRunData(result: IngestionResultDTO): RunExtraccionDTO | null {
    // This would be implemented to return the run data
    // for storage in the database
    return null
  }

  /**
   * Emit phase start event
   */
  private emitPhaseStart(phase: string, metadata?: Record<string, any>): void {
    if (this.callbacks.onPhaseStart) {
      this.callbacks.onPhaseStart(phase, metadata)
    }
    console.log(`Pipeline phase started: ${phase}`, metadata || '')
  }

  /**
   * Emit phase complete event
   */
  private emitPhaseComplete(phase: string, result: Record<string, any>): void {
    if (this.callbacks.onPhaseComplete) {
      this.callbacks.onPhaseComplete(phase, result)
    }
    console.log(`Pipeline phase completed: ${phase}`, result)
  }

  /**
   * Emit error event
   */
  private emitError(phase: string, error: Error): void {
    if (this.callbacks.onError) {
      this.callbacks.onError(phase, error)
    }
    console.error(`Pipeline error in ${phase}:`, error)
  }

  /**
   * Emit progress event
   */
  private emitProgress(phase: string, progress: number, total: number): void {
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(phase, progress, total)
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Create default pipeline instance
 */
export function createPipeline(
  config?: Partial<PipelineConfig>,
  callbacks?: PipelineCallbacks
): IngestionPipeline {
  return new IngestionPipeline(config, callbacks)
}

/**
 * Convenience function to ingest a document
 */
export async function ingestDocument(
  content: string,
  metadata: {
    fileName: string
    mimeType: string
    processId: string
    workspaceId: string
    userId: string
    sizeBytes?: number
    pageCount?: number
  },
  config?: Partial<PipelineConfig>
): Promise<IngestionResultDTO> {
  const pipeline = createPipeline(config)
  return pipeline.ingestDocument(content, metadata)
}