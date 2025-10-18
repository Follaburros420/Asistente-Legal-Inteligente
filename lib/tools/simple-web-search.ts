/**
 * Sistema de Búsqueda Web Simplificado
 * Solo prohíbe Wikipedia, permite todas las demás fuentes
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
  score?: number
  source?: string
}

export interface SimpleSearchResponse {
  success: boolean
  query: string
  results: SearchResult[]
  timestamp: string
  error?: string
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

// Función para filtrar Wikipedia
const filterWikipedia = (results: SearchResult[]): SearchResult[] => {
  return results.filter(result => {
    const urlLower = result.url.toLowerCase()
    const titleLower = result.title.toLowerCase()
    
    // Filtrar cualquier resultado de Wikipedia
    if (urlLower.includes('wikipedia.org') || titleLower.includes('wikipedia')) {
      console.log(`🚫 Filtrando resultado de Wikipedia: ${result.title}`)
      return false
    }
    
    return true
  })
}

// Búsqueda con Serper API
async function searchWithSerper(query: string, numResults: number = 5): Promise<SimpleSearchResponse> {
  console.log(`🔍 Buscando con Serper API: "${query}"`)
  
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      throw new Error('SERPER_API_KEY no configurada')
    }
    
    const searchUrl = 'https://google.serper.dev/search'
    const requestBody = {
      q: query,
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
        score: 1,
        source: 'Serper API'
      }))
      
      // Filtrar Wikipedia
      const filteredResults = filterWikipedia(results)
      
      console.log(`✅ Serper API: ${filteredResults.length} resultados (filtrados de ${results.length})`)
      return {
        success: true,
        query,
        results: filteredResults,
        timestamp: new Date().toISOString()
      }
    }
    
    console.log(`⚠️ Serper API: No se encontraron resultados`)
    return { success: false, query, results: [], timestamp: new Date().toISOString() }
    
  } catch (error) {
    console.log(`❌ Serper API Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Búsqueda con DuckDuckGo (fallback)
async function searchWithDuckDuckGo(query: string, numResults: number = 5): Promise<SimpleSearchResponse> {
  console.log(`🦆 Buscando con DuckDuckGo: "${query}"`)
  
  try {
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
        score: 1,
        source: 'DuckDuckGo Abstract'
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
            score: 1,
            source: 'DuckDuckGo Related'
          })
        }
      })
    }
    
    // Filtrar Wikipedia
    const filteredResults = filterWikipedia(results)
    
    if (filteredResults.length > 0) {
      console.log(`✅ DuckDuckGo: ${filteredResults.length} resultados (filtrados de ${results.length})`)
      return {
        success: true,
        query,
        results: filteredResults,
        timestamp: new Date().toISOString()
      }
    }
    
    console.log(`⚠️ DuckDuckGo: No se encontraron resultados`)
    return { success: false, query, results: [], timestamp: new Date().toISOString() }
    
  } catch (error) {
    console.log(`❌ DuckDuckGo Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      query, 
      results: [], 
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown'
    }
  }
}

// Función principal de búsqueda simplificada
export async function searchWebSimple(query: string, numResults: number = 5): Promise<SimpleSearchResponse> {
  console.log(`\n🚀 BÚSQUEDA WEB SIMPLIFICADA (SIN WIKIPEDIA)`)
  console.log(`📝 Query: "${query}"`)
  console.log(`🎯 Resultados deseados: ${numResults}`)
  console.log(`${'='.repeat(60)}`)
  
  const startTime = Date.now()
  
  // Primero intentar con Serper API
  let serperResult = await searchWithSerper(query, numResults)
  if (serperResult.success && serperResult.results.length > 0) {
    const duration = Date.now() - startTime
    console.log(`🎯 BÚSQUEDA EXITOSA - Serper API (${duration}ms)`)
    return serperResult
  }
  
  // Si Serper falla, intentar con DuckDuckGo
  console.log(`🔄 Serper API falló, intentando DuckDuckGo...`)
  let duckResult = await searchWithDuckDuckGo(query, numResults)
  if (duckResult.success && duckResult.results.length > 0) {
    const duration = Date.now() - startTime
    console.log(`🎯 BÚSQUEDA EXITOSA - DuckDuckGo (${duration}ms)`)
    return duckResult
  }
  
  // Si todo falla
  const duration = Date.now() - startTime
  console.log(`❌ BÚSQUEDA FALLIDA - Todos los motores (${duration}ms)`)
  return {
    success: false,
    query,
    results: [],
    timestamp: new Date().toISOString(),
    error: 'No se encontró información en ningún motor de búsqueda (Wikipedia está filtrada)'
  }
}

// Función para enriquecer resultados con contenido completo
export async function enrichSimpleResults(results: SearchResult[], maxEnriched: number = 3): Promise<SearchResult[]> {
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
