import { NextRequest, NextResponse } from 'next/server'
import { searchLegalSpecialized, enrichLegalResults } from '@/lib/tools/legal-search-specialized'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, numResults = 5, enrich = false } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query es requerida y debe ser un string' },
        { status: 400 }
      )
    }

    console.log(`⚖️ [Legal Search API] Búsqueda especializada: "${query}"`)

    // Realizar búsqueda legal especializada
    const searchResult = await searchLegalSpecialized(query, numResults)

    if (!searchResult.success) {
      return NextResponse.json({
        success: false,
        query,
        results: [],
        sources: [],
        timestamp: searchResult.timestamp,
        searchStrategy: searchResult.searchStrategy,
        error: searchResult.error,
        note: searchResult.note
      })
    }

    let finalResults = searchResult.results

    // Enriquecer resultados si se solicita
    if (enrich && searchResult.results.length > 0) {
      console.log(`📚 Enriqueciendo ${searchResult.results.length} resultados legales...`)
      finalResults = await enrichLegalResults(searchResult.results, 3)
    }

    return NextResponse.json({
      success: true,
      query,
      results: finalResults,
      sources: finalResults.map(r => r.url),
      timestamp: searchResult.timestamp,
      searchStrategy: searchResult.searchStrategy,
      enriched: enrich,
      summary: {
        totalResults: finalResults.length,
        officialSources: finalResults.filter(r => r.type === 'official').length,
        academicSources: finalResults.filter(r => r.type === 'academic').length,
        newsSources: finalResults.filter(r => r.type === 'news').length,
        generalSources: finalResults.filter(r => r.type === 'general').length,
        averageRelevance: finalResults.reduce((sum, r) => sum + r.relevance, 0) / finalResults.length
      }
    })

  } catch (error) {
    console.error('❌ Error en Legal Search API:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
