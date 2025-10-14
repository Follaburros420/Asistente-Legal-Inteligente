/**
 * Búsqueda web usando instancias públicas de SearxNG
 * SearxNG es un motor de búsqueda opensource que agrega múltiples fuentes
 */

export interface SearxResult {
  title: string
  url: string
  content: string
  engine: string
  score: number
}

export interface SearxSearchResponse {
  query: string
  results: SearxResult[]
  number_of_results: number
  results_time: number
}

export class SearxSearch {
  // Instancias públicas de SearxNG (gratuitas)
  private searxInstances = [
    'https://searx.be',
    'https://searx.tiekoetter.com',
    'https://searx.prvcy.eu',
    'https://search.sapti.me'
  ]

  private currentInstanceIndex = 0

  // Obtener la siguiente instancia disponible
  private getNextInstance(): string {
    const instance = this.searxInstances[this.currentInstanceIndex]
    this.currentInstanceIndex = (this.currentInstanceIndex + 1) % this.searxInstances.length
    return instance
  }

  // Realizar búsqueda usando SearxNG
  async search(query: string, options: {
    engines?: string[]
    categories?: string[]
    language?: string
    timeRange?: string
    maxResults?: number
  } = {}): Promise<SearxSearchResponse> {
    const {
      engines = ['google', 'bing', 'duckduckgo'],
      categories = ['general'],
      language = 'es',
      timeRange = '',
      maxResults = 10
    } = options

    const instance = this.getNextInstance()
    const searchUrl = new URL('/search', instance)
    
    // Parámetros de búsqueda
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('format', 'json')
    searchUrl.searchParams.set('engines', engines.join(','))
    searchUrl.searchParams.set('categories', categories.join(','))
    searchUrl.searchParams.set('language', language)
    searchUrl.searchParams.set('pageno', '1')
    
    if (timeRange) {
      searchUrl.searchParams.set('time_range', timeRange)
    }

    try {
      const response = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Procesar resultados
      const results: SearxResult[] = (data.results || [])
        .slice(0, maxResults)
        .map((result: any) => ({
          title: result.title || '',
          url: result.url || '',
          content: result.content || '',
          engine: result.engine || 'unknown',
          score: result.score || 0
        }))

      return {
        query,
        results,
        number_of_results: results.length,
        results_time: data.results_time || 0
      }

    } catch (error) {
      console.error('Searx search error:', error)
      
      // Intentar con la siguiente instancia
      if (this.currentInstanceIndex < this.searxInstances.length - 1) {
        return this.search(query, options)
      }
      
      throw error
    }
  }

  // Búsqueda de noticias
  async searchNews(query: string, language: string = 'es'): Promise<SearxSearchResponse> {
    return this.search(query, {
      engines: ['google', 'bing'],
      categories: ['news'],
      language,
      maxResults: 8
    })
  }

  // Búsqueda especializada en derecho
  async searchLegal(query: string, country: string = 'colombia'): Promise<SearxSearchResponse> {
    const legalQuery = `${query} derecho legal ${country}`
    return this.search(legalQuery, {
      engines: ['google', 'bing', 'duckduckgo'],
      categories: ['general'],
      language: 'es',
      maxResults: 10
    })
  }

  // Formatear resultados para Tongyi
  formatResultsForTongyi(response: SearxSearchResponse): string {
    if (response.results.length === 0) {
      return `🔍 **Búsqueda realizada para: "${response.query}"**\n\n❌ No se encontraron resultados relevantes.\n\n⏱️ **Tiempo de búsqueda:** ${response.results_time}ms`
    }

    let formatted = `🔍 **Búsqueda realizada para: "${response.query}"**\n\n`
    formatted += `📊 **Resultados encontrados:** ${response.number_of_results}\n`
    formatted += `⏱️ **Tiempo de búsqueda:** ${response.results_time}ms\n\n`

    response.results.forEach((result, index) => {
      formatted += `**${index + 1}. ${result.title}**\n`
      formatted += `🔗 **URL:** ${result.url}\n`
      formatted += `🔍 **Motor:** ${result.engine}\n`
      formatted += `📝 **Contenido:** ${result.content.substring(0, 300)}${result.content.length > 300 ? '...' : ''}\n\n`
    })

    formatted += `---\n`
    formatted += `💡 **Nota:** Esta información ha sido obtenida de múltiples motores de búsqueda y debe ser verificada para uso profesional.`

    return formatted
  }
}

// Instancia global
export const searxSearch = new SearxSearch()



