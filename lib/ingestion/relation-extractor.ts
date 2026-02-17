/**
 * Relation Extractor with Evidence
 * 
 * This module extracts relations between entities with mandatory evidence:
 * - Uses controlled vocabulary for relation types
 * - Requires evidence mention for every relation
 * - Validates confidence thresholds
 * - Rejects low-confidence or unevidenced relations
 * 
 * GOLDEN RULE: No relation without evidence
 */

import OpenAI from 'openai'
import {
  RelationDTO,
  EntityDTO,
  MentionDTO,
  ChunkDTO,
  RelCode,
  RelationStatus,
  LLRelationResponse,
  CONFIDENCE_THRESHOLDS,
  validateConfidence
} from './types'
import {
  stableRelationId,
  findMentionOffset
} from './stable-id'

/**
 * Prompt for extracting relations from legal documents
 */
const RELATION_EXTRACTION_PROMPT = `Eres un asistente jurídico experto en análisis de documentos legales colombianos.

Analiza las entidades extraídas y el texto del documento para determinar las relaciones semánticas entre ellas.

ENTIDADES IDENTIFICADAS:
{entities_json}

FRAGMENTO DEL DOCUMENTO:
{chunk_content}

Para cada relación que identifiques, usa EXACTAMENTE uno de los siguientes códigos:
- HECHO_AFIRMADO: Un hecho es afirmado por una parte
- OBLIGACION: Una entidad tiene una obligación hacia otra
- DERECHO: Una entidad tiene un derecho sobre otra
- INCUMPLIMIENTO: Se alega incumplimiento de una obligación
- PRETENSION: Una entidad demanda o solicita algo a otra
- EXCEPCION: Una entidad presenta una excepción o defensa
- PRUEBA_SOPORTA: Una prueba soporta un hecho o pretensión
- DOCUMENTO_ACREDITA: Un documento acredita un hecho o derecho
- CITA_NORMA: Se cita una norma legal
- CITA_JURISPRUDENCIA: Se cita jurisprudencia
- RELACION_GENERAL: Relación general no clasificada
- PARTE_DE: Una entidad es parte de otra (ej: empleado de empresa)
- REPRESENTA: Una entidad representa a otra (ej: abogado representa cliente)
- DEMANDA: Una entidad demanda a otra
- DEMANDADO: Una entidad es demandada por otra
- JUEZ: Un juez conoce del proceso
- UBICADO_EN: Una entidad está ubicada en un lugar
- OCURRIO_EN: Un hecho ocurrió en un lugar/fecha
- MONTO_DE: Un monto está asociado a una obligación/hecho

REGLAS CRÍTICAS:
1. SOLO extrae relaciones que estén EXPLÍCITAMENTE mencionadas en el texto
2. La evidencia (evidence_text) debe ser el texto EXACTO del documento que soporta la relación
3. La confianza (confidence) debe ser entre 0.0 y 1.0
4. Si no estás seguro de la relación, NO la incluyas
5. El source_entity y target_entity deben ser nombres canónicos de las entidades listadas arriba

Responde SOLO con un array JSON válido:
{"relaciones": [{
  "source_entity": "nombre canónico de la entidad origen",
  "target_entity": "nombre canónico de la entidad destino",
  "rel_code": "CODIGO_RELACION",
  "confidence": 0.85,
  "evidence_text": "texto exacto del documento que soporta esta relación"
}]}`

/**
 * Result of relation extraction
 */
export interface RelationExtractionResult {
  relations: RelationDTO[]
  totalExtracted: number
  createdCount: number
  rejectedCount: number
  rejectionReasons: Map<string, number>
  error?: string
}

/**
 * Configuration for the relation extractor
 */
export interface RelationExtractorConfig {
  /** Model to use (default: openrouter model) */
  model?: string
  /** Use OpenRouter instead of OpenAI */
  useOpenRouter?: boolean
  /** Max parallel requests */
  maxParallelism?: number
  /** Prompt version */
  promptVersion?: string
}

/**
 * Relation Extractor class with parallel processing
 */
export class RelationExtractor {
  private client: OpenAI | null = null
  private modelName: string = 'openai/gpt-oss-120b'
  private promptVersion: string = 'v1'
  private maxParallelism: number = 5
  private useOpenRouter: boolean = true

  constructor(config: RelationExtractorConfig = {}) {
    this.modelName = config.model || 'openai/gpt-oss-120b'
    this.useOpenRouter = config.useOpenRouter !== false
    this.maxParallelism = config.maxParallelism || 5
    this.promptVersion = config.promptVersion || 'v1'

    // Initialize OpenAI client (works for both OpenAI and OpenRouter)
    const apiKey = this.useOpenRouter 
      ? process.env.OPENROUTER_API_KEY 
      : process.env.OPENAI_API_KEY
    
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: this.useOpenRouter 
          ? 'https://openrouter.ai/api/v1'
          : undefined,
        defaultHeaders: this.useOpenRouter
          ? {
              'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
              'X-Title': 'Asistente Legal Inteligente'
            }
          : undefined
      })
    } else {
      console.warn('WARNING: No API key configured - relation extraction will not work')
    }
  }

  /**
   * Extract relations from a chunk
   */
  async extractRelations(
    chunkContent: string,
    chunk: ChunkDTO,
    entities: EntityDTO[],
    mentions: MentionDTO[],
    mentionToEntityMap: Map<string, string>,
    processId: string,
    workspaceId: string,
    runId: string
  ): Promise<RelationExtractionResult> {
    if (!this.client) {
      return {
        relations: [],
        totalExtracted: 0,
        createdCount: 0,
        rejectedCount: 0,
        rejectionReasons: new Map([['no_client', 1]]),
        error: 'Client not initialized'
      }
    }

    // Filter entities to those mentioned in this chunk
    const chunkEntityIds = new Set(
      mentions
        .filter(m => m.chunkId === chunk.id)
        .map(m => mentionToEntityMap.get(m.id))
        .filter(Boolean)
    )
    
    const relevantEntities = entities.filter(e => chunkEntityIds.has(e.id))

    if (relevantEntities.length < 2) {
      return {
        relations: [],
        totalExtracted: 0,
        createdCount: 0,
        rejectedCount: 0,
        rejectionReasons: new Map([['insufficient_entities', 1]])
      }
    }

    try {
      const entitiesJson = relevantEntities.map(e => ({
        nombre_canonico: e.nombreCanonico,
        tipo: e.tipo,
        aliases: e.aliases
      }))

      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis de documentos legales colombianos. Extrae relaciones de forma precisa. Responde SOLO con JSON válido.'
          },
          {
            role: 'user',
            content: RELATION_EXTRACTION_PROMPT
              .replace('{entities_json}', JSON.stringify(entitiesJson, null, 2))
              .replace('{chunk_content}', chunkContent)
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })

      const content = response.choices[0].message.content
      if (!content) {
        return {
          relations: [],
          totalExtracted: 0,
          createdCount: 0,
          rejectedCount: 0,
          rejectionReasons: new Map([['empty_response', 1]]),
          error: 'Empty response from LLM'
        }
      }

      const parsed = JSON.parse(content) as { relaciones: LLRelationResponse[] }
      const rawRelations = parsed.relaciones || []

      const relations: RelationDTO[] = []
      const rejectionReasons = new Map<string, number>()
      let rejectedCount = 0

      const entityNameToId = new Map<string, string>()
      for (const entity of relevantEntities) {
        entityNameToId.set(entity.nombreCanonico.toLowerCase(), entity.id)
        for (const alias of entity.aliases) {
          entityNameToId.set(alias.toLowerCase(), entity.id)
        }
      }

      const mentionByText = new Map<string, MentionDTO>()
      for (const mention of mentions.filter(m => m.chunkId === chunk.id)) {
        mentionByText.set(mention.textoOriginal.toLowerCase(), mention)
        mentionByText.set(mention.normalizado.toLowerCase(), mention)
      }

      for (const raw of rawRelations) {
        const relCode = this.validateRelCode(raw.rel_code)
        if (!relCode) {
          rejectedCount++
          rejectionReasons.set('invalid_rel_code', (rejectionReasons.get('invalid_rel_code') || 0) + 1)
          continue
        }

        const sourceEntityId = entityNameToId.get(raw.source_entity.toLowerCase())
        if (!sourceEntityId) {
          rejectedCount++
          rejectionReasons.set('source_entity_not_found', (rejectionReasons.get('source_entity_not_found') || 0) + 1)
          continue
        }

        const targetEntityId = entityNameToId.get(raw.target_entity.toLowerCase())
        if (!targetEntityId) {
          rejectedCount++
          rejectionReasons.set('target_entity_not_found', (rejectionReasons.get('target_entity_not_found') || 0) + 1)
          continue
        }

        const confidence = Math.max(0, Math.min(1, raw.confidence || 0))
        const { valid, status } = validateConfidence(confidence)
        if (!valid) {
          rejectedCount++
          rejectionReasons.set('low_confidence', (rejectionReasons.get('low_confidence') || 0) + 1)
          continue
        }

        if (!raw.evidence_text || raw.evidence_text.trim().length === 0) {
          rejectedCount++
          rejectionReasons.set('no_evidence', (rejectionReasons.get('no_evidence') || 0) + 1)
          continue
        }

        const evidenceMention = this.findEvidenceMention(
          raw.evidence_text,
          mentions.filter(m => m.chunkId === chunk.id)
        )

        if (!evidenceMention) {
          rejectedCount++
          rejectionReasons.set('evidence_not_found_in_mentions', (rejectionReasons.get('evidence_not_found_in_mentions') || 0) + 1)
          continue
        }

        const relationId = stableRelationId(sourceEntityId, targetEntityId, relCode)

        relations.push({
          id: relationId,
          sourceEntidadId: sourceEntityId,
          targetEntidadId: targetEntityId,
          relCode,
          confidence,
          status,
          evidenceMentionId: evidenceMention.id,
          evidenceText: raw.evidence_text,
          processId,
          workspaceId,
          runId
        })
      }

      return {
        relations,
        totalExtracted: rawRelations.length,
        createdCount: relations.length,
        rejectedCount,
        rejectionReasons,
        error: undefined
      }
    } catch (error: any) {
      console.error('Error extracting relations:', error)
      return {
        relations: [],
        totalExtracted: 0,
        createdCount: 0,
        rejectedCount: 0,
        rejectionReasons: new Map([['exception', 1]]),
        error: error.message
      }
    }
  }

  /**
   * Extract relations from multiple chunks in PARALLEL
   */
  async extractRelationsBatch(
    chunks: ChunkDTO[],
    entities: EntityDTO[],
    mentions: MentionDTO[],
    mentionToEntityMap: Map<string, string>,
    processId: string,
    workspaceId: string,
    runId: string
  ): Promise<RelationExtractionResult> {
    if (!this.client) {
      return {
        relations: [],
        totalExtracted: 0,
        createdCount: 0,
        rejectedCount: 0,
        rejectionReasons: new Map([['no_client', 1]]),
        error: 'Client not initialized'
      }
    }

    const allRelations: RelationDTO[] = []
    let totalExtracted = 0
    let totalCreated = 0
    let totalRejected = 0
    const combinedRejectionReasons = new Map<string, number>()
    let error: string | undefined

    // Process chunks in parallel batches
    for (let i = 0; i < chunks.length; i += this.maxParallelism) {
      const batch = chunks.slice(i, i + this.maxParallelism)
      
      // Process batch in parallel
      const batchPromises = batch.map(chunk =>
        this.extractRelations(
          chunk.content,
          chunk,
          entities,
          mentions,
          mentionToEntityMap,
          processId,
          workspaceId,
          runId
        )
      )

      const batchResults = await Promise.all(batchPromises)

      for (const result of batchResults) {
        allRelations.push(...result.relations)
        totalExtracted += result.totalExtracted
        totalCreated += result.createdCount
        totalRejected += result.rejectedCount

        for (const [reason, count] of result.rejectionReasons) {
          combinedRejectionReasons.set(
            reason,
            (combinedRejectionReasons.get(reason) || 0) + count
          )
        }

        if (result.error && !error) {
          error = result.error
        }
      }

      console.log(`📊 Processed relations for ${Math.min(i + this.maxParallelism, chunks.length)}/${chunks.length} chunks`)
    }

    // Deduplicate relations
    const uniqueRelations = this.deduplicateRelations(allRelations)

    return {
      relations: uniqueRelations,
      totalExtracted,
      createdCount: uniqueRelations.length,
      rejectedCount: totalRejected,
      rejectionReasons: combinedRejectionReasons,
      error
    }
  }

  /**
   * Validate and normalize relation code
   */
  private validateRelCode(code: string): RelCode | null {
    const normalized = code.toUpperCase().trim()
    
    const codeMap: Record<string, RelCode> = {
      'HECHO_AFIRMADO': RelCode.HECHO_AFIRMADO,
      'OBLIGACION': RelCode.OBLIGACION,
      'OBLIGA': RelCode.OBLIGACION,
      'DERECHO': RelCode.DERECHO,
      'INCUMPLIMIENTO': RelCode.INCUMPLIMIENTO,
      'INCUMPLIMIENTO_CONTRACTUAL': RelCode.INCUMPLIMIENTO,
      'PRETENSION': RelCode.PRETENSION,
      'PRETENCION': RelCode.PRETENSION,
      'EXCEPCION': RelCode.EXCEPCION,
      'PRUEBA_SOPORTA': RelCode.PRUEBA_SOPORTA,
      'SOPORTA': RelCode.PRUEBA_SOPORTA,
      'DOCUMENTO_ACREDITA': RelCode.DOCUMENTO_ACREDITA,
      'ACREDITA': RelCode.DOCUMENTO_ACREDITA,
      'CITA_NORMA': RelCode.CITA_NORMA,
      'CITA': RelCode.CITA_NORMA,
      'CITA_JURISPRUDENCIA': RelCode.CITA_JURISPRUDENCIA,
      'RELACION_GENERAL': RelCode.RELACION_GENERAL,
      'RELACION': RelCode.RELACION_GENERAL,
      'PARTE_DE': RelCode.PARTE_DE,
      'ES_PARTE_DE': RelCode.PARTE_DE,
      'REPRESENTA': RelCode.REPRESENTA,
      'REPRESENTANTE': RelCode.REPRESENTA,
      'DEMANDA': RelCode.DEMANDA,
      'DEMANDANTE': RelCode.DEMANDA,
      'DEMANDADO': RelCode.DEMANDADO,
      'JUEZ': RelCode.JUEZ,
      'CONOCE': RelCode.JUEZ,
      'UBICADO_EN': RelCode.UBICADO_EN,
      'UBICACION': RelCode.UBICADO_EN,
      'OCURRIO_EN': RelCode.OCURRIO_EN,
      'OCURRIO': RelCode.OCURRIO_EN,
      'MONTO_DE': RelCode.MONTO_DE,
      'MONTO': RelCode.MONTO_DE
    }

    return codeMap[normalized] || null
  }

  /**
   * Find the mention that contains the evidence text
   */
  private findEvidenceMention(
    evidenceText: string,
    chunkMentions: MentionDTO[]
  ): MentionDTO | undefined {
    const normalizedEvidence = evidenceText.toLowerCase().trim()

    for (const mention of chunkMentions) {
      if (mention.textoOriginal.toLowerCase() === normalizedEvidence) {
        return mention
      }
      if (mention.normalizado.toLowerCase() === normalizedEvidence) {
        return mention
      }
    }

    for (const mention of chunkMentions) {
      if (normalizedEvidence.includes(mention.textoOriginal.toLowerCase())) {
        return mention
      }
      if (mention.textoOriginal.toLowerCase().includes(normalizedEvidence)) {
        return mention
      }
    }

    return chunkMentions[0]
  }

  /**
   * Deduplicate relations
   */
  private deduplicateRelations(relations: RelationDTO[]): RelationDTO[] {
    const seen = new Map<string, RelationDTO>()

    for (const relation of relations) {
      const key = `${relation.sourceEntidadId}|${relation.targetEntidadId}|${relation.relCode}`
      const existing = seen.get(key)

      if (!existing || relation.confidence > existing.confidence) {
        seen.set(key, relation)
      }
    }

    return Array.from(seen.values())
  }

  /**
   * Get the model name being used
   */
  getModelName(): string {
    return this.modelName
  }

  /**
   * Get the prompt version
   */
  getPromptVersion(): string {
    return this.promptVersion
  }
}

/**
 * Create default relation extractor instance with OpenRouter
 */
export const relationExtractor = new RelationExtractor({
  model: 'openai/gpt-oss-120b',
  useOpenRouter: true,
  maxParallelism: 5
})