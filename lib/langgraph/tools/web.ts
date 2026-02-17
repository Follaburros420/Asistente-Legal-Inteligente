/**
 * Web Search Tool for LangGraph
 * 
 * Wraps the existing web search functionality for legal research.
 */

import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { WebReference } from "../state/schema"

/**
 * Input schema for web search
 */
const WebSearchInputSchema = z.object({
  query: z.string().describe("The search query"),
  jurisdiction: z.string().default("Colombia").describe("Jurisdiction to focus on"),
  dateRange: z.object({
    start: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    end: z.string().optional().describe("End date (YYYY-MM-DD)")
  }).optional().describe("Date range for results"),
  sourceType: z.enum([
    "all",
    "official",
    "jurisprudence",
    "legislation",
    "doctrine"
  ]).default("all").describe("Type of sources to search"),
  maxResults: z.number().min(1).max(10).default(5).describe("Maximum results to return")
})

/**
 * Input schema for legal article search
 */
const LegalArticleSearchSchema = z.object({
  articleNumber: z.string().describe("Article number to search for"),
  legalBody: z.string().optional().describe("Legal body (Constitution, Civil Code, etc.)"),
  jurisdiction: z.string().default("Colombia")
})

/**
 * Input schema for jurisprudence search
 */
const JurisprudenceSearchSchema = z.object({
  keywords: z.array(z.string()).describe("Keywords to search for"),
  court: z.enum([
    "constitutional",
    "supreme",
    "council_state",
    "all"
  ]).default("all").describe("Court to search"),
  dateRange: z.object({
    start: z.string().optional(),
    end: z.string().optional()
  }).optional()
})

/**
 * Simulated web search result (to be replaced with actual implementation)
 */
interface WebSearchResult {
  title: string
  url: string
  snippet: string
  date?: string
  sourceType: string
  score: number
}

/**
 * Perform actual web search using available search infrastructure
 */
async function performWebSearch(
  query: string, 
  options: {
    jurisdiction?: string
    dateRange?: { start?: string; end?: string }
    sourceType?: string
    maxResults?: number
  } = {}
): Promise<WebSearchResult[]> {
  console.log(`[WebTool] Starting web search for: "${query}"`)
  
  // Try Serper API directly first (most reliable)
  try {
    const apiKey = process.env.SERPER_API_KEY
    
    if (apiKey) {
      console.log("[WebTool] Using Serper API directly")
      
      // Build search query with legal context
      let searchQuery = query
      if (options.sourceType === "official") {
        searchQuery = `${query} site:gov.co`
      } else if (options.sourceType === "jurisprudence") {
        searchQuery = `${query} sentencia site:corteconstitucional.gov.co OR site:cortesuprema.gov.co OR site:consejodeestado.gov.co`
      } else if (options.sourceType === "legislation") {
        searchQuery = `${query} ley decreto site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
      }
      
      // Add Colombia context if not present
      if (!query.toLowerCase().includes("colombia") && !query.toLowerCase().includes("colombian")) {
        searchQuery = `${searchQuery} Colombia`
      }
      
      // Exclude Wikipedia
      searchQuery = `${searchQuery} -site:wikipedia.org -site:wikimedia.org`
      
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          q: searchQuery,
          num: options.maxResults || 5,
          gl: "co",
          hl: "es"
        })
      })
      
      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.organic && data.organic.length > 0) {
        console.log(`[WebTool] Serper returned ${data.organic.length} results`)
        
        return data.organic.map((item: any) => ({
          title: item.title || "Sin título",
          url: item.link || "",
          snippet: item.snippet || "",
          date: item.date,
          sourceType: classifySourceType(item.link || ""),
          score: 0.8
        }))
      }
    }
  } catch (serperError) {
    console.error("[WebTool] Serper search failed:", serperError)
  }
  
  // Fallback to specialized legal search
  try {
    const { searchLegalSpecialized } = await import("@/lib/tools/legal/legal-search-specialized")
    
    const result = await searchLegalSpecialized(query, options.maxResults || 5)
    
    if (result.success && result.results.length > 0) {
      console.log(`[WebTool] Specialized search returned ${result.results.length} results`)
      
      return result.results.map((r: any) => ({
        title: r.title || "Sin título",
        url: r.url || "",
        snippet: r.snippet || "",
        date: undefined,
        sourceType: r.type || "general",
        score: r.relevance ? r.relevance / 20 : 0.7 // Normalize to 0-1
      }))
    }
  } catch (specializedError) {
    console.error("[WebTool] Specialized search failed:", specializedError)
  }
  
  // Final fallback to simple Serper wrapper
  try {
    const { searchWithSerper } = await import("@/lib/tools/search/serper-search")
    
    const results = await searchWithSerper(query, options.maxResults || 5)
    
    console.log(`[WebTool] Fallback Serper returned ${results.length} results`)
    
    return results.map((r: any) => ({
      title: r.title || "",
      url: r.link || r.url || "",
      snippet: r.snippet || "",
      date: undefined,
      sourceType: "web",
      score: 0.7
    }))
  } catch (fallbackError) {
    console.error("[WebTool] All search methods failed:", fallbackError)
    return []
  }
}

/**
 * Classify source type based on URL
 */
function classifySourceType(url: string): string {
  const urlLower = url.toLowerCase()
  
  if (urlLower.includes(".gov.co")) return "official"
  if (urlLower.includes("corteconstitucional") || urlLower.includes("cortesuprema") || urlLower.includes("consejodeestado")) return "jurisprudence"
  if (urlLower.includes("secretariasenado") || urlLower.includes("funcionpublica")) return "legislation"
  if (urlLower.includes(".edu.co")) return "academic"
  
  return "general"
}

/**
 * Web Search Tool
 * 
 * Searches the web for legal information, jurisprudence, and legislation.
 */
export const webSearchTool = tool(
  async (input: z.infer<typeof WebSearchInputSchema>) => {
    const startTime = Date.now()
    
    try {
      console.log(`[WebTool] Searching: "${input.query}" (jurisdiction: ${input.jurisdiction})`)
      
      // Build enhanced query based on source type
      let enhancedQuery = input.query
      
      if (input.sourceType === "official") {
        enhancedQuery = `${input.query} site:gov.co`
      } else if (input.sourceType === "jurisprudence") {
        enhancedQuery = `${input.query} sentencia site:corteconstitucional.gov.co OR site:cortesuprema.gov.co OR site:consejodeestado.gov.co`
      } else if (input.sourceType === "legislation") {
        enhancedQuery = `${input.query} ley decreto site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
      }
      
      const results = await performWebSearch(enhancedQuery, {
        jurisdiction: input.jurisdiction,
        dateRange: input.dateRange,
        sourceType: input.sourceType,
        maxResults: input.maxResults
      })
      
      const duration = Date.now() - startTime
      console.log(`[WebTool] Found ${results.length} results in ${duration}ms`)
      
      // Filter and score results
      const scoredResults = results
        .map(r => ({
          ...r,
          score: calculateRelevanceScore(r, input.query)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, input.maxResults)
      
      return {
        success: true,
        query: input.query,
        jurisdiction: input.jurisdiction,
        source_type: input.sourceType,
        results: scoredResults,
        total: scoredResults.length,
        duration_ms: duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error(`[WebTool] Error after ${duration}ms:`, error.message)
      
      return {
        success: false,
        query: input.query,
        results: [],
        total: 0,
        error: error.message || "Unknown error during web search",
        duration_ms: duration
      }
    }
  },
  {
    name: "web_search",
    description: `Search the web for legal information, jurisprudence, and legislation.
Source types:
- all: General web search
- official: Official government sources (.gov.co)
- jurisprudence: Court decisions and rulings
- legislation: Laws, decrees, regulations
- doctrine: Academic legal analysis

Returns results with URLs, snippets, and relevance scores.`,
    schema: WebSearchInputSchema
  }
)

/**
 * Legal Article Search Tool
 * 
 * Search for specific legal articles in codes and constitutions.
 */
export const legalArticleSearchTool = tool(
  async (input: z.infer<typeof LegalArticleSearchSchema>) => {
    const startTime = Date.now()
    
    try {
      console.log(`[WebTool] Searching for article ${input.articleNumber} in ${input.legalBody || "legal bodies"}`)
      
      // Build specific query for article
      let query = `artículo ${input.articleNumber}`
      
      if (input.legalBody) {
        const legalBodyMap: Record<string, string> = {
          "constitucion": "Constitución Política de Colombia",
          "constitución": "Constitución Política de Colombia",
          "codigo civil": "Código Civil",
          "código civil": "Código Civil",
          "codigo penal": "Código Penal",
          "código penal": "Código Penal",
          "codigo procesal": "Código General del Proceso",
          "cgp": "Código General del Proceso"
        }
        
        const normalizedBody = legalBodyMap[input.legalBody.toLowerCase()] || input.legalBody
        query = `"artículo ${input.articleNumber}" "${normalizedBody}"`
      }
      
      const results = await performWebSearch(query, {
        jurisdiction: input.jurisdiction,
        maxResults: 5
      })
      
      const duration = Date.now() - startTime
      
      return {
        success: true,
        article_number: input.articleNumber,
        legal_body: input.legalBody,
        results: results,
        total: results.length,
        duration_ms: duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      return {
        success: false,
        article_number: input.articleNumber,
        results: [],
        total: 0,
        error: error.message,
        duration_ms: duration
      }
    }
  },
  {
    name: "legal_article_search",
    description: "Search for a specific article in legal codes or the Constitution. Use when you need the exact text of a legal provision.",
    schema: LegalArticleSearchSchema
  }
)

/**
 * Jurisprudence Search Tool
 * 
 * Search for court decisions and rulings.
 */
export const jurisprudenceSearchTool = tool(
  async (input: z.infer<typeof JurisprudenceSearchSchema>) => {
    const startTime = Date.now()
    
    try {
      console.log(`[WebTool] Searching jurisprudence with keywords: ${input.keywords.join(", ")}`)
      
      // Build query based on court
      const courtDomains: Record<string, string> = {
        "constitutional": "site:corteconstitucional.gov.co",
        "supreme": "site:cortesuprema.gov.co",
        "council_state": "site:consejodeestado.gov.co",
        "all": "site:corteconstitucional.gov.co OR site:cortesuprema.gov.co OR site:consejodeestado.gov.co"
      }
      
      const query = `${input.keywords.join(" ")} sentencia ${courtDomains[input.court] || courtDomains.all}`
      
      const results = await performWebSearch(query, {
        jurisdiction: "Colombia",
        dateRange: input.dateRange,
        maxResults: 10
      })
      
      const duration = Date.now() - startTime
      
      return {
        success: true,
        keywords: input.keywords,
        court: input.court,
        results: results,
        total: results.length,
        duration_ms: duration
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      return {
        success: false,
        keywords: input.keywords,
        court: input.court,
        results: [],
        total: 0,
        error: error.message,
        duration_ms: duration
      }
    }
  },
  {
    name: "jurisprudence_search",
    description: "Search for court decisions and jurisprudence. Specify the court (Constitutional Court, Supreme Court, Council of State) for targeted results.",
    schema: JurisprudenceSearchSchema
  }
)

/**
 * Calculate relevance score for a search result
 */
function calculateRelevanceScore(result: WebSearchResult, query: string): number {
  let score = result.score || 0.5
  
  const queryTerms = query.toLowerCase().split(/\s+/)
  const titleLower = result.title.toLowerCase()
  const snippetLower = result.snippet.toLowerCase()
  
  // Boost for query terms in title
  for (const term of queryTerms) {
    if (titleLower.includes(term)) {
      score += 0.1
    }
    if (snippetLower.includes(term)) {
      score += 0.05
    }
  }
  
  // Boost for official sources
  if (result.url.includes(".gov.co")) {
    score += 0.15
  }
  
  // Boost for academic sources
  if (result.url.includes(".edu.co")) {
    score += 0.1
  }
  
  // Cap at 1.0
  return Math.min(score, 1.0)
}

/**
 * Convert WebSearchResult to WebReference
 */
export function webResultToReference(result: WebSearchResult): WebReference {
  return {
    url: result.url,
    title: result.title,
    snippet: result.snippet,
    date: result.date,
    score: result.score,
    source_type: result.sourceType
  }
}

/**
 * Export types
 */
export type WebSearchInput = z.infer<typeof WebSearchInputSchema>
export type LegalArticleSearchInput = z.infer<typeof LegalArticleSearchSchema>
export type JurisprudenceSearchInput = z.infer<typeof JurisprudenceSearchSchema>