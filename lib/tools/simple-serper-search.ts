/**
 * Sistema de búsqueda web simplificado con Serper
 * Evita queries complejas que pueden causar error 403
 */

export interface SimpleSearchResult {
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
  searchEngine: 'serper'
}

/**
 * Búsqueda simplificada con Serper
 */
export async function searchWithSerperSimple(query: string, numResults: number = 5): Promise<SimpleSearchResult> {
  console.log(`🔍 Buscando con Serper (simplificado): "${query}"`)
  
  try {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey || apiKey === 'your_serper_api_key_here') {
      throw new Error('SERPER_API_KEY no configurada')
    }
    
    // Query simplificada - solo agregar "Colombia" si no está presente
    let simpleQuery = query
    if (!query.toLowerCase().includes('colombia')) {
      simpleQuery = `${query} Colombia`
    }
    
    const searchUrl = 'https://google.serper.dev/search'
    const requestBody = {
      q: simpleQuery,
      num: numResults
    }
    
    console.log(`📝 Query simplificada: "${simpleQuery}"`)
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000) // 15 segundos timeout
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log(`❌ Serper Error ${response.status}: ${errorText}`)
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
      
      console.log(`✅ Serper: ${results.length} resultados encontrados`)
      return {
        success: true,
        query: simpleQuery,
        results,
        timestamp: new Date().toISOString(),
        searchEngine: 'serper'
      }
    }
    
    console.log(`⚠️ Serper: No se encontraron resultados`)
    return {
      success: false,
      query: simpleQuery,
      results: [],
      timestamp: new Date().toISOString(),
      searchEngine: 'serper'
    }
    
  } catch (error) {
    console.log(`❌ Serper Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    throw error
  }
}

/**
 * Función para formatear resultados simplificados
 */
export function formatSimpleSearchResults(searchResult: SimpleSearchResult): string {
  if (!searchResult.success || searchResult.results.length === 0) {
    return `No se encontraron resultados específicos en internet para esta consulta.
    
**Motor de búsqueda usado:** ${searchResult.searchEngine}
**Query:** ${searchResult.query}`
  }

  const formattedResults = searchResult.results.map((result, index) => {
    return `${index + 1}. **${result.title}**
   URL: ${result.url}
   Contenido: ${result.snippet}
   
`
  }).join('\n')

  return `**INFORMACIÓN ENCONTRADA EN INTERNET:**

${formattedResults}

**FUENTES CONSULTADAS:**
${searchResult.results.map((result, index) => `${index + 1}. [${result.title}](${result.url})`).join('\n')}

**Motor de búsqueda usado:** ${searchResult.searchEngine}
**Query:** ${searchResult.query}`
}
