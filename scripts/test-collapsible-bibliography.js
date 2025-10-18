/**
 * Script de Prueba: Menú de Bibliografía Desplegable
 */

import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3000'

async function testCollapsibleBibliography() {
  console.log('📚 PRUEBA: Menú de Bibliografía Desplegable')
  console.log('=' .repeat(50))
  
  const testQuery = 'las cuentas en participación son valor financiero'
  
  try {
    console.log(`📝 Probando consulta: "${testQuery}"`)
    
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
        contextLength: 4096,
        selectedTools: []
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    console.log(`✅ Respuesta recibida`)
    
    // Verificar que la respuesta incluye bibliografía
    const hasBibliography = result.response.includes('📚 Fuentes Consultadas') ||
                           result.response.includes('Bibliografía')
    
    if (hasBibliography) {
      console.log(`✅ La respuesta incluye sección de bibliografía`)
    } else {
      console.log(`⚠️ La respuesta no incluye sección de bibliografía`)
    }
    
    // Verificar que no menciona Wikipedia
    const mentionsWikipedia = result.response.toLowerCase().includes('wikipedia')
    
    if (mentionsWikipedia) {
      console.log(`❌ ERROR: La respuesta menciona Wikipedia`)
    } else {
      console.log(`✅ ÉXITO: La respuesta NO menciona Wikipedia`)
    }
    
    console.log(`\n📄 RESPUESTA COMPLETA:`)
    console.log(result.response)
    
    console.log(`\n🎯 INSTRUCCIONES PARA VERIFICAR EN EL NAVEGADOR:`)
    console.log(`1. Ve a http://localhost:3000/es/login`)
    console.log(`2. Haz la pregunta: "${testQuery}"`)
    console.log(`3. Busca la sección "Bibliografía - Fuentes Oficiales Colombianas"`)
    console.log(`4. Verifica que tenga un ícono de chevron (flecha)`)
    console.log(`5. Haz clic en el título para expandir/contraer`)
    console.log(`6. Confirma que muestra el número de fuentes en un badge`)
    console.log(`7. Verifica que las fuentes se muestran/ocultan al hacer clic`)
    
  } catch (error) {
    console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('🎯 PRUEBA COMPLETADA')
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testCollapsibleBibliography()
}

export { testCollapsibleBibliography }
