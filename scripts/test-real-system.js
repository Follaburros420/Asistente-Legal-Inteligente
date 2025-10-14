/**
 * Script para probar el sistema simplificado con peticiones reales
 * Verifica que el sistema accede a internet y da respuestas precisas
 */

const API_URL = 'http://localhost:3000/api/chat/simple-direct' // Cambiar por la URL de producción si es necesario

async function testSystemWithRealRequests() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 PRUEBA REAL DEL SISTEMA SIMPLIFICADO')
  console.log('='.repeat(80))
  
  const testQueries = [
    {
      query: 'habeas data',
      expected: 'Ley 1581 de 2012, protección de datos personales, principios del habeas data'
    },
    {
      query: 'requisitos de la demanda',
      expected: 'Código General del Proceso, artículo 82, requisitos procesales'
    },
    {
      query: 'cuando se entiende que una persona nace a la vida en el derecho',
      expected: 'Código Civil, artículos 90, 91, 92, 93, personalidad jurídica'
    },
    {
      query: 'acción de tutela',
      expected: 'Constitución Política, artículo 86, derechos fundamentales'
    }
  ]
  
  for (let i = 0; i < testQueries.length; i++) {
    const testCase = testQueries[i]
    console.log(`\n🔍 PRUEBA ${i + 1}: "${testCase.query}"`)
    console.log(`📋 Esperado: ${testCase.expected}`)
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: testCase.query }
          ]
        })
      })
      
      if (!response.ok) {
        console.log(`❌ Error HTTP: ${response.status} ${response.statusText}`)
        continue
      }
      
      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ Respuesta exitosa`)
        console.log(`📊 Resultados encontrados: ${data.resultsFound}`)
        console.log(`🔍 Búsqueda ejecutada: ${data.searchExecuted}`)
        
        // Analizar la respuesta
        const message = data.message || ''
        console.log(`📝 Longitud de respuesta: ${message.length} caracteres`)
        
        // Verificar que incluye fuentes
        const hasSources = message.includes('📚 Fuentes Consultadas')
        console.log(`📚 Incluye fuentes: ${hasSources ? '✅' : '❌'}`)
        
        // Verificar contenido específico esperado
        const hasExpectedContent = testCase.expected.split(', ').some(keyword => 
          message.toLowerCase().includes(keyword.toLowerCase())
        )
        console.log(`🎯 Contiene contenido esperado: ${hasExpectedContent ? '✅' : '❌'}`)
        
        // Mostrar preview de la respuesta
        console.log(`📄 Preview de respuesta:`)
        console.log(message.substring(0, 300) + (message.length > 300 ? '...' : ''))
        
        // Verificar que NO menciona búsquedas web
        const mentionsWebSearch = message.toLowerCase().includes('busqué') || 
                                 message.toLowerCase().includes('buscar') ||
                                 message.toLowerCase().includes('encontré en internet')
        console.log(`🚫 NO menciona búsquedas web: ${!mentionsWebSearch ? '✅' : '❌'}`)
        
      } else {
        console.log(`❌ Error en respuesta: ${data.message}`)
        if (data.error) {
          console.log(`🔍 Detalle del error: ${data.error}`)
        }
      }
      
    } catch (error) {
      console.log(`❌ Error de conexión: ${error.message}`)
      console.log(`💡 Sugerencia: Verificar que el servidor esté ejecutándose en ${API_URL}`)
    }
    
    // Pausa entre peticiones
    if (i < testQueries.length - 1) {
      console.log(`⏳ Esperando 2 segundos antes de la siguiente prueba...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log(`\n` + '='.repeat(80))
  console.log('🏁 PRUEBAS COMPLETADAS')
  console.log('='.repeat(80))
  
  console.log(`\n📋 RESUMEN DE PRUEBAS:`)
  console.log(`- Sistema simplificado probado con ${testQueries.length} consultas diferentes`)
  console.log(`- Verificación de acceso a internet`)
  console.log(`- Verificación de respuestas precisas sobre derecho colombiano`)
  console.log(`- Verificación de inclusión de fuentes`)
  console.log(`- Verificación de que NO menciona búsquedas web`)
}

// Función para probar con URL de producción
async function testWithProductionURL() {
  console.log('\n🌐 Probando con URL de producción...')
  
  // Cambiar por la URL real de producción
  const PRODUCTION_URL = 'https://tu-dominio.vercel.app/api/chat/simple-direct'
  
  try {
    const response = await fetch(PRODUCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'habeas data' }
        ]
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Producción funcionando: ${data.success}`)
      console.log(`📊 Resultados: ${data.resultsFound}`)
    } else {
      console.log(`❌ Error en producción: ${response.status}`)
    }
  } catch (error) {
    console.log(`❌ Error de conexión a producción: ${error.message}`)
  }
}

// Ejecutar las pruebas
async function runTests() {
  // Primero probar localmente
  await testSystemWithRealRequests()
  
  // Luego probar producción si es necesario
  // await testWithProductionURL()
}

runTests().catch(console.error)
