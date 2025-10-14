import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { chatSettings, messages } = json as {
      chatSettings: ChatSettings
      messages: any[]
    }

    // Usar API key de OpenRouter desde variables de entorno
    const openrouterApiKey = process.env.OPENROUTER_API_KEY || ""

    if (!openrouterApiKey) {
      return new Response(JSON.stringify({ 
        message: "OpenRouter API Key no configurada. Por favor configura OPENROUTER_API_KEY en las variables de entorno." 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Crear cliente OpenAI con configuración robusta
    const openai = new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: "https://openrouter.ai/api/v1",
      timeout: 60000, // 60 segundos timeout
      maxRetries: 3
    })

    // 🔥 BÚSQUEDA WEB OBLIGATORIA - SIEMPRE SE EJECUTA
    let webSearchContext = ''
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''
    
    console.log(`\n${"🔥".repeat(60)}`)
    console.log(`🔍 CHAT INDEPENDIENTE - BÚSQUEDA WEB FORZADA`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: usuario-anonimo`)
    console.log(`   Modelo: ${chatSettings.model}`)
    console.log(`${"🔥".repeat(60)}\n`)
    
    try {
      console.log(`📡 FORZANDO búsqueda en Google CSE...`)
      const searchResults = await searchWebEnriched(userQuery)
      
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

    // Crear mensaje de sistema robusto
    const systemMessage = {
      role: "system",
      content: `Eres un asistente legal especializado en derecho colombiano.

🔥 BÚSQUEDA WEB EJECUTADA OBLIGATORIAMENTE

He ejecutado una búsqueda en internet sobre "${userQuery}" como parte del proceso obligatorio.

${webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS') ? 
  `⚠️ RESULTADO DE BÚSQUEDA: ${webSearchContext}

Aunque la búsqueda no encontró resultados específicos, DEBES mencionar que se ejecutó una búsqueda web como parte de tu respuesta.

INSTRUCCIONES:
1. **MENCIONA** que se ejecutó una búsqueda web
2. **Responde** basándote en tu conocimiento legal
3. **NO incluyas** bibliografía web (no hay URLs válidas)
4. **Explica** que la búsqueda no encontró fuentes específicas` : 
  `✅ RESULTADO DE BÚSQUEDA: Información encontrada

${webSearchContext}

INSTRUCCIONES:
1. **USA** la información de búsqueda arriba para responder
2. **MENCIONA** que se ejecutó una búsqueda web
3. **AL FINAL** de tu respuesta, después de "---", incluye:

   ## 📚 Fuentes Consultadas
   
   1. [Título](URL exacta copiada de arriba)
   2. [Título](URL exacta copiada de arriba)
   ...

4. **IMPORTANTE**: Usa SOLO las URLs que aparecen arriba. NO inventes URLs.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**OBLIGATORIO**: Siempre menciona que se ejecutó una búsqueda web en tu respuesta.

Responde en español colombiano con terminología jurídica precisa.`
    }

    // Preparar mensajes
    const enhancedMessages = [...messages]
    
    // Insertar el mensaje de sistema al inicio
    if (enhancedMessages.length === 0 || enhancedMessages[0].role !== "system") {
      enhancedMessages.unshift(systemMessage)
    } else {
      // Si ya hay un mensaje de sistema, agregar las instrucciones
      enhancedMessages[0].content = `${enhancedMessages[0].content}\n\n${systemMessage.content}`
    }

    console.log(`⚖️ Chat Independiente: Configurado con búsqueda automática ${webSearchContext ? `(${webSearchContext.split('\n').length} líneas de contexto)` : '(sin resultados)'}`)

    // Usar un modelo más estable por defecto
    const modelToUse = chatSettings.model || "openai/gpt-3.5-turbo"
    
    console.log(`🤖 Usando modelo: ${modelToUse}`)

    // Crear respuesta con OpenAI con manejo robusto de errores
    try {
      const response = await openai.chat.completions.create({
        model: modelToUse as ChatCompletionCreateParamsBase["model"],
        messages: enhancedMessages as ChatCompletionCreateParamsBase["messages"],
        temperature: chatSettings.temperature || 0.7,
        max_tokens: undefined,
        stream: true
      })

      const stream = OpenAIStream(response)
      return new StreamingTextResponse(stream)
    } catch (openaiError: any) {
      console.error('Error específico de OpenAI:', openaiError)
      
      // Si falla con el modelo especificado, intentar con un modelo por defecto
      if (modelToUse !== "openai/gpt-3.5-turbo") {
        console.log(`🔄 Reintentando con modelo por defecto: openai/gpt-3.5-turbo`)
        
        try {
          const fallbackResponse = await openai.chat.completions.create({
            model: "openai/gpt-3.5-turbo" as ChatCompletionCreateParamsBase["model"],
            messages: enhancedMessages as ChatCompletionCreateParamsBase["messages"],
            temperature: 0.7,
            max_tokens: undefined,
            stream: true
          })

          const stream = OpenAIStream(fallbackResponse)
          return new StreamingTextResponse(stream)
        } catch (fallbackError: any) {
          console.error('Error en modelo de respaldo:', fallbackError)
          throw fallbackError
        }
      } else {
        throw openaiError
      }
    }
  } catch (error: any) {
    console.error('Error en chat independiente:', error)
    
    // Respuesta de error más informativa
    const errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    return new Response(JSON.stringify({ 
      message: `Error en chat independiente: ${errorMessage}`,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
      details: {
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        openRouterKeyPreview: process.env.OPENROUTER_API_KEY ? 
          `${process.env.OPENROUTER_API_KEY.substring(0, 10)}...` : 'No configurada'
      }
    }), {
      status: errorCode,
      headers: { "Content-Type": "application/json" }
    })
  }
}
