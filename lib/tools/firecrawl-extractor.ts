/**
 * Firecrawl v2 Integration
 * Extracción avanzada de contenido web con soporte para PDFs y JavaScript
 */

import FirecrawlApp from '@mendable/firecrawl-js'

// Inicializar Firecrawl con API key
const getFirecrawlClient = () => {
  const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-eb5dbfa5b2384e8eb5fac8218b4c66fa'
  return new FirecrawlApp({ apiKey })
}

/**
 * Extraer contenido de una URL usando Firecrawl v2
 * Soporta: HTML, PDFs, páginas con JavaScript
 */
export async function extractWithFirecrawl(url: string): Promise<{
  success: boolean
  content: string
  markdown?: string
  metadata?: any
  error?: string
}> {
  try {
    console.log(`🔥 Firecrawl: Extrayendo contenido de ${url}`)

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY || 'fc-eb5dbfa5b2384e8eb5fac8218b4c66fa'
    
    const response = await fetch("http://104.155.176.60:3002/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firecrawlApiKey}`
      },
      body: JSON.stringify({
        url: url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2000
      }),
      signal: AbortSignal.timeout(30000) // 30 segundos de timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Firecrawl API respondió con ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const markdownContent = data?.data?.markdown

    if (!markdownContent) {
      return {
        success: false,
        content: '',
        error: "No se pudo extraer contenido markdown con Firecrawl v2"
      }
    }

    console.log(`✅ Firecrawl v2: Extraídos ${markdownContent.length} caracteres de ${url}`)

    return {
      success: true,
      content: markdownContent.trim().slice(0, 5000), // Limitar a 5000 caracteres
      markdown: markdownContent,
      metadata: data?.data?.metadata
    }

  } catch (error: any) {
    console.error(`❌ Firecrawl error para ${url}:`, error.message)
    return {
      success: false,
      content: '',
      error: error.message || 'Unknown error'
    }
  }
}

/**
 * Extraer contenido de múltiples URLs en paralelo
 */
export async function extractMultipleWithFirecrawl(urls: string[]): Promise<{
  url: string
  success: boolean
  content: string
  metadata?: any
}[]> {
  console.log(`🔥 Firecrawl: Extrayendo contenido de ${urls.length} URLs en paralelo`)

  const results = await Promise.all(
    urls.map(async url => {
      const result = await extractWithFirecrawl(url)
      return {
        url,
        success: result.success,
        content: result.content,
        metadata: result.metadata
      }
    })
  )

  const successCount = results.filter(r => r.success).length
  console.log(`✅ Firecrawl: ${successCount}/${urls.length} URLs extraídas exitosamente`)

  return results
}

/**
 * Verificar si una URL es accesible antes de extraer
 */
export async function verifyUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch (error) {
    console.log(`⚠️ URL no accesible: ${url}`)
    return false
  }
}

/**
 * Extraer solo de URLs verificadas
 */
export async function extractVerifiedUrls(urls: string[]): Promise<{
  url: string
  success: boolean
  content: string
  verified: boolean
}[]> {
  console.log(`🔍 Verificando ${urls.length} URLs antes de extraer...`)

  // Verificar URLs en paralelo
  const verificationResults = await Promise.all(
    urls.map(async url => ({
      url,
      verified: await verifyUrl(url)
    }))
  )

  const verifiedUrls = verificationResults.filter(r => r.verified)
  console.log(`✅ ${verifiedUrls.length}/${urls.length} URLs verificadas`)

  // Extraer solo URLs verificadas
  const extractions = await extractMultipleWithFirecrawl(
    verifiedUrls.map(r => r.url)
  )

  // Combinar resultados
  return urls.map(url => {
    const verification = verificationResults.find(v => v.url === url)
    const extraction = extractions.find(e => e.url === url)

    return {
      url,
      success: extraction?.success || false,
      content: extraction?.content || '',
      verified: verification?.verified || false
    }
  })
}

/**
 * Buscar en la web usando Firecrawl v2 Search API
 * Ideal para grounding con contexto fresco
 */
export async function searchWithFirecrawl(query: string, numResults: number = 5): Promise<{
  success: boolean
  results: Array<{
    title: string
    url: string
    content: string
    metadata?: any
  }>
  error?: string
}> {
  try {
    console.log(`🔍 Firecrawl v2 Search: "${query}"`)

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY || 'fc-eb5dbfa5b2384e8eb5fac8218b4c66fa'
    
    const response = await fetch("http://104.155.176.60:3002/v2/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firecrawlApiKey}`
      },
      body: JSON.stringify({
        query: query,
        limit: numResults,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 2000
        }
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Firecrawl Search API respondió con ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    if (!data.success || !data.data) {
      return {
        success: false,
        results: [],
        error: "No se pudieron obtener resultados de búsqueda"
      }
    }

    const results = data.data.map((item: any) => ({
      title: item.metadata?.title || 'Sin título',
      url: item.metadata?.url || '',
      content: item.markdown || '',
      metadata: item.metadata
    }))

    console.log(`✅ Firecrawl v2 Search: ${results.length} resultados encontrados`)

    return {
      success: true,
      results
    }

  } catch (error: any) {
    console.error(`❌ Firecrawl Search error:`, error.message)
    return {
      success: false,
      results: [],
      error: error.message || 'Unknown error'
    }
  }
}

