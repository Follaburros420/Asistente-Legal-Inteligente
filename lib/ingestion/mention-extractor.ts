/**
 * Mention Extractor with Offsets
 * 
 * This module extracts mentions from text chunks using an LLM,
 * with proper character offset tracking for verification and highlighting.
 * 
 * CRITICAL: Every mention must have verified offsets that match the actual text.
 */

import OpenAI from 'openai'
import {
  MentionDTO,
  EntityType,
  LLMentionResponse,
  CONFIDENCE_THRESHOLDS
} from './types'
import {
  stableMentionId,
  findMentionOffset,
  verifyMentionOffset
} from './stable-id'

/**
 * Prompt for extracting mentions from legal documents
 */
const MENTION_EXTRACTION_PROMPT = `Eres un asistente jurídico experto en análisis de documentos legales colombianos.

Analiza el siguiente fragmento de un documento legal y extrae TODAS las menciones relevantes.

Para cada mención, identifica:
1. texto_original: el texto exacto tal como aparece en el documento (incluyendo mayúsculas, tildes, puntuación)
2. tipo: uno de los siguientes tipos:
   - PERSONA_NATURAL: personas naturales (ej: "Juan Pérez", "María García")
   - PERSONA_JURIDICA: empresas, organizaciones (ej: "Banco de Bogotá", "EPS Sanitas")
   - ENTIDAD_PUBLICA: entidades gubernamentales (ej: "Ministerio de Hacienda", "DIAN")
   - DESPACHO_JUDICIAL: juzgados, tribunales (ej: "Juzgado Primero Civil del Circuito")
   - NORMA: leyes, decretos, resoluciones (ej: "Ley 100 de 1993", "Decreto 2150 de 1995")
   - CONCEPTO_JURIDICO: conceptos legales (ej: "prescripción", "caducidad", "responsabilidad civil")
   - HECHO: hechos relevantes del caso (ej: "accidente de tránsito", "incumplimiento contractual")
   - PRETENSION: pretensiones o solicitudes (ej: "indemnización de perjuicios", "pago de honorarios")
   - PRUEBA: elementos probatorios (ej: "contrato de arrendamiento", "historia clínica")
   - DOCUMENTO: documentos mencionados (ej: "demanda", "contestación", "poder")
   - FECHA: fechas mencionadas (ej: "15 de marzo de 2023")
   - DINERO: cantidades de dinero (ej: "$5.000.000", "cinco millones de pesos")
   - UBICACION: lugares (ej: "Bogotá D.C.", "Centro Comercial Gran Estación")
   - OTRO: cualquier otra entidad relevante

3. normalizado: forma canónica/estandarizada del nombre (sin títulos, en formato uniforme)

REGLAS IMPORTANTES:
- Extrae TODAS las menciones, incluso si parecen repetidas
- El texto_original debe ser EXACTAMENTE como aparece en el documento
- El texto normalizado debe ser consistente para la misma entidad
- No inventes menciones que no estén en el texto
- Para fechas, normaliza al formato ISO (YYYY-MM-DD) cuando sea posible
- Para dinero, normaliza al formato numérico (ej: "5000000 COP")

Responde SOLO con un array JSON válido, sin explicaciones adicionales:
{"menciones": [{"texto_original": "...", "tipo": "...", "normalizado": "..."}]}

FRAGMENTO DEL DOCUMENTO:
{chunk_content}`

/**
 * Result of mention extraction
 */
export interface MentionExtractionResult {
  mentions: MentionDTO[]
  totalExtracted: number
  verifiedCount: number
  unverifiedCount: number
  error?: string
}

/**
 * Configuration for the mention extractor
 */
export interface MentionExtractorConfig {
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
 * Mention Extractor class with parallel processing
 */
export class MentionExtractor {
  private client: OpenAI | null = null
  private modelName: string = 'openai/gpt-oss-120b'
  private promptVersion: string = 'v1'
  private maxParallelism: number = 5
  private useOpenRouter: boolean = true

  constructor(config: MentionExtractorConfig = {}) {
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
      console.warn('⚠️ No API key configured - mention extraction will not work')
    }
  }

  /**
   * Extract mentions from a chunk
   */
  async extractMentions(
    chunkContent: string,
    chunkId: string,
    documentId: string,
    processId: string,
    workspaceId: string,
    runId: string
  ): Promise<MentionExtractionResult> {
    if (!this.client) {
      return {
        mentions: [],
        totalExtracted: 0,
        verifiedCount: 0,
        unverifiedCount: 0,
        error: 'Client not initialized'
      }
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis de documentos legales colombianos. Extrae menciones de forma precisa y concisa. Responde SOLO con JSON válido.'
          },
          {
            role: 'user',
            content: MENTION_EXTRACTION_PROMPT.replace('{chunk_content}', chunkContent)
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })

      const content = response.choices[0].message.content
      if (!content) {
        return {
          mentions: [],
          totalExtracted: 0,
          verifiedCount: 0,
          unverifiedCount: 0,
          error: 'Empty response from LLM'
        }
      }

      // Parse the response
      const parsed = JSON.parse(content) as { menciones: LLMentionResponse[] }
      const rawMentions = parsed.menciones || []

      // Convert to MentionDTO with offset verification
      const mentions: MentionDTO[] = []
      let verifiedCount = 0
      let unverifiedCount = 0

      for (const raw of rawMentions) {
        const tipo = this.validateEntityType(raw.tipo)
        if (!tipo) continue

        const offset = findMentionOffset(chunkContent, raw.texto_original)
        
        if (!offset) {
          unverifiedCount++
          continue
        }

        const verified = verifyMentionOffset(
          chunkContent,
          offset.start,
          offset.end,
          raw.texto_original
        )

        if (!verified) {
          unverifiedCount++
          continue
        }

        verifiedCount++

        const mentionId = stableMentionId(
          workspaceId,
          processId,
          chunkId,
          offset.start,
          raw.normalizado
        )

        mentions.push({
          id: mentionId,
          textoOriginal: raw.texto_original,
          normalizado: raw.normalizado,
          tipo,
          spanStart: offset.start,
          spanEnd: offset.end,
          chunkId,
          documentId,
          processId,
          workspaceId,
          runId,
          confidence: 0.9
        })
      }

      return {
        mentions,
        totalExtracted: rawMentions.length,
        verifiedCount,
        unverifiedCount
      }
    } catch (error: any) {
      console.error('❌ Error extracting mentions:', error)
      return {
        mentions: [],
        totalExtracted: 0,
        verifiedCount: 0,
        unverifiedCount: 0,
        error: error.message
      }
    }
  }

  /**
   * Extract mentions from multiple chunks in PARALLEL
   */
  async extractMentionsBatch(
    chunks: Array<{
      content: string
      id: string
      documentId: string
      processId: string
      workspaceId: string
    }>,
    runId: string
  ): Promise<MentionExtractionResult> {
    if (!this.client) {
      return {
        mentions: [],
        totalExtracted: 0,
        verifiedCount: 0,
        unverifiedCount: 0,
        error: 'Client not initialized'
      }
    }

    const allMentions: MentionDTO[] = []
    let totalExtracted = 0
    let totalVerified = 0
    let totalUnverified = 0
    let error: string | undefined

    // Process chunks in parallel batches
    for (let i = 0; i < chunks.length; i += this.maxParallelism) {
      const batch = chunks.slice(i, i + this.maxParallelism)
      
      // Process batch in parallel
      const batchPromises = batch.map(chunk =>
        this.extractMentions(
          chunk.content,
          chunk.id,
          chunk.documentId,
          chunk.processId,
          chunk.workspaceId,
          runId
        )
      )

      const batchResults = await Promise.all(batchPromises)

      for (const result of batchResults) {
        allMentions.push(...result.mentions)
        totalExtracted += result.totalExtracted
        totalVerified += result.verifiedCount
        totalUnverified += result.unverifiedCount

        if (result.error && !error) {
          error = result.error
        }
      }

      console.log(`📊 Processed ${Math.min(i + this.maxParallelism, chunks.length)}/${chunks.length} chunks`)
    }

    return {
      mentions: allMentions,
      totalExtracted,
      verifiedCount: totalVerified,
      unverifiedCount: totalUnverified,
      error
    }
  }

  /**
   * Validate and normalize entity type
   */
  private validateEntityType(tipo: string): EntityType | null {
    const normalized = tipo.toUpperCase().trim()
    
    const typeMap: Record<string, EntityType> = {
      'PERSONA_NATURAL': EntityType.PERSONA_NATURAL,
      'PERSONA': EntityType.PERSONA_NATURAL,
      'PERSONAS': EntityType.PERSONA_NATURAL,
      'PERSONA_JURIDICA': EntityType.PERSONA_JURIDICA,
      'EMPRESA': EntityType.PERSONA_JURIDICA,
      'ORGANIZACION': EntityType.PERSONA_JURIDICA,
      'ENTIDAD_PUBLICA': EntityType.ENTIDAD_PUBLICA,
      'ENTIDAD': EntityType.ENTIDAD_PUBLICA,
      'ENTIDAD PUBLICA': EntityType.ENTIDAD_PUBLICA,
      'DESPACHO_JUDICIAL': EntityType.DESPACHO_JUDICIAL,
      'JUZGADO': EntityType.DESPACHO_JUDICIAL,
      'TRIBUNAL': EntityType.DESPACHO_JUDICIAL,
      'NORMA': EntityType.NORMA,
      'LEY': EntityType.NORMA,
      'DECRETO': EntityType.NORMA,
      'CONCEPTO_JURIDICO': EntityType.CONCEPTO_JURIDICO,
      'CONCEPTO': EntityType.CONCEPTO_JURIDICO,
      'HECHO': EntityType.HECHO,
      'HECHOS': EntityType.HECHO,
      'PRETENSION': EntityType.PRETENSION,
      'PRETENCION': EntityType.PRETENSION,
      'PRUEBA': EntityType.PRUEBA,
      'PRUEBAS': EntityType.PRUEBA,
      'DOCUMENTO': EntityType.DOCUMENTO,
      'DOCUMENTOS': EntityType.DOCUMENTO,
      'FECHA': EntityType.FECHA,
      'DINERO': EntityType.DINERO,
      'DINERO_CANTIDAD': EntityType.DINERO,
      'MONTO': EntityType.DINERO,
      'UBICACION': EntityType.UBICACION,
      'LUGAR': EntityType.UBICACION,
      'OTRO': EntityType.OTRO,
      'OTROS': EntityType.OTRO
    }

    return typeMap[normalized] || null
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
 * Create default mention extractor instance with OpenRouter
 */
export const mentionExtractor = new MentionExtractor({
  model: 'openai/gpt-oss-120b',
  useOpenRouter: true,
  maxParallelism: 5
})
