import { NextRequest, NextResponse } from 'next/server'
import { webSearchTool } from '@/lib/tools/web-search-tool'

export async function POST(request: NextRequest) {
  try {
    const { query, country = 'colombia', type = 'general' } = await request.json()

    if (!query) {
      return NextResponse.json({ 
        error: 'Query is required',
        usage: {
          description: 'Búsqueda especializada en jurisprudencia y leyes',
          parameters: {
            query: 'string - Consulta legal específica',
            country: 'string - País para búsqueda (default: colombia)',
            type: 'string - Tipo de búsqueda (general, jurisprudencia, leyes, doctrina)'
          }
        }
      }, { status: 400 })
    }

    // Construir consulta especializada según el tipo
    let specializedQuery = query
    
    switch (type) {
      case 'jurisprudencia':
        specializedQuery = `${query} jurisprudencia ${country} sentencias corte suprema`
        break
      case 'leyes':
        specializedQuery = `${query} ley ${country} código legal legislación`
        break
      case 'doctrina':
        specializedQuery = `${query} doctrina legal ${country} derecho`
        break
      default:
        specializedQuery = `${query} derecho legal ${country}`
    }

    // Realizar búsqueda con fuentes especializadas
    const sources = ['duckduckgo', 'wikipedia']
    const results = await webSearchTool.search(specializedQuery, sources)
    
    // Formatear resultados específicos para consultas legales
    let formattedResults = `⚖️ **Búsqueda Legal Especializada**\n\n`
    formattedResults += `🔍 **Consulta:** "${query}"\n`
    formattedResults += `🌍 **País:** ${country}\n`
    formattedResults += `📋 **Tipo:** ${type}\n\n`
    
    // Agregar información específica de búsqueda legal
    if (results.sources.duckduckgo) {
      const ddg = results.sources.duckduckgo
      formattedResults += `**📊 Resultados de Búsqueda:**\n`
      
      if (ddg.abstract) {
        formattedResults += `- **Resumen Legal:** ${ddg.abstract}\n`
      }
      
      if (ddg.abstractText) {
        formattedResults += `- **Contexto:** ${ddg.abstractText}\n`
      }
      
      if (ddg.answer) {
        formattedResults += `- **Respuesta:** ${ddg.answer}\n`
      }
      
      if (ddg.definition) {
        formattedResults += `- **Definición Legal:** ${ddg.definition}\n`
      }
      
      formattedResults += `\n`
    }

    if (results.sources.wikipedia) {
      const wiki = results.sources.wikipedia
      formattedResults += `**📚 Información Legal (Wikipedia):**\n`
      
      if (wiki.title) {
        formattedResults += `- **Título:** ${wiki.title}\n`
      }
      
      if (wiki.extract) {
        formattedResults += `- **Información:** ${wiki.extract.substring(0, 800)}${wiki.extract.length > 800 ? '...' : ''}\n`
      }
      
      if (wiki.url) {
        formattedResults += `- **Fuente:** ${wiki.url}\n`
      }
      
      formattedResults += `\n`
    }

    // Agregar recomendaciones para búsqueda legal
    formattedResults += `**💡 Recomendaciones para Investigación Legal:**\n`
    formattedResults += `- Consulta bases de datos jurídicas especializadas\n`
    formattedResults += `- Revisa jurisprudencia de cortes superiores\n`
    formattedResults += `- Verifica legislación vigente y actualizaciones\n`
    formattedResults += `- Considera doctrina legal especializada\n\n`
    
    formattedResults += `⏰ **Búsqueda realizada:** ${new Date().toISOString()}\n`

    return NextResponse.json({
      success: true,
      tool: 'legal-search',
      query,
      specializedQuery,
      country,
      type,
      results: formattedResults,
      rawData: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Legal search tool error:', error)
    return NextResponse.json({
      error: 'Failed to perform legal search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const country = searchParams.get('country') || 'colombia'
  const type = searchParams.get('type') || 'general'

  if (!query) {
    return NextResponse.json({ 
      error: 'Query parameter "q" is required',
      example: '/api/tools/legal-search?q=contratos&country=colombia&type=jurisprudencia'
    }, { status: 400 })
  }

  try {
    const response = await fetch(request.url.replace('/api/tools/legal-search?', '/api/tools/legal-search'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, country, type })
    })

    return response
  } catch (error) {
    console.error('Legal search tool error:', error)
    return NextResponse.json({
      error: 'Failed to perform legal search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}



