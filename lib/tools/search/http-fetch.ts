/**
 * Herramienta httpFetch para verificación de enlaces - Compatible con LangChain JS
 * Implementa extracción de contenido HTML/PDF con parsing
 */

import { Tool } from "langchain/tools"
import { z } from "zod"
import * as cheerio from "cheerio"
import pdfParse from "pdf-parse/lib/pdf-parse.js"

export interface HttpFetchResult {
  status: number
  url: string
  title?: string
  content: string
  contentType: string
  success: boolean
  error?: string
}

/**
 * Extrae contenido de una URL con parsing HTML/PDF
 */
async function fetchAndParseUrl(url: string, timeoutMs: number = 12000): Promise<HttpFetchResult> {
  console.log(`🌐 HttpFetch: Verificando "${url}"`)

  try {
    // Crear AbortController para timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        status: response.status,
        url,
        content: `Error HTTP ${response.status}: ${response.statusText}`,
        contentType: response.headers.get('content-type') || 'unknown',
        success: false,
        error: `HTTP ${response.status}`
      }
    }

    const contentType = response.headers.get('content-type') || 'unknown'
    let content = ''
    let title = ''

    // Procesar según el tipo de contenido
    if (contentType.includes('text/html')) {
      const html = await response.text()
      const $ = cheerio.load(html)
      
      // Extraer título
      title = $('title').text().trim() || 
               $('h1').first().text().trim() || 
               'Sin título'
      
      // Extraer contenido principal
      const mainContent = $('main, article, .content, .post-content, .entry-content').first()
      if (mainContent.length > 0) {
        content = mainContent.text().trim()
      } else {
        // Fallback: extraer párrafos
        content = $('p').map((_, el) => $(el).text().trim()).get().join(' ')
      }
      
      // Limitar contenido a 2000 caracteres
      if (content.length > 2000) {
        content = content.substring(0, 2000) + '...'
      }

    } else if (contentType.includes('application/pdf')) {
      const buffer = await response.arrayBuffer()
      const pdfData = await pdfParse(Buffer.from(buffer))
      
      title = pdfData.info?.Title || 'Documento PDF'
      content = pdfData.text.substring(0, 2000) + (pdfData.text.length > 2000 ? '...' : '')

    } else {
      // Para otros tipos de contenido, intentar como texto
      try {
        content = await response.text()
        if (content.length > 2000) {
          content = content.substring(0, 2000) + '...'
        }
      } catch {
        content = `Contenido no procesable (${contentType})`
      }
    }

    console.log(`✅ HttpFetch: ${title} (${content.length} caracteres)`)

    return {
      status: response.status,
      url,
      title,
      content,
      contentType,
      success: true
    }

  } catch (error) {
    console.error(`❌ Error en HttpFetch:`, error)
    
    return {
      status: 0,
      url,
      content: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      contentType: 'error',
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Herramienta httpFetch para LangChain JS con esquema JSON
 */
export const httpFetchTool = new Tool({
  name: "httpFetch",
  description: `Verifica y extrae contenido de una URL específica.
  
Esta herramienta es útil para:
- Verificar fechas y cifras en documentos oficiales
- Extraer contenido de leyes y decretos
- Validar información de sentencias judiciales
- Confirmar datos de APIs o servicios web

Parámetros:
- url (string): URL a verificar (requerido)
- timeoutMs (number, opcional): Timeout en milisegundos (default: 12000)

Retorna el contenido extraído, título y metadatos de la página.`,

  schema: z.object({
    url: z.string().url().describe("URL a verificar y extraer contenido"),
    timeoutMs: z.number().optional().describe("Timeout en milisegundos (default: 12000)")
  }),

  func: async ({ url, timeoutMs = 12000 }) => {
    try {
      const result = await fetchAndParseUrl(url, timeoutMs)
      
      if (!result.success) {
        return `❌ **Error verificando URL**\n\nURL: ${url}\nError: ${result.error}\nStatus: ${result.status}`
      }

      return `✅ **Contenido verificado**\n\n**Título:** ${result.title}\n**URL:** ${url}\n**Tipo:** ${result.contentType}\n**Status:** ${result.status}\n\n**Contenido:**\n${result.content}`
      
    } catch (error) {
      return `❌ Error verificando URL: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
})

/**
 * Función de utilidad para verificación directa
 */
export async function verifyUrl(url: string, timeoutMs: number = 12000): Promise<HttpFetchResult> {
  return await fetchAndParseUrl(url, timeoutMs)
}

/**
 * Verifica múltiples URLs en paralelo
 */
export async function verifyMultipleUrls(
  urls: string[], 
  timeoutMs: number = 12000
): Promise<HttpFetchResult[]> {
  const promises = urls.map(url => fetchAndParseUrl(url, timeoutMs))
  return await Promise.all(promises)
}





