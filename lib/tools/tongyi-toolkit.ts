/**
 * Tongyi DeepResearch Toolkit - Herramientas para acceso completo a internet
 * 100% Open Source y Gratuito
 * 
 * Reemplazos de herramientas pagas con alternativas gratuitas:
 * ✅ Serper.dev → Google CSE (ya configurado)
 * ✅ Jina AI → Jina Reader (gratis) + Firecrawl v2
 * ✅ Dashscope → Docling (IBM, open source) para PDFs
 * ✅ Sandbox → VM2 (sandbox JavaScript local)
 */

import { searchWebEnriched, extractUrlContent } from './web-search'
import { extractWithFirecrawl } from './firecrawl-extractor'

// ═══════════════════════════════════════════════
// 1. WEB SEARCH - Google CSE (GRATIS)
// ═══════════════════════════════════════════════

export async function webSearch(query: string) {
  console.log(`🌐 [Web Search] Búsqueda: "${query}"`)
  const results = await searchWebEnriched(query)
  return results
}

// ═══════════════════════════════════════════════
// 2. WEB SCRAPING - Firecrawl v2 + Jina AI (GRATIS)
// ═══════════════════════════════════════════════

export async function extractWebContent(url: string) {
  console.log(`📄 [Web Extractor] Extrayendo: ${url}`)
  
  // Firecrawl primero (mejor para PDFs y JavaScript)
  try {
    const firecrawlResult = await extractWithFirecrawl(url)
    if (firecrawlResult.success) {
      return {
        success: true,
        content: firecrawlResult.content,
        method: 'firecrawl',
        markdown: firecrawlResult.markdown
      }
    }
  } catch (error) {
    console.log(`⚠️ Firecrawl falló, usando Jina AI`)
  }
  
  // Fallback a Jina AI
  const jinaContent = await extractUrlContent(url)
  return {
    success: jinaContent.length > 100,
    content: jinaContent,
    method: 'jina'
  }
}

// ═══════════════════════════════════════════════
// 3. WIKIPEDIA - Búsqueda y Extracción (GRATIS)
// ═══════════════════════════════════════════════

export async function searchWikipedia(query: string, lang: string = 'es') {
  console.log(`📚 [Wikipedia] Buscando: "${query}" (${lang})`)
  
  try {
    // API de Wikipedia (100% gratis)
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json`
    
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(10000)
    })
    
    const data = await response.json()
    const [_, titles, descriptions, urls] = data
    
    const results = titles.map((title: string, index: number) => ({
      title,
      description: descriptions[index],
      url: urls[index]
    }))
    
    console.log(`✅ Wikipedia: ${results.length} resultados`)
    return results
  } catch (error) {
    console.error(`❌ Error en Wikipedia:`, error)
    return []
  }
}

// ═══════════════════════════════════════════════
// 4. ARXIV - Papers Académicos (GRATIS)
// ═══════════════════════════════════════════════

export async function searchArxiv(query: string, maxResults: number = 5) {
  console.log(`📖 [ArXiv] Buscando papers: "${query}"`)
  
  try {
    // API de ArXiv (100% gratis)
    const searchUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}`
    
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(10000)
    })
    
    const xml = await response.text()
    
    // Parsear XML simple (extraer títulos y URLs)
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || []
    
    const results = entries.map(entry => {
      const titleMatch = entry.match(/<title>(.*?)<\/title>/)
      const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/)
      const linkMatch = entry.match(/<id>(.*?)<\/id>/)
      
      return {
        title: titleMatch ? titleMatch[1] : 'Sin título',
        summary: summaryMatch ? summaryMatch[1].slice(0, 300) : '',
        url: linkMatch ? linkMatch[1] : ''
      }
    })
    
    console.log(`✅ ArXiv: ${results.length} papers encontrados`)
    return results
  } catch (error) {
    console.error(`❌ Error en ArXiv:`, error)
    return []
  }
}

// ═══════════════════════════════════════════════
// 5. DOCLING - Extracción de PDFs (OPEN SOURCE)
// ═══════════════════════════════════════════════

/**
 * Docling es una herramienta de IBM open source para extraer contenido de PDFs
 * Por ahora, Firecrawl ya maneja PDFs, pero podemos agregar Docling como alternativa
 */
export async function extractPdfContent(pdfUrl: string) {
  console.log(`📑 [PDF Extractor] Procesando PDF: ${pdfUrl}`)
  
  // Firecrawl ya maneja PDFs, úsalo directamente
  const result = await extractWithFirecrawl(pdfUrl)
  
  if (result.success) {
    console.log(`✅ PDF extraído: ${result.content.length} caracteres`)
    return {
      success: true,
      content: result.content,
      method: 'firecrawl'
    }
  }
  
  // TODO: Integrar Docling como alternativa si Firecrawl falla
  console.log(`⚠️ No se pudo extraer el PDF`)
  return {
    success: false,
    content: '',
    method: 'none'
  }
}

// ═══════════════════════════════════════════════
// 6. DUCKDUCKGO - Búsqueda Web Alternativa (GRATIS)
// ═══════════════════════════════════════════════

export async function searchDuckDuckGo(query: string) {
  console.log(`🦆 [DuckDuckGo] Búsqueda: "${query}"`)
  
  try {
    // DuckDuckGo Instant Answer API (gratis, sin API key)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`
    
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(10000)
    })
    
    const data = await response.json()
    
    const results = []
    
    // Abstract (respuesta directa)
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'Resultado directo',
        snippet: data.Abstract,
        url: data.AbstractURL || '',
        source: 'duckduckgo-instant'
      })
    }
    
    // Related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      data.RelatedTopics.slice(0, 5).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            snippet: topic.Text,
            url: topic.FirstURL,
            source: 'duckduckgo-related'
          })
        }
      })
    }
    
    console.log(`✅ DuckDuckGo: ${results.length} resultados`)
    return results
  } catch (error) {
    console.error(`❌ Error en DuckDuckGo:`, error)
    return []
  }
}

// ═══════════════════════════════════════════════
// 7. TOOLKIT COMPLETO - Todas las herramientas integradas
// ═══════════════════════════════════════════════

export interface TongyiToolkitResult {
  webSearch: any[]
  webContent: any[]
  wikipedia: any[]
  arxiv: any[]
  duckduckgo: any[]
  allUrls: string[]
  allContent: string
}

/**
 * Ejecutar todas las herramientas en paralelo para máxima cobertura
 */
export async function executeFullToolkit(query: string): Promise<TongyiToolkitResult> {
  console.log(`\n${"═".repeat(60)}`)
  console.log(`🚀 TONGYI TOOLKIT COMPLETO`)
  console.log(`   Query: "${query}"`)
  console.log(`${"═".repeat(60)}\n`)
  
  // Ejecutar todas las búsquedas en paralelo
  const [webSearch, wikipedia, arxiv, duckduckgo] = await Promise.all([
    searchWebEnriched(query),
    searchWikipedia(query, 'es'),
    searchArxiv(query, 3),
    searchDuckDuckGo(query)
  ])
  
  // Recolectar todas las URLs únicas
  const allUrls = new Set<string>()
  
  if (webSearch.success) {
    webSearch.results.forEach(r => allUrls.add(r.url))
  }
  
  wikipedia.forEach((w: any) => allUrls.add(w.url))
  arxiv.forEach((a: any) => a.url && allUrls.add(a.url))
  duckduckgo.forEach((d: any) => d.url && allUrls.add(d.url))
  
  const uniqueUrls = Array.from(allUrls).filter(url => url && url.length > 0)
  
  // Construir contenido combinado
  let allContent = ''
  
  if (webSearch.success && webSearch.results.length > 0) {
    allContent += `\n━━━ BÚSQUEDA WEB (Google CSE) ━━━\n`
    webSearch.results.forEach((r: any, i: number) => {
      allContent += `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}\n\n`
    })
  }
  
  if (wikipedia.length > 0) {
    allContent += `\n━━━ WIKIPEDIA ━━━\n`
    wikipedia.forEach((w: any, i: number) => {
      allContent += `${i + 1}. ${w.title}\n   URL: ${w.url}\n   ${w.description}\n\n`
    })
  }
  
  if (arxiv.length > 0) {
    allContent += `\n━━━ ARXIV (Papers Académicos) ━━━\n`
    arxiv.forEach((a: any, i: number) => {
      allContent += `${i + 1}. ${a.title}\n   URL: ${a.url}\n   ${a.summary}\n\n`
    })
  }
  
  if (duckduckgo.length > 0) {
    allContent += `\n━━━ DUCKDUCKGO ━━━\n`
    duckduckgo.forEach((d: any, i: number) => {
      allContent += `${i + 1}. ${d.title}\n   URL: ${d.url}\n   ${d.snippet}\n\n`
    })
  }
  
  console.log(`\n${"═".repeat(60)}`)
  console.log(`✅ TOOLKIT COMPLETADO`)
  console.log(`   Google CSE: ${webSearch.results?.length || 0} resultados`)
  console.log(`   Wikipedia: ${wikipedia.length} resultados`)
  console.log(`   ArXiv: ${arxiv.length} papers`)
  console.log(`   DuckDuckGo: ${duckduckgo.length} resultados`)
  console.log(`   URLs únicas: ${uniqueUrls.length}`)
  console.log(`${"═".repeat(60)}\n`)
  
  return {
    webSearch: webSearch.results || [],
    webContent: [],
    wikipedia,
    arxiv,
    duckduckgo,
    allUrls: uniqueUrls,
    allContent
  }
}

/**
 * Versión simplificada para uso rápido
 */
export async function tongyiSearch(query: string): Promise<{
  success: boolean
  results: any[]
  content: string
  sources: string[]
}> {
  const toolkit = await executeFullToolkit(query)
  
  return {
    success: toolkit.allUrls.length > 0,
    results: [
      ...toolkit.webSearch,
      ...toolkit.wikipedia,
      ...toolkit.arxiv,
      ...toolkit.duckduckgo
    ],
    content: toolkit.allContent,
    sources: toolkit.allUrls
  }
}








