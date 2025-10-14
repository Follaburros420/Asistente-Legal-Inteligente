/**
 * Búsqueda web simple y confiable usando múltiples fuentes gratuitas
 */

export interface SimpleSearchResult {
  title: string
  url: string
  snippet: string
  source: string
  date?: string
}

export interface SimpleSearchResponse {
  query: string
  results: SimpleSearchResult[]
  totalResults: number
  searchTime: number
  sources: string[]
}

export class SimpleWebSearch {
  
  // Búsqueda usando DuckDuckGo (más confiable)
  async searchDuckDuckGo(query: string): Promise<SimpleSearchResult[]> {
    try {
      const results: SimpleSearchResult[] = []
      
      // Búsqueda básica
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`)
      const data = await response.json()
      
      if (data.Abstract) {
        results.push({
          title: data.Heading || 'Información General',
          url: data.AbstractURL || '',
          snippet: data.Abstract,
          source: 'DuckDuckGo',
          date: new Date().toISOString()
        })
      }
      
      if (data.Answer) {
        results.push({
          title: 'Respuesta Directa',
          url: '',
          snippet: data.Answer,
          source: 'DuckDuckGo',
          date: new Date().toISOString()
        })
      }
      
      if (data.Definition) {
        results.push({
          title: 'Definición',
          url: data.DefinitionURL || '',
          snippet: data.Definition,
          source: 'DuckDuckGo',
          date: new Date().toISOString()
        })
      }
      
      // Procesar temas relacionados
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 5).forEach((topic: any) => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Tema Relacionado',
              url: topic.FirstURL,
              snippet: topic.Text,
              source: 'DuckDuckGo',
              date: new Date().toISOString()
            })
          }
        })
      }
      
      return results
    } catch (error) {
      console.error('DuckDuckGo search error:', error)
      return []
    }
  }

  // Búsqueda en Wikipedia
  async searchWikipedia(query: string, language: string = 'es'): Promise<SimpleSearchResult[]> {
    try {
      const results: SimpleSearchResult[] = []
      
      // Búsqueda de resumen
      const summaryUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
      const summaryResponse = await fetch(summaryUrl)
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        results.push({
          title: summaryData.title || query,
          url: summaryData.content_urls?.desktop?.page || '',
          snippet: summaryData.extract || summaryData.description || '',
          source: `Wikipedia (${language})`,
          date: new Date().toISOString()
        })
      }
      
      return results
    } catch (error) {
      console.error('Wikipedia search error:', error)
      return []
    }
  }

  // Búsqueda usando Google Custom Search (si está disponible)
  async searchGoogle(query: string): Promise<SimpleSearchResult[]> {
    try {
      // Usar DuckDuckGo como alternativa a Google
      return this.searchDuckDuckGo(query)
    } catch (error) {
      console.error('Google search error:', error)
      return []
    }
  }

  // Búsqueda comprehensiva
  async searchComprehensive(query: string, options: {
    includeNews?: boolean
    languages?: string[]
    maxResults?: number
  } = {}): Promise<SimpleSearchResponse> {
    const startTime = Date.now()
    const {
      includeNews = false,
      languages = ['es', 'en'],
      maxResults = 8
    } = options

    const allResults: SimpleSearchResult[] = []
    const sources: string[] = []

    try {
      // Búsqueda en DuckDuckGo
      const ddgResults = await this.searchDuckDuckGo(query)
      allResults.push(...ddgResults)
      if (ddgResults.length > 0) sources.push('DuckDuckGo')

      // Búsqueda en Wikipedia
      for (const lang of languages) {
        const wikiResults = await this.searchWikipedia(query, lang)
        allResults.push(...wikiResults)
        if (wikiResults.length > 0) sources.push(`Wikipedia (${lang})`)
      }

      // Búsqueda de noticias si se solicita
      if (includeNews) {
        const newsQuery = `${query} noticias actualidad`
        const newsResults = await this.searchDuckDuckGo(newsQuery)
        allResults.push(...newsResults.map(result => ({
          ...result,
          source: `${result.source} - Noticias`
        })))
        if (newsResults.length > 0) sources.push('Noticias')
      }

      // Limitar resultados
      const finalResults = allResults.slice(0, maxResults)
      const searchTime = Date.now() - startTime

      return {
        query,
        results: finalResults,
        totalResults: finalResults.length,
        searchTime,
        sources: [...new Set(sources)]
      }

    } catch (error) {
      console.error('Comprehensive search error:', error)
      return {
        query,
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        sources: []
      }
    }
  }

  // Formatear resultados para Tongyi
  formatResultsForTongyi(response: SimpleSearchResponse): string {
    if (response.results.length === 0) {
      return `🔍 **Búsqueda realizada para: "${response.query}"**\n\n❌ No se encontraron resultados relevantes.\n\n⏱️ **Tiempo de búsqueda:** ${response.searchTime}ms`
    }

    let formatted = `🔍 **Búsqueda realizada para: "${response.query}"**\n\n`
    formatted += `📊 **Resultados encontrados:** ${response.totalResults}\n`
    formatted += `🌐 **Fuentes consultadas:** ${response.sources.join(', ')}\n`
    formatted += `⏱️ **Tiempo de búsqueda:** ${response.searchTime}ms\n\n`

    response.results.forEach((result, index) => {
      formatted += `**${index + 1}. ${result.title}**\n`
      formatted += `🔗 **Fuente:** ${result.source}\n`
      if (result.url) {
        formatted += `🌐 **URL:** ${result.url}\n`
      }
      formatted += `📝 **Información:** ${result.snippet}\n\n`
    })

    formatted += `---\n`
    formatted += `💡 **Nota:** Esta información ha sido obtenida de fuentes públicas y debe ser verificada para uso profesional.`

    return formatted
  }
}

// Instancia global
export const simpleWebSearch = new SimpleWebSearch()



