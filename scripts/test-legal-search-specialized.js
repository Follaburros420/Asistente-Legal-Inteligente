/**
 * Script de Prueba: Búsqueda Legal Especializada
 * Prueba la nueva herramienta optimizada para consultas legales colombianas
 */

import { searchLegalSpecialized, enrichLegalResults } from './lib/tools/legal-search-specialized.js'

async function testLegalSearch() {
  console.log('⚖️ PRUEBA DE BÚSQUEDA LEGAL ESPECIALIZADA')
  console.log('=' .repeat(60))
  
  // Casos de prueba específicos
  const testCases = [
    {
      query: 'las cuentas en participación son valor financiero',
      description: 'Consulta específica del usuario'
    },
    {
      query: 'artículo 11 constitución política Colombia',
      description: 'Consulta constitucional específica'
    },
    {
      query: 'contratos de arrendamiento código civil',
      description: 'Consulta de derecho civil'
    },
    {
      query: 'prescripción adquisitiva bienes inmuebles',
      description: 'Consulta de derecho inmobiliario'
    }
  ]
  
  for (const testCase of testCases) {
    console.log(`\n🔍 PRUEBA: ${testCase.description}`)
    console.log(`📝 Query: "${testCase.query}"`)
    console.log('-'.repeat(50))
    
    try {
      // Prueba básica
      const result = await searchLegalSpecialized(testCase.query, 3)
      
      if (result.success) {
        console.log(`✅ ÉXITO: ${result.results.length} resultados encontrados`)
        console.log(`📊 Estrategia: ${result.searchStrategy}`)
        
        // Mostrar resumen de fuentes
        const sourceTypes = result.results.reduce((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1
          return acc
        }, {})
        
        console.log(`📋 Tipos de fuentes:`, sourceTypes)
        
        // Mostrar relevancia promedio
        const avgRelevance = result.results.reduce((sum, r) => sum + r.relevance, 0) / result.results.length
        console.log(`⭐ Relevancia promedio: ${avgRelevance.toFixed(1)}/20`)
        
        // Mostrar primeros resultados
        console.log(`\n📄 Primeros resultados:`)
        result.results.slice(0, 2).forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.title}`)
          console.log(`     🔗 ${r.url}`)
          console.log(`     📊 Tipo: ${r.type}, Relevancia: ${r.relevance}/20`)
          console.log(`     📝 ${r.snippet.substring(0, 100)}...`)
        })
        
        // Prueba de enriquecimiento
        if (result.results.length > 0) {
          console.log(`\n📚 Probando enriquecimiento con Firecrawl...`)
          const enriched = await enrichLegalResults(result.results.slice(0, 1), 1)
          
          if (enriched.length > 0 && enriched[0].snippet.length > result.results[0].snippet.length) {
            console.log(`✅ Enriquecimiento exitoso: ${enriched[0].snippet.length} caracteres`)
          } else {
            console.log(`⚠️ Enriquecimiento limitado o fallido`)
          }
        }
        
      } else {
        console.log(`❌ FALLO: ${result.error}`)
        if (result.note) {
          console.log(`📝 Nota: ${result.note}`)
        }
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
    
    console.log('\n' + '='.repeat(60))
  }
  
  console.log('\n🎯 RESUMEN DE PRUEBAS COMPLETADO')
}

// Función para probar exclusión de Wikipedia
async function testWikipediaExclusion() {
  console.log('\n🚫 PRUEBA DE EXCLUSIÓN DE WIKIPEDIA')
  console.log('=' .repeat(50))
  
  const queries = [
    'constitución política Colombia',
    'código civil Colombia',
    'derecho comercial Colombia'
  ]
  
  for (const query of queries) {
    console.log(`\n🔍 Probando: "${query}"`)
    
    try {
      const result = await searchLegalSpecialized(query, 5)
      
      if (result.success) {
        const wikipediaResults = result.results.filter(r => 
          r.url.toLowerCase().includes('wikipedia.org') ||
          r.title.toLowerCase().includes('wikipedia')
        )
        
        if (wikipediaResults.length === 0) {
          console.log(`✅ ÉXITO: No se encontraron resultados de Wikipedia`)
        } else {
          console.log(`❌ FALLO: Se encontraron ${wikipediaResults.length} resultados de Wikipedia`)
          wikipediaResults.forEach(r => {
            console.log(`   - ${r.title} (${r.url})`)
          })
        }
        
        console.log(`📊 Total resultados: ${result.results.length}`)
        
      } else {
        console.log(`⚠️ Búsqueda falló: ${result.error}`)
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }
}

// Ejecutar pruebas
async function runAllTests() {
  try {
    await testLegalSearch()
    await testWikipediaExclusion()
    
    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS')
    console.log('\n📋 RECOMENDACIONES:')
    console.log('1. Verificar que SERPER_API_KEY esté configurada')
    console.log('2. Verificar que FIRECRAWL_API_KEY esté configurada')
    console.log('3. Probar con consultas legales reales del usuario')
    console.log('4. Monitorear logs del servidor durante las pruebas')
    
  } catch (error) {
    console.error('❌ Error ejecutando pruebas:', error)
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
}

export { testLegalSearch, testWikipediaExclusion, runAllTests }
