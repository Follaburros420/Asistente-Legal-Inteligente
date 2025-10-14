import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

export const runtime: ServerRuntime = "nodejs"
export const maxDuration = 60 // 60 segundos para Sequential Thinking

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages, useSequentialThinking } = json as {
    chatSettings: ChatSettings
    messages: any[]
    useSequentialThinking?: boolean
  }

  try {
    let profile
    try {
      profile = await getServerProfile()
    } catch (error) {
      console.log('⚠️ Usuario no autenticado, usando configuración por defecto')
      profile = {
        email: 'usuario-anonimo',
        openrouter_api_key: process.env.OPENROUTER_API_KEY || ''
      }
    }

    // Usar API key de OpenRouter desde variables de entorno o perfil
    const openrouterApiKey = process.env.OPENROUTER_API_KEY || profile.openrouter_api_key || ""

    if (!openrouterApiKey) {
      throw new Error("OpenRouter API Key no configurada. Por favor configura OPENROUTER_API_KEY en las variables de entorno o en tu perfil.")
    }

    const openai = new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: "https://openrouter.ai/api/v1"
    })

    // 🌐 Preparar mensajes con instrucciones de idioma y búsqueda web
    const enhancedMessages = [...messages]
    
    // Obtener el último mensaje del usuario
    const lastUserMessage = enhancedMessages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''

    // 🔥 BÚSQUEDA WEB OBLIGATORIA - SIEMPRE SE EJECUTA
    let webSearchContext = ''
    let searchResults: any = null
    
    console.log(`\n${"🔥".repeat(60)}`)
    console.log(`🔍 BÚSQUEDA WEB OBLIGATORIA - FORZADA`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: ${profile?.email || 'usuario-anonimo'}`)
    console.log(`${"🔥".repeat(60)}\n`)
    
    // FORZAR BÚSQUEDA - NO HAY EXCEPCIONES
    console.log(`📡 FORZANDO búsqueda en Google CSE...`)
    
    try {
      searchResults = await searchWebEnriched(userQuery)
      console.log(`📊 Resultado de búsqueda:`, {
        success: searchResults?.success,
        resultsCount: searchResults?.results?.length || 0,
        hasResults: !!(searchResults?.results && searchResults.results.length > 0)
      })
      
      if (searchResults && searchResults.success && searchResults.results && searchResults.results.length > 0) {
        webSearchContext = formatSearchResultsForContext(searchResults)
        
        console.log(`\n✅ BÚSQUEDA FORZADA - COMPLETADA CON ÉXITO:`)
        console.log(`   📊 Resultados encontrados: ${searchResults.results.length}`)
        console.log(`   🔗 URLs únicas: ${searchResults.sources?.length || 'N/A'}`)
        console.log(`   📝 Caracteres de contexto: ${webSearchContext.length}`)
        console.log(`\n📚 Fuentes encontradas:`)
        searchResults.results.slice(0, 5).forEach((result: any, i: number) => {
          console.log(`   ${i + 1}. ${result.title}`)
          console.log(`      ${result.url}`)
        })
        console.log(`\n${"🔥".repeat(60)}\n`)
      } else {
        console.log(`\n⚠️ BÚSQUEDA FORZADA - SIN RESULTADOS`)
        console.log(`   searchResults:`, searchResults)
        console.log(`${"🔥".repeat(60)}\n`)
        
        // FORZAR CONTEXTO VACÍO PERO CONFIRMAR BÚSQUEDA
        webSearchContext = `BÚSQUEDA EJECUTADA PERO SIN RESULTADOS PARA: "${userQuery}"`
      }
    } catch (error) {
      console.error(`\n❌ ERROR EN BÚSQUEDA FORZADA:`, error)
      console.log(`   Error details:`, error)
      console.log(`${"🔥".repeat(60)}\n`)
      
      // FORZAR CONTEXTO DE ERROR PERO CONFIRMAR INTENTO
      webSearchContext = `ERROR EN BÚSQUEDA WEB PARA: "${userQuery}" - ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
    
    // CONFIRMAR QUE SIEMPRE HAY CONTEXTO (aunque sea de error)
    console.log(`🎯 CONTEXTO FINAL DE BÚSQUEDA:`, {
      hasContext: !!webSearchContext,
      contextLength: webSearchContext.length,
      contextPreview: webSearchContext.substring(0, 100) + '...'
    })
    
    // Prompt OBLIGATORIO con búsqueda SIEMPRE
    const systemMessage = {
      role: "system",
      content: `Eres un asistente legal especializado en derecho colombiano.

**INFORMACIÓN DISPONIBLE**:
${webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS') ? 
  `⚠️ INFORMACIÓN LIMITADA: ${webSearchContext}

INSTRUCCIONES:
1. **Responde** basándote en tu conocimiento legal
2. **NO menciones** que realizaste búsquedas web
3. **NO incluyas** bibliografía web (no hay URLs válidas)
4. **Responde** como si toda la información fuera de tu conocimiento directo` : 
  `✅ INFORMACIÓN DISPONIBLE:

${webSearchContext}

INSTRUCCIONES:
1. **USA** la información disponible arriba para responder
2. **NO menciones** que realizaste búsquedas web
3. **Responde** como si toda la información fuera de tu conocimiento directo
4. **AL FINAL** de tu respuesta, después de "---", incluye:

   ## 📚 Fuentes Consultadas
   
   1. [Título](URL exacta copiada de arriba)
   2. [Título](URL exacta copiada de arriba)
   ...

5. **IMPORTANTE**: Usa SOLO las URLs que aparecen arriba. NO inventes URLs.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANTE**: NUNCA menciones que realizaste búsquedas en internet. Responde como si toda la información fuera de tu conocimiento directo.

Responde en español colombiano con terminología jurídica precisa.`
    }

    // Insertar el mensaje de sistema al inicio si no hay uno
    if (enhancedMessages.length === 0 || enhancedMessages[0].role !== "system") {
      enhancedMessages.unshift(systemMessage)
    } else {
      // Si ya hay un mensaje de sistema, agregar las instrucciones
      enhancedMessages[0].content = `${enhancedMessages[0].content}\n\n${systemMessage.content}`
    }

    console.log(`⚖️ Tongyi Legal: Configurado con búsqueda automática ${webSearchContext ? `(${webSearchContext.split('\n').length} líneas de contexto)` : '(sin resultados)'}`)

    const response = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages: enhancedMessages as ChatCompletionCreateParamsBase["messages"],
      temperature: chatSettings.temperature,
      max_tokens: undefined,
      stream: true
    })

    const stream = OpenAIStream(response)

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "OpenRouter API Key not found. Please set it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
