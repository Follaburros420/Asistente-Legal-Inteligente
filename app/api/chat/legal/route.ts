import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { searchWebNoApi, enrichNoApiResults } from "@/lib/tools/no-api-search"
import { LEGAL_SYSTEM_PROMPT, formatLegalSearchContext } from "@/lib/prompts/legal-agent"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
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

    // 🔥 BÚSQUEDA JURÍDICA ESPECIALIZADA - SIEMPRE SE EJECUTA
    let webSearchContext = ''
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''
    
    console.log(`\n${"⚖️".repeat(60)}`)
    console.log(`⚖️ ASISTENTE LEGAL COLOMBIANO - BÚSQUEDA JURÍDICA ESPECIALIZADA`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: ${profile?.username || 'usuario-anonimo'}`)
    console.log(`${"⚖️".repeat(60)}\n`)
    
    try {
      console.log(`🔍 EJECUTANDO búsqueda web simplificada (sin Wikipedia)...`)
      
      // Usar el sistema sin APIs que solo filtra Wikipedia
      const searchResults = await searchWebNoApi(userQuery, 5)
      
      if (searchResults && searchResults.success && searchResults.results && searchResults.results.length > 0) {
        // Enriquecer los resultados con contenido completo
        const enrichedResults = await enrichNoApiResults(searchResults.results, 3)
        
        // Formatear resultados para el contexto
        const resultsText = enrichedResults.map((result: any, index: number) => 
          `FUENTE ${index + 1}: ${result.title}\nURL: ${result.url}\nCONTENIDO: ${result.snippet}\n---`
        ).join('\n')
        
        webSearchContext = `RESULTADOS DE BÚSQUEDA WEB (Wikipedia filtrada):\n\n${resultsText}`
        
        console.log(`\n✅ BÚSQUEDA SIN APIs - COMPLETADA CON ÉXITO:`)
        console.log(`   📊 Resultados encontrados: ${searchResults.results.length}`)
        console.log(`   📝 Caracteres de contexto: ${webSearchContext.length}`)
        console.log(`   🚫 Wikipedia: Filtrada exitosamente`)
        console.log(`${"⚖️".repeat(60)}\n`)
        
      } else {
        console.log(`\n⚠️ BÚSQUEDA WEB - SIN RESULTADOS`)
        webSearchContext = `BÚSQUEDA WEB EJECUTADA PERO SIN RESULTADOS PARA: "${userQuery}"`
        console.log(`${"⚖️".repeat(60)}\n`)
      }
    } catch (error) {
      console.error(`\n❌ ERROR EN BÚSQUEDA WEB:`, error)
      webSearchContext = `ERROR EN BÚSQUEDA WEB PARA: "${userQuery}" - ${error instanceof Error ? error.message : 'Error desconocido'}`
      console.log(`${"⚖️".repeat(60)}\n`)
    }

    // Crear mensaje de sistema especializado para derecho colombiano
    const systemMessage = {
      role: "system",
      content: `${LEGAL_SYSTEM_PROMPT}

${webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS') ? 
  `⚠️ RESULTADO DE BÚSQUEDA JURÍDICA: ${webSearchContext}

Aunque la búsqueda no encontró resultados específicos, DEBES mencionar que se ejecutó una búsqueda jurídica como parte de tu respuesta.

INSTRUCCIONES ESPECIALES:
1. **MENCIONA** que se ejecutó una búsqueda jurídica especializada
2. **Responde** basándote en tu conocimiento legal del derecho colombiano
3. **SÉ EXPLÍCITO** sobre la falta de fuentes web específicas
4. **OFRECE** orientación general con la salvedad correspondiente` : 
  `✅ RESULTADO DE BÚSQUEDA JURÍDICA: Información legal encontrada

${webSearchContext}

INSTRUCCIONES ESPECIALES:
1. **USA** la información legal encontrada arriba como base principal
2. **MENCIONA** que se ejecutó una búsqueda jurídica especializada
3. **APLICA** el formato estructurado según la complejidad de la consulta
4. **VERIFICA** la vigencia y aplicabilidad de las normas citadas
5. **AL FINAL**, incluye la sección "## 📚 Fuentes Consultadas" exactamente como se indica`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇨🇴 ESPECIALIZACIÓN EN DERECHO COLOMBIANO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**OBLIGATORIO**: 
- Siempre menciona que se ejecutó una búsqueda jurídica especializada
- Usa terminología jurídica colombiana precisa
- Prioriza el ordenamiento jurídico colombiano
- Incluye siempre la sección de fuentes consultadas
- Sé claro sobre la vigencia de las normas`
    }

    // Insertar el mensaje de sistema al inicio
    if (messages.length === 0 || messages[0].role !== "system") {
      messages.unshift(systemMessage)
    } else {
      // Si ya hay un mensaje de sistema, agregar las instrucciones legales
      messages[0].content = `${messages[0].content}\n\n${systemMessage.content}`
    }

    console.log(`🤖 GENERANDO respuesta con especialización en derecho colombiano...`)

    const response = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages,
      temperature: chatSettings.temperature || 0.3, // Temperatura más baja para mayor precisión legal
      max_tokens: 4000, // Límite superior para respuestas legales detalladas
      stream: true
    })

    const stream = OpenAIStream(response)
    return new StreamingTextResponse(stream)

  } catch (error: any) {
    console.error('❌ Error en asistente legal colombiano:', error)
    const errorMessage = error.error?.message || "Error en el asistente legal colombiano"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ 
      message: errorMessage,
      error: "ASISTENTE_LEGAL_ERROR"
    }), {
      status: errorCode
    })
  }
}

export const runtime = 'edge'
