/**
 * Entity Linker
 * 
 * This module resolves mentions to canonical entities:
 * - Groups mentions by (type, normalized)
 * - Handles aliases (alternative names for the same entity)
 * - Creates stable entity IDs
 * - Deduplicates entities across mentions
 * 
 * CRITICAL: Without entity linking, each mention creates a new entity,
 * causing massive duplicates in the graph.
 */

import {
  MentionDTO,
  EntityDTO,
  EntityType,
  EntityMetadata
} from './types'
import {
  stableEntityId,
  normalizeEntityName
} from './stable-id'

/**
 * Result of entity linking
 */
export interface EntityLinkingResult {
  entities: EntityDTO[]
  mentionToEntityMap: Map<string, string> // mentionId -> entityId
  aliasMap: Map<string, string[]> // canonical name -> aliases
  stats: {
    totalMentions: number
    uniqueEntities: number
    mentionsLinked: number
    mentionsUnlinked: number
  }
}

/**
 * Entity Linker class
 */
export class EntityLinker {
  /**
   * Link mentions to canonical entities
   * 
   * @param mentions - All mentions from extraction
   * @param processId - Process ID
   * @param workspaceId - Workspace ID
   * @param runId - Extraction run ID
   * @returns Linked entities and mapping
   */
  linkMentions(
    mentions: MentionDTO[],
    processId: string,
    workspaceId: string,
    runId: string
  ): EntityLinkingResult {
    // Step 1: Group mentions by (type, normalized name)
    const mentionGroups = new Map<string, MentionDTO[]>()
    
    for (const mention of mentions) {
      const key = this.createGroupingKey(mention.tipo, mention.normalizado)
      const group = mentionGroups.get(key) || []
      group.push(mention)
      mentionGroups.set(key, group)
    }

    // Step 2: Create canonical entities from groups
    const entities: EntityDTO[] = []
    const mentionToEntityMap = new Map<string, string>()
    const aliasMap = new Map<string, string[]>()

    for (const [key, groupMentions] of mentionGroups) {
      // Get the canonical name (most common normalized form)
      const canonicalName = this.selectCanonicalName(groupMentions)
      
      // Collect all aliases from the group
      const aliases = this.collectAliases(groupMentions, canonicalName)
      
      // Create stable entity ID
      const entityId = stableEntityId(
        workspaceId,
        processId,
        groupMentions[0].tipo,
        canonicalName
      )

      // Get first occurrence metadata
      const firstMention = groupMentions[0]

      // Create entity
      const entity: EntityDTO = {
        id: entityId,
        nombreCanonico: canonicalName,
        tipo: groupMentions[0].tipo,
        processId,
        workspaceId,
        mentionIds: groupMentions.map(m => m.id),
        aliases,
        summary: this.generateEntitySummary(canonicalName, groupMentions[0].tipo, groupMentions.length),
        metadata: {
          firstSeenDocumentId: firstMention.documentId,
          firstSeenChunkId: firstMention.chunkId,
          mentionCount: groupMentions.length
        } as EntityMetadata,
        runId
      }

      entities.push(entity)
      aliasMap.set(canonicalName, aliases)

      // Map all mentions to this entity
      for (const mention of groupMentions) {
        mentionToEntityMap.set(mention.id, entityId)
      }
    }

    // Step 3: Try to link similar entities (cross-type linking)
    this.linkSimilarEntities(entities, mentionToEntityMap, mentions)

    return {
      entities,
      mentionToEntityMap,
      aliasMap,
      stats: {
        totalMentions: mentions.length,
        uniqueEntities: entities.length,
        mentionsLinked: mentionToEntityMap.size,
        mentionsUnlinked: mentions.length - mentionToEntityMap.size
      }
    }
  }

  /**
   * Create a grouping key for mentions
   */
  private createGroupingKey(tipo: EntityType, normalizado: string): string {
    const normalized = normalizeEntityName(normalizado)
    return `${tipo}|${normalized}`
  }

  /**
   * Select the canonical name from a group of mentions
   */
  private selectCanonicalName(mentions: MentionDTO[]): string {
    // Count occurrences of each normalized form
    const counts = new Map<string, number>()
    
    for (const mention of mentions) {
      const normalized = normalizeEntityName(mention.normalizado)
      counts.set(normalized, (counts.get(normalized) || 0) + 1)
    }

    // Return the most common form
    let maxCount = 0
    let canonicalName = mentions[0].normalizado

    for (const [name, count] of counts) {
      if (count > maxCount) {
        maxCount = count
        canonicalName = name
      }
    }

    // Capitalize properly for display
    return this.properlyCapitalize(canonicalName)
  }

  /**
   * Collect aliases from mentions (excluding the canonical name)
   */
  private collectAliases(mentions: MentionDTO[], canonicalName: string): string[] {
    const aliases = new Set<string>()
    const canonicalLower = normalizeEntityName(canonicalName)

    for (const mention of mentions) {
      const normalized = normalizeEntityName(mention.normalizado)
      if (normalized !== canonicalLower) {
        aliases.add(mention.normalizado)
      }
      // Also add original text forms as aliases if different
      if (normalizeEntityName(mention.textoOriginal) !== canonicalLower) {
        aliases.add(mention.textoOriginal)
      }
    }

    return Array.from(aliases)
  }

  /**
   * Properly capitalize a name for display
   */
  private properlyCapitalize(name: string): string {
    // Don't capitalize all-caps acronyms
    if (name === name.toUpperCase() && name.length <= 10) {
      return name
    }

    // Capitalize first letter of each word
    return name
      .toLowerCase()
      .split(' ')
      .map(word => {
        // Don't capitalize articles and prepositions
        const lowerWords = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'por', 'para', 'con']
        if (lowerWords.includes(word)) {
          return word
        }
        return word.charAt(0).toUpperCase() + word.slice(1)
      })
      .join(' ')
  }

  /**
   * Generate a brief summary for an entity
   */
  private generateEntitySummary(name: string, tipo: EntityType, mentionCount: number): string {
    const tipoLabels: Record<EntityType, string> = {
      [EntityType.PERSONA_NATURAL]: 'Persona natural',
      [EntityType.PERSONA_JURIDICA]: 'Persona jurídica',
      [EntityType.ENTIDAD_PUBLICA]: 'Entidad pública',
      [EntityType.DESPACHO_JUDICIAL]: 'Despacho judicial',
      [EntityType.NORMA]: 'Norma legal',
      [EntityType.CONCEPTO_JURIDICO]: 'Concepto jurídico',
      [EntityType.HECHO]: 'Hecho',
      [EntityType.PRETENSION]: 'Pretensión',
      [EntityType.PRUEBA]: 'Prueba',
      [EntityType.DOCUMENTO]: 'Documento',
      [EntityType.FECHA]: 'Fecha',
      [EntityType.DINERO]: 'Monto',
      [EntityType.UBICACION]: 'Ubicación',
      [EntityType.OTRO]: 'Entidad'
    }

    return `${tipoLabels[tipo] || 'Entidad'} mencionada ${mentionCount} vez${mentionCount !== 1 ? 'es' : ''} en el documento`
  }

  /**
   * Link similar entities across types
   * 
   * This handles cases like:
   * - "Banco de Bogotá" (PERSONA_JURIDICA) and "BANCO DE BOGOTÁ" (ENTIDAD_PUBLICA)
   */
  private linkSimilarEntities(
    entities: EntityDTO[],
    mentionToEntityMap: Map<string, string>,
    mentions: MentionDTO[]
  ): void {
    // Build a name -> entity map for quick lookup
    const nameToEntity = new Map<string, EntityDTO>()
    
    for (const entity of entities) {
      // Add canonical name
      nameToEntity.set(normalizeEntityName(entity.nombreCanonico), entity)
      // Add aliases
      for (const alias of entity.aliases) {
        nameToEntity.set(normalizeEntityName(alias), entity)
      }
    }

    // Check for potential merges
    const toMerge: Array<{ source: EntityDTO; target: EntityDTO }> = []
    
    for (const entity of entities) {
      const normalizedName = normalizeEntityName(entity.nombreCanonico)
      const existing = nameToEntity.get(normalizedName)
      
      if (existing && existing.id !== entity.id) {
        // Same name, different entity - potential merge
        // Prefer entities with more mentions
        if (entity.mentionIds.length > existing.mentionIds.length) {
          toMerge.push({ source: existing, target: entity })
        } else {
          toMerge.push({ source: entity, target: existing })
        }
      }
    }

    // Perform merges
    for (const { source, target } of toMerge) {
      // Move all mentions from source to target
      for (const mentionId of source.mentionIds) {
        mentionToEntityMap.set(mentionId, target.id)
      }
      
      // Merge aliases
      target.aliases.push(...source.aliases)
      target.aliases = [...new Set(target.aliases)] // Dedupe
      
      // Merge mention IDs
      target.mentionIds.push(...source.mentionIds)
      
      // Update metadata
      target.metadata.mentionCount = target.mentionIds.length
      
      // Mark source for removal (we'll filter it out)
      const sourceIndex = entities.indexOf(source)
      if (sourceIndex !== -1) {
        entities.splice(sourceIndex, 1)
      }
    }
  }

  /**
   * Find entities by name (fuzzy matching)
   */
  findEntityByName(
    entities: EntityDTO[],
    name: string,
    tipo?: EntityType
  ): EntityDTO | undefined {
    const normalizedSearch = normalizeEntityName(name)
    
    for (const entity of entities) {
      // Check canonical name
      if (normalizeEntityName(entity.nombreCanonico) === normalizedSearch) {
        if (!tipo || entity.tipo === tipo) {
          return entity
        }
      }
      
      // Check aliases
      for (const alias of entity.aliases) {
        if (normalizeEntityName(alias) === normalizedSearch) {
          if (!tipo || entity.tipo === tipo) {
            return entity
          }
        }
      }
    }
    
    return undefined
  }

  /**
   * Get all unique entity names for a process
   */
  getUniqueEntityNames(entities: EntityDTO[]): string[] {
    const names = new Set<string>()
    
    for (const entity of entities) {
      names.add(entity.nombreCanonico)
      for (const alias of entity.aliases) {
        names.add(alias)
      }
    }
    
    return Array.from(names)
  }
}

/**
 * Create default entity linker instance
 */
export const entityLinker = new EntityLinker()

/**
 * Convenience function to link mentions
 */
export function linkMentions(
  mentions: MentionDTO[],
  processId: string,
  workspaceId: string,
  runId: string
): EntityLinkingResult {
  return entityLinker.linkMentions(mentions, processId, workspaceId, runId)
}
