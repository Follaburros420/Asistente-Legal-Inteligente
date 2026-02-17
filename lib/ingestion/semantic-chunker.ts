/**
 * Semantic Chunker for Legal Documents
 * 
 * This module implements semantic chunking that respects document structure:
 * - Splits on headers, paragraphs, and lists
 * - Maintains overlap for context preservation
 * - Preserves metadata about chunk origin
 * - Handles min/max chunk sizes
 */

import { encode } from 'gpt-tokenizer'
import {
  ChunkDTO,
  ChunkMetadata,
  ChunkingConfig,
  DEFAULT_CHUNKING_CONFIG
} from './types'
import {
  stableChunkId,
  contentHash
} from './stable-id'

/**
 * Represents a structural element in the document
 */
interface DocumentElement {
  type: 'header' | 'paragraph' | 'list' | 'table' | 'code' | 'quote' | 'other'
  content: string
  level?: number // For headers
  charOffset: number
  metadata?: Record<string, any>
}

/**
 * Result of chunking a document
 */
export interface ChunkingResult {
  chunks: ChunkDTO[]
  totalTokens: number
  elementCount: number
}

/**
 * Semantic Chunker class
 */
export class SemanticChunker {
  private config: ChunkingConfig

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = { ...DEFAULT_CHUNKING_CONFIG, ...config }
  }

  /**
   * Chunk a document into semantic chunks
   * 
   * @param content - Document content (markdown)
   * @param documentId - Document ID
   * @param processId - Process ID
   * @param workspaceId - Workspace ID
   * @param metadata - Additional metadata
   * @returns Array of chunks with metadata
   */
  chunkDocument(
    content: string,
    documentId: string,
    processId: string,
    workspaceId: string,
    metadata: Partial<ChunkMetadata> = {}
  ): ChunkingResult {
    // Step 1: Parse document into structural elements
    const elements = this.parseDocumentStructure(content)
    
    // Step 2: Group elements into chunks respecting size limits
    const rawChunks = this.groupElementsIntoChunks(elements, content)
    
    // Step 3: Create ChunkDTO objects with stable IDs
    const chunks: ChunkDTO[] = []
    let totalTokens = 0
    let charOffset = 0

    for (let i = 0; i < rawChunks.length; i++) {
      const rawChunk = rawChunks[i]
      const tokenCount = this.countTokens(rawChunk.content)
      totalTokens += tokenCount

      const chunkId = stableChunkId(workspaceId, processId, documentId, i)
      
      chunks.push({
        id: chunkId,
        documentId,
        processId,
        workspaceId,
        content: rawChunk.content,
        chunkIndex: i,
        charOffset: rawChunk.charOffset,
        tokenCount,
        contentHash: contentHash(rawChunk.content),
        metadata: {
          ...metadata,
          sectionHeader: rawChunk.sectionHeader,
          contentType: rawChunk.contentType,
          structurePath: rawChunk.structurePath
        }
      })
    }

    return {
      chunks,
      totalTokens,
      elementCount: elements.length
    }
  }

  /**
   * Parse a markdown document into structural elements
   */
  private parseDocumentStructure(content: string): DocumentElement[] {
    const elements: DocumentElement[] = []
    const lines = content.split('\n')
    let currentOffset = 0
    let currentHeaderPath: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLength = line.length + 1 // +1 for newline

      // Check for headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        const level = headerMatch[1].length
        const headerText = headerMatch[2].trim()
        
        // Update header path
        currentHeaderPath = currentHeaderPath.slice(0, level - 1)
        currentHeaderPath.push(headerText)

        elements.push({
          type: 'header',
          content: line,
          level,
          charOffset: currentOffset,
          metadata: {
            headerText,
            headerLevel: level,
            structurePath: [...currentHeaderPath]
          }
        })

        currentOffset += lineLength
        continue
      }

      // Check for list items
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/)
      if (listMatch) {
        elements.push({
          type: 'list',
          content: line,
          charOffset: currentOffset,
          metadata: {
            indentLevel: Math.floor(listMatch[1].length / 2),
            isOrdered: /^\d+\./.test(listMatch[2]),
            structurePath: [...currentHeaderPath]
          }
        })

        currentOffset += lineLength
        continue
      }

      // Check for tables (simple detection)
      if (line.includes('|') && line.trim().startsWith('|')) {
        elements.push({
          type: 'table',
          content: line,
          charOffset: currentOffset,
          metadata: {
            structurePath: [...currentHeaderPath]
          }
        })

        currentOffset += lineLength
        continue
      }

      // Check for code blocks
      if (line.trim().startsWith('```')) {
        const codeBlockLines: string[] = [line]
        let j = i + 1
        
        while (j < lines.length && !lines[j].trim().startsWith('```')) {
          codeBlockLines.push(lines[j])
          j++
        }
        
        if (j < lines.length) {
          codeBlockLines.push(lines[j])
        }

        const codeContent = codeBlockLines.join('\n')
        elements.push({
          type: 'code',
          content: codeContent,
          charOffset: currentOffset,
          metadata: {
            language: line.trim().slice(3).trim() || 'unknown',
            structurePath: [...currentHeaderPath]
          }
        })

        currentOffset += codeContent.length + 1
        i = j
        continue
      }

      // Check for blockquotes
      if (line.trim().startsWith('>')) {
        elements.push({
          type: 'quote',
          content: line,
          charOffset: currentOffset,
          metadata: {
            structurePath: [...currentHeaderPath]
          }
        })

        currentOffset += lineLength
        continue
      }

      // Regular paragraph text
      if (line.trim().length > 0) {
        elements.push({
          type: 'paragraph',
          content: line,
          charOffset: currentOffset,
          metadata: {
            structurePath: [...currentHeaderPath]
          }
        })
      }

      currentOffset += lineLength
    }

    return elements
  }

  /**
   * Group elements into chunks respecting size limits
   */
  private groupElementsIntoChunks(
    elements: DocumentElement[],
    content: string
  ): Array<{
    content: string
    charOffset: number
    sectionHeader?: string
    contentType: ChunkMetadata['contentType']
    structurePath?: string[]
  }> {
    const chunks: Array<{
      content: string
      charOffset: number
      sectionHeader?: string
      contentType: ChunkMetadata['contentType']
      structurePath?: string[]
    }> = []

    let currentChunk: string[] = []
    let currentOffset = 0
    let currentSize = 0
    let currentHeader: string | undefined
    let currentPath: string[] = []
    let currentTypes = new Set<string>()

    const flushChunk = () => {
      if (currentChunk.length === 0) return

      const chunkContent = currentChunk.join('\n')
      
      // Determine primary content type
      let primaryType: ChunkMetadata['contentType'] = 'other'
      if (currentTypes.has('header')) primaryType = 'header'
      else if (currentTypes.has('table')) primaryType = 'table'
      else if (currentTypes.has('list')) primaryType = 'list'
      else if (currentTypes.has('code')) primaryType = 'code'
      else if (currentTypes.has('quote')) primaryType = 'quote'
      else if (currentTypes.has('paragraph')) primaryType = 'paragraph'

      chunks.push({
        content: chunkContent,
        charOffset: currentOffset,
        sectionHeader: currentHeader,
        contentType: primaryType,
        structurePath: currentPath.length > 0 ? currentPath : undefined
      })

      currentChunk = []
      currentSize = 0
      currentTypes.clear()
    }

    for (const element of elements) {
      const elementSize = element.content.length

      // Update header context
      if (element.type === 'header' && element.metadata?.headerText) {
        currentHeader = element.metadata.headerText
        if (element.metadata.structurePath) {
          currentPath = element.metadata.structurePath
        }
      }

      // Check if we need to flush the current chunk
      if (
        currentSize + elementSize > this.config.chunkSize &&
        currentSize >= this.config.minChunkSize
      ) {
        flushChunk()
        currentOffset = element.charOffset
      }

      // Add element to current chunk
      currentChunk.push(element.content)
      currentSize += elementSize + 1 // +1 for newline
      currentTypes.add(element.type)

      // Check if chunk is too large and needs to be split
      if (currentSize > this.config.maxChunkSize) {
        // Split large chunks at sentence boundaries
        const chunkContent = currentChunk.join('\n')
        const subChunks = this.splitLargeChunk(chunkContent, currentOffset)
        
        chunks.push(...subChunks)
        
        currentChunk = []
        currentSize = 0
        currentTypes.clear()
      }
    }

    // Flush remaining content
    if (currentChunk.length > 0) {
      // Check if the last chunk is too small and can be merged
      const lastChunkContent = currentChunk.join('\n')
      
      if (
        lastChunkContent.length < this.config.minChunkSize &&
        chunks.length > 0
      ) {
        // Merge with previous chunk
        const prevChunk = chunks[chunks.length - 1]
        prevChunk.content += '\n' + lastChunkContent
      } else {
        flushChunk()
      }
    }

    // Add overlap between chunks
    if (this.config.chunkOverlap > 0) {
      return this.addOverlap(chunks)
    }

    return chunks
  }

  /**
   * Split a large chunk at sentence boundaries
   */
  private splitLargeChunk(
    content: string,
    baseOffset: number
  ): Array<{
    content: string
    charOffset: number
    contentType: ChunkMetadata['contentType']
  }> {
    const chunks: Array<{
      content: string
      charOffset: number
      contentType: ChunkMetadata['contentType']
    }> = []

    // Split at sentence boundaries
    const sentences = content.split(/(?<=[.!?])\s+/)
    let currentChunk = ''
    let currentOffset = baseOffset

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.config.chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            charOffset: currentOffset,
            contentType: 'paragraph'
          })
          currentOffset += currentChunk.length
          currentChunk = ''
        }
      }
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        charOffset: currentOffset,
        contentType: 'paragraph'
      })
    }

    return chunks
  }

  /**
   * Add overlap between chunks for context preservation
   */
  private addOverlap(
    chunks: Array<{
      content: string
      charOffset: number
      sectionHeader?: string
      contentType: ChunkMetadata['contentType']
      structurePath?: string[]
    }>
  ): typeof chunks {
    if (chunks.length <= 1) return chunks

    const overlappedChunks = [...chunks]

    for (let i = 1; i < overlappedChunks.length; i++) {
      const prevChunk = overlappedChunks[i - 1]
      const currentChunk = overlappedChunks[i]

      // Get the last N characters from the previous chunk
      const overlapText = prevChunk.content.slice(-this.config.chunkOverlap)
      
      // Prepend to current chunk (but don't duplicate if already there)
      if (!currentChunk.content.startsWith(overlapText)) {
        currentChunk.content = overlapText + '...\n\n' + currentChunk.content
      }
    }

    return overlappedChunks
  }

  /**
   * Count tokens in text
   */
  private countTokens(text: string): number {
    try {
      return encode(text).length
    } catch {
      // Fallback to approximate count
      return Math.ceil(text.length / 4)
    }
  }
}

/**
 * Create a default chunker instance
 */
export const semanticChunker = new SemanticChunker()

/**
 * Convenience function to chunk a document
 */
export function chunkDocument(
  content: string,
  documentId: string,
  processId: string,
  workspaceId: string,
  metadata?: Partial<ChunkMetadata>,
  config?: Partial<ChunkingConfig>
): ChunkingResult {
  const chunker = config ? new SemanticChunker(config) : semanticChunker
  return chunker.chunkDocument(content, documentId, processId, workspaceId, metadata)
}
