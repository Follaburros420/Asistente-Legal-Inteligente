import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { executeConditionalWebSearch, generateSystemMessage } from "@/lib/tools/conditional-web-search"

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

    // 🧠 BÚSQUEDA WEB INTELIGENTE - SOLO CUANDO ES NECESARIO
    const enhancedMessages = [...messages]
    const lastUserMessage = enhancedMessages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''
    
    console.log(`\n${"🧠".repeat(60)}`)
    console.log(`🔍 OPENROUTER - BÚSQUEDA WEB INTELIGENTE`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: ${profile?.email || 'usuario-anonimo'}`)
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
    if (searchResult.searchResults) {
      console.log(`   📊 Resultados: ${searchResult.searchResults.results?.length || 0}`)
    }
    console.log(`${"🧠".repeat(60)}\n`)
    
    // Generar mensaje de sistema apropiado
    const systemMessage = {
      role: "system",
      content: generateSystemMessage(userQuery, searchResult)
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
