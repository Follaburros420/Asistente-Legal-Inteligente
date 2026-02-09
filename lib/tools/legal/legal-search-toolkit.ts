/**
 * Toolkit de Herramientas Legales - SERPER ÚNICA HERRAMIENTA DE BÚSQUEDA
 * 
 * Este módulo define las herramientas disponibles para el agente legal.
 * Todas las herramientas de búsqueda usan Serper como backend único.
 */

import { 
  searchLegalColombia, 
  searchJurisprudencia, 
  searchArticuloLey,
  formatSearchResultsForLLM 
} from '../search/serper-legal-search'

// ═══════════════════════════════════════════════════════════════════════════════
// DEFINICIONES DE HERRAMIENTAS PARA OPENAI TOOL CALLING
// ═══════════════════════════════════════════════════════════════════════════════

export const LEGAL_TOOLS_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_legal_official",
      description: "Busca información legal en fuentes oficiales colombianas usando Serper. " +
        "Usa esta herramienta para consultas sobre leyes, decretos, normas, jurisprudencia, " +
        "artículos de códigos, sentencias, y cualquier tema de derecho colombiano. " +
        "SIEMPRE usa esta herramienta antes de responder consultas legales.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Términos de búsqueda específicos. Incluye números de artículos, nombres de leyes, etc."
          },
          num_results: {
            type: "number",
            description: "Número de resultados deseados (1-10)",
            default: 5
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "search_jurisprudencia",
      description: "Busca sentencias y jurisprudencia de altas cortes colombianas. " +
        "Especializado en Corte Constitucional, Corte Suprema y Consejo de Estado.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Términos de búsqueda de jurisprudencia (ej: 'derecho al trabajo', 'tutela salud')"
          },
          tribunal: {
            type: "string",
            enum: ["constitucional", "suprema", "consejo", "all"],
            description: "Tribunal específico o todos",
            default: "all"
          },
          num_results: {
            type: "number",
            description: "Número de sentencias a buscar",
            default: 5
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "buscar_articulo_ley",
      description: "Busca el texto literal de un artículo específico de una norma colombiana. " +
        "Úsala cuando el usuario pregunte por un artículo específico (ej: 'artículo 25 CP', 'art 82 CGP').",
      parameters: {
        type: "object",
        properties: {
          articulo: {
            type: "string",
            description: "Número del artículo (ej: '25', '82', '1502')"
          },
          norma: {
            type: "string",
            description: "Nombre de la norma (ej: 'Código Penal', 'Constitución Política', 'Código Civil')"
          }
        },
        required: ["articulo", "norma"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "serper_web_search",
      description: "Búsqueda web general usando Serper (Google). " +
        "Usa solo cuando necesites información actualizada no disponible en fuentes legales oficiales " +
        "o para complementar información encontrada.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Consulta de búsqueda"
          },
          num_results: {
            type: "number",
            description: "Número de resultados (1-10)",
            default: 5
          }
        },
        required: ["query"]
      }
    }
  }
]

// ═══════════════════════════════════════════════════════════════════════════════
// EJECUTORES DE HERRAMIENTAS
// ═══════════════════════════════════════════════════════════════════════════════

export async function executeTool(name: string, args: any): Promise<string> {
  console.log(`🔧 Ejecutando tool: ${name}`)
  console.log(`📝 Argumentos:`, args)

  try {
    switch (name) {
      case 'search_legal_official':
        return await executeSearchLegalOfficial(args)
      
      case 'search_jurisprudencia':
        return await executeSearchJurisprudencia(args)
      
      case 'buscar_articulo_ley':
        return await executeBuscarArticulo(args)
      
      case 'serper_web_search':
        return await executeSerperWebSearch(args)
      
      default:
        throw new Error(`Herramienta desconocida: ${name}`)
    }
  } catch (error) {
    console.error(`❌ Error ejecutando ${name}:`, error)
    return `Error en ${name}: ${error instanceof Error ? error.message : 'Error desconocido'}`
  }
}

async function executeSearchLegalOfficial(args: any): Promise<string> {
  const { query, num_results = 5 } = args
  
  const results = await searchLegalColombia(query, { 
    numResults: Math.min(num_results, 10),
    includeAcademic: false 
  })
  
  return formatSearchResultsForLLM(results)
}

async function executeSearchJurisprudencia(args: any): Promise<string> {
  const { query, tribunal = 'all', num_results = 5 } = args
  
  const results = await searchJurisprudencia(query, {
    tribunal,
    numResults: Math.min(num_results, 10)
  })
  
  return formatSearchResultsForLLM(results)
}

async function executeBuscarArticulo(args: any): Promise<string> {
  const { articulo, norma } = args
  
  const results = await searchArticuloLey(articulo, norma)
  
  if (results.length === 0) {
    return `No se encontró el artículo ${articulo} de ${norma} en las fuentes consultadas.`
  }
  
  let output = `📜 **Artículo ${articulo} - ${norma}**\n\n`
  
  const officialResult = results.find(r => r.source === 'official')
  if (officialResult) {
    output += `🏛️ **Fuente Oficial:** ${officialResult.sourceName}\n`
    output += `📎 ${officialResult.url}\n\n`
    output += `📝 **Texto encontrado:**\n${officialResult.snippet}\n\n`
  }
  
  // Incluir otros resultados si el primero no tiene suficiente contenido
  if (!officialResult || officialResult.snippet.length < 200) {
    const otherResults = results.filter(r => r !== officialResult).slice(0, 2)
    if (otherResults.length > 0) {
      output += `📚 **Fuentes adicionales:**\n`
      otherResults.forEach((r, i) => {
        output += `${i + 1}. [${r.sourceName}] ${r.url}\n`
      })
    }
  }
  
  return output
}

async function executeSerperWebSearch(args: any): Promise<string> {
  const { query, num_results = 5 } = args
  
  const results = await searchLegalColombia(query, { 
    numResults: Math.min(num_results, 10),
    includeAcademic: true 
  })
  
  return formatSearchResultsForLLM(results)
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTACIONES
// ═══════════════════════════════════════════════════════════════════════════════

export { searchLegalColombia, searchJurisprudencia, searchArticuloLey }
export { formatSearchResultsForLLM }
