/**
 * Docling Service
 * 
 * This service handles document parsing using Docling Serve.
 * Docling provides advanced document parsing capabilities including:
 * - PDF text extraction with layout preservation
 * - Table extraction
 * - OCR for scanned documents
 * - Markdown conversion
 * 
 * API Documentation: https://docling-docs.readthedocs.io/
 * 
 * Note: Uses synchronous /v1/convert/source endpoint with file content encoded as base64
 */

export interface DoclingParseResult {
  success: boolean
  markdown?: string
  text?: string
  pages?: number
  metadata?: {
    filename?: string
    filesize?: number
    page_count?: number
    processing_time_ms?: number
    has_tables?: boolean
    has_images?: boolean
  }
  error?: string
}

export interface DoclingParseOptions {
  outputFormat?: 'markdown' | 'text' | 'json'
  includeImages?: boolean
  includeTables?: boolean
  ocrEnabled?: boolean
  ocrLang?: string[]
}

class DoclingService {
  private baseUrl: string

  constructor() {
    // Docling server URL from environment or provided URL
    this.baseUrl = process.env.DOCLING_URL || 'http://ali-doclingserve-3291af-109-205-177-175.traefik.me'
    
    if (!this.baseUrl) {
      console.warn('⚠️ DOCLING_URL not configured - document parsing will be limited')
    }
  }

  /**
   * Parse a document using Docling
   * Uses /v1/convert/source endpoint with base64-encoded file content
   * @param file - The file to parse (as Buffer or File)
   * @param filename - Original filename
   * @param options - Parse options
   */
  async parseDocument(
    file: Buffer | File,
    filename: string,
    options: DoclingParseOptions = {}
  ): Promise<DoclingParseResult> {
    const startTime = Date.now()
    
    try {
      console.log(`📄 Parsing document with Docling: ${filename}`)
      
      // Convert file to base64
      let base64Content: string
      let fileSize: number
      
      if (file instanceof Buffer) {
        base64Content = file.toString('base64')
        fileSize = file.length
      } else {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        base64Content = buffer.toString('base64')
        fileSize = buffer.length
      }
      
      // Determine file extension for format detection
      const ext = filename.split('.').pop()?.toLowerCase() || 'pdf'
      
      // Use /v1/convert/source with base64 content
      // Docling Serve expects the file content as base64_string in the source
      // OpenAPI spec: FileSourceRequest { base64_string: string, filename: string, kind: "file" }
      const response = await fetch(`${this.baseUrl}/v1/convert/source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sources: [{
            kind: 'file',
            base64_string: base64Content,
            filename: filename
          }],
          options: {
            to_formats: ['md'],
            do_ocr: options.ocrEnabled ?? true,
            ocr_lang: options.ocrLang || ['es', 'en']
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Docling API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      
      const processingTime = Date.now() - startTime
      console.log(`✅ Docling parsed document in ${processingTime}ms`)
      
      // Handle Docling Serve v1 API response format
      // Response structure: { document: { md_content: "...", filename: "..." }, status: "success", processing_time: ... }
      const document = result.document || result
      
      // Extract markdown content - the field is 'md_content' in Docling Serve 1.12.0
      const markdown = document.md_content || document.main_text || document.markdown || document.text || ''
      const text = document.text_content || document.text || markdown
      const pages = document.pages?.length || 1
      
      console.log(`📄 Extracted content length: ${markdown.length} chars, ${pages} pages`)
      
      // Check if we got any content
      if (!markdown && !text) {
        console.error('❌ No content extracted from Docling response:', JSON.stringify(result).substring(0, 500))
        return {
          success: false,
          error: 'No content extracted from document'
        }
      }
      
      return {
        success: true,
        markdown,
        text,
        pages,
        metadata: {
          filename: document.filename || filename,
          filesize: fileSize,
          page_count: pages,
          processing_time_ms: processingTime,
          has_tables: !!(document.tables?.length),
          has_images: !!(document.pictures?.length)
        }
      }
    } catch (error: any) {
      console.error('❌ Error parsing document with Docling:', error)
      return {
        success: false,
        error: error.message || 'Unknown error parsing document'
      }
    }
  }

  /**
   * Parse a document from a URL
   * @param url - URL of the document to parse
   * @param options - Parse options
   */
  async parseFromUrl(
    url: string,
    options: DoclingParseOptions = {}
  ): Promise<DoclingParseResult> {
    const startTime = Date.now()
    
    try {
      console.log(`📄 Parsing document from URL with Docling: ${url}`)
      
      const response = await fetch(`${this.baseUrl}/v1/convert/source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sources: [{
            kind: 'http',
            url: url
          }],
          options: {
            to_formats: ['md'],
            do_ocr: options.ocrEnabled ?? true,
            ocr_lang: options.ocrLang || ['es', 'en']
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Docling API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      const processingTime = Date.now() - startTime
      
      console.log(`✅ Docling parsed document from URL in ${processingTime}ms`)
      
      const document = result.document || result
      const markdown = document.md_content || document.main_text || document.markdown || document.text || ''
      const text = document.text_content || document.text || markdown
      const pages = document.pages?.length || 1
      
      return {
        success: true,
        markdown,
        text,
        pages,
        metadata: {
          page_count: pages,
          processing_time_ms: processingTime,
          has_tables: !!(document.tables?.length),
          has_images: !!(document.pictures?.length)
        }
      }
    } catch (error: any) {
      console.error('❌ Error parsing document from URL:', error)
      return {
        success: false,
        error: error.message || 'Unknown error parsing document from URL'
      }
    }
  }

  /**
   * Check if Docling service is available
   */
  async healthCheck(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      if (!response.ok) {
        return { available: false, error: `Health check failed: ${response.status}` }
      }

      const data = await response.json()
      return { 
        available: true, 
        version: data.version || 'unknown' 
      }
    } catch (error: any) {
      return { 
        available: false, 
        error: error.message || 'Cannot connect to Docling service' 
      }
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.baseUrl
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): string[] {
    return [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
      'text/html',
      'image/png',
      'image/jpeg',
      'image/tiff'
    ]
  }

  /**
   * Check if a file type is supported
   */
  isSupported(mimeType: string): boolean {
    return this.getSupportedTypes().includes(mimeType)
  }
}

// Export singleton instance
export const doclingService = new DoclingService()
