/**
 * Definiciones de Tools para el Orquestador
 * 
 * Consolidación de todas las herramientas legales.
 */

import { ToolDefinition } from "../types"

export const LEGAL_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_legal_official",
      description: "Busca información legal en fuentes oficiales colombianas. " +
        "Usa esta herramienta para consultas sobre leyes, decretos, normas, jurisprudencia. " +
        "SIEMPRE usa esta herramienta PRIMERO antes de responder consultas legales.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Términos de búsqueda específicos"
          },
          num_results: {
            type: "number",
            description: "Número de resultados (1-10)",
            minimum: 1,
            maximum: 10,
            default: 5
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_jurisprudencia",
      description: "Busca sentencias y jurisprudencia de altas cortes colombianas. " +
        "Especializado en Corte Constitucional, Corte Suprema y Consejo de Estado.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Términos de búsqueda de jurisprudencia"
          },
          tribunal: {
            type: "string",
            enum: ["constitucional", "suprema", "consejo", "all"],
            description: "Tribunal específico o todos",
            default: "all"
          },
          num_results: {
            type: "number",
            description: "Número de sentencias",
            minimum: 1,
            maximum: 10,
            default: 5
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_articulo_ley",
      description: "Busca el texto literal de un artículo específico de una norma colombiana. " +
        "Úsala cuando el usuario pregunte por un artículo específico (ej: 'artículo 25 CP').",
      parameters: {
        type: "object",
        properties: {
          articulo: {
            type: "string",
            description: "Número del artículo (ej: '25', '82')"
          },
          norma: {
            type: "string",
            description: "Nombre de la norma (ej: 'Código Penal')"
          }
        },
        required: ["articulo", "norma"]
      }
    }
  }
]
