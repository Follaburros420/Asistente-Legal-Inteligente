import { ChatSettings } from "@/types"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { chatSettings, messages } = json as {
      chatSettings: ChatSettings
      messages: any[]
    }

    // 🔥 BÚSQUEDA WEB OBLIGATORIA - SIEMPRE SE EJECUTA
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''
    
    console.log(`\n${"🔥".repeat(60)}`)
    console.log(`🔍 CHAT SOLO BÚSQUEDA WEB - SIN IA`)
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

    // Crear respuesta basada solo en búsqueda web
    let responseText = ''
    
    if (webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS')) {
      responseText = `⚠️ **Búsqueda Web Ejecutada**

He ejecutado una búsqueda web sobre "${userQuery}" pero no encontré resultados específicos.

**Información disponible:**
${webSearchContext}

**Respuesta basada en conocimiento general:**
Como asistente legal especializado en derecho colombiano, puedo ayudarte con información general sobre temas legales, pero para una respuesta más específica, te recomiendo consultar directamente con un abogado especializado.

**Nota:** Se ejecutó una búsqueda web como parte del proceso obligatorio, pero no se encontraron fuentes específicas para tu consulta.`
    } else {
      // Extraer información relevante de los resultados
      const results = searchResults.results.slice(0, 5) // Primeros 5 resultados
      const sources = results.map((result: any, index: number) => 
        `${index + 1}. [${result.title}](${result.url})`
      ).join('\n')

      responseText = `✅ **Búsqueda Web Ejecutada**

He ejecutado una búsqueda web sobre "${userQuery}" y encontré información relevante.

**Información encontrada:**
${webSearchContext}

**Análisis Legal:**
Basándome en la información encontrada, puedo proporcionarte orientación general sobre el tema consultado. Sin embargo, para asuntos legales específicos, siempre es recomendable consultar con un abogado especializado.

---

## 📚 Fuentes Consultadas

${sources}

**Nota:** Esta respuesta se basa en la búsqueda web ejecutada como parte del proceso obligatorio.`
    }

    // Simular streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // Dividir la respuesta en chunks para simular streaming
        const chunks = responseText.split(' ')
        let index = 0
        
        const sendChunk = () => {
          if (index < chunks.length) {
            const chunk = chunks[index] + ' '
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
            index++
            setTimeout(sendChunk, 50) // Simular delay de streaming
          } else {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
            controller.close()
          }
        }
        
        sendChunk()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })

  } catch (error: any) {
    console.error('Error en chat solo búsqueda web:', error)
    
    return new Response(JSON.stringify({ 
      message: `Error en chat solo búsqueda web: ${error.message}`,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
}
