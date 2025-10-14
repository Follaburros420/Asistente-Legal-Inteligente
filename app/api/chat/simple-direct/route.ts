import { NextResponse } from "next/server"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"
import OpenAI from "openai"

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
    } else {
      console.log(`⚠️ No se encontraron resultados`)
      webSearchContext = `No se encontró información específica en internet para esta consulta.`
    }

    // Intentar procesar con IA si hay API key disponible
    const openrouterApiKey = process.env.OPENROUTER_API_KEY
    
    if (openrouterApiKey && openrouterApiKey !== "sk-or-v1-your-api-key-here") {
      try {
        console.log(`🤖 Procesando con IA...`)
        
        const openai = new OpenAI({
          apiKey: openrouterApiKey,
          baseURL: "https://openrouter.ai/api/v1"
        })

        const systemPrompt = `Eres un Agente de Investigación Legal Colombiano. Tu meta es responder con precisión y trazabilidad jurídica. 

**INSTRUCCIONES CRÍTICAS:**
1. **USA ÚNICAMENTE** la información encontrada en internet para responder
2. **NO uses** información de tu entrenamiento si hay información específica disponible
3. **Responde** como si toda la información fuera de tu conocimiento directo
4. **NO menciones** que realizaste búsquedas web
5. **Proporciona** una respuesta estructurada y completa sobre el tema consultado

**FORMATO DE RESPUESTA:**
- Responde de manera completa y específica sobre la consulta
- Usa terminología jurídica precisa
- Incluye referencias a artículos, leyes y códigos específicos cuando sea relevante
- Al final de tu respuesta, después de "---", incluye:

## 📚 Fuentes Consultadas

1. [Título](URL exacta)
2. [Título](URL exacta)
...

**IMPORTANTE**: NUNCA menciones que realizaste búsquedas en internet. Responde en español colombiano con terminología jurídica precisa.`

        const finalPrompt = `${systemPrompt}

INFORMACIÓN ENCONTRADA EN INTERNET:
${webSearchContext}

CONSULTA DEL USUARIO: "${userQuery}"

Responde basándote ÚNICAMENTE en la información encontrada arriba.`

        const completion = await openai.chat.completions.create({
          model: "alibaba/tongyi-deepresearch-30b-a3b",
          messages: [
            { role: "system", content: finalPrompt },
            { role: "user", content: userQuery }
          ],
          temperature: 0.1,
          max_tokens: 2000
        })

        const aiResponse = completion.choices[0].message.content || "No se pudo generar respuesta"

        // Agregar fuentes al final
        const sources = searchResults?.results?.map((result, index) => {
          const cleanTitle = result.title
            .replace(/\s*Title:\s*/g, '')
            .trim()
          return `${index + 1}. [${cleanTitle}](${result.url})`
        }).join('\n') || ""

        const finalResponse = `${aiResponse}

---

## 📚 Fuentes Consultadas

${sources}`

        console.log(`✅ Respuesta generada exitosamente con IA`)

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
        console.log(`⚠️ Continuando sin IA debido a error: ${aiError.message}`)
        
        // Continuar con respuesta basada solo en búsqueda web
      }
    } else {
      console.log(`⚠️ API key no configurada, continuando sin IA`)
    }

    // Fallback: respuesta basada solo en búsqueda web
    if (searchResults && searchResults.success && searchResults.results && searchResults.results.length > 0) {
      // Crear respuesta estructurada basada en la información encontrada
      const responseText = `Basándome en la información encontrada sobre "${userQuery}":

**Marco Normativo**: Según la información encontrada en fuentes oficiales colombianas:

${webSearchContext.split('\n').slice(0, 20).join('\n')}

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

      console.log(`✅ Respuesta generada exitosamente (solo búsqueda web)`)

      return NextResponse.json({
        success: true,
        message: finalResponse,
        timestamp: new Date().toISOString(),
        searchExecuted: true,
        resultsFound: searchResults.results.length,
        aiProcessed: false,
        note: "Respuesta basada únicamente en búsqueda web (sin IA por falta de API key válida)"
      })
      
    } else {
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