/**
 * Script de prueba para el sistema robusto de búsqueda web
 */

import { searchWebRobust } from './robust-web-search'
import { detectLegalQuery } from './smart-legal-detector'

async function testRobustSearch() {
  console.log(`\n🧪 PROBANDO SISTEMA ROBUSTO DE BÚSQUEDA`)
  console.log(`${'='.repeat(60)}`)
  
  const testCases = [
    "hola", // No debería buscar
    "¿qué es la prescripción?", // Sí debería buscar
    "artículo 700 código civil" // Sí debería buscar
  ]
  
  for (const query of testCases) {
    console.log(`\n📝 Probando: "${query}"`)
    
    // 1. Probar detección
    const detection = detectLegalQuery(query)
    console.log(`   🧠 Detección: ${detection.requiresWebSearch ? 'Buscar' : 'No buscar'} (${(detection.confidence * 100).toFixed(1)}%)`)
    
    if (detection.requiresWebSearch) {
      // 2. Probar búsqueda robusta
      try {
        const searchResult = await searchWebRobust(query, 3)
        console.log(`   🔍 Búsqueda: ${searchResult.success ? 'Exitosa' : 'Fallida'}`)
        console.log(`   🎯 Motor: ${searchResult.searchEngine}`)
        console.log(`   📊 Resultados: ${searchResult.results.length}`)
        
        if (searchResult.results.length > 0) {
          console.log(`   📋 Primer resultado: ${searchResult.results[0].title}`)
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error}`)
      }
    } else {
      console.log(`   ✅ No se ejecuta búsqueda (correcto)`)
    }
  }
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Prueba completada`)
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testRobustSearch().catch(console.error)
}

export { testRobustSearch }
