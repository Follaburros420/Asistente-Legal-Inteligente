/**
 * High-Quality Ingestion Pipeline Types
 * 
 * This module defines all types for the ingestion pipeline following
 * the high-quality pipeline architecture:
 * - Stable IDs for idempotency
 * - Mention → Entity → Relation extraction flow
 * - Evidence-based relations
 * - Run tracking for auditing
 */

// ============================================
// CONTROLLED VOCABULARIES
// ============================================

/**
 * Entity types - controlled vocabulary for consistent extraction
 */
export enum EntityType {
  PERSONA_NATURAL = 'PERSONA_NATURAL',
  PERSONA_JURIDICA = 'PERSONA_JURIDICA',
  ENTIDAD_PUBLICA = 'ENTIDAD_PUBLICA',
  DESPACHO_JUDICIAL = 'DESPACHO_JUDICIAL',
  NORMA = 'NORMA',
  CONCEPTO_JURIDICO = 'CONCEPTO_JURIDICO',
  HECHO = 'HECHO',
  PRETENSION = 'PRETENSION',
  PRUEBA = 'PRUEBA',
  DOCUMENTO = 'DOCUMENTO',
  FECHA = 'FECHA',
  DINERO = 'DINERO',
  UBICACION = 'UBICACION',
  OTRO = 'OTRO'
}

/**
 * Relation types - controlled vocabulary for consistent graph structure
 */
export enum RelCode {
  HECHO_AFIRMADO = 'HECHO_AFIRMADO',
  OBLIGACION = 'OBLIGACION',
  DERECHO = 'DERECHO',
  INCUMPLIMIENTO = 'INCUMPLIMIENTO',
  PRETENSION = 'PRETENSION',
  EXCEPCION = 'EXCEPCION',
  PRUEBA_SOPORTA = 'PRUEBA_SOPORTA',
  DOCUMENTO_ACREDITA = 'DOCUMENTO_ACREDITA',
  CITA_NORMA = 'CITA_NORMA',
  CITA_JURISPRUDENCIA = 'CITA_JURISPRUDENCIA',
  RELACION_GENERAL = 'RELACION_GENERAL',
  PARTE_DE = 'PARTE_DE',
  REPRESENTA = 'REPRESENTA',
  DEMANDA = 'DEMANDA',
  DEMANDADO = 'DEMANDADO',
  JUEZ = 'JUEZ',
  UBICADO_EN = 'UBICADO_EN',
  OCURRIO_EN = 'OCURRIO_EN',
  MONTO_DE = 'MONTO_DE'
}

/**
 * Relation status based on confidence
 */
export enum RelationStatus {
  CONFIRMED = 'confirmed',
  TENTATIVE = 'tentative'
}

/**
 * Run status for tracking
 */
export enum RunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// ============================================
// CHUNKING CONFIGURATION
// ============================================

/**
 * Configuration for semantic chunking
 */
export interface ChunkingConfig {
  /** Target chunk size in characters */
  chunkSize: number
  /** Overlap between chunks in characters */
  chunkOverlap: number
  /** Maximum chunk size before forced split */
  maxChunkSize: number
  /** Minimum chunk size before merging */
  minChunkSize: number
  /** Use semantic splitting (respect document structure) */
  useSemanticSplitting: boolean
  /** Preserve document structure metadata */
  preserveStructure: boolean
}

/**
 * Default chunking configuration for legal documents
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  maxChunkSize: 2000,
  minChunkSize: 100,
  useSemanticSplitting: true,
  preserveStructure: true
}

// ============================================
// CHUNK DTOs
// ============================================

/**
 * Represents a document chunk with metadata
 */
export interface ChunkDTO {
  /** Stable ID derived from workspace, process, document, and chunk index */
  id: string
  /** Document ID this chunk belongs to */
  documentId: string
  /** Process ID this chunk belongs to */
  processId: string
  /** Workspace ID for multi-tenancy */
  workspaceId: string
  /** Chunk content */
  content: string
  /** Index of this chunk in the document */
  chunkIndex: number
  /** Character offset in the original document */
  charOffset: number
  /** Token count for this chunk */
  tokenCount: number
  /** Embedding vector */
  embedding?: number[]
  /** Metadata about the chunk (section, page, etc.) */
  metadata: ChunkMetadata
  /** Content hash for deduplication */
  contentHash: string
}

/**
 * Metadata for a chunk
 */
export interface ChunkMetadata {
  /** Source file name */
  fileName?: string
  /** MIME type of source document */
  mimeType?: string
  /** Section header if available */
  sectionHeader?: string
  /** Page number if available */
  pageNumber?: number
  /** Type of content (paragraph, list, header, table, etc.) */
  contentType?: 'paragraph' | 'list' | 'header' | 'table' | 'code' | 'quote' | 'other'
  /** Original document structure path */
  structurePath?: string[]
}

// ============================================
// MENTION DTOs
// ============================================

/**
 * Represents a mention of an entity in text
 * 
 * CRITICAL: Mentions have offsets that allow verification
 * and highlighting in the original document
 */
export interface MentionDTO {
  /** Stable ID derived from workspace, process, chunk, offset, and normalized text */
  id: string
  /** The exact text as it appears in the document */
  textoOriginal: string
  /** Canonical/normalized form of the entity */
  normalizado: string
  /** Type of entity */
  tipo: EntityType
  /** Character offset where the mention starts in the chunk */
  spanStart: number
  /** Character offset where the mention ends in the chunk */
  spanEnd: number
  /** ID of the chunk containing this mention */
  chunkId: string
  /** ID of the document containing this mention */
  documentId: string
  /** Process ID for multi-tenancy */
  processId: string
  /** Workspace ID for multi-tenancy */
  workspaceId: string
  /** ID of the extraction run */
  runId: string
  /** Confidence of the extraction (0.0 - 1.0) */
  confidence: number
}

// ============================================
// ENTITY DTOs
// ============================================

/**
 * Represents a canonical entity (resolved from mentions)
 */
export interface EntityDTO {
  /** Stable ID derived from workspace, process, type, and canonical name */
  id: string
  /** Canonical name of the entity */
  nombreCanonico: string
  /** Type of entity */
  tipo: EntityType
  /** Process ID for multi-tenancy */
  processId: string
  /** Workspace ID for multi-tenancy */
  workspaceId: string
  /** IDs of mentions that refer to this entity */
  mentionIds: string[]
  /** Alternative names/aliases for this entity */
  aliases: string[]
  /** Brief summary of the entity's relevance */
  summary?: string
  /** Additional metadata */
  metadata: EntityMetadata
  /** ID of the extraction run */
  runId: string
}

/**
 * Metadata for an entity
 */
export interface EntityMetadata {
  /** First occurrence document */
  firstSeenDocumentId?: string
  /** First occurrence chunk */
  firstSeenChunkId?: string
  /** Total mention count */
  mentionCount: number
  /** Custom properties */
  custom?: Record<string, any>
}

// ============================================
// RELATION DTOs
// ============================================

/**
 * Represents a relationship between two entities
 * 
 * GOLDEN RULE: No relation without evidence
 */
export interface RelationDTO {
  /** Stable ID derived from source, target, and relation type */
  id: string
  /** Source entity ID */
  sourceEntidadId: string
  /** Target entity ID */
  targetEntidadId: string
  /** Relation type from controlled vocabulary */
  relCode: RelCode
  /** Confidence score (0.0 - 1.0) */
  confidence: number
  /** Status based on confidence threshold */
  status: RelationStatus
  /** ID of the mention that provides evidence for this relation */
  evidenceMentionId: string
  /** The actual evidence text */
  evidenceText: string
  /** Process ID for multi-tenancy */
  processId: string
  /** Workspace ID for multi-tenancy */
  workspaceId: string
  /** ID of the extraction run */
  runId: string
}

// ============================================
// RUN TRACKING DTOs
// ============================================

/**
 * Represents an extraction run for auditing
 */
export interface RunExtraccionDTO {
  /** Unique ID for this run */
  id: string
  /** Workspace ID */
  workspaceId: string
  /** Process ID */
  processId: string
  /** Document ID (if single document) */
  documentId?: string
  /** LLM model used */
  modelName: string
  /** Prompt version used */
  promptVersion: string
  /** When the run started */
  startedAt: Date
  /** When the run finished */
  finishedAt?: Date
  /** Status of the run */
  status: RunStatus
  /** Number of mentions created */
  mentionsCreated: number
  /** Number of entities created */
  entitiesCreated: number
  /** Number of relations created */
  relationsCreated: number
  /** Number of relations rejected (low confidence, no evidence) */
  relationsRejected: number
  /** Error message if failed */
  errorMessage?: string
  /** Additional metadata */
  metadata: RunMetadata
}

/**
 * Metadata for an extraction run
 */
export interface RunMetadata {
  /** Chunking configuration used */
  chunkingConfig?: ChunkingConfig
  /** Number of chunks processed */
  chunksProcessed?: number
  /** Total tokens used */
  tokensUsed?: number
  /** Processing time in milliseconds */
  processingTimeMs?: number
  /** Custom properties */
  custom?: Record<string, any>
}

// ============================================
// DOCUMENT DTOs
// ============================================

/**
 * Represents a document to be ingested
 */
export interface DocumentDTO {
  /** Stable ID derived from workspace, process, source, and content hash */
  id: string
  /** Document title */
  title: string
  /** Source path or URL */
  source: string
  /** Document content (markdown) */
  content: string
  /** Content hash for deduplication */
  contentHash: string
  /** Process ID */
  processId: string
  /** Workspace ID */
  workspaceId: string
  /** User ID who uploaded */
  userId: string
  /** Document metadata */
  metadata: DocumentMetadata
}

/**
 * Metadata for a document
 */
export interface DocumentMetadata {
  /** Original file name */
  fileName: string
  /** MIME type */
  mimeType: string
  /** File size in bytes */
  sizeBytes?: number
  /** Number of pages (if applicable) */
  pageCount?: number
  /** Document language */
  language?: string
  /** Custom properties */
  custom?: Record<string, any>
}

// ============================================
// PIPELINE RESULT DTOs
// ============================================

/**
 * Result of the ingestion pipeline
 */
export interface IngestionResultDTO {
  /** Whether the ingestion was successful */
  success: boolean
  /** Document ID */
  documentId: string
  /** Number of chunks created */
  chunksCreated: number
  /** Number of mentions extracted */
  mentionsExtracted: number
  /** Number of entities created */
  entitiesCreated: number
  /** Number of relations created */
  relationsCreated: number
  /** Number of relations rejected */
  relationsRejected: number
  /** Run ID for auditing */
  runId: string
  /** Error message if failed */
  error?: string
}

// ============================================
// VALIDATION THRESHOLDS
// ============================================

/**
 * Confidence thresholds for validation
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence to accept a relation */
  MINIMUM: 0.55,
  /** Confidence for "tentative" status */
  TENTATIVE: 0.55,
  /** Confidence for "confirmed" status */
  CONFIRMED: 0.70
} as const

/**
 * Validate a confidence score
 */
export function validateConfidence(confidence: number): { valid: boolean; status: RelationStatus } {
  if (confidence < CONFIDENCE_THRESHOLDS.MINIMUM) {
    return { valid: false, status: RelationStatus.TENTATIVE }
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.CONFIRMED) {
    return { valid: true, status: RelationStatus.CONFIRMED }
  }
  return { valid: true, status: RelationStatus.TENTATIVE }
}

// ============================================
// LLM RESPONSE TYPES
// ============================================

/**
 * Raw mention extracted by LLM
 */
export interface LLMentionResponse {
  texto_original: string
  tipo: string
  normalizado: string
}

/**
 * Raw relation extracted by LLM
 */
export interface LLRelationResponse {
  source_entity: string
  target_entity: string
  rel_code: string
  confidence: number
  evidence_text: string
}
