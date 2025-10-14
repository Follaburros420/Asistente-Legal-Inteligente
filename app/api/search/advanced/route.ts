import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query, sources = ['duckduckgo', 'wikipedia'] } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const results = {
      query,
      sources: {},
      timestamp: new Date().toISOString()
    }

    // Búsqueda en DuckDuckGo
    if (sources.includes('duckduckgo')) {
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
        const ddgResponse = await fetch(ddgUrl)
        const ddgData = await ddgResponse.json()
        
        results.sources.duckduckgo = {
          abstract: ddgData.Abstract || '',
          abstractText: ddgData.AbstractText || '',
          answer: ddgData.Answer || '',
          definition: ddgData.Definition || '',
          relatedTopics: ddgData.RelatedTopics || [],
          results: ddgData.Results || []
        }
      } catch (error) {
        console.error('DuckDuckGo search error:', error)
        results.sources.duckduckgo = { error: 'Failed to fetch from DuckDuckGo' }
      }
    }

    // Búsqueda en Wikipedia
    if (sources.includes('wikipedia')) {
      try {
        const wikiUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
        const wikiResponse = await fetch(wikiUrl)
        
        if (wikiResponse.ok) {
          const wikiData = await wikiResponse.json()
          results.sources.wikipedia = {
            title: wikiData.title || '',
            extract: wikiData.extract || '',
            description: wikiData.description || '',
            url: wikiData.content_urls?.desktop?.page || ''
          }
        } else {
          // Si no encuentra en español, intentar en inglés
          const wikiUrlEn = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
          const wikiResponseEn = await fetch(wikiUrlEn)
          
          if (wikiResponseEn.ok) {
            const wikiDataEn = await wikiResponseEn.json()
            results.sources.wikipedia = {
              title: wikiDataEn.title || '',
              extract: wikiDataEn.extract || '',
              description: wikiDataEn.description || '',
              url: wikiDataEn.content_urls?.desktop?.page || '',
              language: 'en'
            }
          }
        }
      } catch (error) {
        console.error('Wikipedia search error:', error)
        results.sources.wikipedia = { error: 'Failed to fetch from Wikipedia' }
      }
    }

    // Búsqueda de noticias (usando DuckDuckGo News)
    if (sources.includes('news')) {
      try {
        const newsUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' news')}&format=json&no_html=1&skip_disambig=1`
        const newsResponse = await fetch(newsUrl)
        const newsData = await newsResponse.json()
        
        results.sources.news = {
          abstract: newsData.Abstract || '',
          relatedTopics: newsData.RelatedTopics?.filter((topic: any) => 
            topic.Text?.toLowerCase().includes('news') || 
            topic.FirstURL?.includes('news')
          ) || []
        }
      } catch (error) {
        console.error('News search error:', error)
        results.sources.news = { error: 'Failed to fetch news' }
      }
    }

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error) {
    console.error('Advanced search API error:', error)
    return NextResponse.json(
      { error: 'Failed to perform advanced search' },
      { status: 500 }
    )
  }
}



