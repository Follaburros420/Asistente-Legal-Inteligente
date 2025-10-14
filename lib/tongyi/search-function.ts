/**
 * Función de búsqueda web para Tongyi Deep Research
 * Esta función puede ser llamada directamente por Tongyi para obtener información actualizada
 */

export interface SearchOptions {
  includeNews?: boolean
  languages?: string[]
  maxResults?: number
}

export interface SearchFunctionResult {
  success: boolean
  query: string
  results: string
  sources: string[]
  searchTime: string
  error?: string
}

/**
 * Función de búsqueda web que Tongyi puede usar
 * @param query - Consulta de búsqueda
 * @param options - Opciones de búsqueda
 * @returns Resultados formateados para Tongyi
 */
export async function searchWebForTongyi(
  query: string, 
  options: SearchOptions = {}
): Promise<SearchFunctionResult> {
  try {
    const {
      includeNews = true,
      languages = ['es', 'en'],
      maxResults = 10
    } = options

    // Llamar a nuestra API de búsqueda
    const response = await fetch('http://localhost:3000/api/tongyi/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        options: {
          includeNews,
          languages,
          maxResults
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Search failed')
    }

    return {
      success: true,
      query,
      results: data.results,
      sources: data.rawData.sources || [],
      searchTime: data.rawData.searchTime || 'unknown'
    }

  } catch (error) {
    console.error('Search function error:', error)
    return {
      success: false,
      query,
      results: '',
      sources: [],
      searchTime: '0ms',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Función especializada para búsquedas legales
 * @param query - Consulta legal
 * @param country - País (default: colombia)
 * @param type - Tipo de búsqueda (general, jurisprudencia, leyes, doctrina)
 */
export async function searchLegalForTongyi(
  query: string,
  country: string = 'colombia',
  type: 'general' | 'jurisprudencia' | 'leyes' | 'doctrina' = 'general'
): Promise<SearchFunctionResult> {
  try {
    // Construir consulta especializada
    let specializedQuery = query
    
    switch (type) {
      case 'jurisprudencia':
        specializedQuery = `${query} jurisprudencia ${country} sentencias corte suprema`
        break
      case 'leyes':
        specializedQuery = `${query} ley ${country} código legal legislación`
        break
      case 'doctrina':
        specializedQuery = `${query} doctrina legal ${country} derecho`
        break
      default:
        specializedQuery = `${query} derecho legal ${country}`
    }

    // Realizar búsqueda
    const result = await searchWebForTongyi(specializedQuery, {
      includeNews: type === 'general',
      languages: ['es', 'en'],
      maxResults: 8
    })

    if (result.success) {
      // Agregar contexto legal al resultado
      result.results = `⚖️ **BÚSQUEDA LEGAL ESPECIALIZADA**\n\n` +
        `🔍 **Consulta:** "${query}"\n` +
        `🌍 **País:** ${country}\n` +
        `📋 **Tipo:** ${type}\n\n` +
        result.results +
        `\n\n💡 **Recomendaciones:**\n` +
        `- Verifica la vigencia de la legislación\n` +
        `- Consulta fuentes oficiales para información crítica\n` +
        `- Considera la jurisprudencia más reciente\n`
    }

    return result

  } catch (error) {
    console.error('Legal search function error:', error)
    return {
      success: false,
      query,
      results: '',
      sources: [],
      searchTime: '0ms',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Función para búsquedas de actualidad y noticias
 * @param query - Consulta sobre actualidad
 */
export async function searchCurrentEventsForTongyi(
  query: string
): Promise<SearchFunctionResult> {
  try {
    const result = await searchWebForTongyi(query, {
      includeNews: true,
      languages: ['es', 'en'],
      maxResults: 8
    })

    if (result.success) {
      // Agregar contexto de actualidad
      result.results = `📰 **BÚSQUEDA DE ACTUALIDAD**\n\n` +
        `🔍 **Consulta:** "${query}"\n` +
        `📅 **Fecha:** ${new Date().toLocaleDateString('es-ES')}\n\n` +
        result.results +
        `\n\n⚠️ **Nota:** La información de actualidad puede cambiar rápidamente. Verifica las fuentes más recientes.`
    }

    return result

  } catch (error) {
    console.error('Current events search function error:', error)
    return {
      success: false,
      query,
      results: '',
      sources: [],
      searchTime: '0ms',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Exportar funciones para uso directo
export const tongyiSearchFunctions = {
  searchWeb: searchWebForTongyi,
  searchLegal: searchLegalForTongyi,
  searchCurrentEvents: searchCurrentEventsForTongyi
}



