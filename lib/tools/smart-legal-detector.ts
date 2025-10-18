/**
 * Detector inteligente para determinar si una consulta requiere búsqueda web legal
 * Solo busca cuando es necesario información legal colombiana específica
 */

export interface LegalDetectionResult {
  requiresWebSearch: boolean
  confidence: number
  reason: string
  searchStrategy?: 'constitutional' | 'code' | 'general-legal' | 'none'
  keywords: string[]
  entities: string[]
}

/**
 * Palabras clave que indican consulta legal colombiana
 */
const LEGAL_KEYWORDS = [
  // Conceptos legales fundamentales
  'derecho', 'ley', 'norma', 'reglamento', 'decreto', 'resolucion', 'circular',
  'jurisprudencia', 'sentencia', 'fallo', 'decision', 'tribunal', 'corte',
  'juez', 'magistrado', 'fiscal', 'procurador', 'defensor', 'abogado',
  
  // Procesos legales
  'proceso', 'procedimiento', 'demanda', 'demandado', 'demandante', 'actor',
  'recurso', 'apelacion', 'casacion', 'tutela', 'accion', 'pretension',
  'prescripcion', 'caducidad', 'termino', 'plazo', 'notificacion', 'citacion',
  
  // Materias legales específicas
  'civil', 'penal', 'laboral', 'comercial', 'administrativo', 'constitucional',
  'familiar', 'tributario', 'fiscal', 'contractual', 'obligaciones', 'responsabilidad',
  'propiedad', 'posesion', 'usucapion', 'hipoteca', 'prenda', 'fianza',
  
  // Instituciones colombianas
  'corte constitucional', 'corte suprema', 'consejo de estado', 'corte suprema de justicia',
  'fiscalia', 'procuraduria', 'defensoria', 'contraloria', 'registraduria',
  'superintendencia', 'ministerio', 'congreso', 'senado', 'camara',
  
  // Códigos y leyes específicas
  'codigo civil', 'codigo penal', 'codigo procesal', 'codigo de comercio',
  'codigo de procedimiento civil', 'codigo de procedimiento penal',
  'constitucion politica', 'constitucion de colombia', 'carta magna',
  'ley 100', 'ley 1437', 'ley 1564', 'ley 906', 'ley 1098',
  
  // Artículos y numerales
  'articulo', 'art', 'numeral', 'inciso', 'paragrafo', 'literal',
  
  // Conceptos procesales
  'audiencia', 'prueba', 'testigo', 'perito', 'diligencias', 'actuaciones',
  'auto', 'sentencia', 'providencia', 'resolucion', 'decreto',
  
  // Derechos fundamentales
  'derechos fundamentales', 'derechos humanos', 'libertad', 'igualdad',
  'dignidad', 'vida', 'honra', 'intimidad', 'habeas corpus', 'habeas data',
  
  // Materias específicas colombianas
  'desplazamiento', 'victimas', 'restitucion', 'justicia transicional',
  'paramilitar', 'guerrilla', 'conflicto armado', 'acuerdo de paz',
  'jurisdiccion especial', 'jep', 'comision de la verdad'
]

/**
 * Palabras que indican consultas NO legales (saludos, conversación casual)
 */
const NON_LEGAL_KEYWORDS = [
  'hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'gracias', 'por favor',
  'como estas', 'que tal', 'saludos', 'adios', 'hasta luego', 'nos vemos',
  'feliz cumpleanos', 'feliz navidad', 'feliz ano nuevo', 'felicitaciones',
  'perdon', 'disculpa', 'lo siento', 'perdona', 'con permiso',
  'clima', 'tiempo', 'lluvia', 'sol', 'temperatura',
  'deporte', 'futbol', 'tenis', 'natacion', 'ciclismo',
  'musica', 'pelicula', 'libro', 'arte', 'pintura',
  'comida', 'restaurante', 'receta', 'cocina', 'chef',
  'viaje', 'turismo', 'vacaciones', 'hotel', 'avion'
]

/**
 * Patrones que indican consulta legal específica
 */
const LEGAL_PATTERNS = [
  // Artículos específicos
  /articulo\s+\d+/i,
  /art\.?\s+\d+/i,
  /numeral\s+\d+/i,
  /inciso\s+\d+/i,
  
  // Códigos específicos
  /codigo\s+(civil|penal|comercial|procesal|laboral)/i,
  
  // Leyes específicas
  /ley\s+\d+/i,
  /decreto\s+\d+/i,
  /resolucion\s+\d+/i,
  
  // Instituciones específicas
  /corte\s+(constitucional|suprema)/i,
  /consejo\s+de\s+estado/i,
  /fiscalia\s+general/i,
  /procuraduria\s+general/i,
  
  // Procesos específicos
  /tutela/i,
  /accion\s+de\s+tutela/i,
  /habeas\s+corpus/i,
  /habeas\s+data/i,
  /accion\s+de\s+cumplimiento/i,
  
  // Materias específicas
  /derecho\s+(civil|penal|laboral|comercial|administrativo)/i,
  /proceso\s+(civil|penal|laboral|administrativo)/i,
  
  // Conceptos legales específicos
  /prescripcion/i,
  /caducidad/i,
  /responsabilidad\s+(civil|penal)/i,
  /contrato/i,
  /obligacion/i,
  /delito/i,
  /falta/i,
  /contravencion/i
]

/**
 * Patrones que indican consulta NO legal
 */
const NON_LEGAL_PATTERNS = [
  // Saludos simples
  /^(hola|hi|hello|buenos?\s+dias|buenas?\s+tardes|buenas?\s+noches)$/i,
  
  // Preguntas personales
  /como\s+estas/i,
  /que\s+tal/i,
  /como\s+te\s+va/i,
  
  // Conversación casual
  /que\s+haces/i,
  /como\s+te\s+llamas/i,
  /de\s+donde\s+eres/i,
  
  // Temas no legales
  /clima|tiempo|lluvia|sol/i,
  /deporte|futbol|tenis|natacion/i,
  /musica|pelicula|libro|arte/i,
  /comida|restaurante|receta/i,
  /viaje|turismo|vacaciones/i
]

/**
 * Analiza si una consulta requiere búsqueda web legal
 */
export function detectLegalQuery(query: string): LegalDetectionResult {
  const normalizedQuery = query.toLowerCase().trim()
  
  // 1. Verificar patrones NO legales primero (alta prioridad)
  for (const pattern of NON_LEGAL_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      return {
        requiresWebSearch: false,
        confidence: 0.95,
        reason: 'Consulta identificada como saludo o conversación casual',
        searchStrategy: 'none',
        keywords: [],
        entities: []
      }
    }
  }
  
  // 2. Verificar palabras clave NO legales
  const nonLegalMatches = NON_LEGAL_KEYWORDS.filter(keyword => 
    normalizedQuery.includes(keyword.toLowerCase())
  )
  
  if (nonLegalMatches.length > 0 && normalizedQuery.length < 50) {
    return {
      requiresWebSearch: false,
      confidence: 0.85,
      reason: `Contiene palabras no legales: ${nonLegalMatches.join(', ')}`,
      searchStrategy: 'none',
      keywords: nonLegalMatches,
      entities: []
    }
  }
  
  // 3. Verificar patrones legales específicos (alta confianza)
  for (const pattern of LEGAL_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      const matchedKeywords = LEGAL_KEYWORDS.filter(keyword => 
        normalizedQuery.includes(keyword.toLowerCase())
      )
      
      return {
        requiresWebSearch: true,
        confidence: 0.95,
        reason: 'Patrón legal específico detectado',
        searchStrategy: determineSearchStrategy(normalizedQuery),
        keywords: matchedKeywords,
        entities: extractLegalEntities(normalizedQuery)
      }
    }
  }
  
  // 4. Verificar palabras clave legales
  const legalMatches = LEGAL_KEYWORDS.filter(keyword => 
    normalizedQuery.includes(keyword.toLowerCase())
  )
  
  if (legalMatches.length > 0) {
    const confidence = Math.min(0.9, 0.5 + (legalMatches.length * 0.1))
    
    return {
      requiresWebSearch: true,
      confidence,
      reason: `Contiene ${legalMatches.length} palabras clave legales: ${legalMatches.slice(0, 3).join(', ')}`,
      searchStrategy: determineSearchStrategy(normalizedQuery),
      keywords: legalMatches,
      entities: extractLegalEntities(normalizedQuery)
    }
  }
  
  // 5. Consultas muy cortas sin contexto legal
  if (normalizedQuery.length < 20 && !containsLegalContext(normalizedQuery)) {
    return {
      requiresWebSearch: false,
      confidence: 0.8,
      reason: 'Consulta muy corta sin contexto legal aparente',
      searchStrategy: 'none',
      keywords: [],
      entities: []
    }
  }
  
  // 6. Por defecto, no buscar para consultas ambiguas
  return {
    requiresWebSearch: false,
    confidence: 0.6,
    reason: 'Consulta ambigua, no se detectó contexto legal específico',
    searchStrategy: 'none',
    keywords: [],
    entities: []
  }
}

/**
 * Determina la estrategia de búsqueda basada en el contenido
 */
function determineSearchStrategy(query: string): 'constitutional' | 'code' | 'general-legal' | 'none' {
  if (/constitucion|constitucional|articulo\s+\d+.*constitucion/i.test(query)) {
    return 'constitutional'
  }
  
  if (/codigo|articulo\s+\d+.*codigo/i.test(query)) {
    return 'code'
  }
  
  if (/derecho|ley|norma|jurisprudencia/i.test(query)) {
    return 'general-legal'
  }
  
  return 'none'
}

/**
 * Extrae entidades legales de la consulta
 */
function extractLegalEntities(query: string): string[] {
  const entities: string[] = []
  
  // Extraer números de artículos
  const articleMatches = query.match(/articulo\s+(\d+)/gi)
  if (articleMatches) {
    entities.push(...articleMatches)
  }
  
  // Extraer códigos
  const codeMatches = query.match(/codigo\s+(civil|penal|comercial|procesal|laboral)/gi)
  if (codeMatches) {
    entities.push(...codeMatches)
  }
  
  // Extraer instituciones
  const institutionMatches = query.match(/(corte|consejo|fiscalia|procuraduria|defensoria)/gi)
  if (institutionMatches) {
    entities.push(...institutionMatches)
  }
  
  return entities
}

/**
 * Verifica si la consulta contiene contexto legal
 */
function containsLegalContext(query: string): boolean {
  const legalContextWords = [
    'colombia', 'colombiano', 'nacional', 'estatal', 'gubernamental',
    'oficial', 'publico', 'administrativo', 'juridico', 'legal'
  ]
  
  return legalContextWords.some(word => query.includes(word))
}

/**
 * Función de utilidad para logging
 */
export function logLegalDetection(query: string, result: LegalDetectionResult): void {
  console.log(`\n🧠 DETECCIÓN LEGAL INTELIGENTE`)
  console.log(`📝 Query: "${query}"`)
  console.log(`🔍 Requiere búsqueda: ${result.requiresWebSearch ? '✅ SÍ' : '❌ NO'}`)
  console.log(`🎯 Confianza: ${(result.confidence * 100).toFixed(1)}%`)
  console.log(`📋 Razón: ${result.reason}`)
  if (result.searchStrategy && result.searchStrategy !== 'none') {
    console.log(`🎯 Estrategia: ${result.searchStrategy}`)
  }
  if (result.keywords.length > 0) {
    console.log(`🔑 Keywords: ${result.keywords.slice(0, 5).join(', ')}`)
  }
  if (result.entities.length > 0) {
    console.log(`📋 Entidades: ${result.entities.slice(0, 3).join(', ')}`)
  }
  console.log(`${'='.repeat(60)}\n`)
}
