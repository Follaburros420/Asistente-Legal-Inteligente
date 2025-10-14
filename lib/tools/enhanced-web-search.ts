import { webSearchTool } from './web-search-tool'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
  timestamp: string
}

export interface EnhancedSearchResponse {
  query: string
  results: SearchResult[]
  totalResults: number
  searchTime: string
  sources: string[]
}

export class EnhancedWebSearch {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl
  }

  // Búsqueda usando DuckDuckGo (gratuita y sin API key)
  async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    try {
      // Usar DuckDuckGo Instant Answer API
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`)
      const data = await response.json()
      
      const results: SearchResult[] = []
      
      // Procesar resultados de DuckDuckGo
      if (data.Abstract) {
        results.push({
          title: data.Heading || 'Información General',
          url: data.AbstractURL || '',
          snippet: data.Abstract,
          source: 'DuckDuckGo',
          timestamp: new Date().toISOString()
        })
      }
      
      if (data.Answer) {
        results.push({
          title: 'Respuesta Directa',
          url: '',
          snippet: data.Answer,
          source: 'DuckDuckGo',
          timestamp: new Date().toISOString()
        })
      }
      
      if (data.Definition) {
        results.push({
          title: 'Definición',
          url: data.DefinitionURL || '',
          snippet: data.Definition,
          source: 'DuckDuckGo',
          timestamp: new Date().toISOString()
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
              timestamp: new Date().toISOString()
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

  // Búsqueda en Wikipedia (gratuita)
  async searchWikipedia(query: string, language: string = 'es'): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = []
      
      // Búsqueda de resumen de página
      const summaryUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
      const summaryResponse = await fetch(summaryUrl)
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        results.push({
          title: summaryData.title || query,
          url: summaryData.content_urls?.desktop?.page || '',
          snippet: summaryData.extract || summaryData.description || '',
          source: `Wikipedia (${language})`,
          timestamp: new Date().toISOString()
        })
      }
      
      // Búsqueda de páginas relacionadas
      const searchUrl = `https://${language}.wikipedia.org/api/rest_v1/page/search/${encodeURIComponent(query)}?limit=3`
      const searchResponse = await fetch(searchUrl)
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        if (searchData.pages) {
          searchData.pages.forEach((page: any) => {
            if (page.title !== query) { // Evitar duplicados
              results.push({
                title: page.title,
                url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
                snippet: page.snippet || page.description || '',
                source: `Wikipedia (${language})`,
                timestamp: new Date().toISOString()
              })
            }
          })
        }
      }
      
      return results
    } catch (error) {
      console.error('Wikipedia search error:', error)
      return []
    }
  }

  // Búsqueda de noticias usando DuckDuckGo
  async searchNews(query: string): Promise<SearchResult[]> {
    try {
      const newsQuery = `${query} noticias actualidad`
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(newsQuery)}&format=json&no_html=1&skip_disambig=1`)
      const data = await response.json()
      
      const results: SearchResult[] = []
      
      if (data.Abstract) {
        results.push({
          title: 'Noticias Recientes',
          url: data.AbstractURL || '',
          snippet: data.Abstract,
          source: 'DuckDuckGo Noticias',
          timestamp: new Date().toISOString()
        })
      }
      
      // Procesar temas relacionados que contengan "news" o "noticias"
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics
          .filter((topic: any) => 
            topic.Text?.toLowerCase().includes('news') || 
            topic.Text?.toLowerCase().includes('noticias') ||
            topic.FirstURL?.includes('news')
          )
          .slice(0, 3)
          .forEach((topic: any) => {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(' - ')[0] || 'Noticia',
                url: topic.FirstURL,
                snippet: topic.Text,
                source: 'DuckDuckGo Noticias',
                timestamp: new Date().toISOString()
              })
            }
          })
      }
      
      return results
    } catch (error) {
      console.error('News search error:', error)
      return []
    }
  }

  // Búsqueda completa que combina todas las fuentes
  async searchComprehensive(query: string, options: {
    includeNews?: boolean
    languages?: string[]
    maxResults?: number
  } = {}): Promise<EnhancedSearchResponse> {
    const {
      includeNews = true,
      languages = ['es', 'en'],
      maxResults = 10
    } = options

    const startTime = Date.now()
    const allResults: SearchResult[] = []
    const sources: string[] = []

    try {
      // Búsqueda en DuckDuckGo
      const ddgResults = await this.searchDuckDuckGo(query)
      allResults.push(...ddgResults)
      if (ddgResults.length > 0) sources.push('DuckDuckGo')

      // Búsqueda en Wikipedia (múltiples idiomas)
      for (const lang of languages) {
        const wikiResults = await this.searchWikipedia(query, lang)
        allResults.push(...wikiResults)
        if (wikiResults.length > 0) sources.push(`Wikipedia (${lang})`)
      }

      // Búsqueda de noticias si se solicita
      if (includeNews) {
        const newsResults = await this.searchNews(query)
        allResults.push(...newsResults)
        if (newsResults.length > 0) sources.push('Noticias')
      }

      // Limitar resultados y eliminar duplicados
      const uniqueResults = this.removeDuplicates(allResults).slice(0, maxResults)
      const searchTime = `${Date.now() - startTime}ms`

      return {
        query,
        results: uniqueResults,
        totalResults: uniqueResults.length,
        searchTime,
        sources: [...new Set(sources)]
      }

    } catch (error) {
      console.error('Comprehensive search error:', error)
      return {
        query,
        results: [],
        totalResults: 0,
        searchTime: `${Date.now() - startTime}ms`,
        sources: []
      }
    }
  }

  // Eliminar resultados duplicados
  private removeDuplicates(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return results.filter(result => {
      const key = `${result.title}-${result.url}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  // Formatear resultados para el asistente
  formatResultsForAssistant(response: EnhancedSearchResponse): string {
    if (response.results.length === 0) {
      return `🔍 **Búsqueda realizada para: "${response.query}"**\n\n❌ No se encontraron resultados relevantes.\n\n⏱️ **Tiempo de búsqueda:** ${response.searchTime}`
    }

    let formatted = `🔍 **Búsqueda realizada para: "${response.query}"**\n\n`
    formatted += `📊 **Resultados encontrados:** ${response.totalResults}\n`
    formatted += `🌐 **Fuentes consultadas:** ${response.sources.join(', ')}\n`
    formatted += `⏱️ **Tiempo de búsqueda:** ${response.searchTime}\n\n`

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
export const enhancedWebSearch = new EnhancedWebSearch()



