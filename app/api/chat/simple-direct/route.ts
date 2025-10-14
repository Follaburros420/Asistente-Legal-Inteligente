import { NextResponse } from "next/server"
import { searchWebEnriched, formatSearchResultsForContext } from "@/lib/tools/web-search"

export const runtime = "nodejs"
export const maxDuration = 60

// Base de datos de artículos constitucionales colombianos
const CONSTITUTIONAL_ARTICLES = {
  "15": {
    title: "Derecho a la intimidad personal y familiar",
    text: "ARTÍCULO 15. Todas las personas tienen derecho a su intimidad personal y familiar y a su buen nombre, y el Estado debe respetarlos y hacerlos respetar. De igual modo, tienen derecho a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre ellas en los bancos de datos y en archivos de entidades públicas y privadas. En la recolección, tratamiento y circulación de datos se respetarán la libertad y demás garantías consagradas en la Constitución. La correspondencia y demás formas de comunicación privada son inviolables. Solo pueden ser interceptados o registrados mediante orden judicial, en los casos y con las formalidades que establezca la ley."
  },
  "82": {
    title: "Protección del espacio público",
    text: "ARTÍCULO 82. Es deber del Estado velar por la protección de la integridad del espacio público y por su destinación al uso común, el cual prevalece sobre el interés particular. Las entidades públicas participarán en la plusvalía que genere su acción urbanística y regularán la utilización del suelo y del espacio aéreo urbano en defensa del interés común."
  },
  "67": {
    title: "Derecho a la educación",
    text: "ARTÍCULO 67. La educación es un derecho de la persona y un servicio público que tiene una función social; con ella se busca el acceso al conocimiento, a la ciencia, a la técnica, y a los demás bienes y valores de la cultura. La educación formará al colombiano en el respeto a los derechos humanos, a la paz y a la democracia; y en la práctica del trabajo y la recreación, para el mejoramiento cultural, científico, tecnológico y para la protección del ambiente."
  },
  "1": {
    title: "Estado social de derecho",
    text: "ARTÍCULO 1. Colombia es un Estado social de derecho, organizado en forma de República unitaria, descentralizada, con autonomía de sus entidades territoriales, democrática, participativa y pluralista, fundada en el respeto de la dignidad humana, en el trabajo y la solidaridad de las personas que la integran y en la prevalencia del interés general."
  },
  "2": {
    title: "Fines esenciales del Estado",
    text: "ARTÍCULO 2. Son fines esenciales del Estado: servir a la comunidad, promover la prosperidad general y garantizar la efectividad de los principios, derechos y deberes consagrados en la Constitución; facilitar la participación de todos en las decisiones que los afectan y en la vida económica, política, administrativa y cultural de la Nación; defender la independencia nacional, mantener la integridad territorial y asegurar la convivencia pacífica y la vigencia de un orden justo."
  },
  "3": {
    title: "Soberanía popular",
    text: "ARTÍCULO 3. La soberanía reside exclusivamente en el pueblo, del cual emana el poder público. El pueblo la ejerce en forma directa o por medio de sus representantes, en los términos que la Constitución establece."
  },
  "4": {
    title: "Supremacía constitucional",
    text: "ARTÍCULO 4. La Constitución es norma de normas. En todo caso de incompatibilidad entre la Constitución y la ley u otra norma jurídica, se aplicarán las disposiciones constitucionales. Es deber de los nacionales y de los extranjeros en Colombia acatar la Constitución y las leyes, y respetar y obedecer a las autoridades."
  },
  "5": {
    title: "Primacía de los derechos inalienables",
    text: "ARTÍCULO 5. El Estado reconoce, sin discriminación alguna, la primacía de los derechos inalienables de la persona y ampara a la familia como institución básica de la sociedad."
  },
  "11": {
    title: "Derecho a la vida",
    text: "ARTÍCULO 11. El derecho a la vida es inviolable. No habrá pena de muerte."
  },
  "12": {
    title: "Prohibición de la desaparición forzada",
    text: "ARTÍCULO 12. Nadie será sometido a desaparición forzada, a torturas ni a tratos o penas crueles, inhumanos o degradantes."
  },
  "13": {
    title: "Derecho a la igualdad",
    text: "ARTÍCULO 13. Todas las personas nacen libres e iguales ante la ley, recibirán la misma protección y trato de las autoridades y gozarán de los mismos derechos, libertades y oportunidades sin ninguna discriminación por razones de sexo, raza, origen nacional o familiar, lengua, religión, opinión política o filosófica."
  },
  "14": {
    title: "Derecho al reconocimiento de la personalidad jurídica",
    text: "ARTÍCULO 14. Toda persona tiene derecho al reconocimiento de su personalidad jurídica."
  },
  "16": {
    title: "Libertad de conciencia",
    text: "ARTÍCULO 16. Todas las personas tienen derecho al libre desarrollo de su personalidad sin más limitaciones que las que imponen los derechos de los demás y el orden jurídico."
  },
  "17": {
    title: "Prohibición de la esclavitud",
    text: "ARTÍCULO 17. Se prohíben la esclavitud, la servidumbre y la trata de seres humanos en todas sus formas."
  },
  "18": {
    title: "Libertad de conciencia",
    text: "ARTÍCULO 18. Se garantiza la libertad de conciencia. Nadie será molestado por razón de sus convicciones o creencias ni compelido a revelarlas ni obligado a actuar contra su conciencia."
  },
  "19": {
    title: "Libertad de cultos",
    text: "ARTÍCULO 19. Se garantiza la libertad de cultos. Toda persona tiene derecho a profesar libremente su religión y a difundirla en forma individual o colectiva."
  },
  "20": {
    title: "Libertad de expresión",
    text: "ARTÍCULO 20. Se garantiza a toda persona la libertad de expresar y difundir su pensamiento y opiniones, la de informar y recibir información veraz e imparcial, y la de fundar medios masivos de comunicación."
  }
}

// Función para extraer número de artículo de la consulta
function extractArticleNumber(query: string): string | null {
  // Buscar patrones como "art 11", "artículo 11", "art11", etc.
  const patterns = [
    /art(?:ículo)?\s*(\d+)/i,
    /art\.?\s*(\d+)/i,
    /articulo\s*(\d+)/i,
    /art\s*(\d+)/i
  ]
  
  for (const pattern of patterns) {
    const match = query.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return null
}

// Función para procesar y resumir contenido de búsqueda
function processSearchContent(content: string, query: string): string {
  // Extraer número de artículo de la consulta
  const articleNumber = extractArticleNumber(query)
  
  if (articleNumber && CONSTITUTIONAL_ARTICLES[articleNumber as keyof typeof CONSTITUTIONAL_ARTICLES]) {
    const article = CONSTITUTIONAL_ARTICLES[articleNumber as keyof typeof CONSTITUTIONAL_ARTICLES]
    
    return `**ARTÍCULO ${articleNumber} DE LA CONSTITUCIÓN POLÍTICA DE COLOMBIA**

${article.text}

**Análisis Jurídico:**

${article.title}. Este artículo forma parte de los derechos fundamentales consagrados en la Constitución Política de Colombia de 1991.

**Aspectos Importantes:**
- Este artículo establece principios fundamentales del Estado colombiano
- Forma parte del bloque de constitucionalidad
- Es de aplicación inmediata y prevalente sobre otras normas
- Puede ser protegido mediante acción de tutela`
  }
  
  // Si no se encuentra el artículo específico, buscar información relevante en español
  const lines = content.split('\n').filter(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return false
    
    // Filtrar metadatos técnicos
    if (trimmedLine.includes('Title:') || 
        trimmedLine.includes('URL Source:') || 
        trimmedLine.includes('Published Time:') ||
        trimmedLine.includes('Markdown Content:') ||
        trimmedLine.includes('Image ') ||
        trimmedLine.includes('[![')) {
      return false
    }
    
    // Filtrar contenido en inglés
    if (trimmedLine.includes('The people of Colombia') ||
        trimmedLine.includes('In the exercise of') ||
        trimmedLine.includes('National Constituent Assembly') ||
        trimmedLine.includes('social state under the rule of law') ||
        trimmedLine.includes('Nevada') ||
        trimmedLine.includes('Constitute Project')) {
      return false
    }
    
    // Solo contenido en español y relacionado con Colombia
    return (trimmedLine.includes('Colombia') || 
            trimmedLine.includes('Constitución') || 
            trimmedLine.includes('ARTÍCULO') ||
            trimmedLine.includes('República') ||
            trimmedLine.includes('Estado') ||
            trimmedLine.includes('derecho') ||
            trimmedLine.includes('intimidad') ||
            trimmedLine.includes('personal') ||
            trimmedLine.includes('familiar'))
  })
  
  // Tomar las primeras líneas relevantes
  const relevantLines = lines.slice(0, 8).join('\n')
  
  if (relevantLines) {
    return `**INFORMACIÓN JURÍDICA SOBRE ${query.toUpperCase()}**

${relevantLines}

Esta información se basa en la Constitución Política de Colombia de 1991 y la legislación vigente.`
  }
  
  return `Como asistente legal especializado en derecho colombiano, puedo ayudarte con información sobre "${query}". 

Para consultas específicas sobre artículos constitucionales, por favor especifica el número del artículo (ej: "artículo 15", "art 82").`
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { messages } = json as {
      messages: any[]
    }

    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userQuery = lastUserMessage?.content || ''

    console.log(`\n${"🔥".repeat(60)}`)
    console.log(`🔍 CHAT SIMPLE DIRECTO - SIN STREAMING`)
    console.log(`   Query: "${userQuery.substring(0, 50)}..."`)
    console.log(`   Usuario: usuario-anonimo`)
    console.log(`${"🔥".repeat(60)}\n`)

    let webSearchContext = ''
    let searchResults: any = null

    // Verificar si tenemos el artículo en nuestra base de datos
    const articleNumber = extractArticleNumber(userQuery)
    const hasArticleInDB = articleNumber && CONSTITUTIONAL_ARTICLES[articleNumber as keyof typeof CONSTITUTIONAL_ARTICLES]
    
    if (hasArticleInDB) {
      console.log(`✅ Artículo ${articleNumber} encontrado en base de datos local`)
      webSearchContext = `Artículo ${articleNumber} disponible en base de datos`
      searchResults = { success: true, results: [] }
    } else {
      console.log(`📡 FORZANDO búsqueda en Google CSE...`)
      // Mejorar la query para ser más específica en fuentes gubernamentales colombianas
      const enhancedQuery = userQuery.includes('art') 
        ? `${userQuery} constitución política colombia 1991 site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
        : `${userQuery} derecho colombiano constitución site:gov.co OR site:secretariasenado.gov.co OR site:funcionpublica.gov.co`
      
      searchResults = await searchWebEnriched(enhancedQuery)
    }

      if (hasArticleInDB) {
        console.log(`\n✅ ARTÍCULO ${articleNumber} - DISPONIBLE EN BASE DE DATOS`)
        console.log(`\n${"🔥".repeat(60)}\n`)
      } else if (searchResults && searchResults.success && searchResults.results && searchResults.results.length > 0) {
        webSearchContext = formatSearchResultsForContext(searchResults)
        console.log(`\n✅ BÚSQUEDA FORZADA - COMPLETADA CON ÉXITO:`)
        console.log(`   📊 Resultados encontrados: ${searchResults.results.length}`)
        console.log(`   📝 Caracteres de contexto: ${webSearchContext.length}`)
        console.log(`\n${"🔥".repeat(60)}\n`)
      } else {
        console.log(`\n⚠️ BÚSQUEDA FORZADA - SIN RESULTADOS`)
        webSearchContext = `BÚSQUEDA EJECUTADA PERO SIN RESULTADOS PARA: "${userQuery}"`
        console.log(`${"🔥".repeat(60)}\n`)
      }
    } catch (error) {
      console.error(`\n❌ ERROR EN BÚSQUEDA FORZADA:`, error)
      webSearchContext = `ERROR EN BÚSQUEDA WEB PARA: "${userQuery}" - ${error instanceof Error ? error.message : 'Error desconocido'}`
      console.log(`${"🔥".repeat(60)}\n`)
    }

    // Crear respuesta basada en información encontrada
    let responseText = ''
    
    if (webSearchContext.includes('ERROR') || webSearchContext.includes('SIN RESULTADOS')) {
      responseText = `Como asistente legal especializado en derecho colombiano, puedo ayudarte con información sobre "${userQuery}".

Basándome en mi base de datos jurídica, puedo proporcionarte orientación general sobre el tema consultado.`
    } else {
      // Procesar y resumir la información encontrada
      const processedContent = processSearchContent(webSearchContext, userQuery)
      
      // Extraer información relevante de los resultados - solo fuentes nacionales
      const results = searchResults.results
        .filter((result: any) => 
          result.url.includes('.gov.co') || 
          result.url.includes('secretariasenado.gov.co') ||
          result.url.includes('funcionpublica.gov.co') ||
          result.url.includes('alcaldiabogota.gov.co') ||
          result.url.includes('mincit.gov.co')
        )
        .slice(0, 3) // Primeros 3 resultados nacionales
      
      const sources = results.map((result: any, index: number) => {
        // Limpiar el título de metadatos
        const cleanTitle = result.title
          .replace(/Title:\s*/g, '')
          .replace(/\s*Title:\s*/g, '')
          .trim()
        
        const preview = result.snippet ? result.snippet.substring(0, 120) + '...' : 'Información jurídica oficial disponible'
        return `${index + 1}. [${cleanTitle}](${result.url})\n   *${preview}*`
      }).join('\n\n')

      responseText = `Como asistente legal especializado en derecho colombiano, puedo ayudarte con información sobre "${userQuery}".

${processedContent}

---

## 📚 Fuentes Consultadas

${sources}`
    }

    // Respuesta directa sin streaming
    return NextResponse.json({
      success: true,
      message: responseText,
      timestamp: new Date().toISOString(),
      searchExecuted: true,
      resultsFound: searchResults?.results?.length || 0
    });

  } catch (error: any) {
    console.error("Error en chat simple directo:", error)
    return NextResponse.json({
      success: false,
      message: `Error en chat simple directo: ${error.message}`,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
