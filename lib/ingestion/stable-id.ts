/**
 * Stable ID Generation Utilities
 * 
 * CRITICAL: These functions generate deterministic IDs from input parts.
 * This ensures idempotency - re-running the pipeline doesn't create duplicates.
 * 
 * The same input always produces the same output ID.
 */

import * as crypto from 'crypto'

/**
 * Generate a deterministic 32-char hex ID from ordered parts.
 * 
 * @param parts - String parts to combine for the ID
 * @returns 32-character hex string
 * 
 * @example
 * const docId = stableId(workspaceId, procesoId, source, docHash)
 * // Returns something like "a1b2c3d4e5f6..."
 */
export function stableId(...parts: string[]): string {
  const raw = parts.join('|')
  return crypto.createHash('sha256').update(raw, 'utf-8').digest('hex').slice(0, 32)
}

/**
 * Generate a content hash for deduplication.
 * 
 * @param text - Content to hash
 * @returns 16-character hex string
 * 
 * @example
 * const hash = contentHash(documentContent)
 * // Returns something like "a1b2c3d4e5f67890"
 */
export function contentHash(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex').slice(0, 16)
}

/**
 * Generate a stable document ID
 * 
 * @param workspaceId - Workspace ID
 * @param processId - Process ID
 * @param source - Document source/path
 * @param docHash - Content hash
 * @returns Stable 32-char ID
 */
export function stableDocumentId(
  workspaceId: string,
  processId: string,
  source: string,
  docHash: string
): string {
  return stableId(workspaceId, processId, source, docHash)
}

/**
 * Generate a stable chunk ID
 * 
 * @param workspaceId - Workspace ID
 * @param processId - Process ID
 * @param documentId - Document ID
 * @param chunkIndex - Index of the chunk
 * @returns Stable 32-char ID
 */
export function stableChunkId(
  workspaceId: string,
  processId: string,
  documentId: string,
  chunkIndex: number
): string {
  return stableId(workspaceId, processId, documentId, String(chunkIndex))
}

/**
 * Generate a stable mention ID
 * 
 * @param workspaceId - Workspace ID
 * @param processId - Process ID
 * @param chunkId - Chunk ID
 * @param spanStart - Character offset start
 * @param normalizado - Normalized entity text
 * @returns Stable 32-char ID
 */
export function stableMentionId(
  workspaceId: string,
  processId: string,
  chunkId: string,
  spanStart: number,
  normalizado: string
): string {
  return stableId(workspaceId, processId, chunkId, String(spanStart), normalizado)
}

/**
 * Generate a stable entity ID
 * 
 * @param workspaceId - Workspace ID
 * @param processId - Process ID
 * @param tipo - Entity type
 * @param nombreCanonico - Canonical entity name
 * @returns Stable 32-char ID
 */
export function stableEntityId(
  workspaceId: string,
  processId: string,
  tipo: string,
  nombreCanonico: string
): string {
  // Normalize the name for consistent IDs
  const normalizedName = normalizeEntityName(nombreCanonico)
  return stableId(workspaceId, processId, tipo, normalizedName)
}

/**
 * Generate a stable relation ID
 * 
 * @param sourceEntityId - Source entity ID
 * @param targetEntityId - Target entity ID
 * @param relCode - Relation type code
 * @returns Stable 32-char ID
 */
export function stableRelationId(
  sourceEntityId: string,
  targetEntityId: string,
  relCode: string
): string {
  return stableId(sourceEntityId, targetEntityId, relCode)
}

/**
 * Generate a stable run ID
 * 
 * @param workspaceId - Workspace ID
 * @param processId - Process ID
 * @param timestamp - ISO timestamp
 * @returns Stable 32-char ID
 */
export function stableRunId(
  workspaceId: string,
  processId: string,
  timestamp: string
): string {
  return stableId(workspaceId, processId, 'run', timestamp)
}

/**
 * Normalize an entity name for consistent ID generation
 * 
 * @param name - Entity name
 * @returns Normalized name (lowercase, trimmed, no extra spaces)
 */
export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
}

/**
 * Verify that a mention's text matches the expected text at the given offset
 * 
 * @param content - Full chunk content
 * @param start - Start offset
 * @param end - End offset
 * @param expectedText - Expected text at that position
 * @returns True if the text matches
 */
export function verifyMentionOffset(
  content: string,
  start: number,
  end: number,
  expectedText: string
): boolean {
  if (start < 0 || end > content.length || start >= end) {
    return false
  }
  
  const actualText = content.slice(start, end)
  return actualText === expectedText
}

/**
 * Find the actual offset of a mention in text (for verification/correction)
 * 
 * @param content - Full chunk content
 * @param mentionText - Text to find
 * @param approximateStart - Approximate start position (for disambiguation)
 * @returns Actual start and end offsets, or null if not found
 */
export function findMentionOffset(
  content: string,
  mentionText: string,
  approximateStart: number = 0
): { start: number; end: number } | null {
  // Try exact match first, starting near the approximate position
  const searchStart = Math.max(0, approximateStart - 50)
  const index = content.indexOf(mentionText, searchStart)
  
  if (index !== -1) {
    return {
      start: index,
      end: index + mentionText.length
    }
  }
  
  // Try case-insensitive search
  const lowerContent = content.toLowerCase()
  const lowerMention = mentionText.toLowerCase()
  const lowerIndex = lowerContent.indexOf(lowerMention, searchStart)
  
  if (lowerIndex !== -1) {
    return {
      start: lowerIndex,
      end: lowerIndex + mentionText.length
    }
  }
  
  return null
}

/**
 * Generate a UUID v4 for compatibility with existing systems
 * Note: This is NOT deterministic - use only for non-critical IDs
 */
export function randomUUID(): string {
  return crypto.randomUUID()
}
