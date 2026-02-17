/**
 * Supabase Vector Store with Idempotent Operations
 * 
 * This module handles storing chunks, entities, and relations in Supabase
 * with UPSERT operations for idempotency.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  ChunkDTO,
  EntityDTO,
  MentionDTO,
  RelationDTO,
  DocumentDTO,
  RunExtraccionDTO
} from './types'

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  url: string
  serviceKey: string
}

/**
 * Result of a storage operation
 */
export interface StorageResult {
  success: boolean
  count: number
  error?: string
}

/**
 * Search result from vector search
 */
export interface SearchResult {
  id: string
  content: string
  similarity: number
  documentId: string
  processId: string
  metadata: Record<string, any>
}

/**
 * Supabase Vector Store class
 */
export class SupabaseVectorStore {
  private client: SupabaseClient

  constructor(config?: Partial<VectorStoreConfig>) {
    const url = config?.url || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = config?.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  /**
   * Check if the store is configured
   */
  isConfigured(): boolean {
    return !!this.client
  }

  /**
   * Upsert a document with idempotency
   */
  async upsertDocument(document: DocumentDTO): Promise<StorageResult> {
    try {
      // Use the new ingestion_documents table
      const { error } = await this.client
        .from('ingestion_documents')
        .upsert({
          id: document.id,
          title: document.title,
          source: document.source,
          content: document.content,
          content_hash: document.contentHash,
          workspace_id: document.workspaceId,
          process_id: document.processId,
          user_id: document.userId,
          metadata: document.metadata,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })

      if (error) {
        // If ingestion_documents doesn't exist, try the old documents table
        if (error.code === '42P01') {
          console.log('ingestion_documents table not found, using documents table')
          const { error: error2 } = await this.client
            .from('documents')
            .upsert({
              id: document.id,
              title: document.title,
              source: document.source,
              content: document.content,
              metadata: {
                ...document.metadata,
                content_hash: document.contentHash
              },
              workspace_id: document.workspaceId,
              process_id: document.processId,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            })
          
          if (error2) {
            return { success: false, count: 0, error: error2.message }
          }
        } else {
          return { success: false, count: 0, error: error.message }
        }
      }

      return { success: true, count: 1 }
    } catch (error: any) {
      return { success: false, count: 0, error: error.message }
    }
  }

  /**
   * Upsert chunks in batch with embeddings
   */
  async upsertChunks(chunks: ChunkDTO[]): Promise<StorageResult> {
    if (chunks.length === 0) {
      return { success: true, count: 0 }
    }

    try {
      // Try the new ingestion_chunks table first
      const chunkData = chunks.map(c => ({
        id: c.id,
        document_id: c.documentId,
        process_id: c.processId,
        workspace_id: c.workspaceId,
        content: c.content,
        chunk_index: c.chunkIndex,
        char_offset: c.charOffset,
        token_count: c.tokenCount,
        content_hash: c.contentHash,
        embedding: c.embedding ? `[${c.embedding.join(',')}]` : null,
        metadata: {
          fileName: c.metadata.fileName,
          mimeType: c.metadata.mimeType,
          sectionHeader: c.metadata.sectionHeader,
          contentType: c.metadata.contentType,
          structurePath: c.metadata.structurePath
        },
        updated_at: new Date().toISOString()
      }))

      const { error } = await this.client
        .from('ingestion_chunks')
        .upsert(chunkData, {
          onConflict: 'id'
        })

      if (error) {
        // If ingestion_chunks doesn't exist, try the old document_chunks table
        if (error.code === '42P01') {
          console.log('ingestion_chunks table not found, using document_chunks table')
          
          const oldChunkData = chunks.map(c => ({
            process_id: c.processId,
            document_id: c.documentId,
            workspace_id: c.workspaceId,
            user_id: c.metadata.userId || 'unknown',
            content: c.content,
            chunk_index: c.chunkIndex,
            embedding: c.embedding ? `[${c.embedding.join(',')}]` : null,
            metadata: {
              fileName: c.metadata.fileName,
              mimeType: c.metadata.mimeType,
              sectionHeader: c.metadata.sectionHeader,
              contentType: c.metadata.contentType,
              tokenCount: c.tokenCount,
              charOffset: c.charOffset,
              contentHash: c.contentHash
            },
            updated_at: new Date().toISOString()
          }))

          const { error: error2 } = await this.client
            .from('document_chunks')
            .insert(oldChunkData)

          if (error2) {
            return { success: false, count: 0, error: error2.message }
          }
        } else {
          return { success: false, count: 0, error: error.message }
        }
      }

      return { success: true, count: chunks.length }
    } catch (error: any) {
      return { success: false, count: 0, error: error.message }
    }
  }

  /**
   * Upsert entities in batch
   */
  async upsertEntities(entities: EntityDTO[]): Promise<StorageResult> {
    if (entities.length === 0) {
      return { success: true, count: 0 }
    }

    try {
      // Try the new ingestion_entities table first
      const entityData = entities.map(e => ({
        id: e.id,
        process_id: e.processId,
        workspace_id: e.workspaceId,
        nombre_canonico: e.nombreCanonico,
        entity_type: e.tipo,
        aliases: e.aliases,
        mention_ids: e.mentionIds,
        summary: e.summary,
        metadata: e.metadata,
        run_id: e.runId,
        updated_at: new Date().toISOString()
      }))

      const { error } = await this.client
        .from('ingestion_entities')
        .upsert(entityData, {
          onConflict: 'id'
        })

      if (error) {
        // If ingestion_entities doesn't exist, try the old graph_entities table
        if (error.code === '42P01') {
          console.log('ingestion_entities table not found, using graph_entities table')
          
          const oldEntityData = entities.map(e => ({
            process_id: e.processId,
            workspace_id: e.workspaceId,
            name: e.nombreCanonico,
            entity_type: e.tipo,
            summary: e.summary,
            aliases: e.aliases,
            metadata: {
              ...e.metadata,
              mentionIds: e.mentionIds,
              runId: e.runId
            },
            updated_at: new Date().toISOString()
          }))

          const { error: error2 } = await this.client
            .from('graph_entities')
            .upsert(oldEntityData, {
              onConflict: 'id'
            })

          if (error2) {
            return { success: false, count: 0, error: error2.message }
          }
        } else {
          return { success: false, count: 0, error: error.message }
        }
      }

      return { success: true, count: entities.length }
    } catch (error: any) {
      return { success: false, count: 0, error: error.message }
    }
  }

  /**
   * Upsert mentions in batch
   */
  async upsertMentions(mentions: MentionDTO[]): Promise<StorageResult> {
    if (mentions.length === 0) {
      return { success: true, count: 0 }
    }

    try {
      // Try the new ingestion_mentions table first
      const mentionData = mentions.map(m => ({
        id: m.id,
        process_id: m.processId,
        workspace_id: m.workspaceId,
        document_id: m.documentId,
        chunk_id: m.chunkId,
        texto_original: m.textoOriginal,
        normalizado: m.normalizado,
        entity_type: m.tipo,
        span_start: m.spanStart,
        span_end: m.spanEnd,
        confidence: m.confidence,
        run_id: m.runId,
        updated_at: new Date().toISOString()
      }))

      const { error } = await this.client
        .from('ingestion_mentions')
        .upsert(mentionData, {
          onConflict: 'id'
        })

      if (error) {
        // Table might not exist - this is not critical
        console.warn('ingestion_mentions table not found, mentions stored only in Neo4j:', error.message)
        return { success: true, count: 0 }
      }

      return { success: true, count: mentions.length }
    } catch (error: any) {
      return { success: false, count: 0, error: error.message }
    }
  }

  /**
   * Upsert relations in batch
   */
  async upsertRelations(relations: RelationDTO[]): Promise<StorageResult> {
    if (relations.length === 0) {
      return { success: true, count: 0 }
    }

    try {
      // Try the new ingestion_relations table first
      const relationData = relations.map(r => ({
        id: r.id,
        process_id: r.processId,
        workspace_id: r.workspaceId,
        source_entity_id: r.sourceEntidadId,
        target_entity_id: r.targetEntidadId,
        rel_code: r.relCode,
        confidence: r.confidence,
        status: r.status,
        evidence_mention_id: r.evidenceMentionId,
        evidence_text: r.evidenceText,
        run_id: r.runId,
        updated_at: new Date().toISOString()
      }))

      const { error } = await this.client
        .from('ingestion_relations')
        .upsert(relationData, {
          onConflict: 'id'
        })

      if (error) {
        // If ingestion_relations doesn't exist, try the old graph_relations table
        if (error.code === '42P01') {
          console.log('ingestion_relations table not found, using graph_relations table')
          
          const oldRelationData = relations.map(r => ({
            process_id: r.processId,
            source_entity_id: r.sourceEntidadId,
            target_entity_id: r.targetEntidadId,
            relation_type: r.relCode,
            metadata: {
              confidence: r.confidence,
              status: r.status,
              evidenceMentionId: r.evidenceMentionId,
              evidenceText: r.evidenceText,
              runId: r.runId
            },
            updated_at: new Date().toISOString()
          }))

          const { error: error2 } = await this.client
            .from('graph_relations')
            .upsert(oldRelationData, {
              onConflict: 'id'
            })

          if (error2) {
            return { success: false, count: 0, error: error2.message }
          }
        } else {
          return { success: false, count: 0, error: error.message }
        }
      }

      return { success: true, count: relations.length }
    } catch (error: any) {
      return { success: false, count: 0, error: error.message }
    }
  }

  /**
   * Save an extraction run for auditing
   */
  async saveRun(run: RunExtraccionDTO): Promise<StorageResult> {
    try {
      const { error } = await this.client
        .from('extraction_runs')
        .upsert({
          id: run.id,
          workspace_id: run.workspaceId,
          process_id: run.processId,
          document_id: run.documentId,
          model_name: run.modelName,
          prompt_version: run.promptVersion,
          started_at: run.startedAt.toISOString(),
          finished_at: run.finishedAt?.toISOString(),
          status: run.status,
          mentions_created: run.mentionsCreated,
          entities_created: run.entitiesCreated,
          relations_created: run.relationsCreated,
          relations_rejected: run.relationsRejected,
          error_message: run.errorMessage,
          metadata: run.metadata,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })

      if (error) {
        // Table might not exist
        console.warn('extraction_runs table not found, skipping run storage:', error.message)
        return { success: true, count: 0 }
      }

      return { success: true, count: 1 }
    } catch (error: any) {
      return { success: false, count: 0, error: error.message }
    }
  }

  /**
   * Vector similarity search
   */
  async similaritySearch(
    queryEmbedding: number[],
    options: {
      processId?: string
      workspaceId?: string
      limit?: number
      threshold?: number
    } = {}
  ): Promise<SearchResult[]> {
    const { processId, workspaceId, limit = 5, threshold = 0.7 } = options

    try {
      // Try new ingestion_chunks RPC first
      const { data, error } = await this.client.rpc('match_ingestion_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        filter_process_id: processId || null,
        filter_workspace_id: workspaceId || null
      })

      if (error) {
        // Fallback to old RPC
        const { data: data2, error: error2 } = await this.client.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit,
          filter_process_id: processId || null,
          filter_workspace_id: workspaceId || null
        })

        if (error2) {
          // Fallback to direct query
          return this.fallbackSearch(queryEmbedding, options)
        }

        return (data2 || []).map((item: any) => ({
          id: item.id,
          content: item.content,
          similarity: item.similarity,
          documentId: item.document_id,
          processId: item.process_id,
          metadata: item.metadata || {}
        }))
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        content: item.content,
        similarity: item.similarity,
        documentId: item.document_id,
        processId: item.process_id,
        metadata: item.metadata || {}
      }))
    } catch (error: any) {
      console.error('Error in similarity search:', error)
      return []
    }
  }

  /**
   * Fallback search when RPC is not available
   */
  private async fallbackSearch(
    queryEmbedding: number[],
    options: {
      processId?: string
      workspaceId?: string
      limit?: number
    }
  ): Promise<SearchResult[]> {
    const { processId, workspaceId, limit = 5 } = options

    try {
      let query = this.client
        .from('document_chunks')
        .select('id, content, document_id, process_id, metadata')
        .limit(limit)

      if (processId) {
        query = query.eq('process_id', processId)
      }
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId)
      }

      const { data, error } = await query

      if (error) {
        return []
      }

      // Return without similarity scores
      return (data || []).map((item: any) => ({
        id: item.id,
        content: item.content,
        similarity: 1.0,
        documentId: item.document_id,
        processId: item.process_id,
        metadata: item.metadata || {}
      }))
    } catch (error: any) {
      return []
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteDocumentChunks(documentId: string): Promise<StorageResult> {
    try {
      // Try new table first
      const { error } = await this.client
        .from('ingestion_chunks')
        .delete()
        .eq('document_id', documentId)

      if (error && error.code !== '42P01') {
        // Also try old table
        await this.client
          .from('document_chunks')
          .delete()
          .eq('document_id', documentId)
      }

      return { success: true, count: 0 }
    } catch (error: any) {
      return { success: false, count: 0, error: error.message }
    }
  }

  /**
   * Delete all data for a process
   */
  async deleteProcessData(processId: string): Promise<StorageResult> {
    try {
      // Delete from all tables (new and old)
      await this.client.from('ingestion_chunks').delete().eq('process_id', processId)
      await this.client.from('ingestion_mentions').delete().eq('process_id', processId)
      await this.client.from('ingestion_relations').delete().eq('process_id', processId)
      await this.client.from('ingestion_entities').delete().eq('process_id', processId)
      await this.client.from('ingestion_documents').delete().eq('process_id', processId)
      
      // Also delete from old tables
      await this.client.from('document_chunks').delete().eq('process_id', processId)
      await this.client.from('graph_relations').delete().eq('process_id', processId)
      await this.client.from('graph_entities').delete().eq('process_id', processId)
      await this.client.from('documents').delete().eq('process_id', processId)

      return { success: true, count: 0 }
    } catch (error: any) {
      return { success: false, count: 0, error: error.message }
    }
  }

  /**
   * Get chunks for a process
   */
  async getProcessChunks(processId: string): Promise<ChunkDTO[]> {
    try {
      // Try new table first
      const { data, error } = await this.client
        .from('ingestion_chunks')
        .select('*')
        .eq('process_id', processId)
        .order('chunk_index', { ascending: true })

      if (error) {
        // Try old table
        const { data: data2 } = await this.client
          .from('document_chunks')
          .select('*')
          .eq('process_id', processId)
          .order('chunk_index', { ascending: true })
        
        if (data2) {
          return data2.map((item: any) => ({
            id: item.id,
            documentId: item.document_id,
            processId: item.process_id,
            workspaceId: item.workspace_id,
            content: item.content,
            chunkIndex: item.chunk_index,
            charOffset: item.char_offset || 0,
            tokenCount: item.token_count || 0,
            contentHash: item.content_hash || '',
            embedding: item.embedding,
            metadata: item.metadata || {}
          }))
        }
        return []
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        documentId: item.document_id,
        processId: item.process_id,
        workspaceId: item.workspace_id,
        content: item.content,
        chunkIndex: item.chunk_index,
        charOffset: item.char_offset,
        tokenCount: item.token_count,
        contentHash: item.content_hash,
        embedding: item.embedding,
        metadata: item.metadata || {}
      }))
    } catch (error: any) {
      return []
    }
  }

  /**
   * Get entities for a process
   */
  async getProcessEntities(processId: string): Promise<EntityDTO[]> {
    try {
      // Try new table first
      const { data, error } = await this.client
        .from('ingestion_entities')
        .select('*')
        .eq('process_id', processId)

      if (error) {
        // Try old table
        const { data: data2 } = await this.client
          .from('graph_entities')
          .select('*')
          .eq('process_id', processId)
        
        if (data2) {
          return data2.map((item: any) => ({
            id: item.id,
            processId: item.process_id,
            workspaceId: item.workspace_id,
            nombreCanonico: item.name,
            tipo: item.entity_type,
            summary: item.summary,
            aliases: item.aliases || [],
            mentionIds: item.metadata?.mentionIds || [],
            metadata: item.metadata || {},
            runId: item.metadata?.runId || ''
          }))
        }
        return []
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        processId: item.process_id,
        workspaceId: item.workspace_id,
        nombreCanonico: item.nombre_canonico,
        tipo: item.entity_type,
        summary: item.summary,
        aliases: item.aliases || [],
        mentionIds: item.mention_ids || [],
        metadata: item.metadata || {},
        runId: item.run_id
      }))
    } catch (error: any) {
      return []
    }
  }
}

/**
 * Create default vector store instance
 */
export const vectorStore = new SupabaseVectorStore()