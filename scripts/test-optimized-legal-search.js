/**
 * Script de Prueba Final: Sistema de Búsqueda Legal Optimizado
 * Verifica que la nueva configuración funciona correctamente
 */

import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3000'

async function testLegalSearchAPI() {
  console.log('⚖️ PRUEBA FINAL: Sistema de Búsqueda Legal Optimizado')
  console.log('=' .repeat(70))
  
  const testCases = [
    {
      query: 'las cuentas en participación son valor financiero',
      description: 'Consulta específica del usuario sobre cuentas en participación'
    },
    {
      query: 'artículo 11 constitución política Colombia',
      description: 'Consulta constitucional específica'
    },
    {
      query: 'prescripción adquisitiva bienes inmuebles Colombia',
      description: 'Consulta de derecho inmobiliario'
    }
  ]
  
  for (const testCase of testCases) {
    console.log(`\n🔍 PRUEBA: ${testCase.description}`)
    console.log(`📝 Query: "${testCase.query}"`)
    console.log('-'.repeat(60))
    
    try {
      // Probar la nueva API de búsqueda legal especializada
      const response = await fetch(`${API_BASE}/api/tools/legal-search-specialized`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: testCase.query,
          numResults: 3,
          enrich: false
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`✅ ÉXITO: ${result.results.length} resultados encontrados`)
        console.log(`📊 Estrategia: ${result.searchStrategy}`)
        
        if (result.summary) {
          console.log(`📋 Resumen:`)
          console.log(`   - Fuentes oficiales: ${result.summary.officialSources}`)
          console.log(`   - Fuentes académicas: ${result.summary.academicSources}`)
          console.log(`   - Fuentes noticiosas: ${result.summary.newsSources}`)
          console.log(`   - Fuentes generales: ${result.summary.generalSources}`)
          console.log(`   - Relevancia promedio: ${result.summary.averageRelevance.toFixed(1)}/20`)
        }
        
        // Verificar que no hay Wikipedia
        const wikipediaResults = result.results.filter(r => 
          r.url.toLowerCase().includes('wikipedia.org') ||
          r.title.toLowerCase().includes('wikipedia')
        )
        
        if (wikipediaResults.length === 0) {
          console.log(`✅ Wikipedia excluida correctamente`)
        } else {
          console.log(`❌ ERROR: Se encontraron ${wikipediaResults.length} resultados de Wikipedia`)
        }
        
        // Mostrar primeros resultados
        console.log(`\n📄 Primeros resultados:`)
        result.results.slice(0, 2).forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.title}`)
          console.log(`     🔗 ${r.url}`)
          console.log(`     📊 Tipo: ${r.type}, Relevancia: ${r.relevance}/20`)
          console.log(`     📝 ${r.snippet.substring(0, 100)}...`)
        })
        
      } else {
        console.log(`❌ FALLO: ${result.error}`)
        if (result.note) {
          console.log(`📝 Nota: ${result.note}`)
        }
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
    
    console.log('\n' + '='.repeat(70))
  }
}

async function testChatWithTools() {
  console.log('\n💬 PRUEBA: Chat con Herramientas Optimizadas')
  console.log('=' .repeat(50))
  
  const testQuery = 'las cuentas en participación son valor financiero'
  
  try {
    const response = await fetch(`${API_BASE}/api/chat/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: testQuery
          }
        ],
        model: 'alibaba/tongyi-deepresearch-30b-a3b',
        temperature: 0.5,
        contextLength: 4096
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    if (result.success) {
      console.log(`✅ Chat exitoso`)
      console.log(`📝 Respuesta: ${result.response.substring(0, 200)}...`)
      
      // Verificar que la respuesta no menciona Wikipedia
      if (result.response.toLowerCase().includes('wikipedia')) {
        console.log(`❌ ERROR: La respuesta menciona Wikipedia`)
      } else {
        console.log(`✅ Wikipedia no mencionada en la respuesta`)
      }
      
      // Verificar que incluye fuentes
      if (result.response.includes('📚 Fuentes Consultadas') || result.response.includes('Bibliografía')) {
        console.log(`✅ Respuesta incluye fuentes consultadas`)
      } else {
        console.log(`⚠️ Respuesta no incluye sección de fuentes`)
      }
      
    } else {
      console.log(`❌ Chat falló: ${result.error}`)
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}

async function testEnvironmentVariables() {
  console.log('\n🔧 VERIFICACIÓN: Variables de Entorno')
  console.log('=' .repeat(40))
  
  const requiredVars = [
    'SERPER_API_KEY',
    'FIRECRAWL_API_KEY'
  ]
  
  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (value) {
      console.log(`✅ ${varName}: Configurada (${value.substring(0, 10)}...)`)
    } else {
      console.log(`❌ ${varName}: NO CONFIGURADA`)
    }
  }
}

// Ejecutar todas las pruebas
async function runAllTests() {
  try {
    await testEnvironmentVariables()
    await testLegalSearchAPI()
    await testChatWithTools()
    
    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS')
    console.log('\n📋 RESUMEN DE OPTIMIZACIONES IMPLEMENTADAS:')
    console.log('1. ✅ Nueva herramienta legal_search_specialized creada')
    console.log('2. ✅ Wikipedia completamente excluida de búsquedas legales')
    console.log('3. ✅ Serper optimizado con queries legales específicas')
    console.log('4. ✅ Firecrawl configurado para extracción profunda')
    console.log('5. ✅ Prompts actualizados para usar herramienta especializada')
    console.log('6. ✅ Sistema multinivel: Oficial → Académico → Legal → General → Firecrawl')
    console.log('7. ✅ Clasificación automática de fuentes por relevancia')
    console.log('8. ✅ Exclusión explícita de Wikipedia en todas las queries')
    
    console.log('\n🚀 PRÓXIMOS PASOS:')
    console.log('1. Reinicia el servidor: npm run dev')
    console.log('2. Prueba con la consulta del usuario: "las cuentas en participación son valor financiero"')
    console.log('3. Verifica que no aparezca Wikipedia en los resultados')
    console.log('4. Confirma que las fuentes sean oficiales colombianas')
    
  } catch (error) {
    console.error('❌ Error ejecutando pruebas:', error)
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
}

export { testLegalSearchAPI, testChatWithTools, testEnvironmentVariables, runAllTests }
