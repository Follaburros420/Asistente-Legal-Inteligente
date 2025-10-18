/**
 * Fuentes directas y confiables para la Constitución Política de Colombia
 */

export interface ConstitutionArticle {
  number: string
  title?: string
  content: string
  source: string
  url: string
}

/**
 * Obtiene un artículo específico de la Constitución Política de Colombia
 * desde fuentes oficiales directas
 */
export async function getConstitutionArticle(articleNumber: string): Promise<ConstitutionArticle | null> {
  const sources = [
    {
      name: 'Secretaría del Senado',
      baseUrl: 'https://www.secretariasenado.gov.co/senado/basedoc/constitucion_politica_de_colombia.html'
    },
    {
      name: 'Imprenta Nacional',
      baseUrl: 'https://www.imprenta.gov.co/sites/imprenta.gov.co/files/Normativa/Constitucion_politica_de_Colombia.pdf'
    }
  ]

  // Intentar extraer desde fuentes oficiales
  for (const source of sources) {
    try {
      const article = await extractArticleFromSource(articleNumber, source)
      if (article) {
        return article
      }
    } catch (error) {
      console.log(`[constitucion] Fallo extrayendo desde ${source.name}: ${error}`)
    }
  }

  // Fallback: usar una base de datos local de artículos importantes
  const fallbackArticle = getFallbackArticle(articleNumber)
  if (fallbackArticle) {
    return fallbackArticle
  }

  return null
}

async function extractArticleFromSource(articleNumber: string, source: { name: string; baseUrl: string }): Promise<ConstitutionArticle | null> {
  if (source.name === 'Secretaría del Senado') {
    return await extractFromSenado(articleNumber, source.baseUrl)
  }
  
  return null
}

async function extractFromSenado(articleNumber: string, url: string): Promise<ConstitutionArticle | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AsistenteLegal/1.0)'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    
    // Buscar el artículo específico en el HTML
    const articlePattern = new RegExp(
      `<[^>]*>Art[íi]?culo\\s+${articleNumber}[.<][^<]*<\/[^>]*>([^]*?)(?=Art[íi]?culo\\s+\\d+|$)`,
      'gi'
    )
    
    const match = articlePattern.exec(html)
    if (match) {
      let content = match[1]
      
      // Limpiar HTML
      content = content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&aacute;/g, 'á')
        .replace(/&eacute;/g, 'é')
        .replace(/&iacute;/g, 'í')
        .replace(/&oacute;/g, 'ó')
        .replace(/&uacute;/g, 'ú')
        .replace(/&Aacute;/g, 'Á')
        .replace(/&Eacute;/g, 'É')
        .replace(/&Iacute;/g, 'Í')
        .replace(/&Oacute;/g, 'Ó')
        .replace(/&Uacute;/g, 'Ú')
        .replace(/&ntilde;/g, 'ñ')
        .replace(/&Ntilde;/g, 'Ñ')
        .replace(/\s+/g, ' ')
        .trim()

      if (content.length > 50) {
      return {
        number: articleNumber,
        content: content,
        source: 'Secretaría del Senado',
        url: url
      }
      }
    }

    return null
  } catch (error) {
    console.error(`[constitucion] Error extrayendo desde Senado:`, error)
    return null
  }
}

/**
 * Base de datos local de artículos constitucionales importantes
 */
function getFallbackArticle(articleNumber: string): ConstitutionArticle | null {
  const articles: Record<string, string> = {
    '113': 'Artículo 113. Son Ramas del Poder Público, la legislativa, la ejecutiva, y la judicial. Además de los órganos que las integran existen otros, autónomos e independientes, para el cumplimiento de las demás funciones del Estado. Los diferentes órganos del Estado tienen funciones separadas pero colaboran armónicamente para la realización de sus fines.',
    '1': 'Artículo 1. Colombia es un Estado social de derecho, organizado en forma de República unitaria, descentralizada, con autonomía de sus entidades territoriales, democrática, participativa y pluralista, fundada en el respeto de la dignidad humana, en el trabajo y la solidaridad de las personas que la integran y en la prevalencia del interés general.',
    '2': 'Artículo 2. Son fines esenciales del Estado: servir a la comunidad, promover la prosperidad general y garantizar la efectividad de los principios, derechos y deberes consagrados en la Constitución; facilitar la participación de todos en las decisiones que los afectan y en la vida económica, política, administrativa y cultural de la Nación; defender la independencia nacional, mantener la integridad territorial y asegurar la convivencia pacífica y la vigencia de un orden justo.',
    '4': 'Artículo 4. La Constitución es norma de normas. En todo caso de incompatibilidad entre la Constitución y la ley u otra norma jurídica, se aplicarán las disposiciones constitucionales. Es nulo de pleno derecho todo texto de ley que sea incompatible con la Constitución.',
    '93': 'Artículo 93. Los tratados y convenios internacionales ratificados por el Congreso, que reconocen los derechos humanos y que prohíben su limitación en los estados de excepción, prevalecen en el orden interno. Los derechos y deberes consagrados en esta Constitución, se interpretarán de conformidad con los tratados internacionales sobre derechos humanos ratificados por Colombia.',
    '228': 'Artículo 228. La administración de justicia es función pública. Sus decisiones son independientes. Las actuaciones serán públicas y permanentes con las excepciones que establezca la ley y en ellas prevalecerá el derecho sustancial. Los términos procesales se observarán con diligencia y su incumplimiento será sancionado. Su funcionamiento será desconcentrado y autónomo.'
  }

  const content = articles[articleNumber]
  if (content) {
    return {
      number: articleNumber,
      content: content,
      source: 'Base de datos oficial - Constitución Política de Colombia',
      url: 'https://www.secretariasenado.gov.co/senado/basedoc/constitucion_politica_de_colombia.html'
    }
  }

  return null
}

/**
 * Verifica si una consulta es sobre un artículo constitucional
 */
export function isConstitutionalArticle(query: string): string | null {
  const normalized = query.toLowerCase().trim()
  
  // Patrones para detectar artículos constitucionales
  const patterns = [
    /art(?:\.?\s*|\s+)(\d+)\s+(?:de\s+la\s+)?constituci(?:ó|o)n/,
    /constituci(?:ó|o)n\s+(?:pol[íi]tica\s+)?(?:de\s+colombia\s+)?art(?:\.?\s*|\s+)(\d+)/,
    /art(?:\.?\s*|\s+)(\d+)\s+(?:c\.?\.?\s*|cp\s*|const\.?\s*)/,
    /^art(?:\.?\s*|\s+)(\d+)$/i
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}
