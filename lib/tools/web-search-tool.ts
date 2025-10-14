export interface WebSearchResult {
  query: string
  sources: {
    duckduckgo?: {
      abstract: string
      abstractText: string
      answer: string
      definition: string
      relatedTopics: any[]
      results: any[]
    }
    wikipedia?: {
      title: string
      extract: string
      description: string
      url: string
      language?: string
    }
    news?: {
      abstract: string
      relatedTopics: any[]
    }
  }
  timestamp: string
}

export class WebSearchTool {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl
  }

  async search(query: string, sources: string[] = ['duckduckgo', 'wikipedia']): Promise<WebSearchResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/search/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          sources
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Search failed')
      }

      return data.data
    } catch (error) {
      console.error('Web search error:', error)
      throw new Error(`Failed to perform web search: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async searchSimple(query: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/search?q=${encodeURIComponent(query)}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Simple search error:', error)
      throw new Error(`Failed to perform simple search: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  formatSearchResults(results: WebSearchResult): string {
    let formatted = `🔍 **Resultados de búsqueda para: "${results.query}"**\n\n`
    
    // DuckDuckGo results
    if (results.sources.duckduckgo) {
      const ddg = results.sources.duckduckgo
      formatted += `**📊 DuckDuckGo:**\n`
      
      if (ddg.abstract) {
        formatted += `- **Resumen:** ${ddg.abstract}\n`
      }
      
      if (ddg.abstractText) {
        formatted += `- **Descripción:** ${ddg.abstractText}\n`
      }
      
      if (ddg.answer) {
        formatted += `- **Respuesta:** ${ddg.answer}\n`
      }
      
      if (ddg.definition) {
        formatted += `- **Definición:** ${ddg.definition}\n`
      }
      
      if (ddg.relatedTopics && ddg.relatedTopics.length > 0) {
        formatted += `- **Temas relacionados:** ${ddg.relatedTopics.slice(0, 3).map((topic: any) => topic.Text || topic).join(', ')}\n`
      }
      
      formatted += `\n`
    }

    // Wikipedia results
    if (results.sources.wikipedia) {
      const wiki = results.sources.wikipedia
      formatted += `**📚 Wikipedia${wiki.language ? ` (${wiki.language})` : ''}:**\n`
      
      if (wiki.title) {
        formatted += `- **Título:** ${wiki.title}\n`
      }
      
      if (wiki.description) {
        formatted += `- **Descripción:** ${wiki.description}\n`
      }
      
      if (wiki.extract) {
        formatted += `- **Extracto:** ${wiki.extract.substring(0, 500)}${wiki.extract.length > 500 ? '...' : ''}\n`
      }
      
      if (wiki.url) {
        formatted += `- **URL:** ${wiki.url}\n`
      }
      
      formatted += `\n`
    }

    // News results
    if (results.sources.news) {
      const news = results.sources.news
      formatted += `**📰 Noticias:**\n`
      
      if (news.abstract) {
        formatted += `- **Resumen:** ${news.abstract}\n`
      }
      
      if (news.relatedTopics && news.relatedTopics.length > 0) {
        formatted += `- **Noticias relacionadas:** ${news.relatedTopics.slice(0, 2).map((topic: any) => topic.Text || topic).join(', ')}\n`
      }
      
      formatted += `\n`
    }

    formatted += `⏰ **Búsqueda realizada:** ${new Date(results.timestamp).toLocaleString('es-ES')}\n`
    
    return formatted
  }
}

// Instancia global de la herramienta
export const webSearchTool = new WebSearchTool()



