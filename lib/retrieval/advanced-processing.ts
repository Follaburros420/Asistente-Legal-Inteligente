/**
 * Sistema avanzado de procesamiento de documentos
 * Mejora la calidad de extracción de texto y estructura
 */

import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import cheerio from 'cheerio'
import { TurndownService } from 'turndown'

export interface DocumentChunk {
  content: string
  tokens: number
  metadata: {
    type: 'text' | 'table' | 'heading' | 'list' | 'code'
    level?: number
    page?: number
    section?: string
  }
}

export interface ProcessedDocument {
  chunks: DocumentChunk[]
  metadata: {
    title?: string
    author?: string
    pages?: number
    wordCount: number
    language?: string
  }
}

/**
 * Procesador avanzado de PDFs
 */
export async function processAdvancedPDF(buffer: Buffer): Promise<ProcessedDocument> {
  try {
    const data = await pdfParse(buffer)
    
    const chunks: DocumentChunk[] = []
    const pages = data.numpages
    const text = data.text
    
    // Dividir por páginas para mejor contexto
    const pageTexts = text.split(/\f/)
    
    pageTexts.forEach((pageText, pageIndex) => {
      if (!pageText.trim()) return
      
      // Procesar diferentes tipos de contenido
      const processedChunks = processTextContent(pageText, pageIndex + 1)
      chunks.push(...processedChunks)
    })
    
    return {
      chunks,
      metadata: {
        pages,
        wordCount: text.split(/\s+/).length,
        language: detectLanguage(text)
      }
    }
  } catch (error) {
    console.error('Error procesando PDF avanzado:', error)
    throw new Error('Failed to process PDF with advanced parser')
  }
}

/**
 * Procesador avanzado de documentos Word
 */
export async function processAdvancedDocx(buffer: Buffer): Promise<ProcessedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    const htmlResult = await mammoth.convertToHtml({ buffer })
    
    const chunks: DocumentChunk[] = []
    const text = result.value
    
    // Procesar HTML para extraer estructura
    const $ = cheerio.load(htmlResult.value)
    
    // Extraer títulos y secciones
    $('h1, h2, h3, h4, h5, h6').each((i, elem) => {
      const level = parseInt(elem.tagName.charAt(1))
      const content = $(elem).text().trim()
      if (content) {
        chunks.push({
          content,
          tokens: Math.ceil(content.length / 4),
          metadata: {
            type: 'heading',
            level
          }
        })
      }
    })
    
    // Extraer párrafos
    $('p').each((i, elem) => {
      const content = $(elem).text().trim()
      if (content && content.length > 50) {
        chunks.push({
          content,
          tokens: Math.ceil(content.length / 4),
          metadata: {
            type: 'text'
          }
        })
      }
    })
    
    // Si no hay estructura HTML, procesar texto plano
    if (chunks.length === 0) {
      const processedChunks = processTextContent(text, 1)
      chunks.push(...processedChunks)
    }
    
    return {
      chunks,
      metadata: {
        wordCount: text.split(/\s+/).length,
        language: detectLanguage(text)
      }
    }
  } catch (error) {
    console.error('Error procesando DOCX avanzado:', error)
    throw new Error('Failed to process DOCX with advanced parser')
  }
}

/**
 * Procesador avanzado de HTML
 */
export async function processAdvancedHTML(html: string): Promise<ProcessedDocument> {
  try {
    const $ = cheerio.load(html)
    const chunks: DocumentChunk[] = []
    
    // Extraer título
    const title = $('title').text() || $('h1').first().text()
    
    // Extraer contenido estructurado
    $('h1, h2, h3, h4, h5, h6').each((i, elem) => {
      const level = parseInt(elem.tagName.charAt(1))
      const content = $(elem).text().trim()
      if (content) {
        chunks.push({
          content,
          tokens: Math.ceil(content.length / 4),
          metadata: {
            type: 'heading',
            level
          }
        })
      }
    })
    
    // Extraer párrafos
    $('p').each((i, elem) => {
      const content = $(elem).text().trim()
      if (content && content.length > 50) {
        chunks.push({
          content,
          tokens: Math.ceil(content.length / 4),
          metadata: {
            type: 'text'
          }
        })
      }
    })
    
    // Extraer listas
    $('ul, ol').each((i, elem) => {
      const content = $(elem).text().trim()
      if (content) {
        chunks.push({
          content,
          tokens: Math.ceil(content.length / 4),
          metadata: {
            type: 'list'
          }
        })
      }
    })
    
    return {
      chunks,
      metadata: {
        title,
        wordCount: $('body').text().split(/\s+/).length,
        language: detectLanguage($('body').text())
      }
    }
  } catch (error) {
    console.error('Error procesando HTML avanzado:', error)
    throw new Error('Failed to process HTML with advanced parser')
  }
}

/**
 * Procesa contenido de texto con detección de estructura
 */
function processTextContent(text: string, page?: number): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  
  // Dividir por párrafos
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  
  paragraphs.forEach(paragraph => {
    const trimmed = paragraph.trim()
    if (trimmed.length < 20) return
    
    // Detectar tipo de contenido
    let type: DocumentChunk['metadata']['type'] = 'text'
    let level: number | undefined
    
    // Detectar títulos
    if (trimmed.length < 100 && /^[A-ZÁÉÍÓÚÑ][^.!?]*$/.test(trimmed)) {
      type = 'heading'
      level = trimmed.length < 50 ? 1 : 2
    }
    
    // Detectar listas
    if (/^[\s]*[-*•]\s/.test(trimmed) || /^[\s]*\d+\.\s/.test(trimmed)) {
      type = 'list'
    }
    
    // Detectar código
    if (trimmed.includes('```') || trimmed.includes('    ') && trimmed.split('\n').length > 3) {
      type = 'code'
    }
    
    chunks.push({
      content: trimmed,
      tokens: Math.ceil(trimmed.length / 4),
      metadata: {
        type,
        level,
        page
      }
    })
  })
  
  return chunks
}

/**
 * Detecta el idioma del texto
 */
function detectLanguage(text: string): string {
  // Detección simple basada en caracteres
  const spanishChars = /[áéíóúñü]/gi
  const englishChars = /[a-z]/gi
  
  const spanishMatches = (text.match(spanishChars) || []).length
  const englishMatches = (text.match(englishChars) || []).length
  
  if (spanishMatches > englishMatches * 0.1) {
    return 'es'
  }
  
  return 'en'
}

/**
 * Convierte HTML a Markdown
 */
export function htmlToMarkdown(html: string): string {
  const turndownService = new TurndownService()
  return turndownService.turndown(html)
}

/**
 * Mejora el chunking de texto para embeddings
 */
export function improveChunking(chunks: DocumentChunk[], maxTokens: number = 1000): DocumentChunk[] {
  const improvedChunks: DocumentChunk[] = []
  
  for (const chunk of chunks) {
    if (chunk.tokens <= maxTokens) {
      improvedChunks.push(chunk)
      continue
    }
    
    // Dividir chunks grandes manteniendo contexto
    const sentences = chunk.content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    let currentChunk = ''
    let currentTokens = 0
    
    for (const sentence of sentences) {
      const sentenceTokens = Math.ceil(sentence.length / 4)
      
      if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
        improvedChunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          metadata: {
            ...chunk.metadata,
            type: 'text'
          }
        })
        currentChunk = sentence
        currentTokens = sentenceTokens
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence
        currentTokens += sentenceTokens
      }
    }
    
    if (currentChunk) {
      improvedChunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        metadata: {
          ...chunk.metadata,
          type: 'text'
        }
      })
    }
  }
  
  return improvedChunks
}















