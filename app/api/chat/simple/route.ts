import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { executeConditionalWebSearch, generateSystemMessage } from "@/lib/tools/conditional-web-search"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    // Usar API key de OpenRouter desde variables de entorno
    const openrouterApiKey = process.env.OPENROUTER_API_KEY || ""

    if (!openrouterApiKey) {
      throw new Error("OpenRouter API Key no configurada. Por favor configura OPENROUTER_API_KEY en las variables de entorno.")
    }

    const openai = new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: "https://openrouter.ai/api/v1"
    })

    // 🧠 BÚSQUEDA WEB INTELIGENTE - SOLO CUANDO ES NECESARIO
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''
    
    console.log(`\n${"🧠".repeat(60)}`)
    console.log(`🔍 CHAT SIMPLE - BÚSQUEDA WEB INTELIGENTE`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: usuario-anonimo`)
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

    // Insertar el mensaje de sistema al inicio
    if (messages.length === 0 || messages[0].role !== "system") {
      messages.unshift(systemMessage)
    } else {
      // Si ya hay un mensaje de sistema, agregar las instrucciones
      messages[0].content = `${messages[0].content}\n\n${systemMessage.content}`
    }

    const response = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages,
      temperature: chatSettings.temperature,
      max_tokens: undefined,
      stream: true
    })

    const stream = OpenAIStream(response)

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    console.error('Error en chat simple:', error)
    const errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
