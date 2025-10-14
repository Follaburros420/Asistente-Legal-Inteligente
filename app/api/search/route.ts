import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query, type = 'web' } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Usar DuckDuckGo Instant Answer API (gratuita y no requiere API key)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    
    const response = await fetch(searchUrl)
    const data = await response.json()

    // También hacer búsqueda web con DuckDuckGo
    const webSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    
    // Para búsqueda web más completa, podemos usar una API alternativa
    // Por ahora, usaremos los resultados de DuckDuckGo Instant Answer
    
    const searchResults = {
      query,
      abstract: data.Abstract || '',
      abstractText: data.AbstractText || '',
      abstractURL: data.AbstractURL || '',
      answer: data.Answer || '',
      answerType: data.AnswerType || '',
      definition: data.Definition || '',
      definitionURL: data.DefinitionURL || '',
      entity: data.Entity || '',
      heading: data.Heading || '',
      image: data.Image || '',
      infobox: data.Infobox || {},
      redirect: data.Redirect || '',
      relatedTopics: data.RelatedTopics || [],
      results: data.Results || [],
      type: data.Type || '',
      webSearchUrl: webSearchUrl
    }

    return NextResponse.json({
      success: true,
      data: searchResults
    })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
}

// También crear un endpoint GET para búsquedas simples
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  try {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    
    const response = await fetch(searchUrl)
    const data = await response.json()

    return NextResponse.json({
      success: true,
      query,
      data
    })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
}



