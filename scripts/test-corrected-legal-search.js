/**
 * Script de Prueba Rápida: Verificar Corrección de Búsqueda Legal
 */

import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3000'

async function testCorrectedLegalSearch() {
  console.log('🔧 PRUEBA RÁPIDA: Verificar Corrección de Búsqueda Legal')
  console.log('=' .repeat(60))
  
  const testQuery = 'las cuentas en participación son valor financiero'
  
  try {
    console.log(`📝 Probando consulta: "${testQuery}"`)
    
    // Probar la nueva API de búsqueda legal especializada
    const response = await fetch(`${API_BASE}/api/tools/legal-search-specialized`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: testQuery,
        numResults: 3,
        enrich: false
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    console.log(`\n📊 RESULTADO:`)
    console.log(`✅ Éxito: ${result.success}`)
    console.log(`📋 Estrategia: ${result.searchStrategy}`)
    console.log(`📊 Resultados: ${result.results.length}`)
    
    if (result.summary) {
      console.log(`\n📈 RESUMEN:`)
      console.log(`   - Fuentes oficiales: ${result.summary.officialSources}`)
      console.log(`   - Fuentes académicas: ${result.summary.academicSources}`)
      console.log(`   - Fuentes noticiosas: ${result.summary.newsSources}`)
      console.log(`   - Fuentes generales: ${result.summary.generalSources}`)
      console.log(`   - Relevancia promedio: ${result.summary.averageRelevance.toFixed(1)}/20`)
    }
    
    // Verificar exclusión de Wikipedia
    const wikipediaResults = result.results.filter(r => 
      r.url.toLowerCase().includes('wikipedia.org') ||
      r.title.toLowerCase().includes('wikipedia')
    )
    
    console.log(`\n🚫 VERIFICACIÓN WIKIPEDIA:`)
    if (wikipediaResults.length === 0) {
      console.log(`✅ ÉXITO: Wikipedia completamente excluida`)
    } else {
      console.log(`❌ ERROR: Se encontraron ${wikipediaResults.length} resultados de Wikipedia`)
      wikipediaResults.forEach(r => {
        console.log(`   - ${r.title} (${r.url})`)
      })
    }
    
    // Mostrar fuentes encontradas
    if (result.results.length > 0) {
      console.log(`\n📄 FUENTES ENCONTRADAS:`)
      result.results.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.type.toUpperCase()}] ${r.title}`)
        console.log(`     🔗 ${r.url}`)
        console.log(`     ⭐ Relevancia: ${r.relevance}/20`)
        console.log(`     📝 ${r.snippet.substring(0, 100)}...`)
        console.log('')
      })
    }
    
    // Probar chat con herramientas
    console.log(`\n💬 PROBANDO CHAT CON HERRAMIENTAS...`)
    
    const chatResponse = await fetch(`${API_BASE}/api/chat/tools`, {
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
        contextLength: 4096,
        selectedTools: []
      })
    })
    
    if (chatResponse.ok) {
      const chatResult = await chatResponse.json()
      console.log(`✅ Chat exitoso`)
      
      // Verificar que no menciona Wikipedia
      if (chatResult.response && chatResult.response.toLowerCase().includes('wikipedia')) {
        console.log(`❌ ERROR: La respuesta del chat menciona Wikipedia`)
      } else {
        console.log(`✅ La respuesta del chat NO menciona Wikipedia`)
      }
      
      // Verificar que incluye fuentes
      if (chatResult.response && (chatResult.response.includes('📚 Fuentes Consultadas') || chatResult.response.includes('Bibliografía'))) {
        console.log(`✅ La respuesta incluye sección de fuentes`)
      } else {
        console.log(`⚠️ La respuesta no incluye sección de fuentes`)
      }
      
    } else {
      console.log(`❌ Chat falló: ${chatResponse.status}`)
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('🎯 PRUEBA COMPLETADA')
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testCorrectedLegalSearch()
}

export { testCorrectedLegalSearch }
