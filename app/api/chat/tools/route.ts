import { openapiToFunctions } from "@/lib/openapi-conversion"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Tables } from "@/supabase/types"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { executeConditionalWebSearch, generateSystemMessage } from "@/lib/tools/conditional-web-search"
import { LEGAL_SYSTEM_PROMPT, formatLegalSearchContext } from "@/lib/prompts/legal-agent"

// Función específica para formatear resultados de búsqueda legal especializada
function formatLegalSearchResultsForContext(searchResponse: any): string {
  if (!searchResponse.success || searchResponse.results.length === 0) {
    return `No se encontraron resultados legales específicos para: "${searchResponse.query}"`
  }

  const officialSources = searchResponse.results.filter((r: any) => r.type === 'official')
  const academicSources = searchResponse.results.filter((r: any) => r.type === 'academic')
  const newsSources = searchResponse.results.filter((r: any) => r.type === 'news')
  const generalSources = searchResponse.results.filter((r: any) => r.type === 'general')

  let context = `⚖️ INFORMACIÓN LEGAL ESPECIALIZADA ENCONTRADA:\n\n`
  context += `📊 Estrategia de búsqueda: ${searchResponse.searchStrategy}\n`
  context += `📋 Resumen de fuentes:\n`
  context += `   - Fuentes oficiales: ${officialSources.length}\n`
  context += `   - Fuentes académicas: ${academicSources.length}\n`
  context += `   - Fuentes noticiosas: ${newsSources.length}\n`
  context += `   - Fuentes generales: ${generalSources.length}\n\n`

  // Priorizar fuentes oficiales
  const prioritizedResults = [...officialSources, ...academicSources, ...newsSources, ...generalSources]

  prioritizedResults.forEach((result: any, index: number) => {
    const sourceType = result.type === 'official' ? '[OFICIAL]' : 
                     result.type === 'academic' ? '[ACADÉMICA]' : 
                     result.type === 'news' ? '[NOTICIAS]' : '[GENERAL]'
    
    context += `**${index + 1}. ${sourceType} ${result.title}**\n`
    context += `🔗 URL: ${result.url}\n`
    context += `⭐ Relevancia: ${result.relevance}/20\n`
    context += `📝 Contenido legal:\n${result.snippet}\n\n`
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
  })

  context += `🚨 INSTRUCCIONES CRÍTICAS:\n`
  context += `1. USA ÚNICAMENTE la información legal específica encontrada arriba\n`
  context += `2. PRIORIZA fuentes oficiales (.gov.co) sobre otras fuentes\n`
  context += `3. NO uses información general si hay información específica aquí\n`
  context += `4. Wikipedia está COMPLETAMENTE EXCLUIDA de esta búsqueda\n`
  context += `5. Responde con precisión jurídica colombiana\n\n`

  return context
}

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages, selectedTools } = json as {
    chatSettings: ChatSettings
    messages: any[]
    selectedTools: Tables<"tools">[]
  }

  try {
    let profile
    try {
      profile = await getServerProfile()
    } catch (error) {
      console.log('⚠️ Usuario no autenticado, usando configuración por defecto')
      profile = {
        username: 'usuario-anonimo',
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
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''
    
    console.log(`\n${"🧠".repeat(60)}`)
    console.log(`🔍 CHAT TOOLS - BÚSQUEDA WEB INTELIGENTE`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: ${profile?.username || 'usuario-anonimo'}`)
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

    let allTools: OpenAI.Chat.Completions.ChatCompletionTool[] = []
    let allRouteMaps = {}
    let schemaDetails = []

    // Si no hay herramientas seleccionadas, usar chat simple
    if (!selectedTools || selectedTools.length === 0) {
      console.log('⚠️ No hay herramientas seleccionadas, usando chat simple')
      
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
    }

    for (const selectedTool of selectedTools) {
      try {
        // Verificar que el schema sea válido antes de parsearlo
        let toolSchema
        try {
          toolSchema = typeof selectedTool.schema === 'string' 
            ? JSON.parse(selectedTool.schema) 
            : selectedTool.schema
        } catch (error) {
          console.error(`❌ Error parsing schema for tool ${selectedTool.name}:`, error)
          continue // Saltar esta herramienta si el schema es inválido
        }

        const convertedSchema = await openapiToFunctions(toolSchema)
        
        // Validar que convertedSchema sea válido
        if (!convertedSchema || typeof convertedSchema !== 'object') {
          console.error(`❌ Invalid converted schema for tool ${selectedTool.name}`)
          continue
        }
        
        const tools = convertedSchema.functions || []
        allTools = allTools.concat(tools)

        // Validar que routes exista y sea un array
        if (!convertedSchema.routes || !Array.isArray(convertedSchema.routes)) {
          console.error(`❌ Invalid routes for tool ${selectedTool.name}`)
          continue
        }

        const routeMap = convertedSchema.routes.reduce(
          (map: Record<string, string>, route) => {
            if (route && route.path && route.operationId) {
              map[route.path.replace(/{(\w+)}/g, ":$1")] = route.operationId
            }
            return map
          },
          {}
        )

        allRouteMaps = { ...allRouteMaps, ...routeMap }

        // Validar que info exista antes de acceder a sus propiedades
        const info = convertedSchema.info || {}
        schemaDetails.push({
          title: info.title || selectedTool.name,
          description: info.description || '',
          url: info.server || '',
          headers: selectedTool.custom_headers,
          routeMap,
          requestInBody: convertedSchema.routes[0]?.requestInBody || false
        })
      } catch (error: any) {
        console.error("Error converting schema", error)
      }
    }

    // Agregar contexto de búsqueda legal especializada a los mensajes
    const systemMessage = {
      role: "system",
      content: `Eres un asistente legal especializado en derecho colombiano.

⚖️ BÚSQUEDA LEGAL ESPECIALIZADA EJECUTADA

He ejecutado una búsqueda legal especializada sobre "${userQuery}" usando herramientas optimizadas que excluyen Wikipedia y priorizan fuentes oficiales colombianas.

**MEMORIA DE CONVERSACIÓN**:
- SIEMPRE recuerda el contexto de mensajes anteriores en esta conversación
- Si el usuario hace referencia a algo mencionado antes, responde en ese contexto
- Mantén coherencia con respuestas previas sobre el mismo tema
- NO repitas información ya proporcionada, pero puedes ampliarla si es necesario

**FORMATO DE RESPUESTA**:
Responde de forma directa y conversacional, como un abogado experto. NO uses títulos como "Marco Normativo", "Análisis Jurídico", etc. Responde directamente la pregunta específica del usuario.

${webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS') ? 
  `⚠️ RESULTADO DE BÚSQUEDA LEGAL: ${webSearchContext}

Aunque la búsqueda legal especializada no encontró resultados específicos, responde basándote en tu conocimiento jurídico colombiano.

INSTRUCCIONES:
1. **Responde** basándote en tu conocimiento legal colombiano
2. **NO incluyas** bibliografía web (no hay URLs válidas)
3. **Explica** que la búsqueda legal no encontró fuentes específicas
4. **Usa** terminología jurídica colombiana precisa` : 
  `✅ RESULTADO DE BÚSQUEDA LEGAL: Información jurídica encontrada

${webSearchContext}

INSTRUCCIONES:
1. **USA** la información legal encontrada arriba para responder
2. **PRIORIZA** fuentes oficiales (.gov.co) sobre otras fuentes
3. **RESPONDE** de forma directa y conversacional, sin títulos formales
4. **AL FINAL** de tu respuesta, incluye:

   📚 Fuentes Consultadas
   
   1. [Título](URL exacta copiada de arriba)
   2. [Título](URL exacta copiada de arriba)
   ...

5. **IMPORTANTE**: Usa SOLO las URLs que aparecen arriba. NO inventes URLs.
6. **WIKIPEDIA**: Está completamente excluida de las búsquedas legales`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**OBLIGATORIO**: Responde directamente sobre el derecho colombiano con precisión jurídica, recordando el contexto de la conversación.

Responde en español colombiano con terminología jurídica precisa.`
    }

    // Insertar el mensaje de sistema al inicio
    if (messages.length === 0 || messages[0].role !== "system") {
      messages.unshift(systemMessage)
    } else {
      // Si ya hay un mensaje de sistema, agregar las instrucciones
      messages[0].content = `${messages[0].content}\n\n${systemMessage.content}`
    }

    const firstResponse = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages,
      tools: allTools.length > 0 ? allTools : undefined
    })

    const message = firstResponse.choices[0].message
    messages.push(message)
    const toolCalls = message.tool_calls || []

    if (toolCalls.length === 0) {
      return new Response(message.content, {
        headers: {
          "Content-Type": "application/json"
        }
      })
    }

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const functionCall = toolCall.function
        const functionName = functionCall.name
        const argumentsString = toolCall.function.arguments.trim()
        const parsedArgs = JSON.parse(argumentsString)

        // Find the schema detail that contains the function name
        const schemaDetail = schemaDetails.find(detail =>
          Object.values(detail.routeMap).includes(functionName)
        )

        if (!schemaDetail) {
          throw new Error(`Function ${functionName} not found in any schema`)
        }

        const pathTemplate = Object.keys(schemaDetail.routeMap).find(
          key => schemaDetail.routeMap[key] === functionName
        )

        if (!pathTemplate) {
          throw new Error(`Path for function ${functionName} not found`)
        }

        const path = pathTemplate.replace(/:(\w+)/g, (_, paramName) => {
          const value = parsedArgs.parameters[paramName]
          if (!value) {
            throw new Error(
              `Parameter ${paramName} not found for function ${functionName}`
            )
          }
          return encodeURIComponent(value)
        })

        if (!path) {
          throw new Error(`Path for function ${functionName} not found`)
        }

        // Determine if the request should be in the body or as a query
        const isRequestInBody = schemaDetail.requestInBody
        let data = {}

        if (isRequestInBody) {
          // If the type is set to body
          let headers = {
            "Content-Type": "application/json"
          }

          // Check if custom headers are set
          const customHeaders = schemaDetail.headers // Moved this line up to the loop
          // Check if custom headers are set and are of type string
          if (customHeaders && typeof customHeaders === "string") {
            let parsedCustomHeaders = JSON.parse(customHeaders) as Record<
              string,
              string
            >

            headers = {
              ...headers,
              ...parsedCustomHeaders
            }
          }

          const fullUrl = schemaDetail.url + path

          const bodyContent = parsedArgs.requestBody || parsedArgs

          const requestInit = {
            method: "POST",
            headers,
            body: JSON.stringify(bodyContent) // Use the extracted requestBody or the entire parsedArgs
          }

          const response = await fetch(fullUrl, requestInit)

          if (!response.ok) {
            data = {
              error: response.statusText
            }
          } else {
            data = await response.json()
          }
        } else {
          // If the type is set to query
          const queryParams = new URLSearchParams(
            parsedArgs.parameters
          ).toString()
          const fullUrl =
            schemaDetail.url + path + (queryParams ? "?" + queryParams : "")

          let headers = {}

          // Check if custom headers are set
          const customHeaders = schemaDetail.headers
          if (customHeaders && typeof customHeaders === "string") {
            headers = JSON.parse(customHeaders)
          }

          const response = await fetch(fullUrl, {
            method: "GET",
            headers: headers
          })

          if (!response.ok) {
            data = {
              error: response.statusText
            }
          } else {
            data = await response.json()
          }
        }

        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(data)
        })
      }
    }

    const secondResponse = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages,
      stream: true
    })

    const stream = OpenAIStream(secondResponse)

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    console.error(error)
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
