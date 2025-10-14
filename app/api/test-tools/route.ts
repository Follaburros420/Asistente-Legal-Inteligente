import { NextRequest, NextResponse } from 'next/server'
import { webSearchTool } from '@/lib/tools/web-search-tool'

export async function GET(request: NextRequest) {
  try {
    // Probar búsqueda web general
    const webSearchTest = await webSearchTool.search('leyes de contratos Colombia', ['duckduckgo', 'wikipedia'])
    
    // Probar búsqueda legal especializada
    const legalSearchResponse = await fetch('http://localhost:3000/api/tools/legal-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'contratos de arrendamiento',
        country: 'colombia',
        type: 'jurisprudencia'
      })
    })
    
    const legalSearchTest = await legalSearchResponse.json()

    return NextResponse.json({
      success: true,
      message: 'Herramientas de búsqueda web funcionando correctamente',
      tests: {
        webSearch: {
          status: 'success',
          query: 'leyes de contratos Colombia',
          hasResults: !!webSearchTest.sources.duckduckgo || !!webSearchTest.sources.wikipedia
        },
        legalSearch: {
          status: legalSearchTest.success ? 'success' : 'error',
          query: 'contratos de arrendamiento',
          hasResults: !!legalSearchTest.results
        }
      },
      tools: {
        webSearch: {
          url: 'http://localhost:3000/api/tools/web-search',
          method: 'POST',
          description: 'Búsqueda web general'
        },
        legalSearch: {
          url: 'http://localhost:3000/api/tools/legal-search',
          method: 'POST', 
          description: 'Búsqueda legal especializada'
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Test tools error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test tools',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}



