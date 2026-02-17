/**
 * Simple Web Search using Serper API
 * 
 * A lightweight web search for general queries without complex legal filtering.
 * Falls back gracefully on errors.
 */

export interface SimpleSearchResult {
  title: string
  url: string
  snippet: string
  type: 'official' | 'general'
}

export interface SimpleSearchResponse {
  success: boolean
  results: SimpleSearchResult[]
  error?: string
}

/**
 * Simple web search using Serper API
 * Works with any query, no complex filtering
 */
export async function simpleWebSearch(query: string, numResults: number = 5): Promise<SimpleSearchResponse> {
  console.log(`[WebSearch] Searching: "${query}"`)
  
  const apiKey = process.env.SERPER_API_KEY
  
  if (!apiKey) {
    console.warn('[WebSearch] No SERPER_API_KEY configured')
    return { success: false, results: [], error: 'No API key configured' }
  }
  
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: numResults
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`[WebSearch] API error: ${response.status} - ${errorText}`)
      return { 
        success: false, 
        results: [], 
        error: `API error: ${response.status}` 
      }
    }
    
    const data = await response.json()
    
    if (!data.organic || data.organic.length === 0) {
      console.log('[WebSearch] No results found')
      return { success: true, results: [] }
    }
    
    const results: SimpleSearchResult[] = data.organic.slice(0, numResults).map((item: any) => ({
      title: item.title || 'Sin título',
      url: item.link || '',
      snippet: item.snippet || item.description || '',
      type: item.link?.includes('.gov.co') ? 'official' : 'general'
    }))
    
    console.log(`[WebSearch] Found ${results.length} results`)
    return { success: true, results }
    
  } catch (error) {
    console.error('[WebSearch] Error:', error)
    return { 
      success: false, 
      results: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
