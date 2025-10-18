import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { executeConditionalWebSearch, generateSystemMessage } from "@/lib/tools/conditional-web-search"

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

    // 🧠 BÚSQUEDA WEB INTELIGENTE - SOLO CUANDO ES NECESARIO
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''
    
    console.log(`\n${"🧠".repeat(60)}`)
    console.log(`🔍 CHAT INDEPENDIENTE - BÚSQUEDA WEB INTELIGENTE`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: usuario-anonimo`)
    console.log(`   Modelo: ${chatSettings.model}`)
    console.log(`${"🧠".repeat(60)}\n`)
    
    // Ejecutar búsqueda condicional inteligente
    const searchResult = await executeConditionalWebSearch(userQuery, {
      logDetection: true
    })
    
    console.log(`\n${"🧠".repeat(60)}`)
    console.log(`✅ ANÁLISIS INTELIGENTE COMPLETADO`)
    console.log(`   🔍 Búsqueda requerida: ${searchResult.shouldSearch ? 'SÍ' : 'NO'}`)
    console.log(`   🎯 Confianza: ${(searchResult.detectionResult.confidence * 100).toFixed(1)}%`)
    console.log(`   📋 Razón: ${searchResult.detectionResult.reason}`)
    console.log(`${"🧠".repeat(60)}\n`)

    // Generar mensaje de sistema apropiado
    const systemMessage = {
      role: "system",
      content: generateSystemMessage(userQuery, searchResult)
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

    console.log(`⚖️ Chat Independiente: Configurado con búsqueda inteligente ${searchResult.shouldSearch ? `(${searchResult.searchResults?.results?.length || 0} resultados)` : '(sin búsqueda requerida)'}`)

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
