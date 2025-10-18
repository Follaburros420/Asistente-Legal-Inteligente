/**
 * Sistema de Búsqueda Web Multinivel Mejorado
 * Implementa 4 niveles de búsqueda con fallbacks inteligentes
 * Resuelve el problema de dependencia de Wikipedia
 */

import { analyzeQuery, generateSearchStrategies } from './smart-query-normalizer'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  score?: number
  source?: string
  type?: 'official' | 'academic' | 'news' | 'general' | 'wikipedia'
}

export interface EnhancedSearchResponse {
  success: boolean
  query: string
  results: SearchResult[]
  sources: string[]
  timestamp: string
  searchLevel?: string
  error?: string
  note?: string
}

// Nivel 1: Fuentes oficiales colombianas
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

// Nivel 2: Fuentes académicas
const ACADEMIC_DOMAINS = [
  '.edu.co',
  'uexternado.edu.co',
  'unal.edu.co',
  'javeriana.edu.co',
  'losandes.edu.co',
  'icesi.edu.co',
  'scholar.google.com',
  'researchgate.net',
  'academia.edu',
  'scielo.org',
  'redalyc.org'
]

// Nivel 3: Fuentes de noticias y medios confiables
const NEWS_DOMAINS = [
  'eltiempo.com',
  'elespectador.com',
  'semana.com',
  'portafolio.co',
  'larepublica.co',
  'bbc.com',
  'reuters.com',
  'elpais.com',
  'elnacional.com'
]

// Dominios a evitar (prioridad baja)
const LOW_PRIORITY_DOMAINS = [
  'wikipedia.org',
  'wikimedia.org',
  'wikidata.org'
]

// Función para clasificar el tipo de fuente
const classifySource = (url: string, title: string): 'official' | 'academic' | 'news' | 'general' | 'wikipedia' => {
  const urlLower = url.toLowerCase()
  const titleLower = title.toLowerCase()
  
  if (urlLower.includes('wikipedia.org') || titleLower.includes('wikipedia')) {
    return 'wikipedia'
  }
  
  if (OFFICIAL_DOMAINS.some(domain => urlLower.includes(domain))) {
    return 'official'
  }
  
  if (ACADEMIC_DOMAINS.some(domain => urlLower.includes(domain))) {
    return 'academic'
  }
  
  if (NEWS_DOMAINS.some(domain => urlLower.includes(domain))) {
    return 'news'
  }
  
  return 'general'
}

// Función para calcular puntuación de fuente
const calculateSourceScore = (url: string, title: string): number => {
  const type = classifySource(url, title)
  
  switch (type) {
    case 'official': return 5
    case 'academic': return 4
    case 'news': return 3
    case 'general': return 2
    case 'wikipedia': return 1
    default: return 1
  }
}

// Función para hacer peticiones HTTP con timeout
const makeHTTPRequest = async (url: string, timeout: number = 10000): Promise<string> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AsistenteLegal/1.0)',
        'Accept': 'application/json, text/plain, */*'
      }
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return await response.text()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Nivel 1: Búsqueda en Serper API (fuentes oficiales)
async function searchLevel1_Official(query: string, numResults: number = 5): Promise<EnhancedSearchResponse> {
  console.log(`🏛️ NIVEL 1: Buscando en fuentes oficiales colombianas con Serper...`)
  
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      throw new Error('SERPER_API_KEY no configurada')
    }
    
    // Construir query especializada para fuentes oficiales con más dominios legales
    const officialQuery = `${query} Colombia (site:gov.co OR site:secretariasenado.gov.co OR site:corteconstitucional.gov.co OR site:suin-juriscol.gov.co OR site:consejodeestado.gov.co OR site:cortesuprema.gov.co OR site:imprenta.gov.co OR site:funcionpublica.gov.co OR site:ramajudicial.gov.co OR site:procuraduria.gov.co OR site:contraloria.gov.co OR site:fiscalia.gov.co OR site:defensoria.gov.co)`
    
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
      const results: SearchResult[] = data.organic.map((item: any) => ({
        title: item.title || 'Sin título',
        url: item.link || '',
        snippet: item.snippet || item.description || 'Sin descripción',
        score: calculateSourceScore(item.link || '', item.title || ''),
        source: 'Serper Oficial',
        type: classifySource(item.link || '', item.title || '')
      }))
      
      console.log(`✅ Nivel 1: ${results.length} fuentes oficiales encontradas`)
      return {
        success: true,
        query,
        results,
        sources: results.map(r => r.url),
        timestamp: new Date().toISOString(),
        searchLevel: 'Official Sources'
      }
    }
    
    console.log(`⚠️ Nivel 1: No se encontraron fuentes oficiales`)
    return { success: false, query, results: [], sources: [], timestamp: new Date().toISOString(), searchLevel: 'Official Sources' }
    
  } catch (error) {
    console.log(`❌ Nivel 1 Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchLevel: 'Official Sources',
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Nivel 2: Búsqueda académica y especializada con Serper
async function searchLevel2_Academic(query: string, numResults: number = 5): Promise<EnhancedSearchResponse> {
  console.log(`🎓 NIVEL 2: Buscando en fuentes académicas con Serper...`)
  
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      throw new Error('SERPER_API_KEY no configurada')
    }
    
    // Query para fuentes académicas con más dominios especializados
    const academicQuery = `${query} Colombia (site:edu.co OR site:scholar.google.com OR site:scielo.org OR site:researchgate.net OR site:academia.edu OR site:redalyc.org OR site:uexternado.edu.co OR site:unal.edu.co OR site:javeriana.edu.co OR site:losandes.edu.co OR site:icesi.edu.co)`
    
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
      const results: SearchResult[] = data.organic.map((item: any) => ({
        title: item.title || 'Sin título',
        url: item.link || '',
        snippet: item.snippet || item.description || 'Sin descripción',
        score: calculateSourceScore(item.link || '', item.title || ''),
        source: 'Serper Académico',
        type: classifySource(item.link || '', item.title || '')
      }))
      
      console.log(`✅ Nivel 2: ${results.length} fuentes académicas encontradas`)
      return {
        success: true,
        query,
        results,
        sources: results.map(r => r.url),
        timestamp: new Date().toISOString(),
        searchLevel: 'Academic Sources'
      }
    }
    
    console.log(`⚠️ Nivel 2: No se encontraron fuentes académicas`)
    return { success: false, query, results: [], sources: [], timestamp: new Date().toISOString(), searchLevel: 'Academic Sources' }
    
  } catch (error) {
    console.log(`❌ Nivel 2 Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchLevel: 'Academic Sources',
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Nivel 3: Búsqueda legal especializada con Serper (sin Wikipedia)
async function searchLevel3_LegalSpecialized(query: string, numResults: number = 5): Promise<EnhancedSearchResponse> {
  console.log(`⚖️ NIVEL 3: Búsqueda legal especializada con Serper (sin Wikipedia)...`)
  
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      throw new Error('SERPER_API_KEY no configurada')
    }
    
    // Query especializada para consultas legales con exclusiones específicas
    const legalQuery = `${query} Colombia -site:wikipedia.org -site:wikimedia.org -site:wikidata.org (ley OR decreto OR sentencia OR jurisprudencia OR código OR artículo OR norma OR reglamento OR resolución)`
    
    const searchUrl = 'https://google.serper.dev/search'
    const requestBody = {
      q: legalQuery,
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
      const results: SearchResult[] = data.organic.map((item: any) => ({
        title: item.title || 'Sin título',
        url: item.link || '',
        snippet: item.snippet || item.description || 'Sin descripción',
        score: calculateSourceScore(item.link || '', item.title || ''),
        source: 'Serper Legal',
        type: classifySource(item.link || '', item.title || '')
      }))
      
      console.log(`✅ Nivel 3: ${results.length} fuentes legales especializadas encontradas`)
      return {
        success: true,
        query,
        results,
        sources: results.map(r => r.url),
        timestamp: new Date().toISOString(),
        searchLevel: 'Legal Specialized'
      }
    }
    
    console.log(`⚠️ Nivel 3: No se encontraron fuentes legales especializadas`)
    return { success: false, query, results: [], sources: [], timestamp: new Date().toISOString(), searchLevel: 'Legal Specialized' }
    
  } catch (error) {
    console.log(`❌ Nivel 3 Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchLevel: 'Legal Specialized',
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Nivel 4: Búsqueda web general con DuckDuckGo (sin API key)
async function searchLevel4_General(query: string, numResults: number = 5): Promise<EnhancedSearchResponse> {
  console.log(`🌐 NIVEL 4: Buscando en web general (DuckDuckGo)...`)
  
  try {
    // DuckDuckGo Instant Answer API (gratuito, no requiere API key)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    
    const response = await makeHTTPRequest(searchUrl)
    const data = JSON.parse(response)
    
    const results: SearchResult[] = []
    
    // Procesar Abstract (respuesta principal)
    if (data.Abstract && data.AbstractURL && data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.AbstractText,
        score: 3,
        source: 'DuckDuckGo Abstract',
        type: classifySource(data.AbstractURL, data.Heading || query)
      })
    }
    
    // Procesar Related Topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, numResults - 1).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || 'Sin título',
            url: topic.FirstURL,
            snippet: topic.Text,
            score: 2,
            source: 'DuckDuckGo Related',
            type: classifySource(topic.FirstURL, topic.Text)
          })
        }
      })
    }
    
    if (results.length > 0) {
      console.log(`✅ Nivel 3: ${results.length} fuentes generales encontradas`)
      return {
        success: true,
        query,
        results,
        sources: results.map(r => r.url),
        timestamp: new Date().toISOString(),
        searchLevel: 'General Web'
      }
    }
    
    console.log(`⚠️ Nivel 3: No se encontraron fuentes generales`)
    return { success: false, query, results: [], sources: [], timestamp: new Date().toISOString(), searchLevel: 'General Web' }
    
  } catch (error) {
    console.log(`❌ Nivel 3 Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchLevel: 'General Web',
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Nivel 5: Búsqueda con Firecrawl para contenido profundo
async function searchLevel5_FirecrawlDeep(query: string, numResults: number = 3): Promise<EnhancedSearchResponse> {
  console.log(`🔥 NIVEL 5: Búsqueda profunda con Firecrawl...`)
  
  try {
    const { searchWithFirecrawl } = await import('./firecrawl-extractor')
    
    const firecrawlResult = await searchWithFirecrawl(query, numResults)
    
    if (firecrawlResult.success && firecrawlResult.results.length > 0) {
      const results: SearchResult[] = firecrawlResult.results.map((item: any) => ({
        title: item.title || 'Sin título',
        url: item.url || '',
        snippet: item.content.substring(0, 1000),
        score: calculateSourceScore(item.url || '', item.title || ''),
        source: 'Firecrawl Deep',
        type: classifySource(item.url || '', item.title || '')
      }))
      
      console.log(`✅ Nivel 5: ${results.length} fuentes profundas encontradas con Firecrawl`)
      return {
        success: true,
        query,
        results,
        sources: results.map(r => r.url),
        timestamp: new Date().toISOString(),
        searchLevel: 'Firecrawl Deep',
        note: 'Extracción profunda de contenido con Firecrawl v2'
      }
    }
    
    console.log(`⚠️ Nivel 5: No se encontraron fuentes con Firecrawl`)
    return { success: false, query, results: [], sources: [], timestamp: new Date().toISOString(), searchLevel: 'Firecrawl Deep' }
    
  } catch (error) {
    console.log(`❌ Nivel 5 Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      sources: [], 
      timestamp: new Date().toISOString(),
      searchLevel: 'Firecrawl Deep',
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Función principal de búsqueda multinivel
export async function searchWebEnhanced(query: string, numResults: number = 5): Promise<EnhancedSearchResponse> {
  console.log(`\n🚀 INICIANDO BÚSQUEDA MULTINIVEL MEJORADA`)
  console.log(`📝 Query original: "${query}"`)
  console.log(`🎯 Resultados deseados: ${numResults}`)
  console.log(`${'='.repeat(80)}`)
  
  const startTime = Date.now()
  
  // Paso 1: Analizar la consulta con el normalizador inteligente
  const analysis = analyzeQuery(query)
  console.log(`🧠 ANÁLISIS INTELIGENTE DE CONSULTA:`)
  console.log(`   📝 Tipo: ${analysis.queryType}`)
  console.log(`   🎯 Confianza: ${(analysis.confidence * 100).toFixed(1)}%`)
  console.log(`   📋 Estrategia: ${analysis.strategy}`)
  console.log(`   🌐 Idioma: ${analysis.language}`)
  console.log(`   📊 Complejidad: ${analysis.complexity}`)
  console.log(`   🔍 Keywords: ${analysis.keywords.join(', ')}`)
  if (analysis.entities.length > 0) {
    console.log(`   📋 Entidades: ${analysis.entities.join(', ')}`)
  }
  
  // Paso 2: Generar estrategias de búsqueda específicas
  const searchStrategies = generateSearchStrategies(analysis)
  console.log(`\n🎯 ESTRATEGIAS DE BÚSQUEDA GENERADAS (${searchStrategies.length}):`)
  searchStrategies.forEach((strategy, i) => {
    console.log(`   ${i + 1}. ${strategy}`)
  })
  
  // Usar la query normalizada para las búsquedas
  const searchQuery = analysis.normalizedQuery
  console.log(`\n🔍 QUERY NORMALIZADA: "${searchQuery}"`)
  
  // Paso 3: Ejecutar búsqueda según la estrategia determinada
  let result: EnhancedSearchResponse | null = null
  
  if (analysis.strategy === 'official-first') {
    console.log(`\n🏛️ ESTRATEGIA: Priorizando fuentes oficiales...`)
    result = await searchLevel1_Official(searchQuery, numResults)
    if (!result.success && analysis.confidence > 0.7) {
      console.log(`⚠️ Alta confianza legal, intentando fuentes académicas...`)
      result = await searchLevel2_Academic(searchQuery, numResults)
    }
  } else if (analysis.strategy === 'academic-first') {
    console.log(`\n🎓 ESTRATEGIA: Priorizando fuentes académicas...`)
    result = await searchLevel2_Academic(searchQuery, numResults)
  } else if (analysis.strategy === 'general-first') {
    console.log(`\n🌐 ESTRATEGIA: Priorizando búsqueda general...`)
    result = await searchLevel4_General(searchQuery, numResults)
  }
  
  // Si la estrategia principal no funciona, continuar con los niveles restantes
  if (!result || !result.success) {
    console.log(`\n🔄 Continuando con niveles restantes...`)
    
    // Nivel 1: Fuentes oficiales colombianas
    if (!result) {
      result = await searchLevel1_Official(searchQuery, numResults)
    }
    
    if (result && result.success) {
      const duration = Date.now() - startTime
      console.log(`🎯 BÚSQUEDA EXITOSA - Nivel 1 (${duration}ms)`)
      return {
        ...result,
        searchLevel: `${result.searchLevel} (Strategy: ${analysis.strategy})`
      }
    }
    
    // Nivel 2: Fuentes académicas
    result = await searchLevel2_Academic(searchQuery, numResults)
    if (result && result.success) {
      const duration = Date.now() - startTime
      console.log(`🎯 BÚSQUEDA EXITOSA - Nivel 2 (${duration}ms)`)
      return {
        ...result,
        searchLevel: `${result.searchLevel} (Strategy: ${analysis.strategy})`
      }
    }
    
    // Nivel 3: Búsqueda legal especializada
    result = await searchLevel3_LegalSpecialized(searchQuery, numResults)
    if (result && result.success) {
      const duration = Date.now() - startTime
      console.log(`🎯 BÚSQUEDA EXITOSA - Nivel 3 (${duration}ms)`)
      return {
        ...result,
        searchLevel: `${result.searchLevel} (Strategy: ${analysis.strategy})`
      }
    }
    
    // Nivel 4: Web general (DuckDuckGo)
    result = await searchLevel4_General(searchQuery, numResults)
    if (result && result.success) {
      const duration = Date.now() - startTime
      console.log(`🎯 BÚSQUEDA EXITOSA - Nivel 4 (${duration}ms)`)
      return {
        ...result,
        searchLevel: `${result.searchLevel} (Strategy: ${analysis.strategy})`
      }
    }
    
    // Nivel 5: Búsqueda profunda con Firecrawl
    result = await searchLevel5_FirecrawlDeep(searchQuery, numResults)
    const duration = Date.now() - startTime
    
    if (result && result.success) {
      console.log(`🎯 BÚSQUEDA EXITOSA - Nivel 5 (${duration}ms)`)
      return {
        ...result,
        searchLevel: `${result.searchLevel} (Strategy: ${analysis.strategy})`
      }
    }
  } else {
    // La estrategia principal funcionó
    const duration = Date.now() - startTime
    console.log(`✅ ESTRATEGIA PRINCIPAL EXITOSA (${duration}ms)`)
    return {
      ...result,
      searchLevel: `${result.searchLevel} (Strategy: ${analysis.strategy})`
    }
  }
  
  // Si todo falla
  console.log(`❌ BÚSQUEDA FALLIDA - Todos los niveles (${Date.now() - startTime}ms)`)
  return {
    success: false,
    query,
    results: [],
    sources: [],
    timestamp: new Date().toISOString(),
    searchLevel: `Failed (Strategy: ${analysis.strategy})`,
    error: 'No se encontró información en ninguna fuente después de agotar todos los niveles de búsqueda',
    note: `Análisis: ${analysis.queryType} (confianza: ${(analysis.confidence * 100).toFixed(1)}%). Se intentaron búsqueda en fuentes oficiales, académicas, legales especializadas, web general y Firecrawl sin éxito. Wikipedia está completamente excluida.`
  }
}

// Función para enriquecer resultados con contenido completo
export async function enrichSearchResults(results: SearchResult[], maxEnriched: number = 3): Promise<SearchResult[]> {
  console.log(`📚 Enriqueciendo ${results.length} resultados (máximo ${maxEnriched})...`)
  
  const enriched: SearchResult[] = []
  
  for (let i = 0; i < Math.min(results.length, maxEnriched); i++) {
    const result = results[i]
    
    try {
      // Usar Jina AI Reader para extraer contenido completo
      const jinaUrl = `https://r.jina.ai/${result.url}`
      const content = await makeHTTPRequest(jinaUrl, 8000)
      
      if (content && content.length > 200) {
        // Extraer el contenido relevante
        const lines = content.split('\n')
        const cleanContent = lines
          .filter(line => !line.startsWith('URL Source:') && !line.startsWith('Published Time:') && !line.startsWith('Markdown Content:'))
          .join('\n')
          .substring(0, 2000)
        
        enriched.push({
          ...result,
          snippet: cleanContent
        })
        
        console.log(`✅ Enriquecido: ${result.title} (${cleanContent.length} caracteres)`)
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
