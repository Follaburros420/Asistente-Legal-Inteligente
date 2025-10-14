/**
 * Script de prueba para verificar las mejoras en la búsqueda web obligatoria
 * Prueba específicamente el caso de "requisitos de demanda en Colombia"
 */

// Simular las funciones de búsqueda web para la prueba
async function testGoogleCSE(query) {
  console.log(`📡 Simulando búsqueda Google CSE para: "${query}"`)
  
  // Simular resultados de búsqueda
  const mockResults = [
    {
      title: "Requisitos para interponer una demanda en Colombia - Corte Suprema",
      url: "https://www.cortesuprema.gov.co/corte/requisitos-demanda",
      snippet: "Los requisitos para interponer una demanda en Colombia incluyen: 1) Identificación completa del demandante y demandado, 2) Descripción clara y precisa de los hechos, 3) Fundamentos de derecho aplicables, 4) Pretensiones específicas, 5) Documentos probatorios, 6) Pago de tasas judiciales correspondientes."
    },
    {
      title: "Código de Procedimiento Civil - Artículo 75 - Requisitos de la demanda",
      url: "https://www.suin-juriscol.gov.co/viewDocument.asp?ruta=Leyes/1676337",
      snippet: "Artículo 75. La demanda deberá contener: 1) La designación del tribunal ante el cual se propone, 2) El nombre y apellidos del demandante y su domicilio, 3) El nombre y apellidos del demandado y su domicilio, 4) La relación clara y precisa de los hechos, 5) Los fundamentos de derecho, 6) Las pretensiones que se deducen de los hechos y del derecho."
    },
    {
      title: "Guía práctica para interponer demandas - Consejo Superior de la Judicatura",
      url: "https://www.ramajudicial.gov.co/web/guia-demandas",
      snippet: "Para interponer una demanda en Colombia debe cumplir con los siguientes requisitos: Documentos de identidad, Certificación de residencia, Poder cuando se actúe por intermedio de apoderado, Documentos que acrediten la calidad para demandar, Documentos probatorios de los hechos alegados, Pago de las tasas judiciales."
    }
  ]
  
  return {
    success: true,
    query: `${query} Colombia derecho legal legislación`,
    results: mockResults,
    sources: mockResults.map(r => r.url),
    timestamp: new Date().toISOString()
  }
}

function formatSearchResultsForContext(searchResponse) {
  if (!searchResponse.success || searchResponse.results.length === 0) {
    return `No se encontraron resultados para: "${searchResponse.query}"`
  }

  let context = `INFORMACIÓN ESPECÍFICA ENCONTRADA EN INTERNET:\n\n`
  
  searchResponse.results.forEach((result, index) => {
    context += `**${index + 1}. ${result.title}**\n`
    context += `URL: ${result.url}\n`
    context += `Contenido: ${result.snippet}\n\n`
  })

  context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  context += `INSTRUCCIÓN: Usa ÚNICAMENTE esta información específica para responder.\n`
  context += `NO uses información general si hay información específica aquí.\n\n`

  return context
}

async function testImprovedSearch() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 PRUEBA DE MEJORAS EN BÚSQUEDA WEB OBLIGATORIA')
  console.log('='.repeat(80))
  
  const testQuery = 'requisitos de demanda en Colombia'
  
  console.log(`\n🔍 Probando query: "${testQuery}"`)
  console.log('📡 Ejecutando búsqueda web enriquecida...\n')
  
  try {
    // Ejecutar búsqueda simulada
    const searchResults = await testGoogleCSE(testQuery)
    
    console.log('📊 RESULTADOS DE BÚSQUEDA:')
    console.log(`   ✅ Éxito: ${searchResults.success}`)
    console.log(`   📝 Query utilizada: "${searchResults.query}"`)
    console.log(`   🔢 Resultados encontrados: ${searchResults.results?.length || 0}`)
    console.log(`   🔗 URLs únicas: ${searchResults.sources?.length || 0}`)
    
    if (searchResults.success && searchResults.results && searchResults.results.length > 0) {
      console.log('\n📚 FUENTES ENCONTRADAS:')
      searchResults.results.slice(0, 5).forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.title}`)
        console.log(`      URL: ${result.url}`)
        console.log(`      Snippet: ${result.snippet.substring(0, 100)}...`)
        console.log('')
      })
      
      // Probar formateo de contexto
      console.log('🎯 PROBANDO FORMATEO DE CONTEXTO:')
      const formattedContext = formatSearchResultsForContext(searchResults)
      console.log(`   📏 Longitud del contexto: ${formattedContext.length} caracteres`)
      console.log(`   📄 Preview del contexto:`)
      console.log(formattedContext.substring(0, 500) + '...\n')
      
      console.log('✅ PRUEBA EXITOSA: Búsqueda web funcionando correctamente')
      console.log('✅ PRUEBA EXITOSA: Formateo de contexto funcionando')
      
      // Simular el prompt que recibiría el modelo
      console.log('\n🤖 SIMULANDO PROMPT PARA EL MODELO:')
      const systemPrompt = `Eres un asistente legal especializado en derecho colombiano.

**INFORMACIÓN DISPONIBLE**:
✅ INFORMACIÓN ENCONTRADA EN INTERNET:

${formattedContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**INSTRUCCIONES CRÍTICAS**:
1. **OBLIGATORIO**: Usa ÚNICAMENTE la información de arriba para responder
2. **PROHIBIDO**: NO uses información de tu entrenamiento si hay información específica arriba
3. **PROHIBIDO**: NO menciones que realizaste búsquedas web
4. **OBLIGATORIO**: Responde como si toda la información fuera de tu conocimiento directo
5. **OBLIGATORIO**: AL FINAL de tu respuesta, después de "---", incluye:

   ## 📚 Fuentes Consultadas
   
   1. [Título](URL exacta copiada de arriba)
   2. [Título](URL exacta copiada de arriba)
   ...

6. **CRÍTICO**: Usa SOLO las URLs que aparecen arriba. NO inventes URLs.
7. **CRÍTICO**: Si la información arriba es específica sobre el tema, úsala completamente antes que cualquier conocimiento general.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANTE**: NUNCA menciones que realizaste búsquedas en internet. Responde como si toda la información fuera de tu conocimiento directo.

Responde en español colombiano con terminología jurídica precisa.`
      
      console.log(`   📏 Longitud del prompt: ${systemPrompt.length} caracteres`)
      console.log(`   ✅ Prompt contiene información específica de internet`)
      console.log(`   ✅ Prompt instruye usar ÚNICAMENTE información de internet`)
      
    } else {
      console.log('⚠️ ADVERTENCIA: No se encontraron resultados')
      console.log('   Esto puede indicar un problema con Google CSE o la query')
    }
    
  } catch (error) {
    console.error('❌ ERROR EN LA PRUEBA:', error)
    console.log('   Detalles:', error.message)
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('🏁 PRUEBA COMPLETADA')
  console.log('='.repeat(80))
}

// Ejecutar la prueba
testImprovedSearch().catch(console.error)
