import { NextRequest, NextResponse } from 'next/server'
import { simpleWebSearch } from '@/lib/tools/simple-web-search'

export async function POST(request: NextRequest) {
  try {
    const { query, type = 'general', options = {} } = await request.json()

    if (!query) {
      return NextResponse.json({
        error: 'Query is required',
        usage: {
          description: 'Búsqueda web confiable para Tongyi Deep Research',
          parameters: {
            query: 'string - Consulta de búsqueda (requerido)',
            type: 'string - Tipo: general, news, legal (default: general)',
            options: {
              includeNews: 'boolean - Incluir noticias (default: false)',
              languages: 'array - Idiomas (default: ["es", "en"])',
              maxResults: 'number - Máximo resultados (default: 8)'
            }
          }
        }
      }, { status: 400 })
    }

    // Configurar opciones según el tipo
    let searchOptions = {
      includeNews: false,
      languages: ['es', 'en'],
      maxResults: 8,
      ...options
    }

    // Ajustar según el tipo de búsqueda
    switch (type) {
      case 'news':
        searchOptions.includeNews = true
        searchOptions.maxResults = 6
        break
      case 'legal':
        searchOptions.languages = ['es']
        searchOptions.maxResults = 10
        break
    }

    // Realizar búsqueda
    const searchResponse = await simpleWebSearch.searchComprehensive(query, searchOptions)
    
    // Formatear para Tongyi
    let formattedResults = simpleWebSearch.formatResultsForTongyi(searchResponse)

    // Agregar contexto según el tipo
    if (type === 'legal') {
      formattedResults = `⚖️ **BÚSQUEDA LEGAL**\n\n` +
        `🔍 **Consulta:** "${query}"\n` +
        `📅 **Fecha:** ${new Date().toLocaleDateString('es-ES')}\n\n` +
        formattedResults +
        `\n\n💡 **Recomendaciones Legales:**\n` +
        `- Verifica la vigencia de la legislación\n` +
        `- Consulta fuentes oficiales para información crítica\n` +
        `- Considera la jurisprudencia más reciente\n`
    } else if (type === 'news') {
      formattedResults = `📰 **BÚSQUEDA DE ACTUALIDAD**\n\n` +
        `🔍 **Consulta:** "${query}"\n` +
        `📅 **Fecha:** ${new Date().toLocaleDateString('es-ES')}\n\n` +
        formattedResults +
        `\n\n⚠️ **Nota:** La información de actualidad puede cambiar rápidamente. Verifica las fuentes más recientes.`
    }

    return NextResponse.json({
      success: true,
      tool: 'tongyi-final-search',
      query,
      type,
      results: formattedResults,
      rawData: searchResponse,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Final search error:', error)
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
  const includeNews = searchParams.get('news') === 'true'
  const languages = searchParams.get('lang')?.split(',') || ['es', 'en']
  const maxResults = parseInt(searchParams.get('limit') || '8')

  if (!query) {
    return NextResponse.json({
      error: 'Query parameter "q" is required',
      examples: [
        '/api/tongyi/final-search?q=noticias+colombia&type=news',
        '/api/tongyi/final-search?q=leyes+contratos&type=legal',
        '/api/tongyi/final-search?q=informacion+general&type=general'
      ]
    }, { status: 400 })
  }

  try {
    const options = {
      includeNews,
      languages,
      maxResults
    }

    const response = await fetch(request.url.replace('/api/tongyi/final-search?', '/api/tongyi/final-search'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, type, options })
    })

    return response

  } catch (error) {
    console.error('Final search error:', error)
    return NextResponse.json({
      error: 'Failed to perform search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}



