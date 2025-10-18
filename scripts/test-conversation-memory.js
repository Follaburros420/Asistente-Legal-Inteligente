/**
 * Script de Prueba: Formato y Memoria de Conversación
 */

import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3000'

async function testConversationMemory() {
  console.log('🧠 PRUEBA: Memoria de Conversación y Formato Mejorado')
  console.log('=' .repeat(60))
  
  try {
    // Primera pregunta
    console.log('📝 Primera pregunta: "son las cuentas en participación valor financiero?"')
    
    const firstResponse = await fetch(`${API_BASE}/api/chat/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'son las cuentas en participación valor financiero?'
          }
        ],
        model: 'alibaba/tongyi-deepresearch-30b-a3b',
        temperature: 0.5,
        contextLength: 4096,
        selectedTools: []
      })
    })
    
    if (!firstResponse.ok) {
      throw new Error(`HTTP ${firstResponse.status}: ${firstResponse.statusText}`)
    }
    
    const firstResult = await firstResponse.json()
    console.log(`✅ Primera respuesta recibida`)
    
    // Segunda pregunta (con contexto)
    console.log('\n📝 Segunda pregunta: "entonces si son catalogados como valor financiero?"')
    
    const secondResponse = await fetch(`${API_BASE}/api/chat/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'son las cuentas en participación valor financiero?'
          },
          {
            role: 'assistant',
            content: firstResult.response
          },
          {
            role: 'user',
            content: 'entonces si son catalogados como valor financiero?'
          }
        ],
        model: 'alibaba/tongyi-deepresearch-30b-a3b',
        temperature: 0.5,
        contextLength: 4096,
        selectedTools: []
      })
    })
    
    if (!secondResponse.ok) {
      throw new Error(`HTTP ${secondResponse.status}: ${secondResponse.statusText}`)
    }
    
    const secondResult = await secondResponse.json()
    
    console.log(`\n📊 ANÁLISIS DE RESULTADOS:`)
    
    // Verificar formato
    console.log(`\n🎨 VERIFICACIÓN DE FORMATO:`)
    const hasFormalTitles = secondResult.response.includes('Marco Normativo') || 
                           secondResult.response.includes('Análisis Jurídico') ||
                           secondResult.response.includes('Conclusión')
    
    if (hasFormalTitles) {
      console.log(`❌ ERROR: La respuesta usa títulos formales como "Marco Normativo"`)
    } else {
      console.log(`✅ ÉXITO: La respuesta NO usa títulos formales`)
    }
    
    // Verificar memoria de conversación
    console.log(`\n🧠 VERIFICACIÓN DE MEMORIA:`)
    const mentionsPreviousContext = secondResult.response.toLowerCase().includes('cuentas en participación') ||
                                   secondResult.response.toLowerCase().includes('valor financiero') ||
                                   secondResult.response.toLowerCase().includes('anterior') ||
                                   secondResult.response.toLowerCase().includes('como mencioné')
    
    if (mentionsPreviousContext) {
      console.log(`✅ ÉXITO: La respuesta muestra memoria de la conversación anterior`)
    } else {
      console.log(`❌ ERROR: La respuesta NO muestra memoria de la conversación anterior`)
    }
    
    // Verificar exclusión de Wikipedia
    console.log(`\n🚫 VERIFICACIÓN WIKIPEDIA:`)
    const mentionsWikipedia = secondResult.response.toLowerCase().includes('wikipedia')
    
    if (mentionsWikipedia) {
      console.log(`❌ ERROR: La respuesta menciona Wikipedia`)
    } else {
      console.log(`✅ ÉXITO: La respuesta NO menciona Wikipedia`)
    }
    
    // Mostrar respuesta
    console.log(`\n📄 RESPUESTA COMPLETA:`)
    console.log(secondResult.response)
    
    // Verificar fuentes
    console.log(`\n📚 VERIFICACIÓN DE FUENTES:`)
    const hasSources = secondResult.response.includes('📚 Fuentes Consultadas') ||
                      secondResult.response.includes('Bibliografía')
    
    if (hasSources) {
      console.log(`✅ ÉXITO: La respuesta incluye sección de fuentes`)
    } else {
      console.log(`⚠️ ADVERTENCIA: La respuesta no incluye sección de fuentes`)
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('🎯 PRUEBA COMPLETADA')
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testConversationMemory()
}

export { testConversationMemory }
