/**
 * Generar embeddings usando OpenRouter
 * Compatible con múltiples modelos de embeddings disponibles en OpenRouter
 */

export async function generateOpenRouterEmbedding(
  text: string,
  apiKeyOrModel?: string,
  modelParam?: string
): Promise<number[]> {
  try {
    // Soporte para ambas firmas: (text, apiKey, model) o (text, model)
    let apiKey: string | undefined
    let model: string
    
    if (modelParam) {
      // Firma: (text, apiKey, model)
      apiKey = apiKeyOrModel
      model = modelParam
    } else if (apiKeyOrModel && (apiKeyOrModel.startsWith('sk-') || apiKeyOrModel.startsWith('or-'))) {
      // Firma: (text, apiKey) - usar modelo por defecto
      apiKey = apiKeyOrModel
      model = 'text-embedding-3-small'
    } else {
      // Firma: (text, model) - usar API key de entorno
      apiKey = process.env.OPENROUTER_API_KEY
      model = apiKeyOrModel || 'text-embedding-3-small'
    }
    
    if (!apiKey) {
      throw new Error('OpenRouter API key not found')
    }

    console.log(`🔍 Llamando a OpenRouter (single), modelo: ${model}`)
    
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Asistente Legal Inteligente'
      },
      body: JSON.stringify({
        model: model,
        input: text
      })
    })

    console.log(`📡 OpenRouter response status: ${response.status}`)

    if (!response.ok) {
      const contentType = response.headers.get('content-type')
      console.error(`❌ OpenRouter error - Status: ${response.status}, Content-Type: ${contentType}`)
      
      const responseText = await response.text()
      console.error(`❌ OpenRouter error response: ${responseText.substring(0, 500)}`)
      
      let errorData: any = {}
      try {
        errorData = JSON.parse(responseText)
      } catch {
        throw new Error(`OpenRouter API error (${response.status}): ${responseText.substring(0, 200)}`)
      }
      
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`)
    }

    const responseText = await response.text()
    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error(`❌ Error parsing OpenRouter response as JSON:`, parseError)
      console.error(`Response text: ${responseText.substring(0, 500)}`)
      throw new Error(`Invalid JSON response from OpenRouter API`)
    }
    
    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      throw new Error('Invalid response from OpenRouter API')
    }

    return data.data[0].embedding

  } catch (error) {
    console.error('OpenRouter embedding error:', error)
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Modelos de embeddings disponibles en OpenRouter
 */
export const OPENROUTER_EMBEDDING_MODELS = {
  'text-embedding-3-small': {
    name: 'OpenAI Text Embedding 3 Small',
    dimensions: 1536,
    cost: 'low'
  },
  'text-embedding-3-large': {
    name: 'OpenAI Text Embedding 3 Large', 
    dimensions: 3072,
    cost: 'medium'
  },
  'text-embedding-ada-002': {
    name: 'OpenAI Text Embedding Ada 002',
    dimensions: 1536,
    cost: 'low'
  }
}

/**
 * Función para generar múltiples embeddings en paralelo
 */
export async function generateMultipleOpenRouterEmbeddings(
  texts: string[],
  apiKeyOrModel?: string,
  modelParam?: string
): Promise<(number[] | null)[]> {
  try {
    // Soporte para ambas firmas: (texts, apiKey, model) o (texts, model)
    let apiKey: string | undefined
    let model: string
    
    if (modelParam) {
      // Firma: (texts, apiKey, model)
      apiKey = apiKeyOrModel
      model = modelParam
    } else if (apiKeyOrModel && (apiKeyOrModel.startsWith('sk-') || apiKeyOrModel.startsWith('or-'))) {
      // Firma: (texts, apiKey) - usar modelo por defecto
      apiKey = apiKeyOrModel
      model = 'text-embedding-3-small'
    } else {
      // Firma: (texts, model) - usar API key de entorno
      apiKey = process.env.OPENROUTER_API_KEY
      model = apiKeyOrModel || 'text-embedding-3-small'
    }
    
    if (!apiKey) {
      throw new Error('OpenRouter API key not found')
    }

    console.log(`🔍 Llamando a OpenRouter con ${texts.length} textos, modelo: ${model}`)
    
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Asistente Legal Inteligente'
      },
      body: JSON.stringify({
        model: model,
        input: texts
      })
    })

    console.log(`📡 OpenRouter response status: ${response.status}`)
    
    if (!response.ok) {
      const contentType = response.headers.get('content-type')
      console.error(`❌ OpenRouter error - Status: ${response.status}, Content-Type: ${contentType}`)
      
      // Intentar leer como texto primero
      const responseText = await response.text()
      console.error(`❌ OpenRouter error response: ${responseText.substring(0, 500)}`)
      
      // Intentar parsear como JSON si es posible
      let errorData: any = {}
      try {
        errorData = JSON.parse(responseText)
      } catch {
        // Si no es JSON, usar el texto como mensaje de error
        throw new Error(`OpenRouter API error (${response.status}): ${responseText.substring(0, 200)}`)
      }
      
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`)
    }

    const responseText = await response.text()
    console.log(`📄 OpenRouter response preview: ${responseText.substring(0, 200)}...`)
    
    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error(`❌ Error parsing OpenRouter response as JSON:`, parseError)
      console.error(`Response text: ${responseText.substring(0, 500)}`)
      throw new Error(`Invalid JSON response from OpenRouter API. Response starts with: ${responseText.substring(0, 100)}`)
    }
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response from OpenRouter API')
    }

    return data.data.map((item: any) => item.embedding || null)

  } catch (error) {
    console.error('OpenRouter multiple embeddings error:', error)
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}


