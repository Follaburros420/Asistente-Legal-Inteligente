import { NextResponse } from 'next/server'
import { searchWebEnriched, formatSearchResultsForContext } from '@/lib/tools/web-search'

export const runtime = 'edge'

/**
 * API endpoint para búsqueda web con herramientas de código abierto
 * POST /api/tools/web-search
 * Body: { query: string }
 */
export async function POST(request: Request) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 [API] Búsqueda web solicitada: "${query}"`)

    // Realizar búsqueda enriquecida
    const searchResponse = await searchWebEnriched(query)

    if (!searchResponse.success) {
      return NextResponse.json(
        { 
          error: searchResponse.error || 'Search failed',
          query
        },
        { status: 500 }
      )
    }

    // Formatear para contexto
    const formattedContext = formatSearchResultsForContext(searchResponse)

    return NextResponse.json({
      success: true,
      query,
      results: searchResponse.results,
      sources: searchResponse.sources,
      formattedContext,
      timestamp: searchResponse.timestamp
    })

  } catch (error) {
    console.error('❌ [API] Error en web-search:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint para testing
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    )
  }

  return POST(new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  }))
}
