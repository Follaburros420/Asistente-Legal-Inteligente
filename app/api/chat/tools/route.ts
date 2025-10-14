import { openapiToFunctions } from "@/lib/openapi-conversion"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Tables } from "@/supabase/types"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

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

    // 🔥 BÚSQUEDA WEB OBLIGATORIA - SIEMPRE SE EJECUTA
    let webSearchContext = ''
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''
    
    console.log(`\n${"🔥".repeat(60)}`)
    console.log(`🔍 BÚSQUEDA WEB OBLIGATORIA EN TOOLS - FORZADA`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: ${profile?.email || 'usuario-anonimo'}`)
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

    let allTools: OpenAI.Chat.Completions.ChatCompletionTool[] = []
    let allRouteMaps = {}
    let schemaDetails = []

    // Si no hay herramientas seleccionadas, usar chat simple
    if (!selectedTools || selectedTools.length === 0) {
      console.log('⚠️ No hay herramientas seleccionadas, usando chat simple')
      
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

    // Agregar contexto de búsqueda web a los mensajes
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
