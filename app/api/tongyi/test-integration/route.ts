import { NextRequest, NextResponse } from 'next/server'
import { tongyiWebSearch } from '@/lib/tongyi/tongyi-integration'

export async function GET(request: NextRequest) {
  try {
    // Probar diferentes tipos de búsqueda
    const tests = [
      {
        name: 'Búsqueda de Noticias',
        query: 'noticias actuales Colombia',
        type: 'news' as const
      },
      {
        name: 'Búsqueda Legal',
        query: 'contratos de arrendamiento',
        type: 'legal' as const
      },
      {
        name: 'Búsqueda General',
        query: 'información sobre Colombia',
        type: 'general' as const
      }
    ]

    const results = []

    for (const test of tests) {
      try {
        const result = await tongyiWebSearch.search({
          query: test.query,
          type: test.type
        })
        
        results.push({
          test: test.name,
          query: test.query,
          type: test.type,
          success: result.success,
          hasResults: result.success && result.results.length > 0,
          error: result.error
        })
      } catch (error) {
        results.push({
          test: test.name,
          query: test.query,
          type: test.type,
          success: false,
          hasResults: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const allSuccessful = results.every(r => r.success)
    const allHaveResults = results.every(r => r.hasResults)

    return NextResponse.json({
      success: allSuccessful,
      message: allSuccessful ? 
        'Todas las herramientas de búsqueda están funcionando correctamente' :
        'Algunas herramientas tienen problemas',
      tests: results,
      summary: {
        totalTests: tests.length,
        successfulTests: results.filter(r => r.success).length,
        testsWithResults: results.filter(r => r.hasResults).length
      },
      endpoints: {
        directSearch: 'http://localhost:3000/api/tongyi/direct-search',
        testIntegration: 'http://localhost:3000/api/tongyi/test-integration'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Integration test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to run integration tests',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// También permitir POST para pruebas específicas
export async function POST(request: NextRequest) {
  try {
    const { query, type = 'general' } = await request.json()

    if (!query) {
      return NextResponse.json({
        error: 'Query is required',
        usage: {
          description: 'Probar integración de búsqueda para Tongyi',
          parameters: {
            query: 'string - Consulta de búsqueda (requerido)',
            type: 'string - Tipo: general, news, legal (default: general)'
          }
        }
      }, { status: 400 })
    }

    // Realizar búsqueda usando la integración de Tongyi
    const result = await tongyiWebSearch.search({ query, type })

    return NextResponse.json({
      success: result.success,
      test: 'Tongyi Integration Test',
      query,
      type,
      result: result.success ? {
        hasResults: result.results.length > 0,
        resultsLength: result.results.length,
        timestamp: result.timestamp
      } : {
        error: result.error
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Integration test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to run integration test',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}



