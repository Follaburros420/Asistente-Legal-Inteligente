/**
 * Script para probar el sistema con mejor manejo de errores
 */

async function testSystemWithErrorHandling() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 PRUEBA DEL SISTEMA CON MANEJO DE ERRORES')
  console.log('='.repeat(80))
  
  const testQuery = 'habeas data'
  console.log(`🔍 Probando query: "${testQuery}"`)
  
  try {
    const response = await fetch('http://localhost:3000/api/chat/simple-direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: testQuery }
        ]
      })
    })
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log(`❌ Error response: ${errorText}`)
      
      try {
        const errorJson = JSON.parse(errorText)
        console.log(`📋 Error details:`)
        console.log(`   - Success: ${errorJson.success}`)
        console.log(`   - Message: ${errorJson.message}`)
        console.log(`   - Timestamp: ${errorJson.timestamp}`)
        if (errorJson.error) {
          console.log(`   - Error: ${errorJson.error}`)
        }
      } catch (parseError) {
        console.log(`📋 Raw error text: ${errorText}`)
      }
      
      return
    }
    
    const data = await response.json()
    console.log(`✅ Respuesta exitosa:`)
    console.log(`   - Success: ${data.success}`)
    console.log(`   - Results found: ${data.resultsFound}`)
    console.log(`   - Search executed: ${data.searchExecuted}`)
    console.log(`   - Message length: ${data.message?.length || 0} caracteres`)
    
    if (data.message) {
      console.log(`📄 Preview de respuesta:`)
      console.log(data.message.substring(0, 500) + (data.message.length > 500 ? '...' : ''))
    }
    
  } catch (error) {
    console.log(`❌ Error de conexión: ${error.message}`)
    console.log(`💡 Verificar que el servidor esté ejecutándose en http://localhost:3000`)
  }
}

// Ejecutar la prueba
testSystemWithErrorHandling().catch(console.error)
