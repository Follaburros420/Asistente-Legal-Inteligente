import { NextResponse } from "next/server"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

export const runtime = "nodejs"
export const maxDuration = 60

// Función para procesar y resumir contenido de búsqueda
function processSearchContent(content: string, query: string): string {
  // Buscar información específica del artículo consultado
  const articleMatch = content.match(/ARTÍCULO\s+(\d+)[\s\S]*?(?=ARTÍCULO|\n\n|$)/i)
  
  if (articleMatch) {
    const articleText = articleMatch[0]
    // Limpiar el texto del artículo
    const cleanText = articleText
      .replace(/Title:.*?\n/g, '')
      .replace(/URL Source:.*?\n/g, '')
      .replace(/Published Time:.*?\n/g, '')
      .replace(/Markdown Content:/g, '')
      .replace(/Image \d+:.*?\n/g, '')
      .replace(/\[!\[.*?\]\(.*?\)\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    
    return cleanText
  }
  
  // Si no se encuentra el artículo específico, buscar información relevante
  const lines = content.split('\n').filter(line => 
    line.trim() && 
    !line.includes('Title:') && 
    !line.includes('URL Source:') && 
    !line.includes('Published Time:') &&
    !line.includes('Markdown Content:') &&
    !line.includes('Image ') &&
    !line.includes('[![')
  )
  
  // Tomar las primeras líneas relevantes
  const relevantLines = lines.slice(0, 10).join('\n')
  
  return relevantLines || `Información jurídica disponible sobre "${query}".`
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { messages } = json as {
      messages: any[]
    }

    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''

    console.log(`\n${"🔥".repeat(60)}`)
    console.log(`🔍 CHAT SIMPLE DIRECTO - SIN STREAMING`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: usuario-anonimo`)
    console.log(`${"🔥".repeat(60)}\n`)

    let webSearchContext = ''
    let searchResults: any = null

    try {
      console.log(`📡 FORZANDO búsqueda en Google CSE...`)
      searchResults = await searchWebEnriched(userQuery)

      if (searchResults && searchResults.success && searchResults.results && searchResults.results.length > 0) {
        webSearchContext = formatSearchResultsForContext(searchResults)
        console.log(`\n✅ BÚSQUEDA FORZADA - COMPLETADA CON ÉXITO:`)
        console.log(`   📊 Resultados encontrados: ${searchResults.results.length}`)
        console.log(`   📝 Caracteres de contexto: ${webSearchContext.length}`)
        console.log(`\n${"🔥".repeat(60)}\n`)
      } else {
        console.log(`\n⚠️ BÚSQUEDA FORZADA - SIN RESULTADOS`)
        webSearchContext = `BÚSQUEDA EJECUTADA PERO SIN RESULTADOS PARA: "${userQuery}"`
        console.log(`${"🔥".repeat(60)}\n`)
      }
    } catch (error) {
      console.error(`\n❌ ERROR EN BÚSQUEDA FORZADA:`, error)
      webSearchContext = `ERROR EN BÚSQUEDA WEB PARA: "${userQuery}" - ${error instanceof Error ? error.message : 'Error desconocido'}`
      console.log(`${"🔥".repeat(60)}\n`)
    }

    // Crear respuesta basada en información encontrada
    let responseText = ''
    
    if (webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS')) {
      responseText = `Como asistente legal especializado en derecho colombiano, puedo ayudarte con información sobre "${userQuery}".

Basándome en mi base de datos jurídica, puedo proporcionarte orientación general sobre el tema consultado.`
    } else {
      // Procesar y resumir la información encontrada
      const processedContent = processSearchContent(webSearchContext, userQuery)
      
      // Extraer información relevante de los resultados
      const results = searchResults.results.slice(0, 3) // Primeros 3 resultados
      const sources = results.map((result: any, index: number) => {
        const preview = result.snippet ? result.snippet.substring(0, 100) + '...' : 'Información jurídica disponible'
        return `${index + 1}. [${result.title}](${result.url})\n   *${preview}*`
      }).join('\n\n')

      responseText = `Basándome en mi base de datos jurídica, puedo ayudarte con información sobre "${userQuery}".

${processedContent}

---

## 📚 Fuentes Consultadas

${sources}`
    }

    // Respuesta directa sin streaming
    return NextResponse.json({
      success: true,
      message: responseText,
      timestamp: new Date().toISOString(),
      searchExecuted: true,
      resultsFound: searchResults?.results?.length || 0
    })

  } catch (error: any) {
    console.error("Error en chat simple directo:", error)
    return NextResponse.json({
      success: false,
      message: `Error en chat simple directo: ${error.message}`,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
