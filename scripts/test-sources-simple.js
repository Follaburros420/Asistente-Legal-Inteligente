/**
 * Script simple para probar la calidad de fuentes
 */

async function testSourceQualitySimple() {
  console.log('\n' + '='.repeat(80))
  console.log('🔍 PRUEBA SIMPLE DE CALIDAD DE FUENTES')
  console.log('='.repeat(80))
  
  const testQuery = 'habeas data'
  console.log(`\n🔍 Probando: "${testQuery}"`)
  
  try {
    const response = await fetch('http://localhost:3000/api/chat/simple-direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: testQuery }]
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ Respuesta exitosa`)
        console.log(`📊 Resultados encontrados: ${data.resultsFound}`)
        console.log(`📄 Longitud de respuesta: ${data.message.length} caracteres`)
        
        // Buscar URLs en la respuesta
        const urlMatches = data.message.match(/https?:\/\/[^\s\)]+/g)
        if (urlMatches) {
          console.log(`\n🔗 URLs encontradas en la respuesta:`)
          urlMatches.forEach((url, index) => {
            const isOfficial = url.includes('.gov.co') || url.includes('corteconstitucional') || url.includes('secretariasenado')
            const isAcademic = url.includes('.edu.co')
            const icon = isOfficial ? '⚖️' : isAcademic ? '🎓' : '📄'
            const type = isOfficial ? 'OFICIAL' : isAcademic ? 'ACADÉMICA' : 'OTRA'
            
            console.log(`   ${index + 1}. ${icon} ${url} [${type}]`)
          })
          
          const officialCount = urlMatches.filter(url => url.includes('.gov.co') || url.includes('corteconstitucional') || url.includes('secretariasenado')).length
          const academicCount = urlMatches.filter(url => url.includes('.edu.co')).length
          
          console.log(`\n📈 RESUMEN DE CALIDAD:`)
          console.log(`   - URLs oficiales: ${officialCount}/${urlMatches.length} (${Math.round(officialCount/urlMatches.length*100)}%)`)
          console.log(`   - URLs académicas: ${academicCount}/${urlMatches.length} (${Math.round(academicCount/urlMatches.length*100)}%)`)
          console.log(`   - Otras URLs: ${urlMatches.length - officialCount - academicCount}/${urlMatches.length}`)
        } else {
          console.log(`⚠️ No se encontraron URLs en la respuesta`)
        }
        
        // Mostrar una muestra de la respuesta
        console.log(`\n📄 MUESTRA DE LA RESPUESTA:`)
        const lines = data.message.split('\n')
        const sampleLines = lines.slice(0, 15).join('\n')
        console.log(sampleLines)
        console.log(`... (${lines.length - 15} líneas más)`)
        
      } else {
        console.log(`❌ Error en respuesta: ${data.message}`)
      }
    } else {
      console.log(`❌ Error HTTP: ${response.status}`)
      const errorText = await response.text()
      console.log(`Error details: ${errorText}`)
    }
  } catch (error) {
    console.log(`❌ Error de conexión: ${error.message}`)
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('🏁 PRUEBA SIMPLE COMPLETADA')
  console.log('='.repeat(80))
}

// Ejecutar la prueba
testSourceQualitySimple().catch(console.error)
