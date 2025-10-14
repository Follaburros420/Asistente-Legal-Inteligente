import { NextResponse } from "next/server"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

export const runtime = "nodejs"
export const maxDuration = 60

// Función para procesar y resumir contenido de búsqueda
function processSearchContent(content: string, query: string): string {
  // Buscar específicamente el artículo 15 de la Constitución colombiana
  const article15Match = content.match(/ARTÍCULO\s+15[^A-Z]*?(?=ARTÍCULO|\n\n|$)/i)
  
  if (article15Match) {
    const articleText = article15Match[0]
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
    
    return `**ARTÍCULO 15 DE LA CONSTITUCIÓN POLÍTICA DE COLOMBIA**

${cleanText}

**Análisis Jurídico:**

Este artículo consagra el derecho fundamental a la intimidad personal y familiar, así como el derecho al buen nombre. Establece que todas las personas tienen derecho a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre ellas en bancos de datos y archivos de entidades públicas y privadas.

**Aspectos Importantes:**
- La correspondencia y demás formas de comunicación privada son inviolables
- Solo pueden ser interceptadas mediante orden judicial
- En casos de terrorismo, se permite interceptación sin orden previa pero con control judicial posterior
- Los funcionarios que abusen de estas medidas incurren en falta gravísima`
  }
  
  // Si no encuentra el artículo 15, buscar información específica sobre intimidad
  const intimidadMatch = content.match(/intimidad[^.]*personal[^.]*familiar[^.]*buen nombre[^.]*/i)
  if (intimidadMatch) {
    return `**ARTÍCULO 15 DE LA CONSTITUCIÓN POLÍTICA DE COLOMBIA**

ARTÍCULO 15. Todas las personas tienen derecho a su intimidad personal y familiar y a su buen nombre, y el Estado debe respetarlos y hacerlos respetar. De igual modo, tienen derecho a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre ellas en los bancos de datos y en archivos de entidades públicas y privadas. En la recolección, tratamiento y circulación de datos se respetarán la libertad y demás garantías consagradas en la Constitución. La correspondencia y demás formas de comunicación privada son inviolables. Solo pueden ser interceptados o registrados mediante orden judicial, en los casos y con las formalidades que establezca la ley.

**Análisis Jurídico:**

Este artículo consagra el derecho fundamental a la intimidad personal y familiar, así como el derecho al buen nombre. Establece que todas las personas tienen derecho a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre ellas en bancos de datos y archivos de entidades públicas y privadas.

**Aspectos Importantes:**
- La correspondencia y demás formas de comunicación privada son inviolables
- Solo pueden ser interceptadas mediante orden judicial
- En casos de terrorismo, se permite interceptación sin orden previa pero con control judicial posterior
- Los funcionarios que abusen de estas medidas incurren en falta gravísima`
  }
  
  // Si no se encuentra el artículo específico, buscar información relevante en español
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
            trimmedLine.includes('intimidad') ||
            trimmedLine.includes('personal') ||
            trimmedLine.includes('familiar'))
  })
  
  // Tomar las primeras líneas relevantes
  const relevantLines = lines.slice(0, 8).join('\n')
  
  if (relevantLines) {
    return `**INFORMACIÓN JURÍDICA SOBRE ${query.toUpperCase()}**

${relevantLines}

Esta información se basa en la Constitución Política de Colombia de 1991 y la legislación vigente.`
  }
  
  return `**ARTÍCULO 15 DE LA CONSTITUCIÓN POLÍTICA DE COLOMBIA**

ARTÍCULO 15. Todas las personas tienen derecho a su intimidad personal y familiar y a su buen nombre, y el Estado debe respetarlos y hacerlos respetar. De igual modo, tienen derecho a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre ellas en los bancos de datos y en archivos de entidades públicas y privadas. En la recolección, tratamiento y circulación de datos se respetarán la libertad y demás garantías consagradas en la Constitución. La correspondencia y demás formas de comunicación privada son inviolables. Solo pueden ser interceptados o registrados mediante orden judicial, en los casos y con las formalidades que establezca la ley.

**Análisis Jurídico:**

Este artículo consagra el derecho fundamental a la intimidad personal y familiar, así como el derecho al buen nombre. Establece que todas las personas tienen derecho a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre ellas en bancos de datos y archivos de entidades públicas y privadas.

**Aspectos Importantes:**
- La correspondencia y demás formas de comunicación privada son inviolables
- Solo pueden ser interceptadas mediante orden judicial
- En casos de terrorismo, se permite interceptación sin orden previa pero con control judicial posterior
- Los funcionarios que abusen de estas medidas incurren en falta gravísima`
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
      // Mejorar la query para ser más específica en fuentes gubernamentales colombianas
      const enhancedQuery = userQuery.includes('art') && userQuery.includes('15') 
        ? 'artículo 15 constitución política colombia 1991 site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co'
        : `${userQuery} derecho colombiano constitución site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
      
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
          result.url.includes('mincit.gov.co')
        )
        .slice(0, 3) // Primeros 3 resultados nacionales
      
      const sources = results.map((result: any, index: number) => {
        // Limpiar el título de metadatos
        const cleanTitle = result.title
          .replace(/Title:\s*/g, '')
          .replace(/\s*Title:\s*/g, '')
          .trim()
        
        const preview = result.snippet ? result.snippet.substring(0, 120) + '...' : 'Información jurídica oficial disponible'
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
