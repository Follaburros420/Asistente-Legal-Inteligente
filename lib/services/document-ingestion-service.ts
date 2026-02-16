/**
 * Document Ingestion Service
 * 
 * This service handles document ingestion using:
 * - Docling for document parsing and text extraction
 * - Supabase Vector Store for embeddings and similarity search
 * - Neo4j for knowledge graph
 * - Wasabi (S3) for object storage
 * 
 * Architecture:
 * 1. Document uploaded to Wasabi (S3-compatible storage)
 * 2. Document parsed with Docling (PDF, DOCX, images, etc.)
 * 3. Document processed and chunked
 * 4. Embeddings generated and stored in Supabase Vector Store
 * 5. Entities extracted and stored in Neo4j knowledge graph
 */

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { encode } from 'gpt-tokenizer'
import OpenAI from 'openai'
import { supabaseVectorStore } from './supabase-vector-store'
import { neo4jGraphService } from './neo4j-graph-service'
import { doclingService } from './docling-service'
import { env } from '@/lib/env/runtime-env'

// Chunking configuration for legal documents
const CHUNK_SIZE = 650 // tokens
const CHUNK_OVERLAP = 100 // tokens

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

class DocumentIngestionService {
  private openai: OpenAI | null = null

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      this.openai = new OpenAI({ apiKey })
    } else {
      console.warn('⚠️ OPENAI_API_KEY not configured - entity extraction will be limited')
    }
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

      // Step 2: Ingest the parsed content
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
   * Process and ingest a document
   */
  async ingestDocument(
    content: string,
    metadata: DocumentMetadata,
    options: IngestionOptions = {}
  ): Promise<IngestionResult> {
    try {
      console.log(`📄 Starting ingestion for document: ${metadata.file_name}`)

      // Step 1: Split document into chunks
      const chunks = await this.splitDocument(content)
      console.log(`📝 Created ${chunks.length} chunks`)

      // Step 2: Store chunks with embeddings in Supabase Vector Store
      const chunksResult = await supabaseVectorStore.insertChunks(
        chunks.map((chunk, index) => ({
          process_id: metadata.process_id,
          document_id: metadata.document_id,
          workspace_id: metadata.workspace_id,
          user_id: metadata.user_id,
          content: chunk,
          chunk_index: index,
          metadata: {
            file_name: metadata.file_name,
            mime_type: metadata.mime_type
          }
        }))
      )

      if (!chunksResult.success) {
        throw new Error(`Failed to store chunks: ${chunksResult.error}`)
      }

      console.log(`✅ Stored ${chunksResult.count} chunks in vector store`)

      // Step 3: Extract entities using LLM (skip if skipGraph is true)
      let entitiesExtracted = 0
      
      if (!options.skipGraph) {
        const entities = await this.extractEntities(content, metadata.file_name)
        console.log(`🔍 Extracted ${entities.length} entities`)

        // Step 4: Store entities in Neo4j knowledge graph
        for (const entity of entities) {
          const entityId = crypto.randomUUID()
          const result = await neo4jGraphService.createEntity({
            entityId,
            processId: metadata.process_id,
            workspaceId: metadata.workspace_id,
            name: entity.name,
            type: entity.type,
            summary: entity.summary,
            metadata: entity.metadata
          })

          if (result.success) {
            entitiesExtracted++

            // Also store in Supabase for backup/query
            await supabaseVectorStore.insertEntity({
              id: entityId,
              process_id: metadata.process_id,
              workspace_id: metadata.workspace_id,
              name: entity.name,
              entity_type: entity.type,
              summary: entity.summary,
              neo4j_id: result.neo4jId,
              metadata: entity.metadata
            })
          }
        }

        // Step 5: Create document node in Neo4j
        await neo4jGraphService.upsertDocument({
          documentId: metadata.document_id,
          processId: metadata.process_id,
          workspaceId: metadata.workspace_id,
          fileName: metadata.file_name,
          content: content.substring(0, 5000), // Store preview
          metadata: {
            chunk_count: chunks.length,
            entity_count: entitiesExtracted
          }
        })
      } else {
        console.log(`⏩ Skipping graph storage (chat-only ingestion)`)
      }

      console.log(`✅ Ingestion complete: ${chunksResult.count} chunks, ${entitiesExtracted} entities`)

      return {
        success: true,
        documentId: metadata.document_id,
        chunksCreated: chunksResult.count,
        entitiesExtracted
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
   * Split document into chunks
   */
  private async splitDocument(content: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE * 4, // Approximate characters per token
      chunkOverlap: CHUNK_OVERLAP * 4,
      separators: ['\n\n', '\n', '. ', ' ', '']
    })

    const docs = await splitter.createDocuments([content])
    return docs.map(doc => doc.pageContent)
  }

  /**
   * Extract entities from document using LLM
   */
  private async extractEntities(
    content: string,
    fileName: string
  ): Promise<Array<{
    name: string
    type: string
    summary?: string
    metadata?: Record<string, any>
  }>> {
    if (!this.openai) {
      console.warn('⚠️ OpenAI not configured, skipping entity extraction')
      return []
    }

    try {
      const prompt = `Analiza el siguiente documento legal y extrae las entidades importantes.
Para cada entidad, proporciona:
- name: nombre de la entidad
- type: tipo (persona, organización, fecha, dinero, ubicación, norma, artículo, hecho, documento)
- summary: breve descripción de su relevancia en el documento

Documento: ${fileName}

Contenido (primeros 8000 caracteres):
${content.substring(0, 8000)}

Responde SOLO en formato JSON válido con un array de entidades:
{"entities": [{"name": "...", "type": "...", "summary": "..."}]}`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis de documentos legales colombianos. Extrae entidades de forma precisa y concisa.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(response.choices[0].message.content || '{"entities": []}')
      return result.entities || []
    } catch (error: any) {
      console.error('❌ Error extracting entities:', error)
      return []
    }
  }

  /**
   * Delete a document and all its data
   */
  async deleteDocument(documentId: string, processId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete from Supabase Vector Store
      await supabaseVectorStore.deleteDocumentChunks(documentId)

      // Delete from Neo4j
      await neo4jGraphService.deleteDocument(documentId)

      return { success: true }
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
      // Delete from Supabase Vector Store
      await supabaseVectorStore.deleteProcessChunks(processId)

      // Delete from Neo4j
      await neo4jGraphService.deleteProcessGraph(processId)

      return { success: true }
    } catch (error: any) {
      console.error('❌ Error deleting process:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return supabaseVectorStore.isConfigured()
  }
}

// Export singleton instance
export const documentIngestionService = new DocumentIngestionService()
