/**
 * Herramientas de búsqueda web de código abierto para Tongyi
 * Usa SearXNG (metabuscador open source) + Jina AI Reader (gratuito)
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
  score?: number
}

export interface WebSearchResponse {
  success: boolean
  query: string
  results: SearchResult[]
  sources: string[]
  timestamp: string
  error?: string
}

/**
 * Instancias públicas de SearXNG (código abierto, sin API key necesaria)
 */
const SEARXNG_INSTANCES = [
  'https://searx.be',
  'https://search.sapti.me',
  'https://searx.tiekoetter.com',
  'https://searx.work',
  'https://searx.fmac.xyz'
]

import { extractWithFirecrawl, searchWithFirecrawl } from './firecrawl-extractor'

/**
 * Buscar usando Firecrawl v2 Search API (recomendado)
 * Ideal para grounding con contexto fresco
 */
export async function searchWebWithFirecrawl(query: string, numResults: number = 5): Promise<WebSearchResponse> {
  const timestamp = new Date().toISOString()
  
  try {
    console.log(`🔥 Firecrawl v2 Search: "${query}"`)
    
    const searchResult = await searchWithFirecrawl(query, numResults)
    
    if (!searchResult.success) {
      console.log(`⚠️ Firecrawl Search falló: ${searchResult.error}`)
      return await searchWeb(query, numResults) // Fallback a Google CSE
    }

    // Convertir resultados de Firecrawl a formato estándar
    const results: SearchResult[] = searchResult.results.map((item, index) => ({
      title: item.title,
      url: item.url,
      snippet: item.content.slice(0, 5000), // Contenido completo extraído
      score: 2 // Alta calidad por ser extracción completa
    }))

    console.log(`✅ Firecrawl v2 Search completado: ${results.length} resultados con contenido completo`)

    return {
      success: true,
      query,
      results,
      sources: results.map(r => r.url),
      timestamp
    }

  } catch (error) {
    console.error('❌ Error en Firecrawl Search:', error)
    return await searchWeb(query, numResults) // Fallback a Google CSE
  }
}

/**
 * Buscar usando Google Custom Search Engine (CSE)
 * Réplica exacta del flujo de n8n para búsquedas legales colombianas
 */
export async function searchWeb(query: string, numResults: number = 10): Promise<WebSearchResponse> {
  const timestamp = new Date().toISOString()
  
  try {
    console.log(`⚖️ Google CSE búsqueda legal: "${query}"`)
    
    // Google CSE API (mismas credenciales que n8n)
    const cseApiKey = process.env.GOOGLE_CSE_API_KEY || 'AIzaSyD5y97kpgw32Q5C6ujGKB6JafkD4Cv49TA'
    const cseCx = process.env.GOOGLE_CSE_CX || '6464df08faf4548b9'
    
    // Construir query con enfoque legal colombiano específico y fuentes nacionales prioritarias
    let legalQuery = query
    
    // Detectar consultas de artículos constitucionales específicos
    const isConstitutionalArticle = query.toLowerCase().includes('art') && 
                                   (query.toLowerCase().includes('constitucion') || query.toLowerCase().includes('constitución'))
    
    if (isConstitutionalArticle) {
      // Para artículos constitucionales, buscar específicamente en sitios de la Constitución
      // Extraer número de artículo para búsqueda más específica
      const articleMatch = query.toLowerCase().match(/art\s*(\d+)/)
      const articleNumber = articleMatch ? articleMatch[1] : ''
      
      if (articleNumber) {
        // Búsqueda específica para el artículo con número exacto
        legalQuery = `"artículo ${articleNumber}" "Constitución Política de Colombia 1991" site:secretariasenado.gov.co OR site:corteconstitucional.gov.co OR site:funcionpublica.gov.co OR site:imprenta.gov.co`
      } else {
        // Búsqueda general constitucional
        legalQuery = `${query} "Constitución Política de Colombia 1991" site:secretariasenado.gov.co OR site:corteconstitucional.gov.co OR site:funcionpublica.gov.co`
      }
    } else if (!query.toLowerCase().includes('colombia') && 
               !query.toLowerCase().includes('colombiano') && 
               !query.includes('site:')) {
      // Para otras consultas, usar la búsqueda general con sitios oficiales
      legalQuery = `${query} Colombia derecho legal legislación site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co OR site:ramajudicial.gov.co OR site:corteconstitucional.gov.co OR site:consejodeestado.gov.co OR site:cortesuprema.gov.co OR site:suin-juriscol.gov.co OR site:imprenta.gov.co`
    }
    
    console.log(`📡 Google CSE: Consultando con query: "${legalQuery}"`)
    
    // Llamar a Google Custom Search API
    const cseUrl = `https://www.googleapis.com/customsearch/v1?key=${cseApiKey}&cx=${cseCx}&q=${encodeURIComponent(legalQuery)}&num=${Math.min(numResults, 10)}`
    
    const cseResponse = await fetch(cseUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    })

    if (!cseResponse.ok) {
      const errorText = await cseResponse.text()
      console.log(`⚠️ Google CSE error ${cseResponse.status}: ${errorText.substring(0, 200)}`)
      return await searchWebFallback(query, numResults)
    }

    const cseData = await cseResponse.json()
    
    if (!cseData.items || cseData.items.length === 0) {
      console.log(`⚠️ Google CSE sin resultados para: "${legalQuery}"`)
      
      // Si es una consulta constitucional específica, intentar búsqueda alternativa
      if (isConstitutionalArticle) {
        console.log(`🔄 Intentando búsqueda alternativa para artículo constitucional...`)
        const alternativeQuery = `"Constitución Política de Colombia" texto completo site:secretariasenado.gov.co`
        const altUrl = `https://www.googleapis.com/customsearch/v1?key=${cseApiKey}&cx=${cseCx}&q=${encodeURIComponent(alternativeQuery)}&num=5`
        
        try {
          const altResponse = await fetch(altUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
          })
          
          if (altResponse.ok) {
            const altData = await altResponse.json()
            if (altData.items && altData.items.length > 0) {
              console.log(`✅ Búsqueda alternativa exitosa: ${altData.items.length} resultados`)
              // Usar los resultados alternativos
              const results: SearchResult[] = altData.items.map((item: any) => {
                const url = item.link || item.formattedUrl || ''
                const title = item.title || 'Sin título'
                const snippet = item.snippet || item.htmlSnippet || 'Sin descripción'
                
                const isOfficial = url.includes('.gov.co') || 
                                 url.includes('corteconstitucional.gov.co') ||
                                 url.includes('secretariasenado.gov.co')
                
                return {
                  title: isOfficial ? `⚖️ ${title}` : title,
                  url: url,
                  snippet: snippet,
                  score: isOfficial ? 3 : 1
                }
              })
              
              return {
                success: true,
                query: alternativeQuery,
                results,
                sources: results.map(r => r.url),
                timestamp: new Date().toISOString()
              }
            }
          }
        } catch (altError) {
          console.log(`⚠️ Búsqueda alternativa falló: ${altError}`)
        }
      }
      
      return await searchWebFallback(query, numResults)
    }

    console.log(`📍 Google CSE encontró ${cseData.items.length} resultados`)

    // Formatear resultados de Google CSE
    const results: SearchResult[] = cseData.items.map((item: any) => {
      const url = item.link || item.formattedUrl || ''
      const title = item.title || 'Sin título'
      const snippet = item.snippet || item.htmlSnippet || 'Sin descripción'
      
      // Identificar fuentes oficiales y confiables colombianas
      const isOfficial = url.includes('.gov.co') || 
                         url.includes('corteconstitucional.gov.co') ||
                         url.includes('consejodeestado.gov.co') ||
                         url.includes('cortesuprema.gov.co') ||
                         url.includes('suin-juriscol.gov.co') ||
                         url.includes('imprenta.gov.co') ||
                         url.includes('secretariasenado.gov.co') ||
                         url.includes('funcionpublica.gov.co') ||
                         url.includes('ramajudicial.gov.co') ||
                         url.includes('alcaldiabogota.gov.co') ||
                         url.includes('congresovisible.org') ||
                         url.includes('procuraduria.gov.co') ||
                         url.includes('contraloria.gov.co') ||
                         url.includes('fiscalia.gov.co') ||
                         url.includes('defensoria.gov.co')
      
      // Identificar fuentes académicas confiables
      const isAcademic = url.includes('.edu.co') ||
                         url.includes('uexternado.edu.co') ||
                         url.includes('unal.edu.co') ||
                         url.includes('javeriana.edu.co') ||
                         url.includes('losandes.edu.co') ||
                         url.includes('icesi.edu.co')
      
      // Calcular score basado en confiabilidad
      let score = 1
      if (isOfficial) score = 3  // Máxima prioridad para sitios oficiales
      else if (isAcademic) score = 2  // Alta prioridad para sitios académicos
      
      return {
        title: isOfficial ? `⚖️ ${title}` : isAcademic ? `🎓 ${title}` : title,
        url: url,
        snippet: snippet,
        score: score
      }
    })

    // Ordenar: fuentes oficiales primero
    results.sort((a, b) => b.score - a.score)

    const officialCount = results.filter(r => r.score === 3).length
    const academicCount = results.filter(r => r.score === 2).length
    console.log(`✅ Google CSE completado: ${results.length} resultados (${officialCount} oficiales, ${academicCount} académicas)`)

    return {
      success: true,
      query: legalQuery,
      results,
      sources: results.map(r => r.url),
      timestamp
    }

  } catch (error) {
    console.error('❌ Error en Google CSE:', error)
    return await searchWebFallback(query, numResults)
  }
}

/**
 * Fallback: Buscar usando Wikipedia (extrae el término principal)
 */
async function searchWebFallback(query: string, numResults: number): Promise<WebSearchResponse> {
  console.log(`🔄 Usando fallback: Wikipedia`)
  
  const timestamp = new Date().toISOString()
  
  try {
    // Extraer el término principal de la query
    // Ejemplos:
    // "cuando murió ozzy osbourne" -> "ozzy osbourne"
    // "¿qué es blockchain?" -> "blockchain"
    const cleanQuery = query
      .toLowerCase()
      .replace(/[¿?¡!]/g, '')
      .replace(/^(cuando|cuándo|que|qué|quien|quién|donde|dónde|como|cómo|busca|investiga|murió|murio|falleció|fallecio|muerte de|información sobre|en internet|que dia es hoy)\s+/gi, '')
      .trim()
    
    console.log(`📝 Término limpio para Wikipedia: "${cleanQuery}"`)
    
    const searchUrls = [
      `https://es.wikipedia.org/wiki/${encodeURIComponent(cleanQuery.replace(/\s+/g, '_'))}`,
      `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanQuery.replace(/\s+/g, '_'))}`,
    ]
    
    const results: SearchResult[] = []
    
    // Intentar extraer contenido de Wikipedia
    for (const url of searchUrls) {
      try {
        const content = await extractUrlContent(url)
        if (content && !content.startsWith('Error') && content.length > 100) {
          results.push({
            title: `Wikipedia: ${cleanQuery}`,
            url: url,
            snippet: content.slice(0, 500),
            score: 1
          })
          console.log(`✅ Encontrado en Wikipedia: ${url}`)
          break // Solo una versión de Wikipedia
        }
      } catch (error) {
        console.log(`⚠️ No se encontró en ${url}`)
      }
    }
    
    if (results.length > 0) {
      console.log(`✅ Fallback exitoso: ${results.length} resultado(s)`)
      return {
        success: true,
        query,
        results,
        sources: results.map(r => r.url),
        timestamp
      }
    }
    
    // Si todo falla
    throw new Error('No se pudieron obtener resultados')
    
  } catch (error) {
    console.error('❌ Fallback también falló:', error)
    return {
      success: false,
      query,
      results: [],
      sources: [],
      timestamp,
      error: 'No se pudo realizar la búsqueda web. Por favor intenta de nuevo más tarde.'
    }
  }
}

/**
 * Extraer contenido completo de una URL usando Jina AI Reader (gratuito, código abierto)
 */
export async function extractUrlContent(url: string): Promise<string> {
  try {
    console.log(`📄 Extrayendo contenido de: ${url}`)
    
    // Intentar primero con Firecrawl v2 (soporta PDFs y JavaScript)
    try {
      const firecrawlResult = await extractWithFirecrawl(url)
      
      if (firecrawlResult.success && firecrawlResult.content) {
        console.log(`✅ Firecrawl: Extraídos ${firecrawlResult.content.length} caracteres`)
        return firecrawlResult.content
      }
    } catch (firecrawlError) {
      console.log(`⚠️ Firecrawl falló, usando fallback Jina AI`)
    }
    
    // Fallback a Jina AI Reader si Firecrawl falla
    const jinaUrl = `https://r.jina.ai/${url}`
    
    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'Mozilla/5.0 (compatible; AsistenteLegal/1.0)'
      },
      signal: AbortSignal.timeout(15000) // 15 segundos timeout
    })

    if (!response.ok) {
      throw new Error(`Jina AI Reader respondió con ${response.status}`)
    }

    const content = await response.text()
    
    // Limpiar y limitar el contenido, pero mantener más caracteres para artículos específicos
    const cleanContent = content
      .trim()
      .slice(0, 5000) // Aumentar a 5000 caracteres para mejor contexto
    
    console.log(`✅ Jina AI: Contenido extraído: ${cleanContent.length} caracteres`)
    
    return cleanContent

  } catch (error) {
    console.error(`❌ Error extrayendo contenido de ${url}:`, error)
    return `Error al extraer contenido: ${error instanceof Error ? error.message : 'Unknown'}`
  }
}

/**
 * Búsqueda web enriquecida: busca + extrae contenido de los primeros resultados
 */
export async function searchWebEnriched(query: string): Promise<WebSearchResponse> {
  try {
    // 1. Buscar en la web - Aumentado a 10 resultados para mejor cobertura
    const searchResults = await searchWeb(query, 10)
    
    if (!searchResults.success || searchResults.results.length === 0) {
      return searchResults
    }

    // 2. MEJORADO: Extraer contenido completo de los primeros 3 resultados para mejor calidad
    console.log(`📚 Extrayendo contenido completo de los primeros 3 resultados para análisis profundo...`)
    
    const enrichedResults = await Promise.all(
      searchResults.results.slice(0, 3).map(async (result) => {
        try {
          const content = await extractUrlContent(result.url)
          return {
            ...result,
            snippet: content.slice(0, 5000) + '...' // Contenido completo extraído
          }
        } catch (error) {
          console.error(`Error enriqueciendo ${result.url}:`, error)
          return result // Mantener snippet original si falla
        }
      })
    )

    // Agregar los resultados restantes sin enriquecer pero con sus snippets originales
    for (let i = 3; i < searchResults.results.length; i++) {
      enrichedResults.push(searchResults.results[i])
    }

    return {
      ...searchResults,
      results: enrichedResults
    }

  } catch (error) {
    console.error('❌ Error en búsqueda enriquecida:', error)
    return {
      success: false,
      query,
      results: [],
      sources: [],
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Formatear resultados de búsqueda para incluir en el contexto de Tongyi
 */
export function formatSearchResultsForContext(searchResponse: WebSearchResponse): string {
  if (!searchResponse.success || searchResponse.results.length === 0) {
    return `No se encontraron resultados para: "${searchResponse.query}"`
  }

  // Separar fuentes por confiabilidad
  const officialSources = searchResponse.results.filter(r => r.score === 3)
  const academicSources = searchResponse.results.filter(r => r.score === 2)
  const otherSources = searchResponse.results.filter(r => r.score === 1)

  let context = `INFORMACIÓN JURÍDICA ESPECÍFICA ENCONTRADA EN INTERNET:\n\n`
  
  // Priorizar fuentes oficiales (máxima confiabilidad)
  if (officialSources.length > 0) {
    context += `📚 FUENTES OFICIALES COLOMBIANAS (MÁXIMA CONFIABILIDAD):\n\n`
    officialSources.forEach((result, index) => {
      context += `**${index + 1}. ${result.title}**\n`
      context += `URL: ${result.url}\n`
      context += `CONTENIDO COMPLETO:\n${result.snippet}\n\n`
      context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    })
  }

  // Incluir fuentes académicas (alta confiabilidad)
  if (academicSources.length > 0) {
    context += `🎓 FUENTES ACADÉMICAS CONFIABLES:\n\n`
    academicSources.forEach((result, index) => {
      context += `**${index + 1}. ${result.title}**\n`
      context += `URL: ${result.url}\n`
      context += `CONTENIDO COMPLETO:\n${result.snippet}\n\n`
      context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    })
  }

  // Incluir otras fuentes relevantes (limitadas)
  if (otherSources.length > 0) {
    context += `📄 FUENTES ADICIONALES RELEVANTES:\n\n`
    otherSources.slice(0, 3).forEach((result, index) => { // Limitar a 3 fuentes adicionales
      context += `**${index + 1}. ${result.title}**\n`
      context += `URL: ${result.url}\n`
      context += `CONTENIDO COMPLETO:\n${result.snippet}\n\n`
      context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    })
  }

  context += `INSTRUCCIÓN CRÍTICA: Analiza TODO el contenido arriba y proporciona una respuesta COMPLETA y ESPECÍFICA sobre la consulta del usuario.\n`
  context += `PRIORIZA la información de fuentes oficiales y académicas. NO uses información general si hay información específica aquí.\n\n`

  return context
}

