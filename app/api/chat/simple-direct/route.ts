import { NextResponse } from "next/server"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { messages } = json as { messages: Array<{ role: string; content: string }> }
    
    const userQuery = messages[messages.length - 1]?.content || ""
    
    console.log(`🔍 Consulta: "${userQuery}"`)

    // Buscar información en internet
    console.log(`📡 Buscando información en internet para: "${userQuery}"`)
    
    const searchResults = await searchWebEnriched(userQuery)
    let webSearchContext = ""
    
    if (searchResults && searchResults.success && searchResults.results && searchResults.results.length > 0) {
      webSearchContext = formatSearchResultsForContext(searchResults)
      console.log(`✅ Encontrados ${searchResults.results.length} resultados`)
      
      // Crear respuesta basada en la información encontrada
      const responseText = `Basándome en la información encontrada sobre "${userQuery}":

${webSearchContext}

**Análisis**: Esta información se basa en fuentes oficiales colombianas y proporciona detalles específicos sobre el tema consultado.

**Conclusión**: La información encontrada en internet proporciona una base sólida para responder la consulta sobre derecho legal colombiano.`

      // Agregar fuentes al final
      const sources = searchResults.results.map((result, index) => {
        const cleanTitle = result.title
          .replace(/\s*Title:\s*/g, '')
          .trim()
        return `${index + 1}. [${cleanTitle}](${result.url})`
      }).join('\n')

      const finalResponse = `${responseText}

---

## 📚 Fuentes Consultadas

${sources}`

      console.log(`✅ Respuesta generada exitosamente`)

      return NextResponse.json({
        success: true,
        message: finalResponse,
        timestamp: new Date().toISOString(),
        searchExecuted: true,
        resultsFound: searchResults.results.length,
        aiProcessed: false,
        note: "Respuesta basada únicamente en búsqueda web (sin IA por falta de API key)"
      })
      
    } else {
      console.log(`⚠️ No se encontraron resultados`)
      
      return NextResponse.json({
        success: false,
        message: `No se encontró información específica sobre "${userQuery}" en las fuentes oficiales consultadas.`,
        timestamp: new Date().toISOString(),
        searchExecuted: true,
        resultsFound: 0,
        aiProcessed: false,
        note: "Búsqueda web ejecutada pero sin resultados"
      })
    }

  } catch (error: any) {
    console.error("Error en procesamiento:", error)
    
    return NextResponse.json({
      success: false,
      message: "Error interno del servidor",
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 })
  }
}