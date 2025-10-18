/**
 * Sistema de búsqueda web con fallback robusto
 * Intenta Serper primero, luego Google CSE como fallback
 */

import { searchWeb } from './web-search.js'

export interface RobustSearchResult {
  success: boolean
  query: string
  results: Array<{
    title: string
    url: string
    snippet: string
    score: number
    source: string
  }>
  timestamp: string
  searchEngine: 'serper' | 'google-cse' | 'fallback'
  error?: string
}

/**
 * Verifica si Serper está disponible
 */
async function checkSerperAvailability(): Promise<boolean> {
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      console.log(`⚠️ SERPER_API_KEY no configurada`)
      return false
    }

    // Hacer una prueba simple con Serper
    const testResponse = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: 'test',
        num: 1
      }),
      signal: AbortSignal.timeout(5000) // 5 segundos timeout
    })

    if (testResponse.ok) {
      console.log(`✅ Serper API disponible`)
      return true
    } else {
      console.log(`❌ Serper API no disponible: ${testResponse.status} ${testResponse.statusText}`)
      return false
    }
  } catch (error) {
    console.log(`❌ Error verificando Serper: ${error instanceof Error ? error.message : 'Unknown'}`)
    return false
  }
}

/**
 * Búsqueda con Serper API
 */
async function searchWithSerper(query: string, numResults: number = 5): Promise<RobustSearchResult> {
  console.log(`🔍 Buscando con Serper API: "${query}"`)
  
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      throw new Error('SERPER_API_KEY no configurada')
    }
    
    const searchUrl = 'https://google.serper.dev/search'
    const requestBody = {
      q: query,
      num: numResults
    }
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000) // 10 segundos timeout
    })
    
    if (!response.ok) {
      throw new Error(`Serper API Error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.organic && data.organic.length > 0) {
      const results = data.organic.map((item: any) => ({
        title: item.title || 'Sin título',
        url: item.link || '',
        snippet: item.snippet || item.description || 'Sin descripción',
        score: 1,
        source: 'Serper API'
      }))
      
      console.log(`✅ Serper API: ${results.length} resultados encontrados`)
      return {
        success: true,
        query,
        results,
        timestamp: new Date().toISOString(),
        searchEngine: 'serper'
      }
    }
    
    console.log(`⚠️ Serper API: No se encontraron resultados`)
    return {
      success: false,
      query,
      results: [],
      timestamp: new Date().toISOString(),
      searchEngine: 'serper'
    }
    
  } catch (error) {
    console.log(`❌ Serper API Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    throw error
  }
}

/**
 * Búsqueda con Google CSE como fallback
 */
async function searchWithGoogleCSE(query: string, numResults: number = 5): Promise<RobustSearchResult> {
  console.log(`🔄 Fallback: Buscando con Google CSE: "${query}"`)
  
  try {
    const searchResponse = await searchWeb(query, numResults)
    
    if (searchResponse.success && searchResponse.results && searchResponse.results.length > 0) {
      const results = searchResponse.results.map((item: any) => ({
        title: item.title || 'Sin título',
        url: item.url || '',
        snippet: item.snippet || 'Sin descripción',
        score: item.score || 1,
        source: 'Google CSE'
      }))
      
      console.log(`✅ Google CSE: ${results.length} resultados encontrados`)
      return {
        success: true,
        query,
        results,
        timestamp: new Date().toISOString(),
        searchEngine: 'google-cse'
      }
    }
    
    console.log(`⚠️ Google CSE: No se encontraron resultados`)
    return {
      success: false,
      query,
      results: [],
      timestamp: new Date().toISOString(),
      searchEngine: 'google-cse'
    }
    
  } catch (error) {
    console.log(`❌ Google CSE Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    throw error
  }
}

/**
 * Búsqueda robusta con fallback automático
 */
export async function searchWebRobust(query: string, numResults: number = 5): Promise<RobustSearchResult> {
  console.log(`\n🚀 INICIANDO BÚSQUEDA ROBUSTA`)
  console.log(`📝 Query: "${query}"`)
  console.log(`🎯 Resultados deseados: ${numResults}`)
  console.log(`${'='.repeat(60)}`)
  
  const startTime = Date.now()
  
  // Paso 1: Verificar disponibilidad de Serper
  const serperAvailable = await checkSerperAvailability()
  
  if (serperAvailable) {
    try {
      // Intentar con Serper primero
      const serperResult = await searchWithSerper(query, numResults)
      const duration = Date.now() - startTime
      console.log(`🎯 BÚSQUEDA EXITOSA - Serper API (${duration}ms)`)
      return serperResult
    } catch (error) {
      console.log(`⚠️ Serper falló, intentando Google CSE...`)
    }
  } else {
    console.log(`⚠️ Serper no disponible, usando Google CSE directamente...`)
  }
  
  // Paso 2: Fallback a Google CSE
  try {
    const googleResult = await searchWithGoogleCSE(query, numResults)
    const duration = Date.now() - startTime
    console.log(`🎯 BÚSQUEDA EXITOSA - Google CSE (${duration}ms)`)
    return googleResult
  } catch (error) {
    console.log(`❌ Google CSE también falló`)
  }
  
  // Paso 3: Fallback final - respuesta vacía
  const duration = Date.now() - startTime
  console.log(`❌ BÚSQUEDA FALLIDA - Todos los métodos (${duration}ms)`)
  
  return {
    success: false,
    query,
    results: [],
    timestamp: new Date().toISOString(),
    searchEngine: 'fallback',
    error: 'Todos los métodos de búsqueda fallaron'
  }
}

/**
 * Función de utilidad para formatear resultados
 */
export function formatRobustSearchResults(searchResult: RobustSearchResult): string {
  if (!searchResult.success || searchResult.results.length === 0) {
    return `No se encontraron resultados específicos en internet para esta consulta.
    
**Motor de búsqueda usado:** ${searchResult.searchEngine}
**Estado:** ${searchResult.error || 'Sin resultados'}`
  }

  const formattedResults = searchResult.results.map((result, index) => {
    return `${index + 1}. **${result.title}**
   URL: ${result.url}
   Contenido: ${result.snippet}
   Fuente: ${result.source}
   
`
  }).join('\n')

  return `**INFORMACIÓN ENCONTRADA EN INTERNET:**

${formattedResults}

**FUENTES CONSULTADAS:**
${searchResult.results.map((result, index) => `${index + 1}. [${result.title}](${result.url})`).join('\n')}

**Motor de búsqueda usado:** ${searchResult.searchEngine}`
}
