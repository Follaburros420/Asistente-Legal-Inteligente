import { NextRequest, NextResponse } from 'next/server'
import { enhancedWebSearch } from '@/lib/tools/enhanced-web-search'

export async function POST(request: NextRequest) {
  try {
    const { query, options = {} } = await request.json()

    if (!query) {
      return NextResponse.json({
        error: 'Query is required',
        usage: {
          description: 'Búsqueda web avanzada para Tongyi Deep Research',
          parameters: {
            query: 'string - Consulta de búsqueda (requerido)',
            options: {
              includeNews: 'boolean - Incluir búsqueda de noticias (default: true)',
              languages: 'array - Idiomas para Wikipedia (default: ["es", "en"])',
              maxResults: 'number - Máximo de resultados (default: 10)'
            }
          }
        }
      }, { status: 400 })
    }

    // Realizar búsqueda comprehensiva
    const searchResponse = await enhancedWebSearch.searchComprehensive(query, options)
    
    // Formatear para Tongyi
    const formattedResults = enhancedWebSearch.formatResultsForAssistant(searchResponse)

    return NextResponse.json({
      success: true,
      tool: 'tongyi-web-search',
      query,
      results: formattedResults,
      rawData: searchResponse,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Tongyi search error:', error)
    return NextResponse.json({
      error: 'Failed to perform search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// También permitir GET para búsquedas simples
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const includeNews = searchParams.get('news') === 'true'
  const languages = searchParams.get('lang')?.split(',') || ['es', 'en']
  const maxResults = parseInt(searchParams.get('limit') || '10')

  if (!query) {
    return NextResponse.json({
      error: 'Query parameter "q" is required',
      example: '/api/tongyi/search?q=leyes+colombia&news=true&lang=es,en&limit=5'
    }, { status: 400 })
  }

  try {
    const options = {
      includeNews,
      languages,
      maxResults
    }

    const searchResponse = await enhancedWebSearch.searchComprehensive(query, options)
    const formattedResults = enhancedWebSearch.formatResultsForAssistant(searchResponse)

    return NextResponse.json({
      success: true,
      tool: 'tongyi-web-search',
      query,
      results: formattedResults,
      rawData: searchResponse,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Tongyi search error:', error)
    return NextResponse.json({
      error: 'Failed to perform search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}



