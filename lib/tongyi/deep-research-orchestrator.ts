import OpenAI from "openai"
import { searchLegalSpecialized, enrichLegalResults } from "@/lib/tools/legal/legal-search-specialized"
import { synthesizeLegalResponse, LegalSource, ResearchRound as LegalResearchRound } from "@/lib/utils/legal-synthesis"
import { 
  RESEARCH_PLANNING_PROMPT, 
  INFORMATION_SUFFICIENCY_PROMPT,
  QUERY_GENERATION_PROMPT,
  SOURCE_VERIFICATION_PROMPT,
  FINAL_SYNTHESIS_PROMPT
} from "./deep-research-prompts"

export interface DeepResearchOptions {
  client: OpenAI
  model: string
  maxResearchRounds?: number
  maxSearchesPerRound?: number
  searchTimeoutMs?: number
  onProgress?: (round: number, totalRounds: number, phase: string, message: string) => void
}

export interface ResearchSource {
  title: string
  url: string
  snippet: string
  type: 'official' | 'academic' | 'news' | 'general'
  relevance: number
  quality: number
  verificationNotes?: string
  authority: 'maxima' | 'alta' | 'media' | 'baja' | 'minima'
  currency: 'actualizada' | 'desactualizada' | 'desconocida'
  recommendedUse: 'cita_principal' | 'secundaria' | 'contextual' | 'no_usar'
}

export interface ResearchRound {
  roundNumber: number
  queries: string[]
  results: ResearchSource[]
  sufficiencyEvaluation: {
    isSufficient: boolean
    confidence: number
    detailedScores: {
      normativa: number
      jurisprudencia: number
      doctrina: number
      actualidad: number
      verificacion: number
    }
    totalScore: number
    missingInfo: string[]
    qualityIssues: string[]
    needsMoreSearch: boolean
    additionalQueries?: Array<{
      query: string
      priority: 'alta' | 'media' | 'baja'
      reason: string
    }>
  }
  durationMs: number
}

export interface DeepResearchResult {
  success: boolean
  context: string
  sources: ResearchSource[]
  rounds: ResearchRound[]
  metadata: {
    totalDurationMs: number
    totalRounds: number
    totalSources: number
    highQualitySources: number
    officialSources: number
    averageQuality: number
    gapsIdentified: number
    finalSufficiencyScore: number
  }
}

export interface EvidenceSummary {
  totalSources: number
  officialSources: number
  academicSources: number
  newsSources: number
  generalSources: number
  averageQuality: number
  highQualitySources: number
  coverageAreas: string[]
}

/**
 * Función principal que orquesta la investigación profunda dirigida por el modelo
 * Versión refactorizada con funciones separadas para cada fase
 */
export async function runDeepResearchWorkflow(
  userQuery: string,
  options: DeepResearchOptions
): Promise<DeepResearchResult> {
  const {
    client,
    model,
    maxResearchRounds = 5,
    maxSearchesPerRound = 6,
    searchTimeoutMs = 35000,
    onProgress
  } = options

  console.log(`\n🔍 INICIANDO INVESTIGACIÓN PROFUNDA MEJORADA`)
  console.log(`📝 Consulta: "${userQuery}"`)
  console.log(`📊 Máximo de rondas: ${maxResearchRounds}`)
  console.log(`🔍 Búsquedas por ronda: ${maxSearchesPerRound}`)
  console.log(`⏱️ Timeout por búsqueda: ${searchTimeoutMs}ms`)
  console.log(`${'='.repeat(80)}`)

  const startTime = Date.now()

  try {
    // FASE 1: Planificación inicial exhaustiva
    onProgress?.(0, maxResearchRounds, "planning", "Planificando estrategia de investigación...")
    const { initialPlan, minRequiredRounds, mandatoryQueries } = await executePlanningPhase(
      client, model, userQuery
    )

    // FASE 2: Ejecución iterativa exigente
    const { rounds, allSources, gapsIdentified } = await executeIterativePhase(
      client, model, userQuery, initialPlan, minRequiredRounds, mandatoryQueries,
      maxResearchRounds, maxSearchesPerRound, searchTimeoutMs, onProgress
    )

    // FASE 3: Síntesis final mejorada
    onProgress?.(rounds.length, maxResearchRounds, "synthesizing", "Sintetizando hallazgos...")
    const result = await executeSynthesisPhase(
      client, model, userQuery, allSources, rounds, startTime
    )

    return result

  } catch (error) {
    console.error(`❌ Error en investigación profunda:`, error)
    
    const totalDuration = Date.now() - startTime
    const partialResult: DeepResearchResult = {
      success: false,
      context: `Error durante la investigación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      sources: [],
      rounds: [],
      metadata: {
        totalDurationMs: totalDuration,
        totalRounds: 0,
        totalSources: 0,
        highQualitySources: 0,
        officialSources: 0,
        averageQuality: 0,
        gapsIdentified: 0,
        finalSufficiencyScore: 0
      }
    }

    return partialResult
  }
}

/**
 * FASE 1: Planificación inicial exhaustiva
 */
async function executePlanningPhase(
  client: OpenAI,
  model: string,
  userQuery: string
): Promise<{
  initialPlan: any;
  minRequiredRounds: number;
  mandatoryQueries: string[];
}> {
  console.log(`\n🔍 FASE 1: PLANIFICACIÓN EXHAUSTIVA`)
  const initialPlan = await planResearchStrategy(client, model, userQuery)
  console.log(`📋 Plan inicial: ${initialPlan.complexity} (${initialPlan.estimatedRounds} rondas estimadas)`)
  console.log(`🎯 Áreas de investigación: ${initialPlan.researchAreas?.length || 0} identificadas`)
  
  // Exigir mínimo de rondas según complejidad
  const minRequiredRounds = initialPlan.complexity === 'muy_compleja' ? 4 : 
                           initialPlan.complexity === 'compleja' ? 3 : 2

  const mandatoryQueries = buildMandatoryLegalQueries(userQuery)
  
  return { initialPlan, minRequiredRounds, mandatoryQueries }
}

/**
 * FASE 2: Ejecución iterativa exigente
 */
async function executeIterativePhase(
  client: OpenAI,
  model: string,
  userQuery: string,
  initialPlan: any,
  minRequiredRounds: number,
  mandatoryQueries: string[],
  maxResearchRounds: number,
  maxSearchesPerRound: number,
  searchTimeoutMs: number,
  onProgress?: (round: number, totalRounds: number, phase: string, message: string) => void
): Promise<{
  rounds: ResearchRound[];
  allSources: ResearchSource[];
  gapsIdentified: number;
}> {
  console.log(`\n🔄 FASE 2: EJECUCIÓN ITERATIVA EXIGENTE`)
  
  const rounds: ResearchRound[] = []
  let allSources: ResearchSource[] = []
  let gapsIdentified = 0
  let consecutiveInsufficientRounds = 0
  const executedQueries = new Set<string>()

  for (let round = 1; round <= maxResearchRounds; round++) {
    console.log(`\n🔍 RONDA ${round} DE INVESTIGACIÓN`)
    const roundStart = Date.now()
    
    // Report progress
    onProgress?.(round, maxResearchRounds, "searching", `Ronda ${round}: Buscando fuentes...`)
    
    // Generar consultas específicas para esta ronda
    let queries: string[] = []
    
    if (round === 1) {
      // Primera ronda: usar consultas del plan inicial
      queries = initialPlan.searchQueries.slice(0, maxSearchesPerRound)
      console.log(`📋 Usando ${queries.length} consultas del plan inicial`)
    } else {
      // Rondas subsiguientes: generar consultas basadas en brechas
      const lastRound = rounds[rounds.length - 1]
      if (lastRound?.sufficiencyEvaluation.needsMoreSearch && 
          lastRound.sufficiencyEvaluation.additionalQueries) {
        queries = lastRound.sufficiencyEvaluation.additionalQueries
          .filter(q => q.priority === 'alta')
          .slice(0, maxSearchesPerRound)
          .map(q => q.query)
        console.log(`🎯 Generadas ${queries.length} consultas de alta prioridad`)
      }
      
      // Si no hay consultas de alta prioridad, generar automáticas
      if (queries.length === 0) {
        queries = await generateAdditionalQueries(client, model, userQuery, allSources, rounds)
        console.log(`🤖 Generadas ${queries.length} consultas automáticas`)
      }
    }

    const pendingMandatory = mandatoryQueries
      .filter(q => !executedQueries.has(normalizeQueryKey(q)))
    const needsOfficialBoost = allSources.filter(s => s.type === 'official').length < 3
    if (pendingMandatory.length > 0) {
      const forcedQueries = (round === 1 || needsOfficialBoost)
        ? pendingMandatory
        : pendingMandatory.slice(0, Math.min(2, pendingMandatory.length))
      if (forcedQueries.length > 0) {
        console.log(`[INFO] Refuerzo de dominios oficiales con ${forcedQueries.length} consultas`)
        queries = [...forcedQueries, ...queries]
      }
    }

    const roundSeen = new Set<string>()
    queries = queries
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .filter(q => {
        const key = normalizeQueryKey(q)
        if (executedQueries.has(key) || roundSeen.has(key)) {
          return false
        }
        roundSeen.add(key)
        return true
      })

    const maxQueriesThisRound = Math.min(queries.length, maxSearchesPerRound + 2)
    if (queries.length > maxQueriesThisRound) {
      queries = queries.slice(0, maxQueriesThisRound)
    }

    if (queries.length === 0) {
      console.log(`⚠️ No se generaron consultas para ronda ${round}`)
      if (round >= minRequiredRounds) {
        console.log(`✅ Mínimo de rondas requeridas cumplido (${minRequiredRounds})`)
        break
      }
      continue
    }

    // Ejecutar búsquedas con mayor exigencia
    console.log(`🔍 Ejecutando ${queries.length} búsquedas especializadas...`)
    queries.forEach(q => executedQueries.add(normalizeQueryKey(q)))
    const roundResults = await executeSearchRound(queries, maxSearchesPerRound, searchTimeoutMs)
    
    // Verificación rigurosa de fuentes
    console.log(`🔍 Verificando calidad de ${roundResults.length} fuentes...`)
    const verifiedSources = await verifySources(client, model, roundResults)
    
    // Filtrar fuentes de alta calidad solo
    const highQualitySources = verifiedSources.filter(source => source.quality >= 6)
    console.log(`✅ ${highQualitySources.length} fuentes de alta calidad (>=6/10)`)
    
    allSources = [...allSources, ...highQualitySources]

    // Eliminar duplicados y mantener solo las mejores
    allSources = removeDuplicateSources(allSources)
    allSources = allSources.sort((a, b) => b.quality - a.quality).slice(0, 20) // Máximo 20 fuentes
    
    // Evaluación exhaustiva de suficiencia
    console.log(`📊 Evaluando suficiencia de información...`)
    const sufficiencyEval = await evaluateInformationSufficiency(
      client, 
      model, 
      userQuery, 
      allSources, 
      rounds
    )

    const roundDuration = Date.now() - roundStart

    const researchRound: ResearchRound = {
      roundNumber: round,
      queries,
      results: highQualitySources,
      sufficiencyEvaluation: sufficiencyEval,
      durationMs: roundDuration
    }

    rounds.push(researchRound)
    
    console.log(`✅ Ronda ${round} completada en ${roundDuration}ms`)
    console.log(`📊 Fuentes: ${highQualitySources.length} | Calidad promedio: ${highQualitySources.length > 0 ? (highQualitySources.reduce((sum, s) => sum + s.quality, 0) / highQualitySources.length).toFixed(1) : 0}/10`)
    console.log(`📊 Suficiencia: ${sufficiencyEval.isSufficient ? 'Sí' : 'NO'} (${sufficiencyEval.confidence.toFixed(2)})`)
    console.log(`📊 Puntaje total: ${sufficiencyEval.totalScore}/100`)
    
    if (sufficiencyEval.missingInfo.length > 0) {
      console.log(`🔍 Brechas identificadas: ${sufficiencyEval.missingInfo.length}`)
      gapsIdentified += sufficiencyEval.missingInfo.length
    }

    // Lógica de continuación más exigente
    if (sufficiencyEval.isSufficient && sufficiencyEval.confidence >= 0.85 && sufficiencyEval.totalScore >= 80) {
      console.log(`✅ INFORMACIÓN SUFICIENTE Y DE ALTA CALIDAD`)
      if (round >= minRequiredRounds) {
        console.log(`✅ Requisitos mínimos cumplidos, finalizando investigación`)
        break
      }
    }

    // Contar rondas insuficientes consecutivas
    if (sufficiencyEval.totalScore < 50) {
      consecutiveInsufficientRounds++
      console.log(`⚠️ Ronda de baja calidad (${consecutiveInsufficientRounds}/3 consecutivas)`)
      
      if (consecutiveInsufficientRounds >= 3) {
        console.log(`❌ 3 rondas consecutivas de baja calidad, finalizando`)
        break
      }
    } else {
      consecutiveInsufficientRounds = 0
    }

    // Exigir mínimo de fuentes de alta calidad
    const highQualityCount = allSources.filter(s => s.quality >= 7).length
    if (highQualityCount >= 8 && round >= minRequiredRounds && sufficiencyEval.totalScore >= 70) {
      console.log(`✅ Suficientes fuentes de alta calidad (${highQualityCount}), finalizando`)
      break
    }
  }

  return { rounds, allSources, gapsIdentified }
}

/**
 * FASE 3: Síntesis final mejorada
 */
async function executeSynthesisPhase(
  client: OpenAI,
  model: string,
  userQuery: string,
  allSources: ResearchSource[],
  rounds: ResearchRound[],
  startTime: number
): Promise<DeepResearchResult> {
  console.log(`\n📝 FASE 3: SÍNTESIS FINAL MEJORADA`)
  const totalDuration = Date.now() - startTime
  
  // Generar contexto final con síntesis experta
  const modelContext = await generateFinalSynthesis(client, model, userQuery, allSources, rounds)
  
  const result: DeepResearchResult = {
    success: true,
    context: modelContext,
    sources: allSources,
    rounds,
    metadata: {
      totalDurationMs: totalDuration,
      totalRounds: rounds.length,
      totalSources: allSources.length,
      highQualitySources: allSources.filter(s => s.quality >= 7).length,
      officialSources: allSources.filter(s => s.type === 'official').length,
      averageQuality: allSources.length > 0 ? 
        allSources.reduce((sum, s) => sum + s.quality, 0) / allSources.length : 0,
      gapsIdentified: rounds.reduce((sum, r) => sum + r.sufficiencyEvaluation.missingInfo.length, 0),
      finalSufficiencyScore: rounds.length > 0 ? rounds[rounds.length - 1].sufficiencyEvaluation.totalScore : 0
    }
  }

  console.log(`\n🎉 INVESTIGACIÓN PROFUNDA COMPLETADA`)
  console.log(`⏱️ Duración total: ${totalDuration}ms`)
  console.log(`📊 Rondas ejecutadas: ${rounds.length}`)
  console.log(`📚 Fuentes encontradas: ${allSources.length}`)
  console.log(`⭐ Fuentes de alta calidad: ${result.metadata.highQualitySources}`)
  console.log(`🏛️ Fuentes oficiales: ${result.metadata.officialSources}`)
  console.log(`📊 Calidad promedio: ${result.metadata.averageQuality.toFixed(1)}/10`)
  console.log(`📊 Puntaje final de suficiencia: ${result.metadata.finalSufficiencyScore}/100`)
  console.log(`${'='.repeat(80)}`)

  return result
}

// Funciones auxiliares (mantenidas del código original)

async function executeSearchRound(
  queries: string[],
  maxSearchesPerRound: number,
  searchTimeoutMs: number
): Promise<ResearchSource[]> {
  const allResults: ResearchSource[] = []
  
  for (const query of queries.slice(0, maxSearchesPerRound)) {
    try {
      console.log(`🔍 Buscando: "${query}"`)
      // Use 5 results per query (second parameter is numResults, not timeout)
      const searchResult = await searchLegalSpecialized(query, 5)
      
      if (searchResult.success && searchResult.results.length > 0) {
        // Skip enrichment for speed - use results directly
        const researchSources: ResearchSource[] = searchResult.results.map(result => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          type: result.type,
          relevance: result.relevance,
          quality: result.type === 'official' ? 7 : result.type === 'academic' ? 6 : result.type === 'news' ? 5 : 4,
          authority: result.type === 'official' ? 'maxima' : result.type === 'academic' ? 'alta' : result.type === 'news' ? 'media' : 'baja',
          currency: 'desconocida' as const,
          recommendedUse: result.type === 'official' ? 'cita_principal' : result.type === 'academic' ? 'secundaria' : 'contextual'
        }))
        
        allResults.push(...researchSources)
        console.log(`✅ Encontradas ${researchSources.length} fuentes`)
      } else {
        console.log(`⚠️ Sin resultados para: "${query}"`)
      }
    } catch (error) {
      console.error(`❌ Error en búsqueda "${query}":`, error)
    }
  }
  
  return allResults
}

async function verifySources(
  client: OpenAI,
  model: string,
  sources: ResearchSource[]
): Promise<ResearchSource[]> {
  if (sources.length === 0) return sources

  const verificationPrompt = SOURCE_VERIFICATION_PROMPT.replace('{sources}', JSON.stringify(sources, null, 2))
  
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: verificationPrompt }],
      temperature: 0.1,
      max_tokens: 4000
    })

    const content = response.choices[0]?.message?.content || ''
    const verificationData = parseSourceVerification(content)
    
    return sources.map((source, index) => ({
      ...source,
      verificationNotes: verificationData.sources[index]?.verificationNotes || '',
      authority: verificationData.sources[index]?.authority || source.authority,
      currency: verificationData.sources[index]?.currency || source.currency,
      recommendedUse: verificationData.sources[index]?.recommendedUse || source.recommendedUse
    }))
  } catch (error) {
    console.error('Error verificando fuentes:', error)
    return sources
  }
}

async function evaluateInformationSufficiency(
  client: OpenAI,
  model: string,
  originalQuery: string,
  sources: ResearchSource[],
  previousRounds: ResearchRound[]
): Promise<{
  isSufficient: boolean
  confidence: number
  detailedScores: {
    normativa: number
    jurisprudencia: number
    doctrina: number
    actualidad: number
    verificacion: number
  }
  totalScore: number
  missingInfo: string[]
  qualityIssues: string[]
  needsMoreSearch: boolean
  additionalQueries?: Array<{
    query: string
    priority: 'alta' | 'media' | 'baja'
    reason: string
  }>
}> {
  const evidenceSummary = analyzeEvidenceSummary(sources)
  const evaluationPrompt = INFORMATION_SUFFICIENCY_PROMPT
    .replace('{query}', originalQuery)
    .replace('{sources}', JSON.stringify(sources, null, 2))
    .replace('{evidenceSummary}', JSON.stringify(evidenceSummary, null, 2))
    .replace('{previousRounds}', JSON.stringify(previousRounds.length))
  
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: evaluationPrompt }],
      temperature: 0.1,
      max_tokens: 3000
    })

    const content = response.choices[0]?.message?.content || ''
    const evaluation = parseSufficiencyEvaluation(content)
    
    const enforcedEvaluation = enforceEvidenceThresholds(evaluation, evidenceSummary, originalQuery)
    
    return enforcedEvaluation
  } catch (error) {
    console.error('Error evaluando suficiencia:', error)
    
    return {
      isSufficient: false,
      confidence: 0.3,
      detailedScores: {
        normativa: 10,
        jurisprudencia: 10,
        doctrina: 10,
        actualidad: 10,
        verificacion: 10
      },
      totalScore: 50,
      missingInfo: ['Error en evaluación de suficiencia'],
      qualityIssues: ['No se pudo evaluar la calidad'],
      needsMoreSearch: true,
      additionalQueries: [{
        query: originalQuery,
        priority: 'alta',
        reason: 'Error en evaluación, reintentar búsqueda'
      }]
    }
  }
}

async function generateAdditionalQueries(
  client: OpenAI,
  model: string,
  originalQuery: string,
  currentSources: ResearchSource[],
  previousRounds: ResearchRound[]
): Promise<string[]> {
  const queryPrompt = QUERY_GENERATION_PROMPT
    .replace('{query}', originalQuery)
    .replace('{sources}', JSON.stringify(currentSources, null, 2))
    .replace('{rounds}', JSON.stringify(previousRounds.length))
  
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: queryPrompt }],
      temperature: 0.3,
      max_tokens: 2000
    })

    const content = response.choices[0]?.message?.content || ''
    const queryData = parseQueryGeneration(content)
    
    return queryData.additionalQueries || []
  } catch (error) {
    console.error('Error generando consultas adicionales:', error)
    return []
  }
}

async function generateFinalSynthesis(
  client: OpenAI,
  model: string,
  originalQuery: string,
  sources: ResearchSource[],
  rounds: ResearchRound[]
): Promise<string> {
  try {
    // Convertir fuentes al formato estándar
    const legalSources: LegalSource[] = sources.map(source => ({
      title: source.title,
      url: source.url,
      content: source.snippet,
      snippet: source.snippet,
      type: source.type,
      quality: source.quality,
      authority: source.authority,
      currency: source.currency,
      recommendedUse: source.recommendedUse,
      verificationNotes: source.verificationNotes
    }))

    // Convertir rondas al formato estándar
    const researchRounds: LegalResearchRound[] = rounds.map(round => ({
      roundNumber: round.roundNumber,
      queries: round.queries,
      results: round.results.map(result => ({
        title: result.title,
        url: result.url,
        content: result.snippet,
        snippet: result.snippet,
        type: result.type,
        quality: result.quality,
        authority: result.authority,
        currency: result.currency,
        recommendedUse: result.recommendedUse,
        verificationNotes: result.verificationNotes
      })),
      durationMs: round.durationMs,
      sufficiencyEvaluation: round.sufficiencyEvaluation
    }))

    // Usar función de síntesis unificada
    const result = await synthesizeLegalResponse({
      client,
      model,
      userQuery: originalQuery,
      sources: legalSources,
      researchRounds,
      synthesisType: 'comprehensive',
      includeMetadata: true,
      includeWarnings: true,
      temperature: 0.2,
      maxTokens: 4000
    })

    if (result.success) {
      return result.content
    } else {
      console.error('Error in final synthesis:', result.error)
      return `Error generando síntesis: ${result.error || 'Error desconocido'}`
    }
  } catch (error) {
    console.error('Error generando síntesis final:', error)
    return `Error generando síntesis: ${error instanceof Error ? error.message : 'Error desconocido'}`
  }
}

async function planResearchStrategy(
  client: OpenAI,
  model: string,
  userQuery: string
): Promise<{
  complexity: 'simple' | 'compleja' | 'muy_compleja'
  estimatedRounds: number
  researchAreas: string[]
  searchQueries: string[]
}> {
  const planningPrompt = RESEARCH_PLANNING_PROMPT.replace('{query}', userQuery)
  
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: planningPrompt }],
      temperature: 0.2,
      max_tokens: 3000
    })

    const content = response.choices[0]?.message?.content || ''
    return parseResearchPlan(content)
  } catch (error) {
    console.error('Error planificando investigación:', error)
    
    return {
      complexity: 'compleja',
      estimatedRounds: 3,
      researchAreas: ['Derecho general'],
      searchQueries: [userQuery]
    }
  }
}

function removeDuplicateSources(sources: ResearchSource[]): ResearchSource[] {
  const seen = new Set<string>()
  return sources.filter(source => {
    const key = source.url.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function normalizeQueryKey(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ')
}

function analyzeEvidenceSummary(sources: ResearchSource[]): EvidenceSummary {
  const officialSources = sources.filter(s => s.type === 'official').length
  const academicSources = sources.filter(s => s.type === 'academic').length
  const newsSources = sources.filter(s => s.type === 'news').length
  const generalSources = sources.filter(s => s.type === 'general').length
  const averageQuality = sources.length > 0 ? sources.reduce((sum, s) => sum + s.quality, 0) / sources.length : 0
  const highQualitySources = sources.filter(s => s.quality >= 7).length
  
  const coverageAreas = sources.map(s => s.title.toLowerCase()).slice(0, 10)
  
  return {
    totalSources: sources.length,
    officialSources,
    academicSources,
    newsSources,
    generalSources,
    averageQuality,
    highQualitySources,
    coverageAreas
  }
}

function enforceEvidenceThresholds(
  evaluation: ReturnType<typeof parseSufficiencyEvaluation>,
  evidenceSummary: EvidenceSummary,
  originalQuery: string
): ReturnType<typeof parseSufficiencyEvaluation> {
  const issues: string[] = []
  const missingInfo: string[] = []
  const additionalQueries: Array<{query: string, priority: 'alta' | 'media' | 'baja', reason: string}> = []
  
  if (evidenceSummary.officialSources < 2) {
    issues.push(`Solo ${evidenceSummary.officialSources} fuentes oficiales encontradas (mínimo requerido: 2)`)
    missingInfo.push('Más fuentes oficiales del gobierno colombiano')
    additionalQueries.push({
      query: `${originalQuery} sitio:gov.co`,
      priority: 'alta',
      reason: 'Refuerzo de fuentes oficiales'
    })
  }
  
  const explicitArticles = evidenceSummary.coverageAreas.filter(area => 
    area.includes('artículo') || area.includes('ley') || area.includes('decreto')
  ).length
  
  if (explicitArticles < 1) {
    issues.push('No se encontraron artículos o leyes explícitas')
    missingInfo.push('Referencias específicas a artículos de ley')
    additionalQueries.push({
      query: `${originalQuery} artículo ley decreto`,
      priority: 'alta',
      reason: 'Búsqueda de artículos específicos'
    })
  }
  
  const jurisprudenceSources = evidenceSummary.coverageAreas.filter(area => 
    area.includes('sentencia') || area.includes('jurisprudencia') || area.includes('corte')
  ).length
  
  if (jurisprudenceSources < 1) {
    issues.push('No se encontró jurisprudencia relevante')
    missingInfo.push('Sentencias o jurisprudencia relacionada')
    additionalQueries.push({
      query: `${originalQuery} sentencia jurisprudencia corte`,
      priority: 'media',
      reason: 'Búsqueda de jurisprudencia'
    })
  }
  
  const doctrineSources = evidenceSummary.coverageAreas.filter(area => 
    area.includes('doctrina') || area.includes('académico') || area.includes('universidad')
  ).length
  
  if (doctrineSources < 1) {
    issues.push('No se encontró doctrina académica')
    missingInfo.push('Análisis doctrinal o académico')
    additionalQueries.push({
      query: `${originalQuery} doctrina académico universidad`,
      priority: 'media',
      reason: 'Búsqueda de doctrina'
    })
  }
  
  let adjustedScore = evaluation.totalScore
  if (issues.length > 0) {
    adjustedScore = Math.max(0, adjustedScore - (issues.length * 15))
  }
  
  return {
    ...evaluation,
    totalScore: adjustedScore,
    isSufficient: adjustedScore >= 70 && issues.length === 0,
    missingInfo: [...evaluation.missingInfo, ...missingInfo],
    qualityIssues: [...evaluation.qualityIssues, ...issues],
    needsMoreSearch: issues.length > 0 || evaluation.needsMoreSearch,
    additionalQueries: [...(evaluation.additionalQueries || []), ...additionalQueries]
  }
}

function buildMandatoryLegalQueries(query: string): string[] {
  const baseQuery = query.toLowerCase()
  const mandatoryQueries: string[] = []
  
  mandatoryQueries.push(`${query} sitio:corteconstitucional.gov.co`)
  mandatoryQueries.push(`${query} sitio:consejodeestado.gov.co`)
  mandatoryQueries.push(`${query} sitio:suin-juriscol.gov.co`)
  
  if (baseQuery.includes('constitucional') || baseQuery.includes('derechos')) {
    mandatoryQueries.push(`${query} sitio:corteconstitucional.gov.co derechos fundamentales`)
  }
  
  if (baseQuery.includes('administrativo') || baseQuery.includes('estado')) {
    mandatoryQueries.push(`${query} sitio:consejodeestado.gov.co derecho administrativo`)
  }
  
  if (baseQuery.includes('civil') || baseQuery.includes('comercial')) {
    mandatoryQueries.push(`${query} sitio:ramajudicial.gov.co derecho civil`)
  }
  
  if (baseQuery.includes('penal') || baseQuery.includes('criminal')) {
    mandatoryQueries.push(`${query} sitio:fiscalia.gov.co derecho penal`)
  }
  
  return mandatoryQueries
}

function parseResearchPlan(content: string): {
  complexity: 'simple' | 'compleja' | 'muy_compleja'
  estimatedRounds: number
  researchAreas: string[]
  searchQueries: string[]
} {
  try {
    const jsonContent = extractJson(content)
    const parsed = JSON.parse(jsonContent)
    
    return {
      complexity: parsed.complexity || 'compleja',
      estimatedRounds: parsed.estimatedRounds || 3,
      researchAreas: parsed.researchAreas || ['Derecho general'],
      searchQueries: parsed.searchQueries || []
    }
  } catch (error) {
    console.error('Error parseando plan de investigación:', error)
    
    return {
      complexity: 'compleja',
      estimatedRounds: 3,
      researchAreas: ['Derecho general'],
      searchQueries: []
    }
  }
}

function parseQueryGeneration(content: string): {
  additionalQueries: string[]
} {
  try {
    const jsonContent = extractJson(content)
    const parsed = JSON.parse(jsonContent)
    
    return {
      additionalQueries: parsed.additionalQueries || []
    }
  } catch (error) {
    console.error('Error parseando generación de consultas:', error)
    
    return {
      additionalQueries: []
    }
  }
}

function parseSourceVerification(content: string): {
  sources: Array<{
    verificationNotes: string
    authority: 'maxima' | 'alta' | 'media' | 'baja' | 'minima'
    currency: 'actualizada' | 'desactualizada' | 'desconocida'
    recommendedUse: 'cita_principal' | 'secundaria' | 'contextual' | 'no_usar'
  }>
} {
  try {
    const jsonContent = extractJson(content)
    const parsed = JSON.parse(jsonContent)
    
    return {
      sources: parsed.sources || []
    }
  } catch (error) {
    console.error('Error parseando verificación de fuentes:', error)
    
    return {
      sources: []
    }
  }
}

function parseSufficiencyEvaluation(content: string): {
  isSufficient: boolean
  confidence: number
  detailedScores: {
    normativa: number
    jurisprudencia: number
    doctrina: number
    actualidad: number
    verificacion: number
  }
  totalScore: number
  missingInfo: string[]
  qualityIssues: string[]
  needsMoreSearch: boolean
  additionalQueries?: Array<{
    query: string
    priority: 'alta' | 'media' | 'baja'
    reason: string
  }>
} {
  try {
    const jsonContent = extractJson(content)
    const parsed = JSON.parse(jsonContent)
    
    return {
      isSufficient: parsed.isSufficient || false,
      confidence: parsed.confidence || 0.3,
      detailedScores: parsed.detailedScores || {
        normativa: 10,
        jurisprudencia: 10,
        doctrina: 10,
        actualidad: 10,
        verificacion: 10
      },
      totalScore: parsed.totalScore || 50,
      missingInfo: parsed.missingInfo || [],
      qualityIssues: parsed.qualityIssues || [],
      needsMoreSearch: parsed.needsMoreSearch || true,
      additionalQueries: parsed.additionalQueries || []
    }
  } catch (error) {
    console.error('Error parseando evaluación de suficiencia:', error)
    
    return {
      isSufficient: false,
      confidence: 0.3,
      detailedScores: {
        normativa: 10,
        jurisprudencia: 10,
        doctrina: 10,
        actualidad: 10,
        verificacion: 10
      },
      totalScore: 50,
      missingInfo: ['Error en evaluación'],
      qualityIssues: ['Error en evaluación'],
      needsMoreSearch: true,
      additionalQueries: []
    }
  }
}

function extractJson(content: string): string {
  const start = content.indexOf("{")
  const end = content.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("JSON no encontrado en el contenido")
  }
  return content.slice(start, end + 1)
}
