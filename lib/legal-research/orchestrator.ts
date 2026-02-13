/**
 * Legal Research Orchestrator
 * 
 * Reemplaza el AgentExecutor de LangChain con un flujo de investigación
 * controlado manualmente, eliminando el problema de "max iterations"
 */

import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages"
import { createModel } from "@/lib/langchain/config/models"
import { searchLegalColombia, searchJurisprudencia, searchArticuloLey } from "@/lib/tools/search/serper-legal-search"
import { analyzeQueryPrompt, synthesisPrompt, validationPrompt } from "./prompts/research-prompts"
import {
  ResearchContext,
  ResearchProgress,
  QueryAnalysis,
  SearchPlan,
  SearchTask,
  SearchResult,
  LegalSource,
  SynthesisResult,
  ResearchResult,
  ProgressCallback,
  TokenCallback
} from "./types"

export class LegalResearchOrchestrator {
  private model: ChatOpenAI
  private context: ResearchContext
  private onProgress?: ProgressCallback
  private onToken?: TokenCallback

  constructor(context: ResearchContext, callbacks?: {
    onProgress?: ProgressCallback
    onToken?: TokenCallback
  }) {
    this.context = context
    this.onProgress = callbacks?.onProgress
    this.onToken = callbacks?.onToken
    
    // Inicializar modelo
    this.model = createModel({
      modelId: context.modelId,
      temperature: context.temperature,
      maxTokens: 4096,
      streaming: true
    })
  }

  /**
   * Ejecuta el flujo completo de investigación legal
   */
  async execute(query: string): Promise<ResearchResult> {
    const startTime = Date.now()
    
    try {
      // FASE 1: ANALIZAR CONSULTA
      this.emitProgress('analyzing', 5, 'Analizando su consulta legal...')
      const analysis = await this.analyzeQuery(query)
      
      // FASE 2: PLANIFICAR BÚSQUEDAS
      this.emitProgress('planning', 15, 'Planificando investigación...', 
        `Área: ${analysis.legalArea || 'General'}, Complejidad: ${analysis.complexity}`)
      const searchPlan = this.createSearchPlan(analysis)
      
      // FASE 3: EJECUTAR BÚSQUEDAS
      this.emitProgress('searching', 25, 'Investigando fuentes legales...',
        `${searchPlan.primarySearches.length} búsquedas planificadas`)
      const searchResults = await this.executeSearches(searchPlan)
      
      // Verificar si encontramos resultados
      const totalResults = searchResults.reduce((acc, r) => acc + r.results.length, 0)
      if (totalResults === 0) {
        // Fallback: responder con conocimiento general pero advertir
        return this.handleNoResults(query, startTime)
      }
      
      // FASE 4: SINTETIZAR RESPUESTA
      this.emitProgress('synthesizing', 70, 'Redactando respuesta profesional...',
        `Sintetizando ${totalResults} fuentes encontradas`)
      const synthesis = await this.synthesizeResponse(query, searchResults, analysis)
      
      // FASE 5: VALIDAR
      this.emitProgress('validating', 90, 'Verificando calidad de la respuesta...')
      const validated = await this.validateResponse(synthesis, query)
      
      // COMPLETADO
      this.emitProgress('completed', 100, 'Respuesta completada')
      
      return {
        success: true,
        response: this.formatFullResponse(validated),
        structuredResponse: validated,
        sources: synthesis.sources,
        metadata: {
          executionTime: Date.now() - startTime,
          searchesPerformed: searchResults.length,
          phase: 'completed',
          modelUsed: this.context.modelId
        }
      }
      
    } catch (error) {
      console.error('[Orchestrator] Error:', error)
      return this.handleError(error, query, startTime)
    }
  }

  /**
   * FASE 1: Analiza la consulta para entender qué buscar
   */
  private async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const messages = [
      new SystemMessage(analyzeQueryPrompt),
      new HumanMessage(query)
    ]
    
    const response = await this.model.invoke(messages)
    const content = response.content as string
    
    try {
      // Intentar parsear JSON de la respuesta
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as QueryAnalysis
      }
    } catch (e) {
      console.warn('[Orchestrator] No se pudo parsear análisis como JSON, usando fallback')
    }
    
    // Fallback: análisis básico basado en reglas
    return this.fallbackAnalyzeQuery(query)
  }

  /**
   * Análisis fallback basado en reglas simples
   */
  private fallbackAnalyzeQuery(query: string): QueryAnalysis {
    const lowerQuery = query.toLowerCase()
    
    // Detectar artículo específico
    const articleMatch = lowerQuery.match(/art[ií]culo\s+(\d+[a-z]?)/i)
    const codeMatch = lowerQuery.match(/(c[oó]digo\s+\w+|ley\s+\d+|constituci[oó]n)/i)
    
    if (articleMatch && codeMatch) {
      return {
        intent: 'article_lookup',
        entities: [
          { type: 'article', value: articleMatch[1], normalized: `Artículo ${articleMatch[1]}` },
          { type: 'code', value: codeMatch[1], normalized: codeMatch[1] }
        ],
        complexity: 'low',
        requiresJurisprudence: false,
        requiresDoctrinal: false,
        keywords: [articleMatch[1], codeMatch[1]],
        suggestedSearches: [`${articleMatch[1]} ${codeMatch[1]} Colombia`]
      }
    }
    
    // Detectar jurisprudencia
    if (lowerQuery.includes('jurisprudencia') || lowerQuery.includes('sentencia') || 
        lowerQuery.includes('fallo') || lowerQuery.includes('tutela')) {
      return {
        intent: 'jurisprudence',
        entities: [],
        complexity: 'high',
        requiresJurisprudence: true,
        requiresDoctrinal: true,
        keywords: query.split(' ').slice(0, 5),
        suggestedSearches: [query, `${query} jurisprudencia Colombia`]
      }
    }
    
    // Default
    return {
      intent: 'general',
      entities: [],
      complexity: 'medium',
      requiresJurisprudence: false,
      requiresDoctrinal: false,
      keywords: query.split(' ').slice(0, 5),
      suggestedSearches: [query, `${query} normativa Colombia`]
    }
  }

  /**
   * FASE 2: Crea un plan de búsquedas basado en el análisis
   */
  private createSearchPlan(analysis: QueryAnalysis): SearchPlan {
    const primarySearches: SearchTask[] = []
    
    // Según el tipo de consulta, crear búsquedas específicas
    switch (analysis.intent) {
      case 'article_lookup':
        const article = analysis.entities.find(e => e.type === 'article')?.value
        const code = analysis.entities.find(e => e.type === 'code')?.value
        if (article && code) {
          primarySearches.push({
            id: 'article_specific',
            type: 'article',
            query: `${article} ${code}`,
            priority: 1,
            timeout: 10000
          })
        }
        break
        
      case 'jurisprudence':
        primarySearches.push({
          id: 'jurisprudence_search',
          type: 'jurisprudence',
          query: analysis.suggestedSearches[0],
          priority: 1,
          timeout: 15000
        })
        break
        
      case 'norm_query':
      case 'general':
      default:
        // Búsqueda general en fuentes oficiales
        primarySearches.push({
          id: 'official_search',
          type: 'official',
          query: analysis.suggestedSearches[0],
          priority: 1,
          timeout: 10000
        })
        
        // Si requiere jurisprudencia, agregar búsqueda adicional
        if (analysis.requiresJurisprudence) {
          primarySearches.push({
            id: 'jurisprudence_aux',
            type: 'jurisprudence',
            query: analysis.suggestedSearches[0],
            priority: 2,
            timeout: 10000
          })
        }
    }
    
    return {
      primarySearches,
      parallel: true,
      maxTotalTime: 30000
    }
  }

  /**
   * FASE 3: Ejecuta las búsquedas del plan
   */
  private async executeSearches(plan: SearchPlan): Promise<SearchResult[]> {
    if (plan.parallel) {
      // Ejecutar en paralelo con límite de concurrencia
      const promises = plan.primarySearches.map(task => this.executeSearchTask(task))
      return Promise.all(promises)
    } else {
      // Ejecutar secuencialmente
      const results: SearchResult[] = []
      for (const task of plan.primarySearches) {
        results.push(await this.executeSearchTask(task))
      }
      return results
    }
  }

  /**
   * Ejecuta una tarea de búsqueda individual
   */
  private async executeSearchTask(task: SearchTask): Promise<SearchResult> {
    const startTime = Date.now()
    
    try {
      let results: any[] = []
      
      switch (task.type) {
        case 'article':
          // Parsear "25 Código Penal" o similar
          const parts = task.query.split(' ')
          const article = parts[0]
          const norma = parts.slice(1).join(' ')
          results = await searchArticuloLey(article, norma)
          break
          
        case 'jurisprudence':
          results = await searchJurisprudencia(task.query, { 
            tribunal: 'all', 
            numResults: 5 
          })
          break
          
        case 'official':
        default:
          results = await searchLegalColombia(task.query, { 
            numResults: 5,
            includeAcademic: false 
          })
      }
      
      // Mapear resultados al formato estándar
      const mappedResults: LegalSource[] = results.map(r => ({
        title: r.title || r.sourceName || 'Sin título',
        url: r.url || '',
        snippet: r.snippet || r.content || '',
        sourceType: this.mapSourceType(r.source || r.sourceType),
        authority: r.sourceName || r.authority,
        date: r.date,
        relevance: r.score || 0.5
      }))
      
      return {
        taskId: task.id,
        success: true,
        source: task.type,
        results: mappedResults,
        executionTime: Date.now() - startTime
      }
      
    } catch (error) {
      console.error(`[Orchestrator] Error en búsqueda ${task.id}:`, error)
      return {
        taskId: task.id,
        success: false,
        source: task.type,
        results: [],
        error: error instanceof Error ? error.message : 'Error desconocido',
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * Mapea tipos de fuente al formato estándar
   */
  private mapSourceType(source: string): 'official' | 'jurisprudence' | 'academic' | 'general' {
    if (source === 'official' || source.includes('gov')) return 'official'
    if (source === 'jurisprudence' || source.includes('court')) return 'jurisprudence'
    if (source === 'academic') return 'academic'
    return 'general'
  }

  /**
   * FASE 4: Sintetiza la respuesta legal estructurada
   */
  private async synthesizeResponse(
    query: string,
    searchResults: SearchResult[],
    analysis: QueryAnalysis
  ): Promise<SynthesisResult> {
    // Combinar todos los resultados
    const allSources = searchResults
      .flatMap(r => r.results)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 8) // Top 8 fuentes
    
    // Preparar contexto para el LLM
    const sourcesContext = allSources.map((s, i) => 
      `[${i + 1}] ${s.title}\n${s.snippet}\nFuente: ${s.authority || s.sourceType}\n${s.url}`
    ).join('\n\n')
    
    const messages = [
      new SystemMessage(synthesisPrompt),
      new HumanMessage(`CONSULTA: ${query}\n\nFUENTES ENCONTRADAS:\n${sourcesContext}`)
    ]
    
    // Streaming de la respuesta
    let fullResponse = ''
    const stream = await this.model.stream(messages)
    
    for await (const chunk of stream) {
      const content = chunk.content as string
      fullResponse += content
      this.onToken?.(content)
    }
    
    // Parsear la respuesta estructurada
    return this.parseSynthesis(fullResponse, allSources)
  }

  /**
   * Parsea la síntesis del LLM a estructura
   */
  private parseSynthesis(response: string, sources: LegalSource[]): SynthesisResult {
    // Extraer secciones
    const thesis = this.extractSection(response, 'TESIS', 'MARCO') || 
                   this.extractSection(response, 'RESPUESTA', 'FUNDAMENTO') ||
                   response.slice(0, 500)
    
    const legalFramework = this.extractLegalFramework(response)
    
    const analysis = this.extractSection(response, 'ANÁLISIS', 'CONCLUSIÓN') ||
                     this.extractSection(response, 'ANALISIS', 'CONCLUSION')
    
    const conclusion = this.extractSection(response, 'CONCLUSIÓN', 'FUENTES') ||
                       this.extractSection(response, 'CONCLUSION', 'FUENTES') ||
                       this.extractSection(response, 'CONCLUSIÓN')
    
    return {
      thesis: thesis.trim(),
      legalFramework,
      analysis: (analysis || '').trim(),
      conclusion: (conclusion || '').trim(),
      sources,
      confidence: sources.length > 0 ? 0.8 : 0.4
    }
  }

  /**
   * Extrae una sección del texto
   */
  private extractSection(text: string, startMarker: string, endMarker?: string): string | null {
    const startRegex = new RegExp(`##?\\s*\\*?${startMarker}\\*?[:\\s]`, 'i')
    const startMatch = text.search(startRegex)
    
    if (startMatch === -1) return null
    
    let endMatch = text.length
    if (endMarker) {
      const endRegex = new RegExp(`##?\\s*\\*?${endMarker}\\*?[:\\s]`, 'i')
      const end = text.search(endRegex)
      if (end !== -1) endMatch = end
    }
    
    return text.slice(startMatch, endMatch).replace(startRegex, '').trim()
  }

  /**
   * Extrae el marco legal de la respuesta
   */
  private extractLegalFramework(text: string): LegalFramework[] {
    const frameworks: LegalFramework[] = []
    
    // Buscar citas de leyes
    const lawRegex = /(?:Ley|Decreto)\s+(\d+)\s+de\s+(\d{4})/gi
    let match
    while ((match = lawRegex.exec(text)) !== null) {
      frameworks.push({
        type: 'law',
        citation: `${match[0]}`,
        text: ''
      })
    }
    
    return frameworks
  }

  /**
   * FASE 5: Valida la calidad de la respuesta
   */
  private async validateResponse(synthesis: SynthesisResult, originalQuery: string): Promise<SynthesisResult> {
    // Validaciones básicas
    const hasThesis = synthesis.thesis.length > 50
    const hasSources = synthesis.sources.length > 0
    const hasConclusion = synthesis.conclusion.length > 30
    
    if (!hasThesis || !hasConclusion) {
      // Marcar como baja confianza
      return {
        ...synthesis,
        confidence: 0.3
      }
    }
    
    return synthesis
  }

  /**
   * Maneja el caso donde no se encuentran resultados
   */
  private async handleNoResults(query: string, startTime: number): Promise<ResearchResult> {
    // Fallback: responder con conocimiento general pero claramente marcado
    const fallbackResponse = `No he podido encontrar fuentes legales específicas para su consulta en este momento. 

Basándome en conocimiento general del derecho colombiano, le puedo indicar que este tema requiere consulta directa de la normativa vigente y jurisprudencia aplicable.

**Recomendación:** Consulte directamente en [SUIN-Juriscol](https://www.suin-juriscol.gov.co) o [Secretaría del Senado](https://www.secretariasenado.gov.co) para obtener la información oficial y actualizada.

¿Desea que intente una búsqueda con términos diferentes o que reformule su consulta?`

    return {
      success: true, // Éxito parcial
      response: fallbackResponse,
      structuredResponse: {
        thesis: 'No se encontraron fuentes específicas',
        legalFramework: [],
        analysis: '',
        conclusion: fallbackResponse,
        sources: [],
        confidence: 0.1
      },
      sources: [],
      metadata: {
        executionTime: Date.now() - startTime,
        searchesPerformed: 0,
        phase: 'completed',
        modelUsed: this.context.modelId
      }
    }
  }

  /**
   * Maneja errores del orquestador
   */
  private handleError(error: any, query: string, startTime: number): ResearchResult {
    this.emitProgress('error', 0, 'Error en la investigación', error.message)
    
    return {
      success: false,
      response: `Ha ocurrido un error procesando su consulta: ${error.message}. Por favor, intente de nuevo o contacte soporte si el problema persiste.`,
      structuredResponse: {
        thesis: 'Error en el proceso',
        legalFramework: [],
        analysis: '',
        conclusion: error.message,
        sources: [],
        confidence: 0
      },
      sources: [],
      metadata: {
        executionTime: Date.now() - startTime,
        searchesPerformed: 0,
        phase: 'error',
        modelUsed: this.context.modelId
      },
      error: error.message
    }
  }

  /**
   * Emite progreso al callback
   */
  private emitProgress(phase: ResearchProgress['phase'], progress: number, message: string, detail?: string) {
    this.onProgress?.({ phase, progress, message, detail })
  }

  /**
   * Formatea la respuesta completa para el usuario
   */
  private formatFullResponse(synthesis: SynthesisResult): string {
    return `# Respuesta Legal

## Tesis
${synthesis.thesis}

${synthesis.legalFramework.length > 0 ? `## Marco Normativo\n${synthesis.legalFramework.map(f => `- ${f.citation}`).join('\n')}\n` : ''}

${synthesis.analysis ? `## Análisis Jurídico\n${synthesis.analysis}\n` : ''}

## Conclusión
${synthesis.conclusion}

---
*Confianza: ${Math.round(synthesis.confidence * 100)}% | Fuentes consultadas: ${synthesis.sources.length}*
`
  }
}

export default LegalResearchOrchestrator
