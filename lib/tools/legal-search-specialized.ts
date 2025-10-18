/**
 * Búsqueda Legal Especializada con Serper
 * Optimizada específicamente para consultas legales colombianas
 * Excluye completamente Wikipedia y prioriza fuentes autorizadas
 */

export interface LegalSearchResult {
  title: string
  url: string
  snippet: string
  source: string
  type: 'official' | 'academic' | 'news' | 'general'
  relevance: number
  jurisdiction: string
}

export interface LegalSearchResponse {
  success: boolean
  query: string
  results: LegalSearchResult[]
  sources: string[]
  timestamp: string
  searchStrategy: string
  error?: string
}

// Dominios oficiales colombianos prioritarios
const OFFICIAL_LEGAL_DOMAINS = [
  'corteconstitucional.gov.co',
  'consejodeestado.gov.co', 
  'cortesuprema.gov.co',
  'secretariasenado.gov.co',
  'suin-juriscol.gov.co',
  'imprenta.gov.co',
  'funcionpublica.gov.co',
  'ramajudicial.gov.co',
  'procuraduria.gov.co',
  'contraloria.gov.co',
  'fiscalia.gov.co',
  'defensoria.gov.co',
  'superintendencias.gov.co',
  'minjusticia.gov.co',
  'minhacienda.gov.co'
]

// Dominios académicos legales
const ACADEMIC_LEGAL_DOMAINS = [
  'uexternado.edu.co',
  'unal.edu.co',
  'javeriana.edu.co',
  'losandes.edu.co',
  'icesi.edu.co',
  'scholar.google.com',
  'scielo.org',
  'researchgate.net',
  'academia.edu'
]

// Medios especializados en legal
const LEGAL_NEWS_DOMAINS = [
  'eltiempo.com',
  'elespectador.com',
  'semana.com',
  'portafolio.co',
  'larepublica.co',
  'juridica.com',
  'legis.com.co'
]

// Función para clasificar el tipo de fuente legal
function classifyLegalSource(url: string, title: string): 'official' | 'academic' | 'news' | 'general' {
  const urlLower = url.toLowerCase()
  const titleLower = title.toLowerCase()
  
  if (OFFICIAL_LEGAL_DOMAINS.some(domain => urlLower.includes(domain))) {
    return 'official'
  }
  
  if (ACADEMIC_LEGAL_DOMAINS.some(domain => urlLower.includes(domain))) {
    return 'academic'
  }
  
  if (LEGAL_NEWS_DOMAINS.some(domain => urlLower.includes(domain))) {
    return 'news'
  }
  
  return 'general'
}

// Función para calcular relevancia legal
function calculateLegalRelevance(url: string, title: string, snippet: string): number {
  const type = classifyLegalSource(url, title)
  let relevance = 0
  
  // Puntuación base por tipo de fuente
  switch (type) {
    case 'official': relevance = 10; break
    case 'academic': relevance = 8; break
    case 'news': relevance = 6; break
    case 'general': relevance = 4; break
  }
  
  // Bonificaciones por contenido legal específico
  const legalTerms = ['artículo', 'ley', 'decreto', 'sentencia', 'jurisprudencia', 'código', 'norma', 'reglamento', 'resolución', 'fallo', 'tutela', 'acción']
  const content = (title + ' ' + snippet).toLowerCase()
  
  legalTerms.forEach(term => {
    if (content.includes(term)) {
      relevance += 2
    }
  })
  
  // Bonificación por números (artículos, leyes, etc.)
  if (/\d+/.test(content)) {
    relevance += 1
  }
  
  return Math.min(relevance, 20) // Máximo 20 puntos
}

// Búsqueda oficial especializada
async function searchOfficialLegal(query: string, numResults: number = 5): Promise<LegalSearchResponse> {
  console.log(`🏛️ BÚSQUEDA OFICIAL LEGAL: "${query}"`)
  
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      throw new Error('SERPER_API_KEY no configurada')
    }
    
    // Query especializada para fuentes oficiales con términos legales
    const officialQuery = `${query} Colombia (${OFFICIAL_LEGAL_DOMAINS.map(domain => `site:${domain}`).join(' OR ')}) -site:wikipedia.org -site:wikimedia.org -site:wikidata.org`
    
    const searchUrl = 'https://google.serper.dev/search'
    const requestBody = {
      q: officialQuery,
      num: numResults,
      apiKey: apiKey
    }
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`Serper API Error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.organic && data.organic.length > 0) {
      const results: LegalSearchResult[] = data.organic.map((item: any) => ({
        title: item.title || 'Sin título',
        url: item.link || '',
        snippet: item.snippet || item.description || 'Sin descripción',
        source: 'Serper Oficial',
        type: classifyLegalSource(item.link || '', item.title || ''),
        relevance: calculateLegalRelevance(item.link || '', item.title || '', item.snippet || ''),
        jurisdiction: 'Colombia'
      }))
      
      // Ordenar por relevancia
      results.sort((a, b) => b.relevance - a.relevance)
      
      console.log(`✅ Búsqueda oficial: ${results.length} fuentes encontradas`)
      return {
        success: true,
        query,
        results,
        sources: results.map(r => r.url),
        timestamp: new Date().toISOString(),
        searchStrategy: 'Official Legal Sources'
      }
    }
    
    console.log(`⚠️ Búsqueda oficial: No se encontraron fuentes`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchStrategy: 'Official Legal Sources'
    }
    
  } catch (error) {
    console.log(`❌ Error búsqueda oficial: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchStrategy: 'Official Legal Sources',
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Búsqueda académica legal
async function searchAcademicLegal(query: string, numResults: number = 5): Promise<LegalSearchResponse> {
  console.log(`🎓 BÚSQUEDA ACADÉMICA LEGAL: "${query}"`)
  
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      throw new Error('SERPER_API_KEY no configurada')
    }
    
    // Query para fuentes académicas con términos legales
    const academicQuery = `${query} Colombia (${ACADEMIC_LEGAL_DOMAINS.map(domain => `site:${domain}`).join(' OR ')}) (investigación OR estudio OR análisis OR tesis OR artículo OR doctrina) -site:wikipedia.org -site:wikimedia.org -site:wikidata.org`
    
    const searchUrl = 'https://google.serper.dev/search'
    const requestBody = {
      q: academicQuery,
      num: numResults,
      apiKey: apiKey
    }
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`Serper API Error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.organic && data.organic.length > 0) {
      const results: LegalSearchResult[] = data.organic.map((item: any) => ({
        title: item.title || 'Sin título',
        url: item.link || '',
        snippet: item.snippet || item.description || 'Sin descripción',
        source: 'Serper Académico',
        type: classifyLegalSource(item.link || '', item.title || ''),
        relevance: calculateLegalRelevance(item.link || '', item.title || '', item.snippet || ''),
        jurisdiction: 'Colombia'
      }))
      
      // Ordenar por relevancia
      results.sort((a, b) => b.relevance - a.relevance)
      
      console.log(`✅ Búsqueda académica: ${results.length} fuentes encontradas`)
      return {
        success: true,
        query,
        results,
        sources: results.map(r => r.url),
        timestamp: new Date().toISOString(),
        searchStrategy: 'Academic Legal Sources'
      }
    }
    
    console.log(`⚠️ Búsqueda académica: No se encontraron fuentes`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchStrategy: 'Academic Legal Sources'
    }
    
  } catch (error) {
    console.log(`❌ Error búsqueda académica: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchStrategy: 'Academic Legal Sources',
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Búsqueda legal general (sin Wikipedia)
async function searchGeneralLegal(query: string, numResults: number = 5): Promise<LegalSearchResponse> {
  console.log(`🌐 BÚSQUEDA LEGAL GENERAL: "${query}"`)
  
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      throw new Error('SERPER_API_KEY no configurada')
    }
    
    // Query general con exclusión explícita de Wikipedia
    const generalQuery = `${query} Colombia (ley OR decreto OR sentencia OR jurisprudencia OR código OR artículo OR norma OR reglamento OR resolución) -site:wikipedia.org -site:wikimedia.org -site:wikidata.org`
    
    const searchUrl = 'https://google.serper.dev/search'
    const requestBody = {
      q: generalQuery,
      num: numResults,
      apiKey: apiKey
    }
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`Serper API Error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.organic && data.organic.length > 0) {
      const results: LegalSearchResult[] = data.organic.map((item: any) => ({
        title: item.title || 'Sin título',
        url: item.link || '',
        snippet: item.snippet || item.description || 'Sin descripción',
        source: 'Serper General',
        type: classifyLegalSource(item.link || '', item.title || ''),
        relevance: calculateLegalRelevance(item.link || '', item.title || '', item.snippet || ''),
        jurisdiction: 'Colombia'
      }))
      
      // Filtrar resultados de baja relevancia
      const filteredResults = results.filter(r => r.relevance >= 5)
      
      // Ordenar por relevancia
      filteredResults.sort((a, b) => b.relevance - a.relevance)
      
      console.log(`✅ Búsqueda general: ${filteredResults.length} fuentes encontradas (filtradas de ${results.length})`)
      return {
        success: true,
        query,
        results: filteredResults,
        sources: filteredResults.map(r => r.url),
        timestamp: new Date().toISOString(),
        searchStrategy: 'General Legal Sources'
      }
    }
    
    console.log(`⚠️ Búsqueda general: No se encontraron fuentes`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchStrategy: 'General Legal Sources'
    }
    
  } catch (error) {
    console.log(`❌ Error búsqueda general: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchStrategy: 'General Legal Sources',
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Función principal de búsqueda legal especializada
export async function searchLegalSpecialized(query: string, numResults: number = 5): Promise<LegalSearchResponse> {
  console.log(`\n⚖️ INICIANDO BÚSQUEDA LEGAL ESPECIALIZADA`)
  console.log(`📝 Query: "${query}"`)
  console.log(`🎯 Resultados deseados: ${numResults}`)
  console.log(`🚫 Wikipedia: COMPLETAMENTE EXCLUIDA`)
  console.log(`${'='.repeat(80)}`)
  
  const startTime = Date.now()
  
  // Estrategia 1: Fuentes oficiales (máxima prioridad)
  let result = await searchOfficialLegal(query, numResults)
  if (result.success && result.results.length > 0) {
    const duration = Date.now() - startTime
    console.log(`🎯 BÚSQUEDA EXITOSA - Fuentes Oficiales (${duration}ms)`)
    return result
  }
  
  // Estrategia 2: Fuentes académicas
  console.log(`🔄 Fuentes oficiales insuficientes, intentando académicas...`)
  result = await searchAcademicLegal(query, numResults)
  if (result.success && result.results.length > 0) {
    const duration = Date.now() - startTime
    console.log(`🎯 BÚSQUEDA EXITOSA - Fuentes Académicas (${duration}ms)`)
    return result
  }
  
  // Estrategia 3: Búsqueda general (sin Wikipedia)
  console.log(`🔄 Fuentes académicas insuficientes, intentando general...`)
  result = await searchGeneralLegal(query, numResults)
  if (result.success && result.results.length > 0) {
    const duration = Date.now() - startTime
    console.log(`🎯 BÚSQUEDA EXITOSA - Fuentes Generales (${duration}ms)`)
    return result
  }
  
  // Si todo falla
  const duration = Date.now() - startTime
  console.log(`❌ BÚSQUEDA FALLIDA - Todas las estrategias (${duration}ms)`)
  return {
    success: false,
    query,
    results: [],
    sources: [],
    timestamp: new Date().toISOString(),
    searchStrategy: 'All Strategies Failed',
    error: 'No se encontró información legal relevante en fuentes oficiales, académicas o generales. Wikipedia está completamente excluida.',
    note: 'Se intentaron búsquedas en fuentes oficiales colombianas, académicas especializadas y generales sin éxito. Todas las fuentes de Wikipedia fueron excluidas.'
  }
}

// Función para enriquecer resultados legales con Firecrawl
export async function enrichLegalResults(results: LegalSearchResult[], maxEnriched: number = 3): Promise<LegalSearchResult[]> {
  console.log(`📚 Enriqueciendo ${results.length} resultados legales (máximo ${maxEnriched})...`)
  
  const enriched: LegalSearchResult[] = []
  
  for (let i = 0; i < Math.min(results.length, maxEnriched); i++) {
    const result = results[i]
    
    try {
      // Usar Firecrawl para extraer contenido completo
      const { extractWithFirecrawl } = await import('./firecrawl-extractor')
      const extraction = await extractWithFirecrawl(result.url)
      
      if (extraction.success && extraction.content.length > 200) {
        enriched.push({
          ...result,
          snippet: extraction.content.substring(0, 2000) // Contenido completo
        })
        
        console.log(`✅ Enriquecido legal: ${result.title} (${extraction.content.length} caracteres)`)
      } else {
        enriched.push(result)
      }
    } catch (error) {
      console.log(`⚠️ Error enriqueciendo ${result.title}: ${error instanceof Error ? error.message : 'Unknown'}`)
      enriched.push(result)
    }
  }
  
  return enriched
}
