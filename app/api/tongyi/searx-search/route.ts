import { NextRequest, NextResponse } from 'next/server'
import { searxSearch } from '@/lib/tools/searx-search'

export async function POST(request: NextRequest) {
  try {
    const { query, type = 'general', options = {} } = await request.json()

    if (!query) {
      return NextResponse.json({
        error: 'Query is required',
        usage: {
          description: 'Búsqueda web usando SearxNG (motor de búsqueda opensource)',
          parameters: {
            query: 'string - Consulta de búsqueda (requerido)',
            type: 'string - Tipo de búsqueda: general, news, legal (default: general)',
            options: {
              engines: 'array - Motores de búsqueda (default: google, bing, duckduckgo)',
              language: 'string - Idioma (default: es)',
              maxResults: 'number - Máximo de resultados (default: 10)'
            }
          }
        }
      }, { status: 400 })
    }

    let searchResponse

    // Realizar búsqueda según el tipo
    switch (type) {
      case 'news':
        searchResponse = await searxSearch.searchNews(query, options.language || 'es')
        break
      case 'legal':
        searchResponse = await searxSearch.searchLegal(query, options.country || 'colombia')
        break
      default:
        searchResponse = await searxSearch.search(query, {
          engines: options.engines || ['google', 'bing', 'duckduckgo'],
          language: options.language || 'es',
          maxResults: options.maxResults || 10
        })
    }

    // Formatear para Tongyi
    const formattedResults = searxSearch.formatResultsForTongyi(searchResponse)

    return NextResponse.json({
      success: true,
      tool: 'tongyi-searx-search',
      query,
      type,
      results: formattedResults,
      rawData: searchResponse,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Searx search error:', error)
    return NextResponse.json({
      error: 'Failed to perform search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// También permitir GET
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const type = searchParams.get('type') || 'general'
  const language = searchParams.get('lang') || 'es'
  const maxResults = parseInt(searchParams.get('limit') || '10')

  if (!query) {
    return NextResponse.json({
      error: 'Query parameter "q" is required',
      example: '/api/tongyi/searx-search?q=noticias+colombia&type=news&lang=es&limit=5'
    }, { status: 400 })
  }

  try {
    const options = {
      language,
      maxResults
    }

    let searchResponse

    switch (type) {
      case 'news':
        searchResponse = await searxSearch.searchNews(query, language)
        break
      case 'legal':
        searchResponse = await searxSearch.searchLegal(query, 'colombia')
        break
      default:
        searchResponse = await searxSearch.search(query, options)
    }

    const formattedResults = searxSearch.formatResultsForTongyi(searchResponse)

    return NextResponse.json({
      success: true,
      tool: 'tongyi-searx-search',
      query,
      type,
      results: formattedResults,
      rawData: searchResponse,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Searx search error:', error)
    return NextResponse.json({
      error: 'Failed to perform search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}



