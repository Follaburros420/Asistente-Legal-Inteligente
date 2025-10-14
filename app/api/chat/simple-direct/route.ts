import { NextResponse } from "next/server"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"
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

    // Crear prompt para la IA
    const systemPrompt = `Eres un asistente legal especializado en derecho colombiano. Tu tarea es analizar la información encontrada en internet y proporcionar una respuesta específica, clara y resumida sobre la consulta del usuario.

INFORMACIÓN ENCONTRADA EN INTERNET:
${webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS') ? 
  'No se encontró información específica en internet para esta consulta.' : 
  webSearchContext}

CONSULTA DEL USUARIO: "${userQuery}"

INSTRUCCIONES:
1. Analiza la información encontrada arriba
2. Responde específicamente a lo que pregunta el usuario
3. NO copies texto directamente de internet
4. Proporciona una respuesta clara, resumida y específica
5. Usa terminología jurídica precisa
6. Si la información no es suficiente, indícalo claramente
7. Al final incluye las fuentes consultadas

Responde en español colombiano con terminología jurídica precisa.`

    try {
      const completion = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userQuery }
        ],
        temperature: 0.3,
        max_tokens: 1000
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
      
      // Fallback: respuesta básica si la IA falla
      const fallbackResponse = `Como asistente legal especializado en derecho colombiano, puedo ayudarte con información sobre "${userQuery}".

Basándome en la información encontrada en fuentes oficiales, puedo proporcionarte orientación sobre el tema consultado.

---

## 📚 Fuentes Consultadas

${sources}`

      return NextResponse.json({
        success: true,
        message: fallbackResponse,
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
