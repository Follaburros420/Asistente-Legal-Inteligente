/**
 * Script para probar directamente la función de búsqueda web mejorada
 */

import { searchWebEnriched, formatSearchResultsForContext } from '../lib/tools/web-search.js'

async function testWebSearchDirectly() {
  console.log('\n' + '='.repeat(80))
  console.log('🔍 PRUEBA DIRECTA DE BÚSQUEDA WEB MEJORADA')
  console.log('='.repeat(80))
  
  const testQuery = 'habeas data'
  console.log(`\n🔍 Probando búsqueda: "${testQuery}"`)
  
  try {
    // Probar la búsqueda web
    const searchResults = await searchWebEnriched(testQuery)
    
    if (searchResults.success) {
      console.log(`✅ Búsqueda exitosa`)
      console.log(`📊 Resultados encontrados: ${searchResults.results.length}`)
      
      // Mostrar resultados con clasificación
      console.log(`\n📚 RESULTADOS CLASIFICADOS:`)
      searchResults.results.forEach((result, index) => {
        const isOfficial = result.score === 3
        const isAcademic = result.score === 2
        const icon = isOfficial ? '⚖️' : isAcademic ? '🎓' : '📄'
        const type = isOfficial ? 'OFICIAL' : isAcademic ? 'ACADÉMICA' : 'OTRA'
        
        console.log(`\n${index + 1}. ${icon} ${result.title} [${type}]`)
        console.log(`   URL: ${result.url}`)
        console.log(`   Score: ${result.score}`)
        console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`)
      })
      
      // Contar por tipo
      const officialCount = searchResults.results.filter(r => r.score === 3).length
      const academicCount = searchResults.results.filter(r => r.score === 2).length
      const otherCount = searchResults.results.filter(r => r.score === 1).length
      
      console.log(`\n📈 RESUMEN DE CALIDAD:`)
      console.log(`   - Fuentes oficiales: ${officialCount}/${searchResults.results.length}`)
      console.log(`   - Fuentes académicas: ${academicCount}/${searchResults.results.length}`)
      console.log(`   - Otras fuentes: ${otherCount}/${searchResults.results.length}`)
      
      // Probar el formateo de contexto
      console.log(`\n📝 PROBANDO FORMATEO DE CONTEXTO:`)
      const context = formatSearchResultsForContext(searchResults)
      console.log(`📄 Contexto generado: ${context.length} caracteres`)
      
      // Mostrar las primeras líneas del contexto
      const contextLines = context.split('\n').slice(0, 20)
      console.log(`📋 Primeras líneas del contexto:`)
      contextLines.forEach(line => console.log(`   ${line}`))
      
    } else {
      console.log(`❌ Error en búsqueda: ${searchResults.error}`)
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('🏁 PRUEBA DIRECTA COMPLETADA')
  console.log('='.repeat(80))
}

// Ejecutar la prueba
testWebSearchDirectly().catch(console.error)
