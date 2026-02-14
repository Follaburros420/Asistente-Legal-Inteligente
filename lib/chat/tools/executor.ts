/**
 * Executor de Tools
 * 
 * Conecta las definiciones con las implementaciones existentes.
 */

import {
  searchLegalColombia,
  searchJurisprudencia,
  searchArticuloLey,
  formatSearchResultsForLLM
} from "@/lib/tools/search/serper-legal-search"

export async function executeLegalTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  console.log(`🔧 Executing tool: ${name}(${JSON.stringify(args)})`)
  
  const startTime = Date.now()
  
  try {
    let result: string
    
    switch (name) {
      case "search_legal_official":
        result = await executeSearchLegalOfficial(args)
        break
        
      case "search_jurisprudencia":
        result = await executeSearchJurisprudencia(args)
        break
        
      case "buscar_articulo_ley":
        result = await executeBuscarArticulo(args)
        break
        
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
    
    const duration = Date.now() - startTime
    console.log(`✅ Tool ${name} completed in ${duration}ms`)
    
    return result
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`❌ Tool ${name} failed after ${duration}ms:`, error)
    throw error
  }
}

async function executeSearchLegalOfficial(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query)
  const numResults = Number(args.num_results) || 5
  
  const results = await searchLegalColombia(query, {
    numResults,
    includeAcademic: false
  })
  
  return formatSearchResultsForLLM(results)
}

async function executeSearchJurisprudencia(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query)
  const tribunal = String(args.tribunal || "all")
  const numResults = Number(args.num_results) || 5
  
  const results = await searchJurisprudencia(query, {
    tribunal: tribunal as any,
    numResults
  })
  
  return formatSearchResultsForLLM(results)
}

async function executeBuscarArticulo(args: Record<string, unknown>): Promise<string> {
  const articulo = String(args.articulo)
  const norma = String(args.norma)
  
  const results = await searchArticuloLey(articulo, norma)
  
  if (results.length === 0) {
    return `No se encontró el artículo ${articulo} de ${norma}.`
  }
  
  let output = `📜 **Artículo ${articulo} - ${norma}**\n\n`
  const officialResult = results.find(r => r.source === "official")
  
  if (officialResult) {
    output += `🏛️ **Fuente:** ${officialResult.sourceName}\n`
    output += `📎 ${officialResult.url}\n\n`
    output += `📝 ${officialResult.snippet}\n`
  } else {
    output += results.map((r, i) => 
      `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
    ).join("\n\n")
  }
  
  return output
}
