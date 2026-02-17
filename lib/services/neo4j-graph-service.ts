/**
 * Neo4j Knowledge Graph Service
 * 
 * This service handles the knowledge graph functionality using Neo4j.
 * It stores entities and relationships extracted from legal documents.
 * 
 * Uses the official neo4j-driver for proper Bolt protocol support.
 */

import neo4j, { Driver, Session, ManagedTransaction } from 'neo4j-driver'

/**
 * Helper function to serialize metadata for Neo4j storage
 * Neo4j only supports primitive types or arrays of primitives as property values
 * So we need to convert objects to JSON strings
 */
function serializeMetadata(metadata: Record<string, any> | undefined): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return '{}'
  }
  return JSON.stringify(metadata)
}

/**
 * Helper function to convert JavaScript number to Neo4j integer
 * Neo4j requires explicit integer types for LIMIT and other clauses
 */
function toNeo4jInt(value: number): any {
  return neo4j.int(Math.floor(value))
}

/**
 * Helper function to deserialize metadata from Neo4j storage
 */
function deserializeMetadata(metadataStr: string | Record<string, any> | undefined): Record<string, any> {
  if (!metadataStr) {
    return {}
  }
  // If it's already an object (backward compatibility), return it
  if (typeof metadataStr === 'object') {
    return metadataStr
  }
  try {
    return JSON.parse(metadataStr)
  } catch {
    return {}
  }
}

export interface Neo4jNode {
  id: string
  labels: string[]
  properties: Record<string, any>
}

export interface Neo4jEdge {
  id: string
  type: string
  source: string
  target: string
  properties: Record<string, any>
}

export interface GraphData {
  nodes: Neo4jNode[]
  edges: Neo4jEdge[]
}

export interface EntityExtraction {
  name: string
  type: string
  summary?: string
  metadata?: Record<string, any>
}

export interface RelationExtraction {
  sourceEntity: string
  targetEntity: string
  relationType: string
  metadata?: Record<string, any>
}

export class Neo4jGraphService {
  private driver: Driver | null = null
  private uri: string
  private username: string
  private password: string

  constructor() {
    this.uri = process.env.NEO4J_URI || ''
    this.username = process.env.NEO4J_USER || 'neo4j'
    this.password = process.env.NEO4J_PASSWORD || ''

    if (this.uri && this.password) {
      try {
        // Initialize the Neo4j driver with proper Bolt protocol support
        this.driver = neo4j.driver(
          this.uri,
          neo4j.auth.basic(this.username, this.password),
          {
            maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
            maxConnectionPoolSize: 50,
            connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
            disableLosslessIntegers: true // Use native JS numbers
          }
        )
        console.log('✅ Neo4j driver initialized successfully')
      } catch (error: any) {
        console.error('❌ Failed to initialize Neo4j driver:', error)
        this.driver = null
      }
    } else {
      console.warn('⚠️ NEO4J_URI or NEO4J_PASSWORD not configured - graph functionality will be limited')
    }
  }

  /**
   * Get a session from the driver
   */
  private getSession(): Session | null {
    if (!this.driver) {
      return null
    }
    return this.driver.session()
  }

  /**
   * Execute a Cypher query using the official driver
   */
  private async executeQuery(query: string, params: Record<string, any> = {}): Promise<any[]> {
    const session = this.getSession()
    if (!session) {
      throw new Error('Neo4j driver not initialized')
    }

    try {
      const result = await session.run(query, params)
      return result.records.map(record => record.toObject())
    } catch (error: any) {
      console.error('❌ Neo4j query error:', error)
      throw error
    } finally {
      await session.close()
    }
  }

  /**
   * Create or update a document node in Neo4j
   */
  async upsertDocument(params: {
    documentId: string
    processId: string
    workspaceId?: string
    fileName: string
    content?: string
    metadata?: Record<string, any>
  }): Promise<{ success: boolean; neo4jId?: string; error?: string }> {
    try {
      const query = `
        MERGE (d:Document {id: $documentId})
        SET d.process_id = $processId,
            d.workspace_id = $workspaceId,
            d.file_name = $fileName,
            d.content = $content,
            d.metadata = $metadata,
            d.updated_at = datetime()
        SET d:Process_$processId
        RETURN d.id as id
      `

      const result = await this.executeQuery(query, {
        documentId: params.documentId,
        processId: params.processId,
        workspaceId: params.workspaceId,
        fileName: params.fileName,
        content: params.content || '',
        metadata: serializeMetadata(params.metadata)
      })

      return { success: true, neo4jId: result[0]?.id }
    } catch (error: any) {
      console.error('❌ Error upserting document:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Create an entity in Neo4j with process association
   */
  async createEntity(params: {
    entityId: string
    processId: string
    workspaceId?: string
    name: string
    type: string
    summary?: string
    metadata?: Record<string, any>
  }): Promise<{ success: boolean; neo4jId?: string; error?: string }> {
    try {
      const query = `
        CREATE (e:Entity {
          id: $entityId,
          process_id: $processId,
          workspace_id: $workspaceId,
          name: $name,
          type: $type,
          summary: $summary,
          metadata: $metadata,
          created_at: datetime(),
          updated_at: datetime()
        })
        SET e:Process_$processId
        RETURN e.id as id
      `

      const result = await this.executeQuery(query, {
        entityId: params.entityId,
        processId: params.processId,
        workspaceId: params.workspaceId,
        name: params.name,
        type: params.type,
        summary: params.summary || '',
        metadata: serializeMetadata(params.metadata)
      })

      return { success: true, neo4jId: result[0]?.id }
    } catch (error: any) {
      console.error('❌ Error creating entity:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Create a relationship between entities
   */
  async createRelation(params: {
    sourceEntityId: string
    targetEntityId: string
    relationType: string
    processId: string
    metadata?: Record<string, any>
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const query = `
        MATCH (source:Entity {id: $sourceEntityId})
        MATCH (target:Entity {id: $targetEntityId})
        CREATE (source)-[r:RELATES_TO {
          type: $relationType,
          process_id: $processId,
          metadata: $metadata,
          created_at: datetime()
        }]->(target)
        RETURN r
      `

      await this.executeQuery(query, {
        sourceEntityId: params.sourceEntityId,
        targetEntityId: params.targetEntityId,
        relationType: params.relationType,
        processId: params.processId,
        metadata: serializeMetadata(params.metadata)
      })

      return { success: true }
    } catch (error: any) {
      console.error('❌ Error creating relation:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get the knowledge graph for a process
   * Supports both process_id and group_id for compatibility
   */
  async getProcessGraph(processId: string, options: {
    limit?: number
    includeDocuments?: boolean
  } = {}): Promise<GraphData> {
    try {
      // Ensure limit is an integer (Neo4j requires integer for LIMIT)
      const { includeDocuments = true } = options
      const limit = toNeo4jInt(options.limit || 100)

      // Get entities for this process - check both process_id and group_id
      // Use uuid as id since that's what the data uses
      const entityQuery = `
        MATCH (e:Entity)
        WHERE e.process_id = $processId OR e.group_id = $processId
        RETURN COALESCE(e.uuid, e.id) as id, labels(e) as labels, e.name as name, e.type as type, 
               e.summary as summary, e.metadata as metadata, e.process_id as process_id, e.group_id as group_id
        LIMIT $limit
      `

      const entityResults = await this.executeQuery(entityQuery, { processId, limit })

      // Get all Entity nodes (for general graph view)
      const allEntitiesQuery = `
        MATCH (e:Entity)
        RETURN COALESCE(e.uuid, e.id) as id, labels(e) as labels, e.name as name, e.type as type,
               e.summary as summary, e.metadata as metadata, e.process_id as process_id, e.group_id as group_id
        LIMIT $limit
      `

      // If no results for specific process, get all entities
      const finalEntityResults = entityResults.length > 0 ? entityResults : await this.executeQuery(allEntitiesQuery, { limit })

      // Get relationships - check both process_id and group_id
      const relationQuery = `
        MATCH (source:Entity)-[r]->(target:Entity)
        WHERE r.process_id = $processId OR r.group_id = $processId 
              OR (source.process_id = $processId AND target.process_id = $processId)
              OR (source.group_id = $processId AND target.group_id = $processId)
        RETURN COALESCE(source.uuid, source.id) as source, 
               COALESCE(target.uuid, target.id) as target, 
               type(r) as type, r.type as relation_type, r.metadata as metadata
        LIMIT $limit
      `

      const relationResults = await this.executeQuery(relationQuery, { processId, limit })

      // Get all MENTIONS relationships for general graph
      const allRelationsQuery = `
        MATCH (source)-[r:MENTIONS]->(target)
        RETURN COALESCE(source.uuid, source.id) as source, 
               COALESCE(target.uuid, target.id) as target, 
               type(r) as type, 'MENTIONS' as relation_type, r.metadata as metadata
        LIMIT $limit
      `

      // Get all RELATES_TO relationships
      const allRelatesQuery = `
        MATCH (source)-[r:RELATES_TO]->(target)
        RETURN COALESCE(source.uuid, source.id) as source, 
               COALESCE(target.uuid, target.id) as target, 
               type(r) as type, r.type as relation_type, r.metadata as metadata
        LIMIT $limit
      `

      // Combine all relationships
      const allMentions = await this.executeQuery(allRelationsQuery, { limit })
      const allRelates = await this.executeQuery(allRelatesQuery, { limit })
      const finalRelationResults = relationResults.length > 0 ? relationResults : [...allMentions, ...allRelates]

      // Transform to graph format
      const nodes: Neo4jNode[] = finalEntityResults.map((row: any) => ({
        id: row.id,
        labels: row.labels || ['Entity'],
        properties: {
          name: row.name,
          type: row.type,
          summary: row.summary,
          metadata: deserializeMetadata(row.metadata),
          process_id: row.process_id,
          group_id: row.group_id
        }
      }))

      const edges: Neo4jEdge[] = finalRelationResults.map((row: any, index: number) => ({
        id: `edge-${index}`,
        type: row.relation_type || row.type,
        source: row.source,
        target: row.target,
        properties: deserializeMetadata(row.metadata)
      }))

      return { nodes, edges }
    } catch (error: any) {
      console.error('❌ Error getting process graph:', error)
      return { nodes: [], edges: [] }
    }
  }

  /**
   * Get all graph data (for general visualization)
   */
  async getAllGraphData(options: {
    limit?: number
  } = {}): Promise<GraphData> {
    try {
      // Ensure limit is an integer (Neo4j requires integer for LIMIT)
      const limit = toNeo4jInt(options.limit || 200)

      // Get all nodes (Entity, Episodic, TipoRelacion, Document)
      // Use uuid as id since that's what the data uses
      const allNodesQuery = `
        MATCH (n)
        WHERE labels(n) IN [['Entity'], ['Episodic'], ['TipoRelacion'], ['Document']]
        RETURN COALESCE(n.uuid, n.id, n.codigo) as id, labels(n) as labels, 
               COALESCE(n.name, n.nombre_es, n.uuid) as name,
               COALESCE(n.type, head(labels(n))) as type,
               n.summary as summary, n.metadata as metadata,
               n.content as content, n.descripcion as descripcion
        LIMIT $limit
      `

      const nodeResults = await this.executeQuery(allNodesQuery, { limit })

      // Get all relationships
      const allEdgesQuery = `
        MATCH (source)-[r]->(target)
        WHERE type(r) IN ['MENTIONS', 'RELATES_TO']
        RETURN COALESCE(source.uuid, source.id) as source, 
               COALESCE(target.uuid, target.id) as target, 
               type(r) as type, 
               COALESCE(r.type, type(r)) as relation_type, 
               r.metadata as metadata
        LIMIT $limit
      `

      const edgeResults = await this.executeQuery(allEdgesQuery, { limit })

      // Transform to graph format
      const nodes: Neo4jNode[] = nodeResults.map((row: any) => ({
        id: row.id || row.uuid,
        labels: row.labels || ['Node'],
        properties: {
          name: row.name,
          type: row.type,
          summary: row.summary,
          content: row.content,
          descripcion: row.descripcion,
          metadata: deserializeMetadata(row.metadata)
        }
      }))

      const edges: Neo4jEdge[] = edgeResults.map((row: any, index: number) => ({
        id: `edge-${index}`,
        type: row.relation_type || row.type,
        source: row.source,
        target: row.target,
        properties: deserializeMetadata(row.metadata)
      }))

      return { nodes, edges }
    } catch (error: any) {
      console.error('❌ Error getting all graph data:', error)
      return { nodes: [], edges: [] }
    }
  }

  /**
   * Get entities mentioned in a document
   */
  async getDocumentEntities(documentId: string): Promise<Neo4jNode[]> {
    try {
      const query = `
        MATCH (d:Document {id: $documentId})-[:MENTIONS]->(e:Entity)
        RETURN e.id as id, labels(e) as labels, e.name as name, e.type as type, 
               e.summary as summary, e.metadata as metadata
      `

      const results = await this.executeQuery(query, { documentId })

      return results.map((row: any) => ({
        id: row.id,
        labels: row.labels || ['Entity'],
        properties: {
          name: row.name,
          type: row.type,
          summary: row.summary,
          metadata: deserializeMetadata(row.metadata)
        }
      }))
    } catch (error: any) {
      console.error('❌ Error getting document entities:', error)
      return []
    }
  }

  /**
   * Delete all graph data for a process
   */
  async deleteProcessGraph(processId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const query = `
        MATCH (n)
        WHERE n.process_id = $processId
        DETACH DELETE n
      `

      await this.executeQuery(query, { processId })
      return { success: true }
    } catch (error: any) {
      console.error('❌ Error deleting process graph:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete a document and its relationships
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const query = `
        MATCH (d:Document {id: $documentId})
        DETACH DELETE d
      `

      await this.executeQuery(query, { documentId })
      return { success: true }
    } catch (error: any) {
      console.error('❌ Error deleting document:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.driver
  }

  /**
   * Verify connection to Neo4j
   */
  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.driver) {
      return { success: false, error: 'Neo4j driver not initialized' }
    }

    try {
      const session = this.getSession()
      if (!session) {
        return { success: false, error: 'Could not create session' }
      }

      await session.run('RETURN 1 as test')
      await session.close()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Get graph statistics for a process
   */
  async getProcessStats(processId: string): Promise<{
    entityCount: number
    relationCount: number
    documentCount: number
  }> {
    try {
      const query = `
        MATCH (e:Entity)
        WHERE e.process_id = $processId
        WITH count(e) as entityCount
        MATCH ()-[r]->()
        WHERE r.process_id = $processId
        WITH entityCount, count(r) as relationCount
        MATCH (d:Document)
        WHERE d.process_id = $processId
        RETURN entityCount, relationCount, count(d) as documentCount
      `

      const results = await this.executeQuery(query, { processId })
      const row = results[0] || {}

      return {
        entityCount: row.entityCount || 0,
        relationCount: row.relationCount || 0,
        documentCount: row.documentCount || 0
      }
    } catch (error: any) {
      console.error('❌ Error getting process stats:', error)
      return { entityCount: 0, relationCount: 0, documentCount: 0 }
    }
  }

  /**
   * Close the driver connection (for cleanup)
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close()
      this.driver = null
    }
  }
}

// Export singleton instance
export const neo4jGraphService = new Neo4jGraphService()
