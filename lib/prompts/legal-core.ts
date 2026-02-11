/**
 * Sistema de Prompts Legal Core - ALI
 * Versión 3.0: Unificado, sin ruido interno, máxima precisión jurídica
 * 
 * Principios:
 * 1. Zero exposición de lógica interna al usuario
 * 2. Precisión jurídica máxima (fuente primaria siempre)
 * 3. Respuestas adaptativas según complejidad
 * 4. Sin prompts robóticos ni excesivamente largos
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN CENTRAL
// ═══════════════════════════════════════════════════════════════════════════════

export const ALI_CONFIG = {
  version: '3.0.0',
  name: 'ALI',
  fullName: 'Asistente Legal Inteligente',
  jurisdiction: 'Colombia',
  
  // Comportamiento
  maxGreetingLength: 120,      // caracteres
  maxSimpleResponseLines: 8,   // líneas
  maxSimpleResponseChars: 500, // caracteres
  
  // Fuentes oficiales prioritarias
  primarySources: [
    'corteconstitucional.gov.co',
    'consejodeestado.gov.co',
    'cortesuprema.gov.co',
    'suin-juriscol.gov.co',
    'secretariasenado.gov.co',
    'funcionpublica.gov.co',
    'imprenta.gov.co',
    'ramajudicial.gov.co'
  ]
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BASE (ÚNICO SYSTEM PROMPT)
// ═══════════════════════════════════════════════════════════════════════════════

export const LEGAL_CORE_SYSTEM_PROMPT = `Eres ALI, un asistente de investigación jurídica especializado en derecho colombiano.

OBJETIVO: Proporcionar información legal precisa, verificada y útil para profesionales del derecho.

REGLAS DE ORO:
1. Verifica ANTES de afirmar - Usa las herramientas de búsqueda para confirmar normas, artículos y jurisprudencia
2. Cita siempre fuentes oficiales - Preferir .gov.co y bases de datos jurídicas reconocidas
3. Distingue vigencia - Indica claramente si una norma está vigente, modificada o derogada
4. Separa hecho de opinión - Distingue entre texto normativo, jurisprudencia y análisis doctrinario
5. Nunca inventes - Si no encuentras la fuente, indícalo honestamente

JERARQUÍA NORMATIVA COLOMBIANA:
1. Constitución Política 1991 + Bloque de Constitucionalidad
2. Leyes Estatutarias (mayoría absoluta)
3. Leyes Ordinarias y Códigos
4. Decretos Legislativos y Reglamentarios
5. Jurisprudencia de Altas Cortes (vinculante)
6. Doctrina y conceptos de autoridades

FORMATO DE RESPUESTAS:

Para CONSULTAS SIMPLES (artículo específico, definición breve):
→ Respuesta directa + cita exacta + fuente

Para CONSULTAS COMPLEJAS (análisis de casos, procedimientos):
→ Respuesta estructurada con: (1) Resumen ejecutivo, (2) Fundamento normativo, (3) Análisis aplicado, (4) Fuentes verificadas

ADVERTENCIA FINAL OBLIGATORIA (cuando aplique):
ℹ️ Esta información es orientativa y no sustituye la opinión de un abogado para casos específicos.

IDIOMA: Español colombiano con terminología jurídica precisa.`

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTOR DE COMPLEJIDAD
// ═══════════════════════════════════════════════════════════════════════════════

export type QueryComplexity = 'minimal' | 'simple' | 'standard' | 'complex'

export interface QueryAnalysis {
  complexity: QueryComplexity
  category: 'greeting' | 'farewell' | 'identity' | 'article_lookup' | 'norm_query' | 'case_analysis' | 'procedure' | 'jurisprudence' | 'document_draft' | 'other'
  requiresSearch: boolean
  requiresJurisprudence: boolean
  estimatedSources: number
}

/**
 * Analiza la consulta y determina complejidad y categoría
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const normalized = query.toLowerCase().trim()
  const words = normalized.split(/\s+/).length
  
  // Patrones de detección
  const isGreeting = /^(hola|buenos días|buenas tardes|buenas noches|hey|saludos|qué tal|cómo estás|hi|hello)[\s!?.]*$/i.test(normalized)
  const isFarewell = /^(gracias|adiós|hasta luego|chao|bye|nos vemos)[\s!?.]*$/i.test(normalized)
  const isIdentity = /(quién eres|qué eres|qué haces|cómo funcionas|para qué sirves)/i.test(normalized)
  
  const isArticleLookup = /(art[íi]culo|art\.?)\s*\d+/i.test(normalized) && words < 15
  const isJurisprudence = /(sentencia|fallo|auto)\s*[ctsuCTSU]?-?\d+/i.test(normalized)
  const isCaseAnalysis = /(caso|situación|escenario|mi cliente|me pasó|tengo un problema)/i.test(normalized) && words > 10
  const isProcedure = /(cómo|cuáles|qué necesito).*(presentar|demanda|tutela|proceso|trámite)/i.test(normalized)
  const isDocumentDraft = /(redacta|elabora|escribe|genera).*(tutela|demanda|contrato|memorial|escrito)/i.test(normalized)
  
  // Determinar categoría
  if (isGreeting) {
    return { complexity: 'minimal', category: 'greeting', requiresSearch: false, requiresJurisprudence: false, estimatedSources: 0 }
  }
  if (isFarewell) {
    return { complexity: 'minimal', category: 'farewell', requiresSearch: false, requiresJurisprudence: false, estimatedSources: 0 }
  }
  if (isIdentity) {
    return { complexity: 'minimal', category: 'identity', requiresSearch: false, requiresJurisprudence: false, estimatedSources: 0 }
  }
  if (isArticleLookup) {
    return { complexity: 'simple', category: 'article_lookup', requiresSearch: true, requiresJurisprudence: false, estimatedSources: 2 }
  }
  if (isJurisprudence) {
    return { complexity: 'standard', category: 'jurisprudence', requiresSearch: true, requiresJurisprudence: true, estimatedSources: 3 }
  }
  if (isDocumentDraft) {
    return { complexity: 'standard', category: 'document_draft', requiresSearch: true, requiresJurisprudence: false, estimatedSources: 2 }
  }
  if (isCaseAnalysis) {
    return { complexity: 'complex', category: 'case_analysis', requiresSearch: true, requiresJurisprudence: true, estimatedSources: 5 }
  }
  if (isProcedure) {
    return { complexity: 'standard', category: 'procedure', requiresSearch: true, requiresJurisprudence: false, estimatedSources: 3 }
  }
  
  // Por defecto: consulta normativa general
  if (words < 10) {
    return { complexity: 'simple', category: 'norm_query', requiresSearch: true, requiresJurisprudence: false, estimatedSources: 3 }
  }
  return { complexity: 'standard', category: 'norm_query', requiresSearch: true, requiresJurisprudence: false, estimatedSources: 4 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTRUCCIONES ADAPTATIVAS POR COMPLEJIDAD
// ═══════════════════════════════════════════════════════════════════════════════

export function getComplexityInstructions(analysis: QueryAnalysis): string {
  switch (analysis.complexity) {
    case 'minimal':
      return `INSTRUCCIÓN: Responde de forma breve y natural (máximo 1-2 líneas). No uses disclaimers ni expongas capacidades del sistema.`
    
    case 'simple':
      return `INSTRUCCIÓN: Respuesta concisa y directa. 
- Máximo 5-6 líneas
- Cita la fuente exacta
- NO uses secciones ni formato excesivo
- Ejemplo: "El artículo X establece... (Constitución, Art. X). Fuente: [link]"`
    
    case 'standard':
      return `INSTRUCCIÓN: Respuesta estructurada pero concisa.
- Respuesta directa primero
- Fundamento normativo con citas exactas
- Si aplica: jurisprudencia relevante mencionada brevemente
- Fuentes verificadas al final
- Máximo 15-20 líneas`
    
    case 'complex':
      return `INSTRUCCIÓN: Análisis completo y profesional.
- Resumen ejecutivo (2-3 líneas)
- Marco normativo aplicable (jerarquizado)
- Análisis aplicado a la situación
- Jurisprudencia relevante si existe
- Recomendaciones prácticas
- Advertencia sobre consultar abogado
- Fuentes completas con URLs`
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS ESPECIALIZADOS (Solo añadidos al system cuando se necesitan)
// ═══════════════════════════════════════════════════════════════════════════════

export const SPECIALIZED_PROMPTS = {
  documentDraft: `
MODO REDACCIÓN DE DOCUMENTOS:
Antes de generar cualquier documento:
1. Verifica la normativa aplicable actualizada
2. Solicita datos esenciales si faltan (usar placeholders {{DATO}})
3. Estructura el documento según el tipo legal colombiano
4. Incluye siempre disclaimer de documento preliminar
5. NO inventes hechos, jurisprudencia ni fundamentos

Placeholders comunes: {{NOMBRE}}, {{CEDULA}}, {{DIRECCION}}, {{FECHA}}, {{ENTIDAD}}`,

  jurisprudenceSearch: `
MODO BÚSQUEDA JURISPRUDENCIAL:
- Prioridad: Corte Constitucional > Consejo de Estado > Corte Suprema
- Incluye: Tipo de sentencia, número, año, ponente (si aplica) y tesis relevante
- Extrae el fallo o parte resolutiva si es pertinente
- Verifica que la sentencia no haya sido modificada o revocada`,

  caseAnalysis: `
MODO ANÁLISIS DE CASO:
1. Identifica el área del derecho (civil, penal, laboral, etc.)
2. Busca normativa aplicable específica
3. Identifica elementos de prueba necesarios
4. Menciona plazos procesales relevantes
5. NO determines resultado definitivo - solo opciones legales
6. Recomienda siempre consulta con especialista`
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR DE SYSTEM MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

export interface SystemMessageConfig {
  query: string
  isDocumentDraft?: boolean
  isJurisprudenceSearch?: boolean
  isCaseAnalysis?: boolean
  customInstructions?: string
}

/**
 * Construye el mensaje de sistema óptimo para cada consulta
 */
export function buildSystemMessage(config: SystemMessageConfig): string {
  const analysis = analyzeQuery(config.query)
  
  // Empezar con el prompt base
  let systemMessage = LEGAL_CORE_SYSTEM_PROMPT
  
  // Añadir instrucciones de complejidad
  systemMessage += '\n\n' + getComplexityInstructions(analysis)
  
  // Añadir prompts especializados si aplica
  if (config.isDocumentDraft || analysis.category === 'document_draft') {
    systemMessage += '\n\n' + SPECIALIZED_PROMPTS.documentDraft
  }
  
  if (config.isJurisprudenceSearch || analysis.category === 'jurisprudence') {
    systemMessage += '\n\n' + SPECIALIZED_PROMPTS.jurisprudenceSearch
  }
  
  if (config.isCaseAnalysis || analysis.category === 'case_analysis') {
    systemMessage += '\n\n' + SPECIALIZED_PROMPTS.caseAnalysis
  }
  
  // Añadir instrucciones personalizadas si existen
  if (config.customInstructions) {
    systemMessage += '\n\n' + config.customInstructions
  }
  
  return systemMessage
}

/**
 * Determina si la consulta requiere búsqueda web
 */
export function requiresSearch(query: string): boolean {
  const analysis = analyzeQuery(query)
  return analysis.requiresSearch
}

/**
 * Obtiene metadatos de la consulta para logging/tracking
 */
export function getQueryMetadata(query: string): QueryAnalysis & { timestamp: string } {
  return {
    ...analyzeQuery(query),
    timestamp: new Date().toISOString()
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Las funciones ya están exportadas individualmente arriba
// SYSTEM_PROMPT se exporta como alias de LEGAL_CORE_SYSTEM_PROMPT
export { LEGAL_CORE_SYSTEM_PROMPT as SYSTEM_PROMPT }
