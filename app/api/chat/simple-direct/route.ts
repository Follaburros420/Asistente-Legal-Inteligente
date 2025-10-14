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

// Función para normalizar consultas como en N8n
function normalizeQuery(userQuery: string): string {
  const query = userQuery.toLowerCase().trim()
  
  // Detectar tipo de consulta y crear query específica
  if (query.includes('requisitos') && query.includes('demanda')) {
    return `${userQuery} Colombia código general del proceso artículos demanda site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co OR site:ramajudicial.gov.co`
  }
  
  if (query.includes('requisitos') && (query.includes('contrato') || query.includes('contratos'))) {
    return `${userQuery} Colombia código civil contratos site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
  }
  
  if (query.includes('requisitos') && (query.includes('matrimonio') || query.includes('casamiento'))) {
    return `${userQuery} Colombia código civil matrimonio site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
  }
  
  if (query.includes('requisitos') && query.includes('tutela')) {
    return `${userQuery} Colombia acción tutela artículo 86 constitución site:corteconstitucional.gov.co OR site:gov.co`
  }
  
  if (query.includes('requisitos') && query.includes('inconstitucionalidad')) {
    return `${userQuery} Colombia acción inconstitucionalidad artículo 241 constitución site:corteconstitucional.gov.co OR site:gov.co`
  }
  
  // Consultas sobre artículos específicos
  if (query.includes('art') || query.includes('artículo')) {
    const { articleNumber, codeType } = extractArticleInfo(userQuery)
    if (articleNumber && codeType) {
      if (codeType === 'cgp') {
        return `${userQuery} código general del proceso colombia site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co OR site:ramajudicial.gov.co`
      } else if (codeType === 'constitucion') {
        return `${userQuery} constitución política colombia 1991 site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
      } else if (codeType === 'civil') {
        return `${userQuery} código civil colombia site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
      }
    }
  }
  
  // Consulta general - agregar contexto legal colombiano
  return `${userQuery} Colombia derecho legal legislación site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co OR site:ramajudicial.gov.co OR site:corteconstitucional.gov.co`
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

    // SIEMPRE hacer búsqueda web usando normalización inteligente como N8n
    try {
      console.log(`📡 BÚSQUEDA WEB OBLIGATORIA - NORMALIZACIÓN INTELIGENTE`)
      console.log(`   Query original: "${userQuery}"`)
      
      // Usar normalización inteligente como en N8n
      const enhancedQuery = normalizeQuery(userQuery)
      
      console.log(`   Query normalizada: "${enhancedQuery}"`)
      
      searchResults = await searchWebEnriched(enhancedQuery)

      if (searchResults && searchResults.success && searchResults.results && searchResults.results.length > 0) {
        webSearchContext = formatSearchResultsForContext(searchResults)
        console.log(`\n✅ BÚSQUEDA FORZADA - COMPLETADA CON ÉXITO:`)
        console.log(`   📊 Resultados encontrados: ${searchResults.results.length}`)
        console.log(`   📝 Caracteres de contexto: ${webSearchContext.length}`)
        
        // SIMPLIFICADO: No usar Firecrawl para evitar errores 402 y timeouts
        console.log(`📚 Usando solo resultados de Google CSE (sin Firecrawl para evitar errores)`)
        
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

    // Crear prompt mejorado para procesar información jurídica específica
    const systemPrompt = `Eres un Agente de Investigación Legal Colombiano especializado en derecho procesal colombiano. Tu meta es analizar la información jurídica encontrada en internet y proporcionar una respuesta COMPLETA y ESPECÍFICA.

INFORMACIÓN JURÍDICA ENCONTRADA EN INTERNET:
${webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS') ? 
  'No se encontró información específica en internet para esta consulta.' : 
  webSearchContext}

CONSULTA DEL USUARIO: "${userQuery}"

INSTRUCCIONES CRÍTICAS:
1. ANALIZA TODO el contenido jurídico encontrado arriba
2. Si encuentras artículos específicos (ej: Artículo 82 del Código General del Proceso), explica COMPLETAMENTE su contenido
3. Si la consulta es sobre "requisitos de la demanda", lista TODOS los requisitos específicos encontrados en los artículos
4. Proporciona información CONCRETA y DETALLADA sobre lo que se pregunta
5. Usa terminología jurídica precisa
6. Si encuentras información relevante, explica su contenido completo, alcance y aplicación
7. NO uses frases genéricas como "puedo ayudarte con información sobre..."
8. NO hagas referencias vagas - sé específico con números de artículos, leyes y fechas

FORMATO DE RESPUESTA OBLIGATORIO:
- **Marco Normativo**: Identifica la ley/código específico (ej: Código General del Proceso, Ley 1564 de 2012)
- **Artículo Específico**: Menciona el número exacto del artículo (ej: Artículo 82)
- **Requisitos Detallados**: Lista TODOS los requisitos específicos encontrados
- **Análisis**: Explica el alcance y aplicación de cada requisito
- **Conclusión**: Resumen claro de los requisitos

EJEMPLO CORRECTO para "requisitos de la demanda":
"**Marco Normativo**: Según el Código General del Proceso (Ley 1564 de 2012), específicamente el **Artículo 82**, la demanda debe reunir los siguientes requisitos:

**Requisitos Específicos del Artículo 82**:
1. [Requisito específico encontrado en el artículo]
2. [Requisito específico encontrado en el artículo]
3. [Requisito específico encontrado en el artículo]
...

**Análisis**: Estos requisitos garantizan que la demanda cumpla con los elementos procesales necesarios..."

EJEMPLO INCORRECTO:
"Basándome en la información encontrada..." (respuesta vaga)

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
      
      // Fallback mejorado: extraer información jurídica específica del contexto
      let fallbackResponse = ""
      
      if (webSearchContext && !webSearchContext.includes('ERROR') && !webSearchContext.includes('SIN RESULTADOS')) {
        // Buscar artículos específicos y requisitos en el contexto
        const lines = webSearchContext.split('\n')
        
        // Buscar líneas que contengan información jurídica específica
        const relevantLines = lines.filter(line => {
          const trimmedLine = line.trim()
          return trimmedLine && 
                 !trimmedLine.includes('Title:') && 
                 !trimmedLine.includes('URL Source:') &&
                 !trimmedLine.includes('Published Time:') &&
                 !trimmedLine.includes('INFORMACIÓN JURÍDICA') &&
                 !trimmedLine.includes('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') &&
                 !trimmedLine.includes('INSTRUCCIÓN CRÍTICA') &&
                 (trimmedLine.includes('ARTÍCULO') || 
                  trimmedLine.includes('artículo') ||
                  trimmedLine.includes('Artículo') ||
                  trimmedLine.includes('REQUISITOS') ||
                  trimmedLine.includes('requisitos') ||
                  trimmedLine.includes('Código') ||
                  trimmedLine.includes('Ley') ||
                  trimmedLine.includes('demanda') ||
                  trimmedLine.includes('proceso'))
        })
        
        if (relevantLines.length > 0) {
          // Construir respuesta estructurada
          fallbackResponse = `**Marco Normativo**: Según la información encontrada en fuentes oficiales:

${relevantLines.slice(0, 15).join('\n')}

**Análisis**: Esta información se basa en la legislación colombiana vigente y establece los requisitos específicos para la demanda.`
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
