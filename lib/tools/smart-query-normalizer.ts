/**
 * Normalizador Inteligente de Consultas
 * Analiza la consulta y determina la mejor estrategia de búsqueda
 */

export interface QueryAnalysis {
  originalQuery: string
  normalizedQuery: string
  queryType: 'legal' | 'academic' | 'general' | 'technical' | 'undefined'
  confidence: number
  strategy: 'official-first' | 'academic-first' | 'general-first' | 'multilingual'
  keywords: string[]
  entities: string[]
  language: 'es' | 'en' | 'mixed'
  complexity: 'simple' | 'medium' | 'complex'
}

// Palabras clave legales colombianas
const LEGAL_KEYWORDS = [
  'constitución', 'constitucional', 'ley', 'decreto', 'artículo', 'codigo', 'sentencia', 'jurisprudencia',
  'tutela', 'acción', 'derecho', 'obligación', 'contrato', 'norma', 'reglamento', 'resolución',
  'corte', 'consejo', 'juzgado', 'fiscalía', 'procuraduría', 'contraloría', 'defensoría',
  'congreso', 'senado', 'cámara', 'presidente', 'ministro', 'alcalde', 'gobernador',
  'impuesto', 'tributo', 'multa', 'sanción', 'pena', 'prisión', 'detención',
  'prescripción', 'caducidad', 'término', 'plazo', 'notificación', 'citación',
  'demanda', 'demanda civil', 'penal', 'administrativo', 'laboral', 'comercial',
  'colombia', 'colombiano', 'bogotá', 'medellín', 'cali', 'barranquilla'
]

// Palabras clave académicas
const ACADEMIC_KEYWORDS = [
  'investigación', 'estudio', 'análisis', 'tesis', 'tesina', 'monografía', 'artículo',
  'universidad', 'universidad nacional', 'externado', 'javeriana', 'andes', 'icesi',
  'profesor', 'investigador', 'académico', 'científico', 'doctrina',
  'revista', 'publicación', 'paper', 'journal', 'conference', 'congreso',
  'metodología', 'hipótesis', 'resultados', 'conclusión', 'revisión', 'estado del arte'
]

// Palabras clave técnicas/científicas
const TECHNICAL_KEYWORDS = [
  'blockchain', 'inteligencia artificial', 'ia', 'machine learning', 'algoritmo',
  'software', 'programación', 'base de datos', 'redes', 'ciberseguridad',
  'biotecnología', 'nanotecnología', 'robótica', 'automatización',
  'energía renovable', 'solar', 'eólica', 'hidrógeno', 'batería',
  'telemedicina', 'telesalud', 'salud digital', 'historia clínica',
  'fintech', 'banco digital', 'criptomoneda', 'bitcoin', 'ethereum'
]

// Palabras clave generales
const GENERAL_KEYWORDS = [
  'qué es', 'cómo funciona', 'para qué sirve', 'definición', 'significado',
  'historia', 'origen', 'evolución', 'características', 'tipos', 'clases',
  'ventajas', 'desventajas', 'beneficios', 'riesgos', 'aplicaciones', 'usos',
  'ejemplos', 'casos', 'situaciones', 'escenarios', 'contexto'
]

// Patrones para detectar entidades
const ENTITY_PATTERNS = [
  /\b(\d+)\s*(de|\/)\s*(\w+)\s*(de|\/)\s*(\d{4})\b/gi, // Fechas
  /\b(art[íi]?culo\s*)?(\d+)\b/gi, // Artículos
  /\b(ley|decreto|resolución)\s*(\d+)\s*(de\s*)?(\d{4})?\b/gi, // Normas
  /\b([A-Z]{2,})\s*(\d+)\b/g, // Códigos como CP, CGP, etc.
  /\b(\d{1,2})\s*[°º]\s*(de\s*)?\w*\s*(de\s*)?\d{4}\b/gi // Grados académicos
]

// Función para detectar el idioma principal
function detectLanguage(query: string): 'es' | 'en' | 'mixed' {
  const spanishWords = ['que', 'qué', 'como', 'cómo', 'para', 'por', 'con', 'sin', 'sobre', 'entre', 'hacia', 'hasta'];
  const englishWords = ['what', 'how', 'why', 'where', 'when', 'which', 'who', 'that', 'this', 'with', 'without', 'about'];
  
  const words = query.toLowerCase().split(/\s+/);
  const spanishCount = words.filter(word => spanishWords.includes(word)).length;
  const englishCount = words.filter(word => englishWords.includes(word)).length;
  
  if (spanishCount > englishCount * 1.5) return 'es';
  if (englishCount > spanishCount * 1.5) return 'en';
  return 'mixed';
}

// Función para extraer entidades
function extractEntities(query: string): string[] {
  const entities: string[] = [];
  
  // Extraer fechas
  const dates = query.match(/\b(\d+)\s*(de|\/)\s*(\w+)\s*(de|\/)\s*(\d{4})\b/gi);
  if (dates) entities.push(...dates);
  
  // Extraer artículos
  const articles = query.match(/\b(art[íi]?culo\s*)?(\d+)\b/gi);
  if (articles) entities.push(...articles);
  
  // Extraer normas
  const norms = query.match(/\b(ley|decreto|resolución)\s*(\d+)\s*(de\s*)?(\d{4})?\b/gi);
  if (norms) entities.push(...norms);
  
  // Extraer nombres propios (palabras que empiezan con mayúscula)
  const properNouns = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (properNouns) entities.push(...properNouns);
  
  return [...new Set(entities)]; // Eliminar duplicados
}

// Función para calcular complejidad
function calculateComplexity(query: string, keywords: string[]): 'simple' | 'medium' | 'complex' {
  const wordCount = query.split(/\s+/).length;
  const keywordCount = keywords.length;
  
  if (wordCount <= 5 && keywordCount <= 2) return 'simple';
  if (wordCount <= 15 && keywordCount <= 5) return 'medium';
  return 'complex';
}

// Función principal de análisis
export function analyzeQuery(query: string): QueryAnalysis {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Detectar keywords por categoría
  const legalKeywords = LEGAL_KEYWORDS.filter(keyword => normalizedQuery.includes(keyword));
  const academicKeywords = ACADEMIC_KEYWORDS.filter(keyword => normalizedQuery.includes(keyword));
  const technicalKeywords = TECHNICAL_KEYWORDS.filter(keyword => normalizedQuery.includes(keyword));
  const generalKeywords = GENERAL_KEYWORDS.filter(keyword => normalizedQuery.includes(keyword));
  
  // Calcular puntuaciones
  const legalScore = legalKeywords.length * 3;
  const academicScore = academicKeywords.length * 2;
  const technicalScore = technicalKeywords.length * 2;
  const generalScore = generalKeywords.length * 1;
  
  // Determinar tipo de consulta
  let queryType: QueryAnalysis['queryType'];
  let confidence: number;
  
  if (legalScore >= academicScore && legalScore >= technicalScore && legalScore >= generalScore) {
    queryType = 'legal';
    confidence = Math.min(legalScore / 10, 1);
  } else if (academicScore >= technicalScore && academicScore >= generalScore) {
    queryType = 'academic';
    confidence = Math.min(academicScore / 8, 1);
  } else if (technicalScore >= generalScore) {
    queryType = 'technical';
    confidence = Math.min(technicalScore / 6, 1);
  } else if (generalScore > 0) {
    queryType = 'general';
    confidence = Math.min(generalScore / 4, 1);
  } else {
    queryType = 'undefined';
    confidence = 0;
  }
  
  // Determinar estrategia de búsqueda
  let strategy: QueryAnalysis['strategy'];
  if (queryType === 'legal' && confidence > 0.5) {
    strategy = 'official-first';
  } else if (queryType === 'academic' && confidence > 0.4) {
    strategy = 'academic-first';
  } else if (queryType === 'technical' || confidence < 0.3) {
    strategy = 'general-first';
  } else {
    strategy = 'multilingual';
  }
  
  // Extraer todas las keywords
  const allKeywords = [...legalKeywords, ...academicKeywords, ...technicalKeywords, ...generalKeywords];
  
  // Extraer entidades
  const entities = extractEntities(query);
  
  // Detectar idioma
  const language = detectLanguage(query);
  
  // Calcular complejidad
  const complexity = calculateComplexity(query, allKeywords);
  
  // Construir query normalizada según el tipo
  let finalNormalizedQuery = query;
  
  if (queryType === 'legal' && confidence > 0.5) {
    // Para consultas legales, asegurar contexto colombiano
    if (!normalizedQuery.includes('colombia') && !normalizedQuery.includes('colombiano')) {
      finalNormalizedQuery = `${query} Colombia`;
    }
  } else if (queryType === 'technical' && language === 'es') {
    // Para consultas técnicas en español, intentar también en inglés
    if (confidence < 0.5) {
      strategy = 'multilingual';
    }
  } else if (queryType === 'undefined' || confidence < 0.2) {
    // Para consultas ambiguas, usar estrategia multilingüe
    strategy = 'multilingual';
  }
  
  return {
    originalQuery: query,
    normalizedQuery: finalNormalizedQuery,
    queryType,
    confidence,
    strategy,
    keywords: allKeywords,
    entities,
    language,
    complexity
  };
}

// Función para generar estrategias de búsqueda específicas
export function generateSearchStrategies(analysis: QueryAnalysis): string[] {
  const strategies: string[] = [];
  
  switch (analysis.strategy) {
    case 'official-first':
      strategies.push(
        `${analysis.normalizedQuery} site:gov.co OR site:secretariasenado.gov.co OR site:corteconstitucional.gov.co`,
        `${analysis.normalizedQuery} Colombia legislación norma`,
        `${analysis.normalizedQuery} jurisprudencia sentencia`
      );
      break;
      
    case 'academic-first':
      strategies.push(
        `${analysis.normalizedQuery} site:edu.co OR site:scholar.google.com OR site:scielo.org`,
        `${analysis.normalizedQuery} investigación estudio análisis`,
        `${analysis.normalizedQuery} tesis monografía artículo académico`
      );
      break;
      
    case 'general-first':
      strategies.push(
        analysis.normalizedQuery,
        `${analysis.normalizedQuery} definición explicación`,
        `${analysis.normalizedQuery} características aplicaciones`
      );
      break;
      
    case 'multilingual':
      if (analysis.language === 'es') {
        strategies.push(
          analysis.normalizedQuery,
          `${analysis.normalizedQuery} english definition`,
          `what is ${analysis.originalQuery.replace(/qué es|cómo funciona|para qué sirve/gi, '').trim()}`,
          `${analysis.originalQuery} explicación`
        );
      } else {
        strategies.push(
          analysis.normalizedQuery,
          `${analysis.normalizedQuery} español definición`,
          `qué es ${analysis.originalQuery.replace(/what is|how does|what are/gi, '').trim()}`,
          `${analysis.originalQuery} explanation`
        );
      }
      break;
  }
  
  // Agregar estrategias basadas en entidades
  if (analysis.entities.length > 0) {
    const entityStrategy = analysis.entities.join(' ');
    strategies.push(`${analysis.normalizedQuery} "${entityStrategy}"`);
  }
  
  return [...new Set(strategies)]; // Eliminar duplicados
}

// Función para obtener recomendaciones de mejora
export function getQueryRecommendations(analysis: QueryAnalysis): string[] {
  const recommendations: string[] = [];
  
  if (analysis.confidence < 0.3) {
    recommendations.push('La consulta es ambigua. Considera agregar más contexto o palabras clave específicas.');
  }
  
  if (analysis.queryType === 'legal' && !analysis.normalizedQuery.includes('colombia')) {
    recommendations.push('Para consultas legales, especifica "Colombia" para obtener resultados más precisos.');
  }
  
  if (analysis.complexity === 'complex') {
    recommendations.push('La consulta es compleja. Considera dividirla en preguntas más simples.');
  }
  
  if (analysis.language === 'mixed') {
    recommendations.push('La consulta mezcla idiomas. Considera usar un solo idioma para mejores resultados.');
  }
  
  if (analysis.entities.length === 0 && analysis.queryType === 'legal') {
    recommendations.push('Para consultas legales, incluye números de artículo, ley o sentencia si los conoces.');
  }
  
  return recommendations;
}
