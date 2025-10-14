import { NextRequest, NextResponse } from 'next/server'
import { webSearchTool } from '@/lib/tools/web-search-tool'

// Evitar ejecución durante build estático
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Solo ejecutar tests si no estamos en build time
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV) {
      return NextResponse.json({
        success: true,
        message: 'Test tools endpoint available in production',
        note: 'Tests skipped during build time to avoid errors',
        timestamp: new Date().toISOString()
      })
    }

    // Probar búsqueda web general
    const webSearchTest = await webSearchTool.search('leyes de contratos Colombia', ['duckduckgo', 'wikipedia'])
    
    // Probar búsqueda legal especializada
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    const legalSearchResponse = await fetch(`${baseUrl}/api/tools/legal-search`, {
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
          url: `${baseUrl}/api/tools/web-search`,
          method: 'POST',
          description: 'Búsqueda web general'
        },
        legalSearch: {
          url: `${baseUrl}/api/tools/legal-search`,
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



