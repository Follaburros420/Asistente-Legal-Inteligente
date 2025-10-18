import { NextResponse } from "next/server"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

// Dominios oficiales y académicos para filtrar fuentes de calidad
const OFFICIAL_DOMAINS = [
  '.gov.co',
  'corteconstitucional.gov.co',
  'consejodeestado.gov.co',
  'cortesuprema.gov.co',
  'suin-juriscol.gov.co',
  'imprenta.gov.co',
  'secretariasenado.gov.co',
  'funcionpublica.gov.co',
  'ramajudicial.gov.co',
  'alcaldiabogota.gov.co',
  'procuraduria.gov.co',
  'contraloria.gov.co',
  'fiscalia.gov.co',
  'defensoria.gov.co'
]

const ACADEMIC_DOMAINS = [
  '.edu.co',
  'uexternado.edu.co',
  'unal.edu.co',
  'javeriana.edu.co',
  'losandes.edu.co',
  'icesi.edu.co'
]

// Función para clasificar el tipo de fuente específica
const classifySourceType = (url: string, title: string): string => {
  const urlLower = url.toLowerCase()
  const titleLower = title.toLowerCase()
  
  // Clasificación por URL
  if (urlLower.includes('corteconstitucional.gov.co')) return 'Jurisprudencia Constitucional'
  if (urlLower.includes('cortesuprema.gov.co')) return 'Jurisprudencia Suprema'
  if (urlLower.includes('consejodeestado.gov.co')) return 'Jurisprudencia Administrativa'
  if (urlLower.includes('ramajudicial.gov.co')) return 'Jurisprudencia Judicial'
  if (urlLower.includes('secretariasenado.gov.co')) return 'Normativa Legislativa'
  if (urlLower.includes('imprenta.gov.co')) return 'Normativa Oficial'
  if (urlLower.includes('suin-juriscol.gov.co')) return 'Base de Datos Jurídica'
  if (urlLower.includes('funcionpublica.gov.co')) return 'Normativa Administrativa'
  if (urlLower.includes('alcaldiabogota.gov.co')) return 'Normativa Local'
  if (urlLower.includes('procuraduria.gov.co')) return 'Jurisprudencia Procuraduría'
  if (urlLower.includes('contraloria.gov.co')) return 'Jurisprudencia Contraloría'
  if (urlLower.includes('fiscalia.gov.co')) return 'Jurisprudencia Fiscalía'
  if (urlLower.includes('defensoria.gov.co')) return 'Jurisprudencia Defensoría'
  
  // Clasificación por título
  if (titleLower.includes('constitución') || titleLower.includes('constitucional')) return 'Normativa Constitucional'
  if (titleLower.includes('código civil')) return 'Código Civil'
  if (titleLower.includes('código penal')) return 'Código Penal'
  if (titleLower.includes('código proceso') || titleLower.includes('procedimiento')) return 'Código Procesal'
  if (titleLower.includes('ley')) return 'Ley'
  if (titleLower.includes('decreto')) return 'Decreto'
  if (titleLower.includes('sentencia')) return 'Jurisprudencia'
  if (titleLower.includes('fallo')) return 'Jurisprudencia'
  if (titleLower.includes('auto')) return 'Jurisprudencia'
  if (titleLower.includes('resolución')) return 'Resolución'
  if (titleLower.includes('circular')) return 'Circular'
  if (titleLower.includes('acuerdo')) return 'Acuerdo'
  
  // Clasificación académica
  if (urlLower.includes('.edu.co')) return 'Doctrina Académica'
  
  // Clasificación por dominio oficial
  if (urlLower.includes('.gov.co')) return 'Fuente Oficial'
  
  // Por defecto
  return 'Fuente General'
}
import OpenAI from "openai"

export const runtime = "nodejs"
export const maxDuration = 60

// Función para generar respuesta estructurada simulando IA
async function generateStructuredResponse(userQuery: string, webSearchContext: string): Promise<string> {
  // Extraer información clave del contexto
  const lines = webSearchContext.split('\n')
  const relevantContent = lines.filter(line => 
    line.trim() && 
    !line.includes('Title:') && 
    !line.includes('URL Source:') &&
    !line.includes('INFORMACIÓN JURÍDICA') &&
    !line.includes('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') &&
    !line.includes('INSTRUCCIÓN CRÍTICA')
  ).slice(0, 15).join('\n')

  // Detectar si es consulta sobre artículo específico
  const queryLower = userQuery.toLowerCase()
  const articleMatch = queryLower.match(/\bart(?:iculo|\.?)\s*(\d+[a-z]?)/)
  const articleNumber = articleMatch ? articleMatch[1] : ''
  
  // Detectar tipo de consulta para respuesta específica
  
  // Si es consulta sobre artículo específico, priorizar cita textual
  if (articleNumber) {
    // Detectar si es artículo constitucional o de código
    const isConstitutional = queryLower.includes('constitucion') || queryLower.includes('constitucional')
    const isCivilCode = queryLower.includes('codigo civil') || queryLower.includes('civil')
    const isPenalCode = queryLower.includes('codigo penal') || queryLower.includes('penal')
    const isProcessCode = queryLower.includes('codigo proceso') || queryLower.includes('proceso')
    
    let codeType = "normativo colombiano"
    if (isConstitutional) codeType = "Constitución Política de Colombia de 1991"
    else if (isCivilCode) codeType = "Código Civil Colombiano"
    else if (isPenalCode) codeType = "Código Penal Colombiano"
    else if (isProcessCode) codeType = "Código General del Proceso"
    
    return `**Marco Normativo**: Según la información encontrada en fuentes oficiales colombianas, específicamente el Artículo ${articleNumber} del ${codeType}:

**Artículo Específico**: Artículo ${articleNumber}

**Texto del Artículo**: 
${relevantContent.substring(0, 1500)}

**Contenido Detallado**: El artículo ${articleNumber} del ${codeType} establece las disposiciones específicas relacionadas con la consulta realizada, proporcionando el marco legal aplicable.

**Análisis Jurídico**: Este artículo forma parte del marco normativo colombiano y debe ser interpretado en conjunto con la jurisprudencia y doctrina aplicable.

**Conclusión**: El Artículo ${articleNumber} del ${codeType} contiene las disposiciones legales específicas que regulan el tema consultado, estableciendo los derechos, obligaciones y procedimientos aplicables según el ordenamiento jurídico colombiano.`
  }
  
  if (queryLower.includes('habeas data') || queryLower.includes('protección de datos')) {
    return `**Marco Normativo**: Según la Ley 1581 de 2012 sobre protección de datos personales (Habeas Data), se establecen los siguientes principios fundamentales:

${relevantContent.substring(0, 1000)}...

**Análisis Específico**: El Habeas Data en Colombia es un derecho fundamental que permite a las personas conocer, actualizar y rectificar las informaciones que sobre ellas se hayan recogido en bancos de datos. Esta ley establece los principios de finalidad, libertad, veracidad, transparencia, acceso y circulación restringida.

**Contenido Detallado**: La Ley 1581 de 2012 regula el tratamiento de datos personales por parte de entidades públicas y privadas, estableciendo obligaciones específicas para los responsables del tratamiento y derechos claros para los titulares de los datos.

**Conclusión**: El Habeas Data en Colombia está protegido constitucionalmente y desarrollado legalmente a través de la Ley 1581 de 2012, garantizando el derecho fundamental a la protección de datos personales.`
  }
  
  if (queryLower.includes('requisitos') && queryLower.includes('demanda')) {
    return `**Marco Normativo**: Según el Código General del Proceso (Ley 1564 de 2012), específicamente el Artículo 82, la demanda debe reunir los siguientes requisitos:

${relevantContent.substring(0, 1000)}...

**Artículo Específico**: El Artículo 82 del Código General del Proceso establece que la demanda debe contener: la designación del juez ante quien se propone, los nombres completos del demandante y demandado, la relación clara y precisa de los hechos, los fundamentos de derecho, las pretensiones, la cuantía del asunto, y la firma del demandante o su representante.

**Contenido Detallado**: Cada uno de estos requisitos es obligatorio y su omisión puede llevar a la inadmisión de la demanda o a su rechazo por parte del juez.

**Análisis**: Los requisitos de la demanda buscan garantizar el debido proceso, la claridad en las pretensiones y la posibilidad de defensa del demandado.

**Conclusión**: El cumplimiento de todos los requisitos establecidos en el Artículo 82 del Código General del Proceso es fundamental para la admisión y tramitación exitosa de una demanda en Colombia.`
  }
  
  if (queryLower.includes('nacimiento') || queryLower.includes('personalidad') || queryLower.includes('nace')) {
    return `**Marco Normativo**: Según el Código Civil colombiano, específicamente los artículos 90, 91, 92 y 93, se establece cuándo una persona nace a la vida jurídica:

${relevantContent.substring(0, 1000)}...

**Artículos Específicos**: 
- **Artículo 90**: Establece que la existencia legal de toda persona principia al nacer, esto es, al separarse completamente de su madre.
- **Artículo 91**: Define que la personalidad jurídica termina con la muerte natural.
- **Artículo 92**: Establece que la muerte presunta se declara por el juez.
- **Artículo 93**: Define los efectos de la muerte presunta.

**Contenido Detallado**: El nacimiento marca el inicio de la personalidad jurídica, momento desde el cual la persona adquiere derechos y obligaciones. La separación completa de la madre es el criterio médico y legal para determinar el nacimiento.

**Análisis**: Estos artículos establecen que una persona nace a la vida jurídica cuando se separa completamente de su madre, momento desde el cual adquiere capacidad jurídica para ser titular de derechos y obligaciones.

**Conclusión**: Según el derecho colombiano, una persona nace a la vida jurídica al separarse completamente de su madre, momento que marca el inicio de su personalidad jurídica y capacidad para ser sujeto de derechos y obligaciones.`
  }
  
  if (queryLower.includes('tutela') || queryLower.includes('acción tutela')) {
    return `**Marco Normativo**: Según la Constitución Política de Colombia, específicamente el Artículo 86, la acción de tutela protege los derechos fundamentales:

${relevantContent.substring(0, 1000)}...

**Artículo Específico**: El Artículo 86 de la Constitución establece que toda persona tendrá acción de tutela para reclamar ante los jueces, en todo momento y lugar, por sí misma o por quien actúe a su nombre, la protección inmediata de sus derechos constitucionales fundamentales.

**Contenido Detallado**: La acción de tutela es un mecanismo judicial de protección inmediata de los derechos fundamentales, que puede ser interpuesta por cualquier persona cuando estos derechos sean vulnerados o amenazados por la acción u omisión de cualquier autoridad pública.

**Análisis**: La tutela es un mecanismo ágil y efectivo para la protección de derechos fundamentales, caracterizado por su rapidez, informalidad y eficacia.

**Conclusión**: La acción de tutela es el mecanismo constitucional por excelencia para la protección inmediata de los derechos fundamentales en Colombia, garantizando su efectividad a través de un procedimiento ágil y eficaz.`
  }
  
  // Manejar consultas de artículos constitucionales específicos
  if (queryLower.includes('art') && (queryLower.includes('constitucion') || queryLower.includes('constitución'))) {
    // Extraer número de artículo
    const articleMatch = queryLower.match(/art\s*(\d+)/)
    const articleNumber = articleMatch ? articleMatch[1] : 'específico'
    
    // Base de datos de artículos constitucionales conocidos
    const constitutionalArticles: { [key: string]: string } = {
      '1': 'Colombia es un Estado social de derecho, organizado en forma de República unitaria, descentralizada, con autonomía de sus entidades territoriales, democrática, participativa y pluralista, fundada en el respeto de la dignidad humana, en el trabajo y la solidaridad de las personas que la integran y en la prevalencia del interés general.',
      '2': 'Son fines esenciales del Estado: servir a la comunidad, promover la prosperidad general y garantizar la efectividad de los principios, derechos y deberes consagrados en la Constitución; facilitar la participación de todos en las decisiones que los afectan y en la vida económica, política, administrativa y cultural de la Nación; defender la independencia nacional, mantener la integridad territorial y asegurar la convivencia pacífica y la vigencia de un orden justo.',
      '3': 'La soberanía reside exclusivamente en el pueblo, del cual emana el poder público. El pueblo la ejerce en forma directa o por medio de sus representantes, en los términos que la Constitución establece.',
      '4': 'La Constitución es norma de normas. En todo caso de incompatibilidad entre la Constitución y la ley u otra norma jurídica, se aplicarán las disposiciones constitucionales.',
      '5': 'El Estado reconoce, sin discriminación alguna, la primacía de los derechos inalienables de la persona y ampara a la familia como institución básica de la sociedad.',
      '6': 'Los particulares solo son responsables ante las autoridades por infringir la Constitución y las leyes. Los servidores públicos lo son por la misma causa y por omisión o extralimitación en el ejercicio de sus funciones.',
      '7': 'El Estado reconoce y protege la diversidad étnica y cultural de la Nación colombiana.',
      '8': 'Es obligación del Estado y de las personas proteger las riquezas culturales y naturales de la Nación.',
      '9': 'Las relaciones exteriores del Estado se fundamentan en la soberanía nacional, en el respeto a la autodeterminación de los pueblos y en el reconocimiento de los principios del derecho internacional aceptados por Colombia.',
      '10': 'El castellano es el idioma oficial de Colombia. Las lenguas y dialectos de los grupos étnicos son también oficiales en sus territorios. La enseñanza que se imparta en las comunidades con tradiciones lingüísticas propias será bilingüe.',
      '11': 'El derecho a la vida es inviolable. No habrá pena de muerte.',
      '12': 'Nadie será sometido a desaparición forzada, a torturas ni a tratos o penas crueles, inhumanos o degradantes.',
      '13': 'Todas las personas nacen libres e iguales ante la ley, recibirán la misma protección y trato de las autoridades y gozarán de los mismos derechos, libertades y oportunidades sin ninguna discriminación por razones de sexo, raza, origen nacional o familiar, lengua, religión, opinión política o filosófica.',
      '14': 'Toda persona tiene derecho al reconocimiento de su personalidad jurídica.',
      '15': 'Todas las personas tienen derecho a su intimidad personal y familiar y a su buen nombre, y el Estado debe respetarlos y hacerlos respetar. De igual modo, tienen derecho a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre ellas en bancos de datos y en archivos de entidades públicas y privadas.',
      '16': 'Todas las personas tienen derecho al libre desarrollo de su personalidad sin más limitaciones que las que imponen los derechos de los demás y el orden jurídico.',
      '17': 'Se prohíbe la esclavitud, la servidumbre y la trata de seres humanos en todas sus formas.',
      '18': 'Se garantiza la libertad de conciencia. Nadie será molestado por razón de sus convicciones o creencias ni compelido a revelarlas ni obligado a actuar contra su conciencia.',
      '19': 'Se garantiza la libertad de cultos. Toda persona tiene derecho a profesar libremente su religión y a difundirla en forma individual o colectiva.',
      '20': 'Se garantiza a toda persona la libertad de expresar y difundir su pensamiento y opiniones, la de informar y recibir información veraz e imparcial, y la de fundar medios masivos de comunicación.'
    }
    
    // Verificar si tenemos información específica del artículo
    if (constitutionalArticles[articleNumber]) {
      return `**Marco Normativo**: Según la Constitución Política de Colombia de 1991, específicamente el Artículo ${articleNumber}:

**Artículo Específico**: El Artículo ${articleNumber} de la Constitución Política de Colombia establece:

"${constitutionalArticles[articleNumber]}"

**Contenido Detallado**: Este artículo constitucional forma parte del Título II de la Constitución (De los Derechos, las Garantías y los Deberes) y establece principios fundamentales del ordenamiento jurídico colombiano.

**Análisis Jurídico**: Este artículo constitucional tiene carácter vinculante y debe ser interpretado conforme a los principios y valores constitucionales, así como a la jurisprudencia de la Corte Constitucional.

**Conclusión**: El Artículo ${articleNumber} de la Constitución Política de Colombia forma parte del bloque de constitucionalidad y establece derechos, deberes o principios fundamentales del ordenamiento jurídico colombiano.

**Información Adicional**: ${relevantContent.substring(0, 500)}...`
    } else {
      // Si no tenemos información específica del artículo, usar el contenido encontrado
      const hasSpecificContent = relevantContent.toLowerCase().includes(`artículo ${articleNumber}`) || 
                                relevantContent.toLowerCase().includes(`art ${articleNumber}`) ||
                                relevantContent.length > 500
      
      if (hasSpecificContent) {
        return `**Marco Normativo**: Según la Constitución Política de Colombia de 1991, específicamente el Artículo ${articleNumber}:

${relevantContent.substring(0, 1500)}...

**Artículo Específico**: El Artículo ${articleNumber} de la Constitución Política de Colombia establece disposiciones fundamentales que forman parte del ordenamiento jurídico colombiano.

**Contenido Detallado**: ${relevantContent.substring(0, 800)}...

**Análisis Jurídico**: Este artículo constitucional tiene carácter vinculante y debe ser interpretado conforme a los principios y valores constitucionales, así como a la jurisprudencia de la Corte Constitucional.

**Conclusión**: El Artículo ${articleNumber} de la Constitución Política de Colombia forma parte del bloque de constitucionalidad y establece derechos, deberes o principios fundamentales del ordenamiento jurídico colombiano.`
      } else {
        return `**Marco Normativo**: Según la Constitución Política de Colombia de 1991, específicamente el Artículo ${articleNumber}:

**Artículo Específico**: El Artículo ${articleNumber} de la Constitución Política de Colombia establece disposiciones fundamentales que forman parte del ordenamiento jurídico colombiano.

**Contenido Detallado**: Aunque no se encontró el texto específico del Artículo ${articleNumber} en las fuentes consultadas, este artículo forma parte del Título II de la Constitución (De los Derechos, las Garantías y los Deberes) y establece principios fundamentales del ordenamiento jurídico colombiano.

**Análisis Jurídico**: Los artículos constitucionales tienen carácter vinculante y deben ser interpretados conforme a los principios y valores constitucionales, así como a la jurisprudencia de la Corte Constitucional.

**Conclusión**: El Artículo ${articleNumber} de la Constitución Política de Colombia forma parte del bloque de constitucionalidad y establece derechos, deberes o principios fundamentales del ordenamiento jurídico colombiano. Para obtener el texto completo, se recomienda consultar directamente la Constitución en sitios oficiales como la Secretaría del Senado o la Corte Constitucional.

**Información Adicional**: ${relevantContent.substring(0, 500)}...`
      }
    }
  }
  
  // Respuesta general para otros temas
  return `**Marco Normativo**: Según la información encontrada en fuentes oficiales colombianas sobre "${userQuery}":

${relevantContent.substring(0, 1000)}...

**Análisis Específico**: Esta información se basa en la legislación colombiana vigente y proporciona detalles específicos sobre el tema consultado, incluyendo referencias a artículos, leyes y códigos aplicables.

**Contenido Detallado**: La información encontrada incluye aspectos normativos, jurisprudenciales y doctrinales relevantes para comprender completamente el tema consultado.

**Conclusión**: La información encontrada en fuentes oficiales proporciona una base sólida y actualizada para responder la consulta sobre derecho legal colombiano, garantizando precisión y trazabilidad jurídica.`
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { messages } = json as { messages: Array<{ role: string; content: string }> }
    
    const userQuery = messages[messages.length - 1]?.content || ""
    
    console.log(`🔍 Consulta: "${userQuery}"`)

    // Buscar información en internet
    console.log(`📡 Buscando información en internet para: "${userQuery}"`)
    
    const searchResults = await searchWebEnriched(userQuery)
    let webSearchContext = ""
    
    if (searchResults && searchResults.success && searchResults.results && searchResults.results.length > 0) {
      webSearchContext = formatSearchResultsForContext(searchResults)
      console.log(`✅ Encontrados ${searchResults.results.length} resultados`)
    } else {
      console.log(`⚠️ No se encontraron resultados`)
      webSearchContext = `No se encontró información específica en internet para esta consulta.`
    }

    // Intentar procesar con IA usando OpenRouter
    const openrouterApiKey = process.env.OPENROUTER_API_KEY
    
    if (openrouterApiKey && openrouterApiKey !== "sk-or-v1-your-api-key-here" && openrouterApiKey !== "tu_api_key_aqui") {
      try {
        console.log(`🤖 Procesando con Tongyi Deep Research 30B A3B...`)
        
        const openai = new OpenAI({
          apiKey: openrouterApiKey,
          baseURL: "https://openrouter.ai/api/v1"
        })

        const systemPrompt = `Eres un Asistente Legal Colombiano especializado en derecho civil, procesal y constitucional. Tu función es proporcionar información jurídica precisa, actualizada y basada en fuentes oficiales colombianas.

**INSTRUCCIONES CRÍTICAS:**
1. **USA ÚNICAMENTE** la información encontrada en internet para responder
2. **PRIORIZA** fuentes oficiales (.gov.co) y académicas (.edu.co) colombianas
3. **NO uses** información de tu entrenamiento si hay información específica disponible
4. **Responde** como si toda la información fuera de tu conocimiento directo
5. **NO menciones** que realizaste búsquedas web
6. **Proporciona** respuestas estructuradas y completas sobre derecho colombiano

**REGLAS OBLIGATORIAS PARA ARTÍCULOS:**
- **SIEMPRE** encuentra y cita textualmente el artículo solicitado
- **NUNCA** respondas que "no encontraste" un artículo específico
- **SIEMPRE** incluye el texto completo del artículo cuando esté disponible
- **PRIORIZA** fuentes oficiales que contengan el texto íntegro del artículo
- **Si hay múltiples fuentes**, elige la más oficial y completa

**FORMATO DE RESPUESTA OBLIGATORIO:**
- **Marco Normativo**: Identifica la ley, código o norma específica relevante
- **Artículo Específico**: Menciona el número exacto del artículo relevante
- **Texto del Artículo**: Cita textualmente el contenido del artículo (si está disponible)
- **Contenido Detallado**: Explica el contenido específico relacionado con la consulta
- **Análisis Jurídico**: Explica el alcance y aplicación específica del tema consultado
- **Conclusión**: Resumen claro sobre el tema específico consultado

**CARACTERÍSTICAS DEL CHATBOT LEGAL:**
- Usa terminología jurídica precisa y apropiada
- Incluye referencias a artículos, leyes y códigos específicos
- Proporciona información práctica y aplicable
- Explica conceptos jurídicos de manera clara
- **PRIORIZA** información de fuentes oficiales colombianas
- **CALIDAD SOBRE CANTIDAD**: Incluye solo fuentes relevantes y de alta calidad
**PROHIBICIÓN ABSOLUTA**: NUNCA incluyas fuentes de Wikipedia, wikimedia, o cualquier dominio .wiki
- Al final de tu respuesta, después de "---", incluye SOLO fuentes oficiales (.gov.co) o académicas (.edu.co):

## 📚 Fuentes Consultadas

1. [Título](URL exacta)
2. [Título](URL exacta)
...

**IMPORTANTE**: NUNCA menciones que realizaste búsquedas en internet. Responde en español colombiano con terminología jurídica precisa. PRIORIZA siempre las fuentes oficiales y académicas colombianas. SIEMPRE encuentra el artículo solicitado.`

        const finalPrompt = `${systemPrompt}

INFORMACIÓN JURÍDICA ENCONTRADA EN INTERNET:
${webSearchContext}

CONSULTA DEL USUARIO: "${userQuery}"

Responde basándote ÚNICAMENTE en la información encontrada arriba, proporcionando una respuesta completa y estructurada como chatbot legal especializado.`

        const completion = await openai.chat.completions.create({
          model: "alibaba/tongyi-deepresearch-30b-a3b",
          messages: [
            { role: "system", content: finalPrompt },
            { role: "user", content: userQuery }
          ],
          temperature: 0.1,
          max_tokens: 3000
        })

        const aiResponse = completion.choices[0].message.content || "No se pudo generar respuesta"

        // Agregar fuentes al final (excluyendo Wikipedia)
        const sources = searchResults?.results
          ?.filter(result => {
            // Excluir Wikipedia y dominios prohibidos
            const isBanned = result.url.includes('wikipedia.org') || 
                           result.url.includes('wikimedia.org') ||
                           result.url.includes('.wiki')
            if (isBanned) {
              console.log(`[simple-direct] Fuente filtrada (prohibida): ${result.url}`)
              return false
            }
            return true
          })
          ?.map((result, index) => {
            const cleanTitle = result.title
              .replace(/\s*Title:\s*/g, '')
              .trim()
            return {
              title: cleanTitle,
              url: result.url,
              type: classifySourceType(result.url, cleanTitle)
            }
          }) || []

        console.log(`✅ Respuesta generada exitosamente con Tongyi Deep Research 30B A3B`)

        // Devolver respuesta con bibliografía separada
        return NextResponse.json({
          success: true,
          message: aiResponse,
          bibliography: sources,
          timestamp: new Date().toISOString(),
          searchExecuted: true,
          resultsFound: searchResults?.results?.length || 0,
          aiProcessed: true
        })

      } catch (aiError: any) {
        console.error("Error en procesamiento de IA:", aiError)
        console.log(`⚠️ Continuando con sistema inteligente interno debido a error: ${aiError.message}`)
        
        // Continuar con respuesta basada solo en búsqueda web
      }
    } else {
      console.log(`⚠️ API key no configurada (valor: "${openrouterApiKey}"), continuando con sistema inteligente interno`)
    }

    // Fallback: respuesta estructurada simulando procesamiento de IA
    if (searchResults && searchResults.success && searchResults.results && searchResults.results.length > 0) {
      // Crear respuesta estructurada que simule el procesamiento de IA
      const responseText = await generateStructuredResponse(userQuery, webSearchContext)

      // Agregar fuentes al final (máximo 3 fuentes de alta calidad, excluyendo Wikipedia)
      const highQualitySources = searchResults.results
        .filter(result => {
          // Excluir Wikipedia y dominios prohibidos
          const isBanned = result.url.includes('wikipedia.org') || 
                         result.url.includes('wikimedia.org') ||
                         result.url.includes('.wiki')
          if (isBanned) {
            console.log(`[simple-direct] Fuente filtrada (prohibida): ${result.url}`)
            return false
          }
          
          // Priorizar fuentes oficiales y académicas
          const isOfficial = OFFICIAL_DOMAINS.some(domain => result.url.includes(domain))
          const isAcademic = ACADEMIC_DOMAINS.some(domain => result.url.includes(domain))
          return isOfficial || isAcademic || result.snippet.length > 500
        })
        .slice(0, 3) // Máximo 3 fuentes de alta calidad
        .map((result, index) => {
          const cleanTitle = result.title
            .replace(/\s*Title:\s*/g, '')
            .trim()
          return `${index + 1}. [${cleanTitle}](${result.url})`
        }).join('\n')

      console.log(`✅ Respuesta generada exitosamente con sistema inteligente interno`)

      // Devolver respuesta con bibliografía separada
      return NextResponse.json({
        success: true,
        message: responseText,
        bibliography: highQualitySources.split('\n').map((source, index) => {
          const match = source.match(/\[([^\]]+)\]\(([^)]+)\)/)
          if (match) {
            return {
              title: match[1],
              url: match[2],
              type: classifySourceType(match[2], match[1])
            }
          }
          return null
        }).filter(Boolean),
        timestamp: new Date().toISOString(),
        searchExecuted: true,
        resultsFound: searchResults.results.length,
        aiProcessed: false
      })
      
    } else {
      return NextResponse.json({
        success: false,
        message: `No se encontró información específica sobre "${userQuery}" en las fuentes oficiales consultadas.`,
        timestamp: new Date().toISOString(),
        searchExecuted: true,
        resultsFound: 0,
        aiProcessed: false,
        note: "Búsqueda web ejecutada pero sin resultados"
      })
    }

  } catch (error: any) {
    console.error("Error en procesamiento:", error)
    
    return NextResponse.json({
      success: false,
      message: "Error interno del servidor",
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 })
  }
}
