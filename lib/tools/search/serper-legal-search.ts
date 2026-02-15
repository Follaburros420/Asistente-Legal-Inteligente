/**
 * Herramienta de Búsqueda Legal con Serper (ÚNICA HERRAMIENTA DE BÚSQUEDA)
 * 
 * Esta es la única herramienta de búsqueda web que debe usarse en el sistema.
 * Reemplaza: Google CSE, SearXNG, y cualquier otra herramienta de búsqueda.
 * 
 * Características:
 * - Búsqueda optimizada para derecho colombiano
 * - Priorización de fuentes oficiales (.gov.co)
 * - Detección automática de tipo de consulta legal
 * - Formateo de resultados para LLM
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS Y CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

export interface SerperSearchResult {
  title: string
  link: string
  snippet: string
  position?: number
}

export interface SerperResponse {
  searchParameters: {
    q: string
    gl: string
    hl: string
    num: number
  }
  organic: SerperSearchResult[]
  relatedSearches?: string[]
}

export interface LegalSearchResult {
  title: string
  url: string
  snippet: string
  source: 'official' | 'academic' | 'general'
  sourceName: string
  relevanceScore: number
}

interface SearchCacheEntry {
  expiresAt: number
  results: LegalSearchResult[]
}

// Dominios oficiales colombianos ordenados por prioridad
const OFFICIAL_DOMAINS = [
  'corteconstitucional.gov.co',
  'consejodeestado.gov.co',
  'cortesuprema.gov.co',
  'ramajudicial.gov.co',
  'suin-juriscol.gov.co',
  'secretariasenado.gov.co',
  'funcionpublica.gov.co',
  'imprenta.gov.co',
  'procuraduria.gov.co',
  'contraloria.gov.co',
  'fiscalia.gov.co',
  'defensoria.gov.co',
  'minjusticia.gov.co',
  'dian.gov.co',
  'alcaldiabogota.gov.co',
  '.gov.co'
]

// Dominios académicos confiables
const ACADEMIC_DOMAINS = [
  'uexternado.edu.co',
  'unal.edu.co',
  'javeriana.edu.co',
  'losandes.edu.co',
  'icesi.edu.co',
  'urosario.edu.co',
  'upb.edu.co',
  'usc.edu.co',
  '.edu.co'
]

// Dominios prohibidos (baja confiabilidad)
const BANNED_DOMAINS = [
  'wikipedia.org',
  'wikimedia.org',
  'wikidata.org',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'tiktok.com'
]

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000
const SEARCH_CACHE_MAX_ENTRIES = 200
const SEARCH_CACHE = new Map<string, SearchCacheEntry>()

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE UTILIDAD
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function cloneResults(results: LegalSearchResult[]): LegalSearchResult[] {
  return results.map(item => ({ ...item }))
}

function buildSearchCacheKey(
  optimizedQuery: string,
  numResults: number,
  includeAcademic: boolean
): string {
  const normalizedQuery = normalizeText(optimizedQuery).replace(/\s+/g, ' ').trim()
  return `${normalizedQuery}|num:${numResults}|acad:${includeAcademic ? 1 : 0}`
}

function getCachedResults(cacheKey: string): LegalSearchResult[] | null {
  const cached = SEARCH_CACHE.get(cacheKey)
  if (!cached) return null
  if (Date.now() > cached.expiresAt) {
    SEARCH_CACHE.delete(cacheKey)
    return null
  }
  return cloneResults(cached.results)
}

function setCachedResults(cacheKey: string, results: LegalSearchResult[]): void {
  if (SEARCH_CACHE.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const firstKey = SEARCH_CACHE.keys().next().value
    if (firstKey) SEARCH_CACHE.delete(firstKey)
  }

  SEARCH_CACHE.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    results: cloneResults(results)
  })
}

function classifySource(url: string): { type: 'official' | 'academic' | 'general', name: string } {
  const urlLower = url.toLowerCase()
  
  // Verificar dominios oficiales
  for (const domain of OFFICIAL_DOMAINS) {
    if (urlLower.includes(domain)) {
      const name = getOfficialSourceName(url)
      return { type: 'official', name }
    }
  }
  
  // Verificar dominios académicos
  for (const domain of ACADEMIC_DOMAINS) {
    if (urlLower.includes(domain)) {
      return { type: 'academic', name: 'Fuente Académica' }
    }
  }
  
  return { type: 'general', name: 'Fuente General' }
}

function getOfficialSourceName(url: string): string {
  const domainMap: Record<string, string> = {
    'corteconstitucional.gov.co': 'Corte Constitucional',
    'consejodeestado.gov.co': 'Consejo de Estado',
    'cortesuprema.gov.co': 'Corte Suprema de Justicia',
    'ramajudicial.gov.co': 'Rama Judicial',
    'suin-juriscol.gov.co': 'SUIN-Juriscol',
    'secretariasenado.gov.co': 'Secretaría del Senado',
    'funcionpublica.gov.co': 'Función Pública',
    'imprenta.gov.co': 'Imprenta Nacional',
    'procuraduria.gov.co': 'Procuraduría General',
    'contraloria.gov.co': 'Contraloría General',
    'fiscalia.gov.co': 'Fiscalía General',
    'defensoria.gov.co': 'Defensoría del Pueblo',
    'minjusticia.gov.co': 'Ministerio de Justicia',
    'dian.gov.co': 'DIAN'
  }
  
  for (const [domain, name] of Object.entries(domainMap)) {
    if (url.includes(domain)) return name
  }
  
  return 'Fuente Oficial'
}

function isBannedDomain(url: string): boolean {
  return BANNED_DOMAINS.some(domain => url.toLowerCase().includes(domain))
}

function detectLegalArticle(query: string): { number: string; type: 'constitucion' | 'codigo' | 'ley' | null } {
  const normalized = normalizeText(query)
  
  // Detectar artículo constitucional
  const constMatch = normalized.match(/art(í|i)culo\s+(\d+[a-z]?)\s*(cp|constitucion|constitucional)/)
  if (constMatch) {
    return { number: constMatch[2], type: 'constitucion' }
  }
  
  // Detectar artículo de código
  const codigoMatch = normalized.match(/art(í|i)culo\s+(\d+[a-z]?)\s*(cc|cp|cg|codigo|c(ó|o)digo)/)
  if (codigoMatch) {
    return { number: codigoMatch[2], type: 'codigo' }
  }
  
  // Detectar solo número de artículo
  const articleMatch = normalized.match(/art(í|i)culo\s+(\d+[a-z]?)/)
  if (articleMatch) {
    return { number: articleMatch[2], type: 'ley' }
  }
  
  return { number: '', type: null }
}

function buildOptimizedQuery(query: string): { query: string; type: 'constitucion' | 'codigo' | 'jurisprudencia' | 'general' } {
  const normalized = normalizeText(query)
  const articleInfo = detectLegalArticle(query)
  
  // Consulta constitucional - solo si hay un número de artículo específico o la palabra está al inicio
  // Evitar falsos positivos como "participación" que contiene "cip" pero no "constitución"
  const isConstitucionExplicit = normalized.includes('constitucion') || normalized.includes('constitucional')
  const hasArticuloNumero = articleInfo.type === 'constitucion' && articleInfo.number
  
  if (hasArticuloNumero || (isConstitucionExplicit && !normalized.includes('participacion'))) {
    return {
      query: `"artículo ${articleInfo.number || ''}" "Constitución Política de Colombia" site:secretariasenado.gov.co OR site:corteconstitucional.gov.co`,
      type: 'constitucion'
    }
  }
  
  // Consulta de código
  if (articleInfo.type === 'codigo' || /c(ó|o)digo\s+(penal|civil|comercial|procesal)/.test(normalized)) {
    const codigoType = normalized.includes('penal') ? 'Penal' :
                       normalized.includes('civil') ? 'Civil' :
                       normalized.includes('comercial') ? 'Comercial' : ''
    
    return {
      query: `"artículo ${articleInfo.number || ''}" "Código ${codigoType}" Colombia site:suin-juriscol.gov.co OR site:funcionpublica.gov.co`,
      type: 'codigo'
    }
  }
  
  // Consulta de jurisprudencia
  if (/(sentencia|fallo|auto|tutela|jurisprudencia)/.test(normalized)) {
    return {
      query: `${query} Colombia site:corteconstitucional.gov.co OR site:consejodeestado.gov.co OR site:cortesuprema.gov.co`,
      type: 'jurisprudencia'
    }
  }
  
  // Consulta general
  return {
    query: `${query} Colombia derecho legal site:gov.co`,
    type: 'general'
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL DE BÚSQUEDA
// ═══════════════════════════════════════════════════════════════════════════════

export async function searchLegalColombia(
  query: string,
  options: {
    numResults?: number
    includeAcademic?: boolean
    recencyDays?: number
  } = {}
): Promise<LegalSearchResult[]> {
  const { numResults = 10, includeAcademic = false } = options
  
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    throw new Error('SERPER_API_KEY no está configurada en las variables de entorno')
  }

  // Construir query optimizada
  const { query: optimizedQuery, type: searchType } = buildOptimizedQuery(query)
  const cacheKey = buildSearchCacheKey(optimizedQuery, numResults, includeAcademic)
  
  console.log(`🔍 Serper Legal Search: "${query}" (tipo: ${searchType})`)
  console.log(`📝 Query optimizada: "${optimizedQuery}"`)

  const cachedResults = getCachedResults(cacheKey)
  if (cachedResults) {
    console.log(`⚡ Serper cache hit: ${cachedResults.length} resultados reutilizados`)
    return cachedResults
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: optimizedQuery,
        num: numResults,
        gl: 'co',  // Colombia
        hl: 'es'   // Español
      })
    })

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`)
    }

    const data: SerperResponse = await response.json()
    
    if (!data.organic || data.organic.length === 0) {
      console.log('⚠️ Serper: No se encontraron resultados')
      return []
    }

    // Procesar y clasificar resultados
    const results: LegalSearchResult[] = data.organic
      .filter(result => !isBannedDomain(result.link))
      .map(result => {
        const classification = classifySource(result.link)
        
        // Calcular score de relevancia
        let relevanceScore = 0
        if (classification.type === 'official') relevanceScore += 10
        if (classification.type === 'academic') relevanceScore += 5
        if (result.snippet?.toLowerCase().includes('artículo')) relevanceScore += 3
        if (result.snippet?.toLowerCase().includes('ley')) relevanceScore += 2
        
        return {
          title: result.title,
          url: result.link,
          snippet: cleanSnippet(result.snippet || ''),
          source: classification.type,
          sourceName: classification.name,
          relevanceScore
        }
      })
      .filter(result => includeAcademic || result.source !== 'academic' || result.relevanceScore > 7)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)

    console.log(`✅ Serper: ${results.length} resultados encontrados (${results.filter(r => r.source === 'official').length} oficiales)`)
    setCachedResults(cacheKey, results)
    
    return results

  } catch (error) {
    console.error('❌ Error en Serper Legal Search:', error)
    throw error
  }
}

/**
 * Búsqueda específica de jurisprudencia colombiana
 */
export async function searchJurisprudencia(
  query: string,
  options: { 
    tribunal?: 'constitucional' | 'suprema' | 'consejo' | 'all'
    numResults?: number 
  } = {}
): Promise<LegalSearchResult[]> {
  const { tribunal = 'all', numResults = 10 } = options
  
  let siteFilter = ''
  
  switch (tribunal) {
    case 'constitucional':
      siteFilter = 'site:corteconstitucional.gov.co'
      break
    case 'suprema':
      siteFilter = 'site:cortesuprema.gov.co'
      break
    case 'consejo':
      siteFilter = 'site:consejodeestado.gov.co'
      break
    default:
      siteFilter = 'site:corteconstitucional.gov.co OR site:cortesuprema.gov.co OR site:consejodeestado.gov.co'
  }
  
  const optimizedQuery = `"${query}" sentencia Colombia ${siteFilter}`
  
  return searchLegalColombia(optimizedQuery, { numResults })
}

/**
 * Búsqueda específica de artículos de ley
 */
export async function searchArticuloLey(
  articleNumber: string,
  norma: string
): Promise<LegalSearchResult[]> {
  const query = `"artículo ${articleNumber}" "${norma}" Colombia`
  return searchLegalColombia(query, { numResults: 5 })
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE FORMATO
// ═══════════════════════════════════════════════════════════════════════════════

function cleanSnippet(snippet: string): string {
  return snippet
    .replace(/\s+/g, ' ')
    .replace(/\.{3,}/g, '...')
    .trim()
    .substring(0, 500)
}

export function formatSearchResultsForLLM(results: LegalSearchResult[]): string {
  if (results.length === 0) {
    return 'No se encontraron resultados de búsqueda.'
  }

  const officialResults = results.filter(r => r.source === 'official')
  const otherResults = results.filter(r => r.source !== 'official')

  let output = '🔍 **RESULTADOS DE BÚSQUEDA LEGAL**\n\n'

  if (officialResults.length > 0) {
    output += '🏛️ **FUENTES OFICIALES**\n\n'
    officialResults.slice(0, 5).forEach((result, i) => {
      output += `${i + 1}. **${result.title}**\n`
      output += `   📎 ${result.url}\n`
      output += `   🏛️ ${result.sourceName}\n`
      output += `   📝 ${result.snippet}\n\n`
    })
  }

  if (otherResults.length > 0 && officialResults.length < 3) {
    output += '📚 **FUENTES COMPLEMENTARIAS**\n\n'
    otherResults.slice(0, 3).forEach((result, i) => {
      output += `${i + 1}. **${result.title}**\n`
      output += `   📎 ${result.url}\n`
      output += `   📝 ${result.snippet}\n\n`
    })
  }

  return output
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICACIÓN DE CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

export function checkSerperConfig(): { configured: boolean; message: string } {
  const apiKey = process.env.SERPER_API_KEY
  
  if (!apiKey) {
    return {
      configured: false,
      message: 'SERPER_API_KEY no está configurada. Las búsquedas web no funcionarán.'
    }
  }
  
  return {
    configured: true,
    message: 'Serper API configurada correctamente'
  }
}
