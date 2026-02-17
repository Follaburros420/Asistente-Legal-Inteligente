/**
 * Neo4j Graph Writer with Batch Operations
 * 
 * This module handles writing entities, mentions, and relations to Neo4j
 * using efficient batch operations with MERGE for idempotency.
 */

import neo4j, { Driver, Session } from 'neo4j-driver'
import {
  EntityDTO,
  MentionDTO,
  RelationDTO,
  ChunkDTO,
  DocumentDTO,
  RelCode
} from './types'

/**
 * Graph writer configuration
 */
export interface GraphWriterConfig {
  uri: string
  username: string
  password: string
  maxConnectionPoolSize?: number
  connectionTimeout?: number
}

/**
 * Result of a batch write operation
 */
export interface BatchWriteResult {
  success: boolean
  created: number
  updated: number
  errors: string[]
}

/**
 * Neo4j Graph Writer class
 */
export class Neo4jGraphWriter {
  private driver: Driver | null = null
  private config: GraphWriterConfig

  constructor(config?: Partial<GraphWriterConfig>) {
    this.config = {
      uri: config?.uri || process.env.NEO4J_URI || '',
      username: config?.username || process.env.NEO4J_USER || 'neo4j',
      password: config?.password || process.env.NEO4J_PASSWORD || '',
      maxConnectionPoolSize: config?.maxConnectionPoolSize || 50,
      connectionTimeout: config?.connectionTimeout || 120000
    }

    this.initializeDriver()
  }

  /**
   * Initialize the Neo4j driver
   */
  private initializeDriver(): void {
    if (!this.config.uri || !this.config.password) {
      console.warn('WARNING: NEO4J_URI or NEO4J_PASSWORD not configured')
      return
    }

    try {
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000,
          maxConnectionPoolSize: this.config.maxConnectionPoolSize,
          connectionAcquisitionTimeout: this.config.connectionTimeout,
          disableLosslessIntegers: true
        }
      )
      console.log('Neo4j driver initialized for graph writer')
    } catch (error: any) {
      console.error('Failed to initialize Neo4j driver:', error)
    }
  }

  /**
   * Get a session from the driver
   */
  private getSession(): Session | null {
    if (!this.driver) return null
    return this.driver.session()
  }

  /**
   * Check if the writer is configured
   */
  isConfigured(): boolean {
    return !!this.driver
  }

  /**
   * Create structural nodes (Workspace, Process, Document, Chunk)
   */
  async upsertStructuralNodes(
    document: DocumentDTO,
    chunks: ChunkDTO[]
  ): Promise<BatchWriteResult> {
    const session = this.getSession()
    if (!session) {
      return { success: false, created: 0, updated: 0, errors: ['Driver not initialized'] }
    }

    const errors: string[] = []
    let created = 0
    let updated = 0

    try {
      // Create Workspace node
      await session.run(`
        MERGE (w:Workspace {id: $workspaceId})
        SET w.updated_at = datetime()
      `, { workspaceId: document.workspaceId })
      created++

      // Create Process node and link to Workspace
      await session.run(`
        MATCH (w:Workspace {id: $workspaceId})
        MERGE (p:Process {id: $processId})
        SET p.updated_at = datetime()
        MERGE (w)-[:HAS_PROCESS]->(p)
      `, { 
        workspaceId: document.workspaceId,
        processId: document.processId 
      })
      created++

      // Create Document node and link to Process
      await session.run(`
        MATCH (p:Process {id: $processId})
        MERGE (d:Document {id: $documentId})
        SET d.title = $title,
            d.source = $source,
            d.content_hash = $contentHash,
            d.file_name = $fileName,
            d.mime_type = $mimeType,
            d.process_id = $processId,
            d.workspace_id = $workspaceId,
            d.updated_at = datetime()
        MERGE (p)-[:HAS_DOCUMENT]->(d)
      `, {
        processId: document.processId,
        documentId: document.id,
        workspaceId: document.workspaceId,
        title: document.title,
        source: document.source,
        contentHash: document.contentHash,
        fileName: document.metadata.fileName,
        mimeType: document.metadata.mimeType
      })
      created++

      // Create Chunk nodes in batch
      if (chunks.length > 0) {
        const chunkParams = chunks.map(c => ({
          id: c.id,
          documentId: c.documentId,
          processId: c.processId,
          workspaceId: c.workspaceId,
          content: c.content,
          chunkIndex: c.chunkIndex,
          charOffset: c.charOffset,
          tokenCount: c.tokenCount,
          contentHash: c.contentHash,
          sectionHeader: c.metadata.sectionHeader || null,
          contentType: c.metadata.contentType || 'other'
        }))

        const result = await session.run(`
          MATCH (d:Document {id: $documentId})
          UNWIND $chunks AS chunk
          MERGE (c:Chunk {id: chunk.id})
          SET c.content = chunk.content,
              c.chunk_index = chunk.chunkIndex,
              c.char_offset = chunk.charOffset,
              c.token_count = chunk.tokenCount,
              c.content_hash = chunk.contentHash,
              c.section_header = chunk.sectionHeader,
              c.content_type = chunk.contentType,
              c.process_id = chunk.processId,
              c.workspace_id = chunk.workspaceId,
              c.updated_at = datetime()
          MERGE (d)-[:HAS_CHUNK]->(c)
          RETURN count(c) as created
        `, {
          documentId: document.id,
          chunks: chunkParams
        })

        const createdValue = result.records[0]?.get('created')
        created += typeof createdValue?.toNumber === 'function' 
          ? createdValue.toNumber() 
          : (Number(createdValue) || 0)
      }

      return { success: true, created, updated, errors }
    } catch (error: any) {
      errors.push(error.message)
      console.error('Error in upsertStructuralNodes:', error)
      return { success: false, created, updated, errors }
    } finally {
      await session.close()
    }
  }

  /**
   * Upsert entities in batch with MERGE for idempotency
   */
  async upsertEntities(entities: EntityDTO[]): Promise<BatchWriteResult> {
    const session = this.getSession()
    if (!session) {
      return { success: false, created: 0, updated: 0, errors: ['Driver not initialized'] }
    }

    if (entities.length === 0) {
      return { success: true, created: 0, updated: 0, errors: [] }
    }

    const errors: string[] = []
    let created = 0
    let updated = 0

    try {
      // Prepare entity data
      const entityParams = entities.map(e => ({
        id: e.id,
        processId: e.processId,
        workspaceId: e.workspaceId,
        nombreCanonico: e.nombreCanonico,
        tipo: e.tipo,
        aliases: e.aliases,
        summary: e.summary || '',
        mentionCount: e.metadata.mentionCount,
        runId: e.runId
      }))

      // Batch upsert with MERGE - using process_id for compatibility with old queries
      const result = await session.run(`
        UNWIND $entities AS entity
        MERGE (e:Entity {id: entity.id})
        SET e.process_id = entity.processId,
            e.workspace_id = entity.workspaceId,
            e.nombre_canonico = entity.nombreCanonico,
            e.name = entity.nombreCanonico,
            e.tipo = entity.tipo,
            e.type = entity.tipo,
            e.aliases = entity.aliases,
            e.summary = entity.summary,
            e.mention_count = entity.mentionCount,
            e.run_id = entity.runId,
            e.updated_at = datetime()
        WITH e, entity
        MATCH (p:Process {id: entity.processId})
        MERGE (p)-[:HAS_ENTITY]->(e)
        RETURN count(e) as upserted
      `, { entities: entityParams })

      const upsertedValue = result.records[0]?.get('upserted')
      created = typeof upsertedValue?.toNumber === 'function' 
        ? upsertedValue.toNumber() 
        : (Number(upsertedValue) || 0)
      console.log(`✅ Upserted ${created} entities to Neo4j`)

      return { success: true, created, updated, errors }
    } catch (error: any) {
      errors.push(error.message)
      console.error('Error in upsertEntities:', error)
      return { success: false, created, updated, errors }
    } finally {
      await session.close()
    }
  }

  /**
   * Upsert mentions in batch
   */
  async upsertMentions(mentions: MentionDTO[]): Promise<BatchWriteResult> {
    const session = this.getSession()
    if (!session) {
      return { success: false, created: 0, updated: 0, errors: ['Driver not initialized'] }
    }

    if (mentions.length === 0) {
      return { success: true, created: 0, updated: 0, errors: [] }
    }

    const errors: string[] = []
    let created = 0
    let updated = 0

    try {
      const mentionParams = mentions.map(m => ({
        id: m.id,
        chunkId: m.chunkId,
        documentId: m.documentId,
        processId: m.processId,
        workspaceId: m.workspaceId,
        textoOriginal: m.textoOriginal,
        normalizado: m.normalizado,
        tipo: m.tipo,
        spanStart: m.spanStart,
        spanEnd: m.spanEnd,
        confidence: m.confidence,
        runId: m.runId
      }))

      const result = await session.run(`
        UNWIND $mentions AS mention
        MERGE (m:Mention {id: mention.id})
        SET m.texto_original = mention.textoOriginal,
            m.normalizado = mention.normalizado,
            m.tipo = mention.tipo,
            m.span_start = mention.spanStart,
            m.span_end = mention.spanEnd,
            m.confidence = mention.confidence,
            m.run_id = mention.runId,
            m.process_id = mention.processId,
            m.workspace_id = mention.workspaceId,
            m.updated_at = datetime()
        WITH m, mention
        MATCH (c:Chunk {id: mention.chunkId})
        MERGE (c)-[:HAS_MENTION]->(m)
        RETURN count(m) as upserted
      `, { mentions: mentionParams })

      const mentionsValue = result.records[0]?.get('upserted')
      created = typeof mentionsValue?.toNumber === 'function' 
        ? mentionsValue.toNumber() 
        : (Number(mentionsValue) || 0)
      console.log(`✅ Upserted ${created} mentions to Neo4j`)

      return { success: true, created, updated, errors }
    } catch (error: any) {
      errors.push(error.message)
      console.error('Error in upsertMentions:', error)
      return { success: false, created, updated, errors }
    } finally {
      await session.close()
    }
  }

  /**
   * Create MENTIONS relationships between mentions and entities
   */
  async linkMentionsToEntities(
    mentionToEntityMap: Map<string, string>
  ): Promise<BatchWriteResult> {
    const session = this.getSession()
    if (!session) {
      return { success: false, created: 0, updated: 0, errors: ['Driver not initialized'] }
    }

    if (mentionToEntityMap.size === 0) {
      return { success: true, created: 0, updated: 0, errors: [] }
    }

    const errors: string[] = []
    let created = 0

    try {
      const links = Array.from(mentionToEntityMap.entries()).map(([mentionId, entityId]) => ({
        mentionId,
        entityId
      }))

      const result = await session.run(`
        UNWIND $links AS link
        MATCH (m:Mention {id: link.mentionId})
        MATCH (e:Entity {id: link.entityId})
        MERGE (m)-[:REFERS_TO]->(e)
        RETURN count(m) as created
      `, { links })

      const linksValue = result.records[0]?.get('created')
      created = typeof linksValue?.toNumber === 'function' 
        ? linksValue.toNumber() 
        : (Number(linksValue) || 0)
      console.log(`✅ Created ${created} mention-entity links in Neo4j`)

      return { success: true, created, updated: 0, errors }
    } catch (error: any) {
      errors.push(error.message)
      console.error('Error in linkMentionsToEntities:', error)
      return { success: false, created, updated: 0, errors }
    } finally {
      await session.close()
    }
  }

  /**
   * Upsert relations in batch with evidence
   */
  async upsertRelations(relations: RelationDTO[]): Promise<BatchWriteResult> {
    const session = this.getSession()
    if (!session) {
      return { success: false, created: 0, updated: 0, errors: ['Driver not initialized'] }
    }

    if (relations.length === 0) {
      return { success: true, created: 0, updated: 0, errors: [] }
    }

    const errors: string[] = []
    let created = 0
    let updated = 0

    try {
      const relationParams = relations.map(r => ({
        id: r.id,
        sourceId: r.sourceEntidadId,
        targetId: r.targetEntidadId,
        relCode: r.relCode,
        confidence: r.confidence,
        status: r.status,
        evidenceMentionId: r.evidenceMentionId,
        evidenceText: r.evidenceText,
        processId: r.processId,
        workspaceId: r.workspaceId,
        runId: r.runId
      }))

      // Create relations with RELATES_TO relationship type
      const result = await session.run(`
        UNWIND $relations AS rel
        MATCH (source:Entity {id: rel.sourceId})
        MATCH (target:Entity {id: rel.targetId})
        MERGE (source)-[r:RELATES_TO {id: rel.id}]->(target)
        SET r.rel_code = rel.relCode,
            r.type = rel.relCode,
            r.confidence = rel.confidence,
            r.status = rel.status,
            r.evidence_mention_id = rel.evidenceMentionId,
            r.evidence_text = rel.evidenceText,
            r.process_id = rel.processId,
            r.workspace_id = rel.workspaceId,
            r.run_id = rel.runId,
            r.updated_at = datetime()
        RETURN count(r) as upserted
      `, { relations: relationParams })

      const relationsValue = result.records[0]?.get('upserted')
      created = typeof relationsValue?.toNumber === 'function' 
        ? relationsValue.toNumber() 
        : (Number(relationsValue) || 0)
      console.log(`✅ Upserted ${created} relations to Neo4j`)

      return { success: true, created, updated, errors }
    } catch (error: any) {
      errors.push(error.message)
      console.error('Error in upsertRelations:', error)
      return { success: false, created, updated, errors }
    } finally {
      await session.close()
    }
  }

  /**
   * Delete all data for a process
   */
  async deleteProcessGraph(processId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.getSession()
    if (!session) {
      return { success: false, error: 'Driver not initialized' }
    }

    try {
      await session.run(`
        MATCH (n)
        WHERE n.process_id = $processId OR n.id = $processId
        DETACH DELETE n
      `, { processId })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    } finally {
      await session.close()
    }
  }

  /**
   * Delete a document and its related data
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.getSession()
    if (!session) {
      return { success: false, error: 'Driver not initialized' }
    }

    try {
      // Delete chunks, mentions, and their relationships
      await session.run(`
        MATCH (d:Document {id: $documentId})
        OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
        OPTIONAL MATCH (c)-[:HAS_MENTION]->(m:Mention)
        DETACH DELETE m, c, d
      `, { documentId })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    } finally {
      await session.close()
    }
  }

  /**
   * Create indexes for better performance
   */
  async createIndexes(): Promise<{ success: boolean; errors: string[] }> {
    const session = this.getSession()
    if (!session) {
      return { success: false, errors: ['Driver not initialized'] }
    }

    const errors: string[] = []

    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS FOR (w:Workspace) ON (w.id)',
      'CREATE INDEX IF NOT EXISTS FOR (p:Process) ON (p.id)',
      'CREATE INDEX IF NOT EXISTS FOR (d:Document) ON (d.id)',
      'CREATE INDEX IF NOT EXISTS FOR (c:Chunk) ON (c.id)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.id)',
      'CREATE INDEX IF NOT EXISTS FOR (m:Mention) ON (m.id)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.process_id)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.workspace_id)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.tipo)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.nombre_canonico)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.name)'
    ]

    try {
      for (const query of indexQueries) {
        try {
          await session.run(query)
        } catch (error: any) {
          errors.push(`Index creation failed: ${error.message}`)
        }
      }

      return { success: errors.length === 0, errors }
    } finally {
      await session.close()
    }
  }

  /**
   * Close the driver connection
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close()
      this.driver = null
    }
  }
}

/**
 * Create default graph writer instance
 */
export const graphWriter = new Neo4jGraphWriter()