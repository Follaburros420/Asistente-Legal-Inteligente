/**
 * Herramientas de busqueda web de codigo abierto para Tongyi
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
  note?: string
}

/**
 * Instancias publicas de SearXNG (codigo abierto, sin API key necesaria)
 */
const SEARXNG_INSTANCES = [
  'https://searx.be',
  'https://search.sapti.me',
  'https://searx.tiekoetter.com',
  'https://searx.work',
  'https://searx.fmac.xyz'
]

import { extractWithFirecrawl, searchWithFirecrawl } from './firecrawl-extractor'
import { getConstitutionArticle, isConstitutionalArticle } from '../constitucion-sources'
const OFFICIAL_DOMAINS = [
  '.gov.co',
  'corteconstitucional.gov.co',
  'consejodeestado.gov.co',
  'cortesuprema.gov.co',
  'suin-juriscol.gov.co',
  'imprenta.gov.co',
  'secretariasenado.gov.co',
  'funcionpublica.gov.co',
  'ramajudicial.gov.co',
  'alcaldiabogota.gov.co',
  'procuraduria.gov.co',
  'contraloria.gov.co',
  'fiscalia.gov.co',
  'defensoria.gov.co'
]

const ACADEMIC_DOMAINS = [
  '.edu.co',
  'uexternado.edu.co',
  'unal.edu.co',
  'javeriana.edu.co',
  'losandes.edu.co',
  'icesi.edu.co'
]

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const detectLegalArticle = (query: string) => {
  const normalized = normalizeText(query)
  const articleMatch = normalized.match(/\bart(?:iculo|\.?)\s*(\d+[a-z]?)/)
  const articleNumber = articleMatch ? articleMatch[1] : ''

  const isConstitutionalArticle =
    !!articleNumber &&
    (normalized.includes('constitucion') || normalized.includes('constitucional') || normalized.includes('c.p.'))

  const isCodeArticle =
    !!articleNumber &&
    (normalized.includes('codigo') ||
      normalized.includes('penal') ||
      normalized.includes('civil') ||
      normalized.includes('procedimiento') ||
      normalized.includes('ley'))

  return {
    articleNumber,
    isConstitutionalArticle,
    isCodeArticle
  }
}

const buildLegalQuery = (query: string) => {
  const articleInfo = detectLegalArticle(query)
  const normalized = normalizeText(query)
  let finalQuery = query

  if (articleInfo.isConstitutionalArticle) {
    if (articleInfo.articleNumber) {
      finalQuery =
        `"articulo ${articleInfo.articleNumber}" "Constitucion Politica de Colombia 1991" ` +
        'site:secretariasenado.gov.co OR site:corteconstitucional.gov.co OR site:funcionpublica.gov.co OR site:imprenta.gov.co'
    } else {
      finalQuery =
        `${query} "Constitucion Politica de Colombia 1991" ` +
        'site:secretariasenado.gov.co OR site:corteconstitucional.gov.co OR site:funcionpublica.gov.co'
    }
  } else if (articleInfo.isCodeArticle && articleInfo.articleNumber) {
    finalQuery =
      `"articulo ${articleInfo.articleNumber}" ("Codigo Civil" OR "Codigo Penal" OR "Codigo de Procedimiento Civil") ` +
      'site:suin-juriscol.gov.co OR site:imprenta.gov.co'
  } else if (!normalized.includes('colombia') && !query.includes('site:')) {
    finalQuery =
      `${query} Colombia derecho legal legislacion ` +
      'site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co OR site:ramajudicial.gov.co OR site:corteconstitucional.gov.co OR site:consejodeestado.gov.co OR site:cortesuprema.gov.co OR site:suin-juriscol.gov.co OR site:imprenta.gov.co'
  }

  return {
    finalQuery,
    articleInfo
  }
}

const isOfficialSource = (url: string) => OFFICIAL_DOMAINS.some(domain => url.includes(domain))

const isAcademicSource = (url: string) => ACADEMIC_DOMAINS.some(domain => url.includes(domain))

const scoreFromUrl = (url: string) => {
  if (isOfficialSource(url)) return 3
  if (isAcademicSource(url)) return 2
  return 1
}

const MAX_SNIPPET_LENGTH = 2000

const ARTICLE_CONTEXT_WINDOW = 80
const ARTICLE_MAX_LENGTH = 1000

const cleanWhitespace = (value: string) =>
  value
    .replace(/\r?\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

const removeNavigationNoise = (value: string) =>
  value
    .replace(/Iniciar sesi[oó]n Registrarse Inicio\s*>[^A]+Artículo\s+\d+\s+Código Penal\s*/i, '')
    .replace(/Inicio\s*>[^A]+Artículo\s+\d+\s+Código Penal\s*/i, '')

const sanitizeSnippet = (content: string) =>
  removeNavigationNoise(cleanWhitespace(content)).slice(0, MAX_SNIPPET_LENGTH)

const htmlEntityMap: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&aacute;': 'á',
  '&eacute;': 'é',
  '&iacute;': 'í',
  '&oacute;': 'ó',
  '&uacute;': 'ú',
  '&Aacute;': 'Á',
  '&Eacute;': 'É',
  '&Iacute;': 'Í',
  '&Oacute;': 'Ó',
  '&Uacute;': 'Ú',
  '&ntilde;': 'ñ',
  '&Ntilde;': 'Ñ'
}

const decodeHtmlEntities = (input: string): string =>
  input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&[a-zA-Z]+;/g, entity => htmlEntityMap[entity] ?? entity)

const focusContentOnArticle = (
  content: string,
  articleInfo?: { articleNumber: string }
): string => {
  if (!articleInfo?.articleNumber) {
    return content
  }

  const articleNumber = articleInfo.articleNumber
  const patterns = [
    new RegExp(`art[íi]?culo\\s+${articleNumber}\\b`, 'i'),
    new RegExp(`art\\.?\\s*${articleNumber}\\b`, 'i')
  ]

  for (const pattern of patterns) {
    const match = content.search(pattern)
    if (match !== -1) {
      const sectionStart = Math.max(0, match - ARTICLE_CONTEXT_WINDOW)
      let sectionEnd = Math.min(content.length, match + ARTICLE_MAX_LENGTH)

      const remaining = content.slice(match)
      const nextArticleMatch = remaining.search(/art[íi]?culo\s+\d+\b/i)
      if (nextArticleMatch > 0 && match + nextArticleMatch > match) {
        sectionEnd = Math.min(sectionEnd, match + nextArticleMatch)
      }

      let snippet = content.slice(sectionStart, sectionEnd).trim()

      const relativeMatch = snippet.search(pattern)
      if (relativeMatch > 0) {
        snippet = snippet.slice(relativeMatch)
      }

      const articleDotPattern = new RegExp(`art[íi]?culo\\s+${articleInfo.articleNumber}\\s*\\.`, 'i')
      const dotIndex = snippet.search(articleDotPattern)
      if (dotIndex > 0) {
        snippet = snippet.slice(dotIndex)
      }

      if (sectionStart > 0) {
        snippet = `...${snippet}`
      }
      if (sectionEnd < content.length) {
        snippet = `${snippet}...`
      }

      return snippet
    }
  }

  return content
}

const fetchArticleFromAlternateSources = async (
  articleInfo: { articleNumber: string },
  query?: string
): Promise<string> => {
  if (!query) return ''

  const normalizedQuery = normalizeText(query)
  const candidates: string[] = []

  if (normalizedQuery.includes('constitucion')) {
    candidates.push(`constitucion_politica`)
    candidates.push(`constitucion`)
  }
  if (normalizedQuery.includes('penal')) {
    candidates.push(`codigo_penal`)
  }
  if (normalizedQuery.includes('civil')) {
    candidates.push(`codigo_civil`)
  }
  if (normalizedQuery.includes('procedimiento') && normalizedQuery.includes('civil')) {
    candidates.unshift(`codigo_general_del_proceso`)
  }
  if (normalizedQuery.includes('procedimiento') && normalizedQuery.includes('penal')) {
    candidates.unshift(`codigo_procedimiento_penal`)
  }

  for (const codePath of candidates) {
    const url = `https://leyes.co/${codePath}/${articleInfo.articleNumber}.htm`
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AsistenteLegal/1.0)'
        }
      })

      if (!response.ok) {
        continue
      }

      const html = await response.text()
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const plainText = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (!plainText) {
        continue
      }

      const decoded = decodeHtmlEntities(plainText)
      const focused = focusContentOnArticle(decoded, articleInfo)
      if (focused) {
        console.log(`[web-search] Fallback leyes.co utilizado para articulo ${articleInfo.articleNumber}`)
        return focused
      }
    } catch (error) {
      console.log(`[web-search] Fallback leyes.co fallo (${codePath}): ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return ''
}

async function enrichSearchResults(
  results: SearchResult[],
  options: {
    maxEnriched?: number
    preferFirecrawl?: boolean
    articleInfo?: ReturnType<typeof detectLegalArticle>
    query?: string
  } = {}
): Promise<SearchResult[]> {
  const maxEnriched = options.maxEnriched ?? 3
  const preferFirecrawl = options.preferFirecrawl ?? false
  const articleInfo = options.articleInfo
  const query = options.query
  const enriched: SearchResult[] = []

  for (let index = 0; index < results.length; index++) {
    const result = results[index]
    const baseScore = result.score ?? scoreFromUrl(result.url)
    const preferFirecrawlForResult = preferFirecrawl && baseScore < 3

    if (index < maxEnriched) {
      try {
        const content = await extractUrlContent(result.url, { preferFirecrawl: preferFirecrawlForResult })
        if (content && !content.startsWith('Error')) {
          const decodedContent = decodeHtmlEntities(content)
          let focused = focusContentOnArticle(decodedContent, articleInfo)

          if (articleInfo?.articleNumber) {
            const normalizedFocused = normalizeText(focused)
            if (!normalizedFocused.includes(`articulo ${articleInfo.articleNumber}`)) {
              const alternate = await fetchArticleFromAlternateSources(articleInfo, query)
              if (alternate) {
                focused = alternate
              }
            }
          }

          enriched.push({
            ...result,
            score: baseScore,
            snippet: sanitizeSnippet(focused)
          })
          continue
        }
        console.log(`[web-search] Contenido limitado, usando snippet base para ${result.url}`)
      } catch (error) {
        console.error(`[web-search] Error enriqueciendo ${result.url}:`, error)
      }
    }

    enriched.push({
      ...result,
      score: baseScore,
      snippet: focusContentOnArticle(decodeHtmlEntities(result.snippet), articleInfo)
    })
  }

  return enriched
}

/**
 * Buscar usando Firecrawl v2 Search API (recomendado)
 * Ideal para grounding con contexto fresco
 */
export async function searchWebWithFirecrawl(query: string, numResults: number = 5): Promise<WebSearchResponse> {
  const timestamp = new Date().toISOString()

  try {
    console.log(`[web-search] Google CSE legal enriquecida: "${query}"`)

    const articleInfo = detectLegalArticle(query)
    if (articleInfo.articleNumber) {
      console.log(`[web-search] Articulo detectado: ${articleInfo.articleNumber}`)
    }

    const googleResults = await searchWeb(query, numResults)

    if (!googleResults.success || googleResults.results.length === 0) {
      console.log('[web-search] Google CSE no encontro resultados')
      return {
        ...googleResults,
        timestamp
      }
    }

    const enrichedResults = await enrichSearchResults(googleResults.results, {
      maxEnriched: Math.min(5, googleResults.results.length),
      preferFirecrawl: true,
      articleInfo,
      query
    })

    enrichedResults.sort((a, b) => (b.score || 0) - (a.score || 0))

    const fullContentCount = enrichedResults.filter(r => r.snippet.length > 1000).length
    console.log(
      `[web-search] Google CSE + extraccion completado: ${enrichedResults.length} resultados (${fullContentCount} con contenido extendido)`
    )

    return {
      success: true,
      query: googleResults.query,
      results: enrichedResults,
      sources: enrichedResults.map(r => r.url),
      timestamp
    }
  } catch (error) {
    console.error('[web-search] Error en Google CSE + extraccion:', error)
    return await searchWeb(query, numResults)
  }
}

/**
 * Buscar usando Google Custom Search Engine (CSE)
 * Replica exacta del flujo de n8n para busquedas legales colombianas
 */
export async function searchWeb(query: string, numResults: number = 10): Promise<WebSearchResponse> {
  const timestamp = new Date().toISOString()

  try {
    console.log(`[web-search] Google CSE busqueda legal: "${query}"`)

    const { finalQuery, articleInfo } = buildLegalQuery(query)
    if (articleInfo.articleNumber) {
      console.log(`[web-search] Busqueda optimizada para articulo ${articleInfo.articleNumber}`)
    }

    const cseApiKey = process.env.GOOGLE_CSE_API_KEY || 'AIzaSyD5y97kpgw32Q5C6ujGKB6JafkD4Cv49TA'
    const cseCx = process.env.GOOGLE_CSE_CX || '6464df08faf4548b9'
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${cseApiKey}&cx=${cseCx}&q=${encodeURIComponent(finalQuery)}&num=${Math.min(numResults, 10)}`

    console.log(`[web-search] Google CSE: Consultando con query: "${finalQuery}"`)

    const cseResponse = await fetch(searchUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    })

    if (!cseResponse.ok) {
      const errorText = await cseResponse.text()
      console.log(`[web-search] Google CSE error ${cseResponse.status}: ${errorText.substring(0, 200)}`)
      return await searchWebFallback(query, numResults)
    }

    const cseData = await cseResponse.json()

    if (!cseData.items || cseData.items.length === 0) {
      console.log(`[web-search] Google CSE sin resultados para: "${finalQuery}"`)

      if (articleInfo.isConstitutionalArticle) {
        const alternativeQuery = `"Constitucion Politica de Colombia" texto completo site:secretariasenado.gov.co`
        console.log(`[web-search] Intentando busqueda alternativa: "${alternativeQuery}"`)
        const altUrl = `https://www.googleapis.com/customsearch/v1?key=${cseApiKey}&cx=${cseCx}&q=${encodeURIComponent(alternativeQuery)}&num=5`

        try {
          const altResponse = await fetch(altUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
          })

          if (altResponse.ok) {
            const altData = await altResponse.json()
            if (altData.items && altData.items.length > 0) {
              const altResults: SearchResult[] = altData.items.map((item: any) => {
                const url = item.link || item.formattedUrl || ''
                const title = item.title || 'Sin titulo'
                const snippet = item.snippet || item.htmlSnippet || 'Sin descripcion'
                const score = scoreFromUrl(url)
                const prefix = score === 3 ? '[OFICIAL] ' : score === 2 ? '[ACADEMICA] ' : ''

                return {
                  title: prefix ? `${prefix}${title}` : title,
                  url,
                  snippet,
                  score
                }
              })

              return {
                success: true,
                query: alternativeQuery,
                results: altResults,
                sources: altResults.map(r => r.url),
                timestamp: new Date().toISOString()
              }
            }
          }
        } catch (altError) {
          console.log(`[web-search] Busqueda alternativa fallo: ${String(altError)}`)
        }
      }

      return await searchWebFallback(query, numResults)
    }

    console.log(`[web-search] Google CSE encontro ${cseData.items.length} resultados`)

    const results: SearchResult[] = cseData.items.map((item: any) => {
      const url = item.link || item.formattedUrl || ''
      const title = item.title || 'Sin titulo'
      const snippet = item.snippet || item.htmlSnippet || 'Sin descripcion'
      const score = scoreFromUrl(url)
      const prefix = score === 3 ? '[OFICIAL] ' : score === 2 ? '[ACADEMICA] ' : ''

      return {
        title: prefix ? `${prefix}${title}` : title,
        url,
        snippet,
        score
      }
    })

    results.sort((a, b) => (b.score || 0) - (a.score || 0))

    const officialCount = results.filter(r => r.score === 3).length
    const academicCount = results.filter(r => r.score === 2).length
    console.log(`[web-search] Google CSE completado: ${results.length} resultados (${officialCount} oficiales, ${academicCount} academicas)`)

    return {
      success: true,
      query: finalQuery,
      results,
      sources: results.map(r => r.url),
      timestamp
    }
  } catch (error) {
    console.error('[web-search] Error en Google CSE:', error)
    return await searchWebFallback(query, numResults)
  }
}

/**
 * Fallback: Buscar usando Wikipedia (extrae el termino principal)
 */
async function searchWebFallback(query: string, numResults: number): Promise<WebSearchResponse> {
  console.log(`Ã°Å¸â€â€ž Usando fallback: Wikipedia`)
  
  const timestamp = new Date().toISOString()
  
  try {
    // Extraer el termino principal de la query
    // Ejemplos:
    // "cuando murio ozzy osbourne" -> "ozzy osbourne"
    // "Ã‚Â¿que es blockchain?" -> "blockchain"
    const cleanQuery = query
      .toLowerCase()
      .replace(/[Ã‚Â¿?Ã‚Â¡!]/g, '')
      .replace(/^(cuando|cuando|que|que|quien|quien|donde|donde|como|como|busca|investiga|murio|murio|fallecio|fallecio|muerte de|informacion sobre|en internet|que dia es hoy)\s+/gi, '')
      .trim()
    
    console.log(`Ã°Å¸â€œÂ Termino limpio para Wikipedia: "${cleanQuery}"`)
    
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
          console.log(`[OK] Encontrado en Wikipedia: ${url}`)
          break // Solo una version de Wikipedia
        }
      } catch (error) {
        console.log(`[WARN] No se encontro en ${url}`)
      }
    }
    
    if (results.length > 0) {
      console.log(`[OK] Fallback exitoso: ${results.length} resultado(s)`)
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
    console.error('[ERROR] Fallback tambien fallo:', error)
    return {
      success: false,
      query,
      results: [],
      sources: [],
      timestamp,
      error: 'No se pudo realizar la busqueda web. Por favor intenta de nuevo mas tarde.'
    }
  }
}

/**
 * Extraer contenido completo de una URL usando Jina AI Reader (gratuito, codigo abierto)
 */
export async function extractUrlContent(
  url: string,
  options: { preferFirecrawl?: boolean } = {}
): Promise<string> {
  const preferFirecrawl = options.preferFirecrawl ?? false
  const shouldTryFirecrawl = Boolean(process.env.FIRECRAWL_API_KEY)

  console.log(`[web-search] Extrayendo contenido de: ${url}`)

  let jinaContent = ''
  let firecrawlContent = ''

  const fetchWithJina = async () => {
    const jinaUrl = `https://r.jina.ai/${url}`
    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'Mozilla/5.0 (compatible; AsistenteLegal/1.0)'
      },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`Jina AI Reader respondio con ${response.status}`)
    }

    const raw = await response.text()
    const clean = raw.trim()
    console.log(`[web-search] Jina AI: contenido obtenido (${clean.length} caracteres)`)
    return clean.slice(0, MAX_SNIPPET_LENGTH)
  }

  const fetchWithFirecrawl = async () => {
    try {
      const firecrawlResult = await extractWithFirecrawl(url)
      if (firecrawlResult.success && firecrawlResult.content) {
        console.log(`[web-search] Firecrawl: contenido obtenido (${firecrawlResult.content.length} caracteres)`)
        return firecrawlResult.content.slice(0, MAX_SNIPPET_LENGTH)
      }
    } catch (error) {
      console.log(`[web-search] Firecrawl fallo para ${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
    return ''
  }

  try {
    try {
      jinaContent = await fetchWithJina()
    } catch (jinaError) {
      console.log(`[web-search] Jina fallo para ${url}: ${jinaError instanceof Error ? jinaError.message : String(jinaError)}`)
    }

    const needsFirecrawl = preferFirecrawl || !jinaContent || jinaContent.length < 600

    if (needsFirecrawl && shouldTryFirecrawl) {
      firecrawlContent = await fetchWithFirecrawl()
    }

    if (!jinaContent && !firecrawlContent) {
      // Reintentar con Jina por ultima vez para no devolver cadena vacia
      try {
        jinaContent = await fetchWithJina()
      } catch (finalError) {
        console.error(`[web-search] Error extrayendo contenido de ${url}:`, finalError)
        return `Error al extraer contenido: ${finalError instanceof Error ? finalError.message : 'Unknown'}`
      }
    }

    if (firecrawlContent && firecrawlContent.length > jinaContent.length) {
      return firecrawlContent
    }

    return jinaContent || firecrawlContent || ''
  } catch (error) {
    console.error(`[web-search] Error extrayendo contenido de ${url}:`, error)
    return `Error al extraer contenido: ${error instanceof Error ? error.message : 'Unknown'}`
  }
}

/**
 * Busqueda web enriquecida: busca + extrae contenido de los primeros resultados
 */
export async function searchWebEnriched(query: string): Promise<WebSearchResponse> {
  const timestamp = new Date().toISOString()
  
  try {
    console.log(`[web-search] Busqueda web enriquecida: "${query}"`)

    // PRIMERO: Verificar si es un artículo constitucional y usar fuentes directas
    const constitutionalArticleNumber = isConstitutionalArticle(query)
    if (constitutionalArticleNumber) {
      console.log(`[web-search] Artículo constitucional detectado: ${constitutionalArticleNumber}`)
      
      try {
        const constitutionArticle = await getConstitutionArticle(constitutionalArticleNumber)
        if (constitutionArticle) {
          console.log(`[web-search] Artículo constitucional obtenido desde fuente oficial directa`)
          
          const officialResult: SearchResult = {
            title: `[OFICIAL] ${constitutionArticle.source}`,
            url: constitutionArticle.url,
            snippet: constitutionArticle.content,
            score: 3
          }

          return {
            success: true,
            query: query,
            results: [officialResult],
            sources: [constitutionArticle.url],
            timestamp,
            note: 'Respuesta obtenida desde fuente constitucional oficial directa'
          }
        }
      } catch (error) {
        console.log(`[web-search] Error obteniendo artículo constitucional directo: ${error}`)
      }
    }

    // SEGUNDO: Usar detección tradicional para otros casos legales
    const articleInfo = detectLegalArticle(query)
    if (articleInfo.isConstitutionalArticle || articleInfo.isCodeArticle) {
      console.log(`[web-search] Consulta legal detectada, usando buscador especializado`)
      return await searchWebWithFirecrawl(query, 5)
    }

    // TERCERO: Consulta general con Google CSE
    console.log(`[web-search] Consulta general, usando Google CSE`)
    const searchResults = await searchWeb(query, 10)

    if (!searchResults.success || searchResults.results.length === 0) {
      return searchResults
    }

    const enrichedResults = await enrichSearchResults(searchResults.results, {
      maxEnriched: 3,
      preferFirecrawl: false,
      articleInfo,
      query
    })

    return {
      ...searchResults,
      results: enrichedResults
    }
  } catch (error) {
    console.error(`[web-search] Error en busqueda enriquecida:`, error)
    return {
      success: false,
      query,
      results: [],
      sources: [],
      timestamp,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Formatear resultados de busqueda para incluir en el contexto de Tongyi
 */
export function formatSearchResultsForContext(searchResponse: WebSearchResponse): string {
  if (!searchResponse.success || searchResponse.results.length === 0) {
    return `No se encontraron resultados específicos para: "${searchResponse.query}"`
  }

  const officialSources = searchResponse.results.filter(r => r.score === 3)
  const academicSources = searchResponse.results.filter(r => r.score === 2)
  const otherSources = searchResponse.results.filter(r => r.score === 1)

  let legalContent = ''
  let sourcesList: Array<{title: string, url: string, type: string}> = []

  // Extraer y limpiar el contenido legal más relevante
  const extractLegalContent = (snippet: string): string => {
    // Decodificar caracteres UTF-8 mal codificados
    let cleaned = snippet
      .replace(/ArtÃculo/g, 'Artículo')
      .replace(/PÃºblico/g, 'Público')
      .replace(/pÃºblico/g, 'público')
      .replace(/legislativa/g, 'legislativa')
      .replace(/ejecutiva/g, 'ejecutiva')
      .replace(/judicial/g, 'judicial')
      .replace(/autÃ³nomos/g, 'autónomos')
      .replace(/independientes/g, 'independientes')
      .replace(/funciones/g, 'funciones')
      .replace(/Estado/g, 'Estado')
      .replace(/Colombia/g, 'Colombia')
      .replace(/ConstituciÃ³n/g, 'Constitución')
      .replace(/constituciÃ³n/g, 'constitución')
      .replace(/PolÃtica/g, 'Política')
      .replace(/polÃtica/g, 'política')
      .replace(/organos/g, 'órganos')
      .replace(/Ã³rganos/g, 'órganos')
      .replace(/realizaciÃ³n/g, 'realización')
      .replace(/especÃficamente/g, 'específicamente')
      .replace(/informaciÃ³n/g, 'información')

    // Eliminar ruido de navegación y elementos web
    cleaned = cleaned
      .replace(/Hacer una pregunta en los comentarios[\s\S]*/gi, '')
      .replace(/Ver el artÃ[\s\S]*/gi, '')
      .replace(/Gacetas Asamblea Constituyente[\s\S]*/gi, '')
      .replace(/\d+\s+\d+\s+\d+\s+\d+\s+\d+/g, '') // Números de gaceta
      .replace(/ArtÃculo\s+\d+[oº]\s*\.\.\./gi, '') // Navegación de artículos
      .replace(/\.\.\.\s*\d+\s*Ver/gi, '') // Más navegación
      .replace(/\s{2,}/g, ' ') // Múltiples espacios
      .trim()

    // Extraer el artículo completo usando patrones más precisos
    const articlePatterns = [
      /Artículo\s+\d+\.\s*[^.]*(?:\.[^.]*){0,3}/, // Artículo seguido de hasta 3 oraciones
      /Artículo\s+\d+\.\s*[^.]*(?:\s*[^.]*)*/, // Artículo con contenido variable
    ]

    for (const pattern of articlePatterns) {
      const match = cleaned.match(pattern)
      if (match && match[0].length > 50) { // Asegurar que sea contenido significativo
        let articleText = match[0].trim()
        
        // Eliminar fragmentos incompletos al final
        if (articleText.endsWith(',') || articleText.endsWith(' y ')) {
          articleText = articleText.slice(0, -1).trim()
        }
        
        // Asegurar que termine en punto o completo
        if (!articleText.endsWith('.') && !articleText.endsWith(':')) {
          articleText += '.'
        }
        
        return articleText
      }
    }

    // Si no encuentra patrón de artículo, extraer las primeras oraciones significativas
    const sentences = cleaned.split(/[.!?]/).filter(s => s.trim().length > 15)
    const meaningfulSentences = sentences.filter(s => 
      !s.includes('Hacer una pregunta') &&
      !s.includes('Ver el art') &&
      !s.includes('Gacetas') &&
      !s.includes('Asamblea') &&
      !s.match(/^\d+$/) // Solo números
    )

    if (meaningfulSentences.length > 0) {
      return meaningfulSentences.slice(0, 2).join('. ').trim() + '.'
    }

    return cleaned.slice(0, 300).trim() + (cleaned.length > 300 ? '...' : '')
  }

  // Procesar fuentes oficiales
  if (officialSources.length > 0) {
    officialSources.forEach((result, index) => {
      const legalText = extractLegalContent(result.snippet)
      if (legalText && legalText.length > 50) {
        legalContent += `${legalText}\n\n`
      }
      
      // Agregar a la lista de fuentes para bibliografía
      sourcesList.push({
        title: result.title.replace(/\[OFICIAL\]\s*/g, '').trim(),
        url: result.url,
        type: 'OFICIAL'
      })
    })
  }

  // Procesar fuentes académicas
  if (academicSources.length > 0) {
    academicSources.slice(0, 2).forEach((result, index) => {
      const legalText = extractLegalContent(result.snippet)
      if (legalText && legalText.length > 50) {
        legalContent += `${legalText}\n\n`
      }
      
      sourcesList.push({
        title: result.title.replace(/\[ACADEMICA\]\s*/g, '').trim(),
        url: result.url,
        type: 'ACADÉMICA'
      })
    })
  }

  // Procesar otras fuentes si no hay oficiales
  if (otherSources.length > 0 && officialSources.length === 0) {
    otherSources.slice(0, 2).forEach((result, index) => {
      const legalText = extractLegalContent(result.snippet)
      if (legalText && legalText.length > 50) {
        legalContent += `${legalText}\n\n`
      }
      
      sourcesList.push({
        title: result.title.trim(),
        url: result.url,
        type: 'GENERAL'
      })
    })
  }

  // Construir el contexto final con formato limpio
  let context = ''
  
  if (legalContent.trim()) {
    context += `**INFORMACIÓN LEGAL ENCONTRADA:**\n\n${legalContent.trim()}\n\n`
  }

  // Agregar lista de fuentes separada para bibliografía
  if (sourcesList.length > 0) {
    context += `**FUENTES CONSULTADAS:**\n\n`
    sourcesList.forEach((source, index) => {
      context += `${index + 1}. [${source.type}] ${source.title}\n`
      context += `   URL: ${source.url}\n\n`
    })
  }

  // Instrucción para el modelo
  context += `**INSTRUCCIÓN:** Basado en la información legal anterior, responde de manera clara y específica a la consulta del usuario. Cita el texto legal encontrado y al final de tu respuesta, incluye una sección separada con "## 📚 Fuentes Consultadas" listando las fuentes mencionadas.`

  return context
}
