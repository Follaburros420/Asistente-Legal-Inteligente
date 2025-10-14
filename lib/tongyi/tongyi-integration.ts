/**
 * Integración completa para Tongyi Deep Research con acceso a internet
 */

export interface TongyiSearchOptions {
  type?: 'general' | 'news' | 'legal'
  query: string
}

export interface TongyiSearchResult {
  success: boolean
  query: string
  results: string
  timestamp: string
  error?: string
}

/**
 * Función principal que Tongyi puede usar para buscar información en internet
 */
export async function tongyiSearchWeb(options: TongyiSearchOptions): Promise<TongyiSearchResult> {
  try {
    const { query, type = 'general' } = options

    // Llamar a nuestra API de búsqueda directa
    const response = await fetch('http://localhost:3000/api/tongyi/direct-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        type
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Search failed')
    }

    return {
      success: true,
      query,
      results: data.results,
      timestamp: data.timestamp
    }

  } catch (error) {
    console.error('Tongyi search error:', error)
    return {
      success: false,
      query: options.query,
      results: '',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Función especializada para búsquedas de actualidad
 */
export async function tongyiSearchNews(query: string): Promise<TongyiSearchResult> {
  return tongyiSearchWeb({ query, type: 'news' })
}

/**
 * Función especializada para búsquedas legales
 */
export async function tongyiSearchLegal(query: string): Promise<TongyiSearchResult> {
  return tongyiSearchWeb({ query, type: 'legal' })
}

/**
 * Función para búsquedas generales
 */
export async function tongyiSearchGeneral(query: string): Promise<TongyiSearchResult> {
  return tongyiSearchWeb({ query, type: 'general' })
}

// Exportar todas las funciones para uso directo
export const tongyiWebSearch = {
  search: tongyiSearchWeb,
  searchNews: tongyiSearchNews,
  searchLegal: tongyiSearchLegal,
  searchGeneral: tongyiSearchGeneral
}

/**
 * Instrucciones para Tongyi sobre cómo usar las herramientas de búsqueda
 */
export const TONGYI_SEARCH_INSTRUCTIONS = `
🔍 **HERRAMIENTAS DE BÚSQUEDA WEB DISPONIBLES:**

Tienes acceso a herramientas de búsqueda web que te permiten obtener información actualizada de internet. Usa estas herramientas cuando necesites:

1. **Información de actualidad**: Para noticias recientes y eventos actuales
2. **Información legal**: Para consultas sobre leyes, jurisprudencia y regulaciones
3. **Información general**: Para cualquier consulta que requiera datos actualizados

**FUNCIONES DISPONIBLES:**

- \`tongyiSearchNews(query)\`: Buscar noticias y actualidad
- \`tongyiSearchLegal(query)\`: Buscar información legal especializada
- \`tongyiSearchGeneral(query)\`: Búsqueda general de información

**EJEMPLOS DE USO:**

1. **Para noticias actuales:**
   \`\`\`
   const result = await tongyiSearchNews("noticias actuales Colombia")
   \`\`\`

2. **Para consultas legales:**
   \`\`\`
   const result = await tongyiSearchLegal("contratos de arrendamiento")
   \`\`\`

3. **Para información general:**
   \`\`\`
   const result = await tongyiSearchGeneral("información sobre Colombia")
   \`\`\`

**INSTRUCCIONES IMPORTANTES:**

- Siempre usa estas herramientas antes de responder consultas que requieran información actualizada
- Combina la información obtenida con tu conocimiento para proporcionar respuestas completas
- Cita las fuentes cuando sea relevante
- Advierte sobre la necesidad de verificar información crítica
- Usa el tipo de búsqueda apropiado según la naturaleza de la consulta

**FLUJO DE TRABAJO RECOMENDADO:**

1. Recibe la consulta del usuario
2. Identifica si requiere información actualizada
3. Usa la herramienta de búsqueda apropiada
4. Analiza los resultados obtenidos
5. Proporciona una respuesta completa basada en la información encontrada
6. Incluye recomendaciones adicionales si es necesario
`

// Función para obtener las instrucciones
export function getTongyiSearchInstructions(): string {
  return TONGYI_SEARCH_INSTRUCTIONS
}



