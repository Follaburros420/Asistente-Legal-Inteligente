/**
 * Toolkit de herramientas legales.
 *
 * Seguridad:
 * - Allowlist estricta de nombres de herramienta
 * - Validacion de argumentos con zod
 * - Limites de longitud/rangos para evitar abuso y costo excesivo
 */

import { z } from "zod"
import {
  searchLegalColombia,
  searchJurisprudencia,
  searchArticuloLey,
  formatSearchResultsForLLM
} from "../search/serper-legal-search"

const DEBUG_LOGS = process.env.NODE_ENV === "development"

function debugLog(...args: unknown[]) {
  if (DEBUG_LOGS) {
    console.log(...args)
  }
}

const TOOL_NAME_VALUES = [
  "search_legal_official",
  "search_jurisprudencia",
  "buscar_articulo_ley",
  "serper_web_search"
] as const

const toolNameSchema = z.enum(TOOL_NAME_VALUES)
type ToolName = z.infer<typeof toolNameSchema>

const MAX_QUERY_LENGTH = 500

const normalizeQuery = (value: string) => value.replace(/\s+/g, " ").trim()

const querySchema = z
  .string()
  .trim()
  .min(2, "query demasiado corta")
  .max(MAX_QUERY_LENGTH, `query excede ${MAX_QUERY_LENGTH} caracteres`)
  .transform(normalizeQuery)

const numResultsSchema = z.coerce.number().int().min(1).max(10)

const searchLegalOfficialArgsSchema = z
  .object({
    query: querySchema,
    num_results: numResultsSchema.optional()
  })
  .strict()

const searchJurisprudenciaArgsSchema = z
  .object({
    query: querySchema,
    tribunal: z.enum(["constitucional", "suprema", "consejo", "all"]).optional(),
    num_results: numResultsSchema.optional()
  })
  .strict()

const buscarArticuloArgsSchema = z
  .object({
    articulo: z.string().trim().min(1).max(64),
    norma: z.string().trim().min(2).max(160)
  })
  .strict()

const serperWebSearchArgsSchema = z
  .object({
    query: querySchema,
    num_results: numResultsSchema.optional()
  })
  .strict()

export const LEGAL_TOOLS_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_legal_official",
      description:
        "Busca informacion legal en fuentes oficiales colombianas usando Serper. " +
        "Usa esta herramienta para consultas sobre leyes, decretos, normas, jurisprudencia, " +
        "articulos de codigos, sentencias y derecho colombiano.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Terminos de busqueda especificos. Incluye articulos y normas."
          },
          num_results: {
            type: "number",
            description: "Numero de resultados deseados (1-10)",
            default: 5
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "search_jurisprudencia",
      description:
        "Busca sentencias y jurisprudencia de altas cortes colombianas (Constitucional, Suprema y Consejo de Estado).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Terminos de busqueda de jurisprudencia"
          },
          tribunal: {
            type: "string",
            enum: ["constitucional", "suprema", "consejo", "all"],
            description: "Tribunal especifico o todos",
            default: "all"
          },
          num_results: {
            type: "number",
            description: "Numero de sentencias a buscar (1-10)",
            default: 5
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "buscar_articulo_ley",
      description:
        "Busca el texto literal de un articulo especifico de una norma colombiana.",
      parameters: {
        type: "object",
        properties: {
          articulo: {
            type: "string",
            description: "Numero del articulo (ej: 25, 82, 1502)"
          },
          norma: {
            type: "string",
            description: "Nombre de la norma (ej: Codigo Penal, Constitucion Politica)"
          }
        },
        required: ["articulo", "norma"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "serper_web_search",
      description:
        "Busqueda web general usando Serper para complementar informacion juridica.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Consulta de busqueda"
          },
          num_results: {
            type: "number",
            description: "Numero de resultados (1-10)",
            default: 5
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  }
]

function parseToolName(name: string): ToolName {
  return toolNameSchema.parse(name)
}

function parseToolArgs(name: ToolName, args: unknown) {
  switch (name) {
    case "search_legal_official":
      return searchLegalOfficialArgsSchema.parse(args)
    case "search_jurisprudencia":
      return searchJurisprudenciaArgsSchema.parse(args)
    case "buscar_articulo_ley":
      return buscarArticuloArgsSchema.parse(args)
    case "serper_web_search":
      return serperWebSearchArgsSchema.parse(args)
  }
}

export async function executeTool(name: string, args: unknown): Promise<string> {
  try {
    const safeName = parseToolName(name)
    const safeArgs = parseToolArgs(safeName, args)
    debugLog(`[legal-tools] execute ${safeName}`)

    switch (safeName) {
      case "search_legal_official":
        return await executeSearchLegalOfficial(safeArgs)
      case "search_jurisprudencia":
        return await executeSearchJurisprudencia(safeArgs)
      case "buscar_articulo_ley":
        return await executeBuscarArticulo(safeArgs)
      case "serper_web_search":
        return await executeSerperWebSearch(safeArgs)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido"
    return `Error en herramienta: ${message}`
  }
}

async function executeSearchLegalOfficial(args: z.infer<typeof searchLegalOfficialArgsSchema>): Promise<string> {
  const numResults = args.num_results ?? 5
  const results = await searchLegalColombia(args.query, {
    numResults: Math.min(numResults, 10),
    includeAcademic: false
  })
  return formatSearchResultsForLLM(results)
}

async function executeSearchJurisprudencia(args: z.infer<typeof searchJurisprudenciaArgsSchema>): Promise<string> {
  const numResults = args.num_results ?? 5
  const results = await searchJurisprudencia(args.query, {
    tribunal: args.tribunal ?? "all",
    numResults: Math.min(numResults, 10)
  })
  return formatSearchResultsForLLM(results)
}

async function executeBuscarArticulo(args: z.infer<typeof buscarArticuloArgsSchema>): Promise<string> {
  const results = await searchArticuloLey(args.articulo, args.norma)

  if (results.length === 0) {
    return `No se encontro el articulo ${args.articulo} de ${args.norma} en las fuentes consultadas.`
  }

  let output = `Articulo ${args.articulo} - ${args.norma}\n\n`
  const officialResult = results.find(r => r.source === "official")
  if (officialResult) {
    output += `Fuente oficial: ${officialResult.sourceName}\n`
    output += `URL: ${officialResult.url}\n\n`
    output += `Texto encontrado:\n${officialResult.snippet}\n\n`
  }

  if (!officialResult || officialResult.snippet.length < 200) {
    const otherResults = results.filter(r => r !== officialResult).slice(0, 2)
    if (otherResults.length > 0) {
      output += "Fuentes adicionales:\n"
      otherResults.forEach((r, i) => {
        output += `${i + 1}. [${r.sourceName}] ${r.url}\n`
      })
    }
  }

  return output
}

async function executeSerperWebSearch(args: z.infer<typeof serperWebSearchArgsSchema>): Promise<string> {
  const numResults = args.num_results ?? 5
  const results = await searchLegalColombia(args.query, {
    numResults: Math.min(numResults, 10),
    includeAcademic: true
  })
  return formatSearchResultsForLLM(results)
}

export { searchLegalColombia, searchJurisprudencia, searchArticuloLey }
export { formatSearchResultsForLLM }
