import { NextResponse } from "next/server"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"
import { extractWithFirecrawl } from "@/lib/tools/firecrawl-extractor"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"

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
        
        // Usar Firecrawl para extraer contenido detallado de los mejores resultados
        console.log(`🔥 FIRECRAWL: Extrayendo contenido detallado de sitios oficiales...`)
        
        const officialResults = searchResults.results.filter((result: any) => 
          result.url.includes('.gov.co') || 
          result.url.includes('secretariasenado.gov.co') ||
          result.url.includes('funcionpublica.gov.co') ||
          result.url.includes('ramajudicial.gov.co') ||
          result.url.includes('minjusticia.gov.co')
        ).slice(0, 3) // Top 3 sitios oficiales
        
        let detailedContent = ''
        for (const result of officialResults) {
          try {
            console.log(`🔥 Firecrawl: Extrayendo ${result.url}`)
            const firecrawlResult = await extractWithFirecrawl(result.url)
            if (firecrawlResult.success && firecrawlResult.content) {
              detailedContent += `\n\n--- CONTENIDO DETALLADO DE ${result.url} ---\n${firecrawlResult.content}\n`
              console.log(`✅ Firecrawl: Extraídos ${firecrawlResult.content.length} caracteres`)
            }
          } catch (error) {
            console.log(`⚠️ Firecrawl falló para ${result.url}:`, error)
          }
        }
        
        if (detailedContent) {
          webSearchContext += `\n\n--- CONTENIDO DETALLADO EXTRAÍDO CON FIRECRAWL ---\n${detailedContent}`
          console.log(`🔥 FIRECRAWL: Total contenido detallado: ${detailedContent.length} caracteres`)
        }
        
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

    // Usar IA para procesar la información encontrada y dar respuesta inteligente
    const openrouterApiKey = process.env.OPENROUTER_API_KEY || ""
    
    if (!openrouterApiKey) {
      return NextResponse.json({
        success: false,
        message: "OpenRouter API Key no configurada",
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    const openai = new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: "https://openrouter.ai/api/v1"
    })

    // Preparar fuentes para la respuesta
    const results = searchResults?.results?.filter((result: any) => 
      result.url.includes('.gov.co') || 
      result.url.includes('secretariasenado.gov.co') ||
      result.url.includes('funcionpublica.gov.co') ||
      result.url.includes('alcaldiabogota.gov.co') ||
      result.url.includes('mincit.gov.co') ||
      result.url.includes('ramajudicial.gov.co') ||
      result.url.includes('minjusticia.gov.co')
    ).slice(0, 5) || []

    const sources = results.map((result: any, index: number) => {
      const cleanTitle = result.title
        .replace(/Title:\s*/g, '')
        .replace(/\s*Title:\s*/g, '')
        .trim()
      return `${index + 1}. [${cleanTitle}](${result.url})`
    }).join('\n')

    // Crear prompt mejorado para la IA con contenido detallado de Firecrawl
    const systemPrompt = `Eres un asistente legal especializado en derecho colombiano. Tu tarea es analizar la información encontrada en internet (incluyendo contenido detallado extraído con Firecrawl) y proporcionar una respuesta ESPECÍFICA y DETALLADA sobre la consulta exacta del usuario.

INFORMACIÓN ENCONTRADA EN INTERNET:
${webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS') ? 
  'No se encontró información específica en internet para esta consulta.' : 
  webSearchContext}

CONSULTA ESPECÍFICA DEL USUARIO: "${userQuery}"

INSTRUCCIONES CRÍTICAS:
1. DEBES responder específicamente sobre "${userQuery}" - NO respuestas genéricas
2. Si la consulta es sobre un artículo específico (ej: "art 90 codigo civil"), DEBES explicar ese artículo específico
3. Analiza TODO el contenido encontrado arriba, incluyendo el contenido detallado extraído con Firecrawl
4. NO uses frases genéricas como "puedo ayudarte con información sobre..."
5. Proporciona información CONCRETA y ESPECÍFICA sobre lo que se pregunta
6. Si encuentras el artículo específico, explica su contenido completo, alcance y aplicación
7. Usa terminología jurídica precisa
8. Si la información no es suficiente para responder específicamente, indícalo claramente
9. PRIORIZA el contenido detallado extraído con Firecrawl sobre los snippets de búsqueda

EJEMPLO DE RESPUESTA CORRECTA:
Si preguntan "art 90 codigo civil", responde:
"El artículo 90 del Código Civil establece que [explicación específica del artículo]. Este artículo regula [alcance específico] y se aplica en [casos específicos]. Según la información oficial encontrada, [detalles adicionales del contenido extraído con Firecrawl]."

EJEMPLO DE RESPUESTA INCORRECTA:
"Como asistente legal especializado en derecho colombiano, puedo ayudarte con información sobre..."

Responde en español colombiano con terminología jurídica precisa.`

    try {
      const completion = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analiza la información encontrada (incluyendo contenido detallado de Firecrawl) y responde específicamente sobre: ${userQuery}` }
        ],
        temperature: 0.1, // Muy baja para respuestas más precisas
        max_tokens: 2000 // Más tokens para respuestas detalladas con Firecrawl
      })

      const aiResponse = completion.choices[0].message.content || "No se pudo generar respuesta"

      // Agregar fuentes al final de la respuesta
      const finalResponse = `${aiResponse}

---

## 📚 Fuentes Consultadas

${sources}`

      return NextResponse.json({
        success: true,
        message: finalResponse,
        timestamp: new Date().toISOString(),
        searchExecuted: true,
        resultsFound: searchResults?.results?.length || 0,
        aiProcessed: true
      })

    } catch (aiError: any) {
      console.error("Error en procesamiento de IA:", aiError)
      
      // Fallback mejorado: intentar extraer información específica del contexto web
      let fallbackResponse = ""
      
      if (webSearchContext && !webSearchContext.includes('ERROR') && !webSearchContext.includes('SIN RESULTADOS')) {
        // Intentar extraer información específica del contexto
        const lines = webSearchContext.split('\n').filter(line => {
          const trimmedLine = line.trim()
          return trimmedLine && 
                 !trimmedLine.includes('Title:') && 
                 !trimmedLine.includes('URL Source:') &&
                 !trimmedLine.includes('Published Time:') &&
                 (trimmedLine.includes('ARTÍCULO') || 
                  trimmedLine.includes('artículo') ||
                  trimmedLine.includes('Artículo') ||
                  trimmedLine.includes(userQuery.toLowerCase()))
        })
        
        if (lines.length > 0) {
          const relevantInfo = lines.slice(0, 5).join('\n')
          fallbackResponse = `Basándome en la información encontrada en fuentes oficiales sobre "${userQuery}":

${relevantInfo}

Esta información se basa en la legislación colombiana vigente.`
        } else {
          fallbackResponse = `No se encontró información específica sobre "${userQuery}" en las fuentes consultadas. 

La información disponible no contiene detalles específicos sobre la consulta realizada.`
        }
      } else {
        fallbackResponse = `No se pudo encontrar información específica sobre "${userQuery}" en las fuentes oficiales consultadas.

La búsqueda no arrojó resultados relevantes para responder específicamente a tu consulta.`
      }

      const finalFallbackResponse = `${fallbackResponse}

---

## 📚 Fuentes Consultadas

${sources}`

      return NextResponse.json({
        success: true,
        message: finalFallbackResponse,
        timestamp: new Date().toISOString(),
        searchExecuted: true,
        resultsFound: searchResults?.results?.length || 0,
        aiProcessed: false,
        error: aiError.message
      })
    }

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
