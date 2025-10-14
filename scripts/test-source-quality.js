/**
 * Script para probar la calidad de las fuentes nacionales confiables
 */

async function testSourceQuality() {
  console.log('\n' + '='.repeat(80))
  console.log('🔍 PRUEBA DE CALIDAD DE FUENTES NACIONALES CONFIABLES')
  console.log('='.repeat(80))
  
  const testQueries = [
    'habeas data',
    'requisitos de la demanda',
    'acción de tutela',
    'cuando se entiende que una persona nace a la vida en el derecho',
    'art 10 constitucion'
  ]
  
  for (const query of testQueries) {
    console.log(`\n🔍 Probando: "${query}"`)
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/simple-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: query }]
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success) {
          console.log(`✅ Respuesta exitosa`)
          console.log(`📊 Resultados encontrados: ${data.resultsFound}`)
          
          // Extraer fuentes de la respuesta
          const message = data.message
          console.log(`📄 Longitud de respuesta: ${message.length} caracteres`)
          
          // Buscar la sección de fuentes
          const sourcesMatch = message.match(/## 📚 Fuentes Consultadas\n([\s\S]*?)(?:\n\n|$)/)
          if (sourcesMatch) {
            const sourcesText = sourcesMatch[1]
            const sources = sourcesText.split('\n').filter(line => line.trim().startsWith('['))
            
            console.log(`📚 Fuentes encontradas: ${sources.length}`)
            sources.forEach((source, index) => {
              const isOfficial = source.includes('.gov.co') || source.includes('corteconstitucional') || source.includes('secretariasenado')
              const isAcademic = source.includes('.edu.co')
              const icon = isOfficial ? '⚖️' : isAcademic ? '🎓' : '📄'
              const type = isOfficial ? 'OFICIAL' : isAcademic ? 'ACADÉMICA' : 'OTRA'
              
              console.log(`   ${index + 1}. ${icon} ${source.substring(0, 80)}... [${type}]`)
            })
            
            const officialCount = sources.filter(s => s.includes('.gov.co') || s.includes('corteconstitucional') || s.includes('secretariasenado')).length
            const academicCount = sources.filter(s => s.includes('.edu.co')).length
            
            console.log(`📈 Calidad de fuentes:`)
            console.log(`   - Oficiales: ${officialCount}/${sources.length} (${sources.length > 0 ? Math.round(officialCount/sources.length*100) : 0}%)`)
            console.log(`   - Académicas: ${academicCount}/${sources.length} (${sources.length > 0 ? Math.round(academicCount/sources.length*100) : 0}%)`)
            console.log(`   - Otras: ${sources.length - officialCount - academicCount}/${sources.length}`)
          } else {
            console.log(`⚠️ No se encontró sección de fuentes en la respuesta`)
            // Mostrar las últimas líneas para debug
            const lines = message.split('\n')
            const lastLines = lines.slice(-10).join('\n')
            console.log(`📄 Últimas líneas de la respuesta:`)
            console.log(lastLines)
          }
        } else {
          console.log(`❌ Error en respuesta: ${data.message}`)
        }
      } else {
        console.log(`❌ Error HTTP: ${response.status}`)
      }
    } catch (error) {
      console.log(`❌ Error de conexión: ${error.message}`)
    }
    
    // Pausa entre consultas
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('🏁 PRUEBA DE CALIDAD COMPLETADA')
  console.log('='.repeat(80))
  
  console.log(`\n📋 CRITERIOS DE CALIDAD:`)
  console.log(`✅ Fuentes oficiales (.gov.co): Máxima confiabilidad`)
  console.log(`✅ Fuentes académicas (.edu.co): Alta confiabilidad`)
  console.log(`✅ Sitios específicos: corteconstitucional.gov.co, secretariasenado.gov.co, etc.`)
  console.log(`✅ Priorización automática de fuentes confiables`)
  console.log(`✅ Limitación de fuentes adicionales a máximo 3`)
}

// Ejecutar la prueba
testSourceQuality().catch(console.error)
