/**
 * Supabase Vector Store Service
 * 
 * This service handles document embeddings and vector search using Supabase pgvector.
 * It works alongside Neo4j for knowledge graph functionality.
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { env } from '@/lib/env/runtime-env'

export interface DocumentChunk {
  id?: string
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

export interface SearchResult {
  id: string
  content: string
  metadata: Record<string, any>
  similarity: number
  process_id: string
  document_id: string
}

export interface GraphEntity {
  id?: string
  process_id: string
  workspace_id?: string
  user_id?: string
  name: string
  entity_type?: string
  summary?: string
  neo4j_id?: string
  neo4j_labels?: string[]
  metadata?: Record<string, any>
}

export interface GraphRelation {
  id?: string
  process_id: string
  source_entity_id?: string
  target_entity_id?: string
  relation_type: string
  neo4j_id?: string
  metadata?: Record<string, any>
}

export class SupabaseVectorStore {
  private supabase: any
  private openai: OpenAI | null = null

  constructor() {
    // Use service role for backend operations
    this.supabase = createClient(
      env.supabaseUrl(),
      env.supabaseServiceRole(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Initialize OpenAI for embeddings
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      this.openai = new OpenAI({ apiKey })
    } else {
      console.warn('⚠️ OPENAI_API_KEY not configured - embeddings will not work')
    }
  }

  /**
   * Generate embeddings for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - missing API key')
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.replace(/\n/g, ' ').substring(0, 8191), // Truncate to max tokens
      dimensions: 1536
    })

    return response.data[0].embedding
  }

  /**
   * Insert document chunks with embeddings
   */
  async insertChunks(chunks: Omit<DocumentChunk, 'embedding'>[]): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // Verify Supabase client is initialized
      if (!this.supabase) {
        throw new Error('Supabase client not initialized')
      }
      
      const chunksWithEmbeddings: DocumentChunk[] = []

      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk.content)
        chunksWithEmbeddings.push({
          ...chunk,
          embedding
        })
      }

      const insertData = chunksWithEmbeddings.map(c => ({
        process_id: c.process_id,
        document_id: c.document_id,
        workspace_id: c.workspace_id,
        user_id: c.user_id,
        content: c.content,
        chunk_index: c.chunk_index,
        // pgvector expects the embedding as a string representation of an array
        embedding: `[${c.embedding?.join(',')}]`,
        metadata: c.metadata || {}
      }))
      
      console.log(`📊 Inserting ${insertData.length} chunks into document_chunks table...`)
      console.log(`📊 Sample chunk:`, JSON.stringify({
        process_id: insertData[0]?.process_id,
        document_id: insertData[0]?.document_id,
        user_id: insertData[0]?.user_id,
        content_length: insertData[0]?.content?.length,
        embedding_length: insertData[0]?.embedding?.length
      }))
      
      // Log the raw Supabase client configuration
      console.log(`📊 Supabase URL configured: ${!!env.supabaseUrl()}`)
      console.log(`📊 Supabase Service Role configured: ${!!env.supabaseServiceRole()}`)

      const { data, error, status, statusText } = await this.supabase
        .from('document_chunks')
        .insert(insertData)
        .select()

      console.log(`📊 Supabase response status: ${status} ${statusText}`)
      console.log(`📊 Supabase response data:`, data ? `${data.length} rows` : 'no data')
      console.log(`📊 Supabase response error:`, error)

      if (error) {
        console.error('❌ Error inserting chunks:', JSON.stringify(error, null, 2))
        console.error('❌ Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        return { success: false, count: 0, error: error.message || JSON.stringify(error) }
      }
      
      console.log(`✅ Insert result: ${data?.length || 0} rows inserted`)

      console.log(`✅ Inserted ${chunksWithEmbeddings.length} chunks with embeddings`)
      return { success: true, count: chunksWithEmbeddings.length }
    } catch (error: any) {
      console.error('❌ Error in insertChunks:', error)
      return { success: false, count: 0, error: error.message }
    }
  }

  /**
   * Vector similarity search
   * Searches both document_chunks and ingestion_chunks tables
   */
  async similaritySearch(
    query: string,
    options: {
      processId?: string
      workspaceId?: string
      limit?: number
      threshold?: number
    } = {}
  ): Promise<SearchResult[]> {
    try {
      const { processId, workspaceId, limit = 5, threshold = 0.7 } = options

      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query)

      const allResults: SearchResult[] = []

      // 1. Search document_chunks via RPC
      try {
        const { data: docData, error: docError } = await this.supabase
          .rpc('match_documents', {
            query_embedding: `[${queryEmbedding.join(',')}]`,
            match_threshold: threshold,
            match_count: limit,
            filter_process_id: processId || null,
            filter_workspace_id: workspaceId || null
          })

        if (!docError && docData && docData.length > 0) {
          console.log(`📚 [VectorStore] match_documents returned ${docData.length} results`)
          allResults.push(...docData)
        } else if (docError) {
          console.warn('⚠️ match_documents RPC error:', docError.message)
        }
      } catch (err: any) {
        console.warn('⚠️ match_documents RPC failed:', err.message)
      }

      // 2. Search ingestion_chunks via RPC (newer ingestion pipeline)
      try {
        const { data: ingData, error: ingError } = await this.supabase
          .rpc('match_ingestion_chunks', {
            query_embedding: `[${queryEmbedding.join(',')}]`,
            match_threshold: threshold,
            match_count: limit,
            filter_process_id: processId || null,
            filter_workspace_id: workspaceId || null
          })

        if (!ingError && ingData && ingData.length > 0) {
          console.log(`📚 [VectorStore] match_ingestion_chunks returned ${ingData.length} results`)
          allResults.push(...ingData.map((item: any) => ({
            id: item.id,
            content: item.content,
            metadata: item.metadata,
            similarity: item.similarity,
            process_id: item.process_id,
            document_id: item.document_id
          })))
        } else if (ingError) {
          console.warn('⚠️ match_ingestion_chunks RPC error:', ingError.message)
        }
      } catch (err: any) {
        console.warn('⚠️ match_ingestion_chunks RPC failed:', err.message)
      }

      // Sort by similarity and deduplicate
      const seen = new Set<string>()
      const deduplicated = allResults
        .sort((a, b) => b.similarity - a.similarity)
        .filter(r => {
          const key = `${r.id}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, limit)

      console.log(`📚 [VectorStore] Total results: ${deduplicated.length} (from ${allResults.length} raw)`)
      return deduplicated
    } catch (error: any) {
      console.error('❌ Error in similaritySearch:', error)
      return []
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteDocumentChunks(documentId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Delete all chunks for a process
   */
  async deleteProcessChunks(processId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('document_chunks')
      .delete()
      .eq('process_id', processId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Get all chunks for a process
   */
  async getProcessChunks(processId: string): Promise<DocumentChunk[]> {
    const { data, error } = await this.supabase
      .from('document_chunks')
      .select('*')
      .eq('process_id', processId)
      .order('chunk_index', { ascending: true })

    if (error) {
      console.error('❌ Error getting process chunks:', error)
      return []
    }

    return data || []
  }

  /**
   * Insert graph entity
   */
  async insertEntity(entity: GraphEntity): Promise<{ success: boolean; id?: string; error?: string }> {
    const { data, error } = await this.supabase
      .from('graph_entities')
      .insert(entity)
      .select('id')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  }

  /**
   * Insert graph relation
   */
  async insertRelation(relation: GraphRelation): Promise<{ success: boolean; id?: string; error?: string }> {
    const { data, error } = await this.supabase
      .from('graph_relations')
      .insert(relation)
      .select('id')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  }

  /**
   * Get entities for a process
   */
  async getProcessEntities(processId: string): Promise<GraphEntity[]> {
    const { data, error } = await this.supabase
      .from('graph_entities')
      .select('*')
      .eq('process_id', processId)

    if (error) {
      console.error('❌ Error getting process entities:', error)
      return []
    }

    return data || []
  }

  /**
   * Get relations for a process
   */
  async getProcessRelations(processId: string): Promise<GraphRelation[]> {
    const { data, error } = await this.supabase
      .from('graph_relations')
      .select('*')
      .eq('process_id', processId)

    if (error) {
      console.error('❌ Error getting process relations:', error)
      return []
    }

    return data || []
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.openai && !!env.supabaseUrl() && !!env.supabaseServiceRole()
  }
}

// Export singleton instance
export const supabaseVectorStore = new SupabaseVectorStore()
