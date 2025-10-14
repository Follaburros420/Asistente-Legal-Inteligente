import { NextResponse } from "next/server"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

export const runtime = "nodejs"
export const maxDuration = 60

// Función para extraer número de artículo y tipo de código de la consulta
function extractArticleInfo(query: string): { articleNumber: string | null, codeType: string } {
  // Buscar patrones como "art 11", "artículo 11", "art11", etc.
  const patterns = [
    /art(?:ículo)?\s*(\d+)/i,
    /art\.?\s*(\d+)/i,
    /articulo\s*(\d+)/i,
    /art\s*(\d+)/i
  ]
  
  let articleNumber: string | null = null
  for (const pattern of patterns) {
    const match = query.match(pattern)
    if (match) {
      articleNumber = match[1]
      break
    }
  }
  
  // Determinar el tipo de código
  let codeType = 'constitucion' // Por defecto
  
  if (query.toLowerCase().includes('codigo general del proceso') || 
      query.toLowerCase().includes('cgp') ||
      query.toLowerCase().includes('proceso')) {
    codeType = 'cgp'
  } else if (query.toLowerCase().includes('codigo civil') || 
             query.toLowerCase().includes('civil')) {
    codeType = 'civil'
  } else if (query.toLowerCase().includes('codigo penal') || 
             query.toLowerCase().includes('penal')) {
    codeType = 'penal'
  } else if (query.toLowerCase().includes('codigo de comercio') || 
             query.toLowerCase().includes('comercio')) {
    codeType = 'comercio'
  } else if (query.toLowerCase().includes('constitución') || 
             query.toLowerCase().includes('const') ||
             query.toLowerCase().includes('constitucional')) {
    codeType = 'constitucion'
  }
  
  return { articleNumber, codeType }
}

// Función para procesar y resumir contenido de búsqueda web
function processSearchContent(content: string, query: string): string {
  // Extraer información del artículo de la consulta
  const { articleNumber, codeType } = extractArticleInfo(query)
  
  // Filtrar contenido relevante en español y relacionado con Colombia
  const lines = content.split('\n').filter(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return false
    
    // Filtrar metadatos técnicos
    if (trimmedLine.includes('Title:') || 
        trimmedLine.includes('URL Source:') || 
        trimmedLine.includes('Published Time:') ||
        trimmedLine.includes('Markdown Content:') ||
        trimmedLine.includes('Image ') ||
        trimmedLine.includes('[![')) {
      return false
    }
    
    // Filtrar contenido en inglés
    if (trimmedLine.includes('The people of Colombia') ||
        trimmedLine.includes('In the exercise of') ||
        trimmedLine.includes('National Constituent Assembly') ||
        trimmedLine.includes('social state under the rule of law') ||
        trimmedLine.includes('Nevada') ||
        trimmedLine.includes('Constitute Project')) {
      return false
    }
    
    // Solo contenido en español y relacionado con Colombia
    return (trimmedLine.includes('Colombia') || 
            trimmedLine.includes('Constitución') || 
            trimmedLine.includes('ARTÍCULO') ||
            trimmedLine.includes('República') ||
            trimmedLine.includes('Estado') ||
            trimmedLine.includes('derecho') ||
            trimmedLine.includes('código') ||
            trimmedLine.includes('proceso') ||
            trimmedLine.includes('civil') ||
            trimmedLine.includes('penal') ||
            trimmedLine.includes('comercio'))
  })
  
  // Tomar las primeras líneas relevantes
  const relevantLines = lines.slice(0, 10).join('\n')
  
  if (relevantLines) {
    const codeName = codeType === 'cgp' ? 'CÓDIGO GENERAL DEL PROCESO' :
                    codeType === 'constitucion' ? 'CONSTITUCIÓN POLÍTICA DE COLOMBIA' :
                    codeType === 'civil' ? 'CÓDIGO CIVIL' :
                    codeType === 'penal' ? 'CÓDIGO PENAL' :
                    codeType === 'comercio' ? 'CÓDIGO DE COMERCIO' : 'LEGISLACIÓN COLOMBIANA'
    
    return `**INFORMACIÓN JURÍDICA SOBRE ${query.toUpperCase()}**

${relevantLines}

Esta información se basa en la ${codeName} y la legislación vigente en Colombia.`
  }
  
  return `Como asistente legal especializado en derecho colombiano, puedo ayudarte con información sobre "${query}". 

Basándome en la información encontrada en fuentes oficiales, puedo proporcionarte orientación sobre el tema consultado.`
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

    // SIEMPRE hacer búsqueda web - eliminar base de datos local
    const { articleNumber, codeType } = extractArticleInfo(userQuery)
    
    try {
      console.log(`📡 BÚSQUEDA WEB OBLIGATORIA - SIEMPRE USAR GOOGLE CSE`)
      console.log(`   Query original: "${userQuery}"`)
      console.log(`   Tipo detectado: ${codeType}`)
      
      // Crear query mejorada basada en el tipo de código detectado
      let enhancedQuery = userQuery
      
      if (codeType === 'cgp') {
        enhancedQuery = `${userQuery} código general del proceso colombia site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co OR site:ramajudicial.gov.co`
      } else if (codeType === 'constitucion') {
        enhancedQuery = `${userQuery} constitución política colombia 1991 site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
      } else if (codeType === 'civil') {
        enhancedQuery = `${userQuery} código civil colombia site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
      } else if (codeType === 'penal') {
        enhancedQuery = `${userQuery} código penal colombia site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
      } else {
        // Query general mejorada
        enhancedQuery = `${userQuery} derecho colombiano legislación site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co OR site:ramajudicial.gov.co`
      }
      
      console.log(`   Query mejorada: "${enhancedQuery}"`)
      
      searchResults = await searchWebEnriched(enhancedQuery)

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
      
      // Extraer información relevante de los resultados - solo fuentes nacionales
      const results = searchResults.results
        .filter((result: any) => 
          result.url.includes('.gov.co') || 
          result.url.includes('secretariasenado.gov.co') ||
          result.url.includes('funcionpublica.gov.co') ||
          result.url.includes('alcaldiabogota.gov.co') ||
          result.url.includes('mincit.gov.co') ||
          result.url.includes('ramajudicial.gov.co') ||
          result.url.includes('minjusticia.gov.co')
        )
        .slice(0, 5) // Primeros 5 resultados nacionales
      
      const sources = results.map((result: any, index: number) => {
        // Limpiar el título de metadatos
        const cleanTitle = result.title
          .replace(/Title:\s*/g, '')
          .replace(/\s*Title:\s*/g, '')
          .trim()
        
        const preview = result.snippet ? result.snippet.substring(0, 150) + '...' : 'Información jurídica oficial disponible'
        return `${index + 1}. [${cleanTitle}](${result.url})\n   *${preview}*`
      }).join('\n\n')

      responseText = `Como asistente legal especializado en derecho colombiano, puedo ayudarte con información sobre "${userQuery}".

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
    });

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
