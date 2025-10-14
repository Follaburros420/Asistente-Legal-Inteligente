/**
 * Script específico para probar consultas de artículos constitucionales
 */

async function testConstitutionalArticles() {
  console.log('\n' + '='.repeat(80))
  console.log('📜 PRUEBA DE ARTÍCULOS CONSTITUCIONALES ESPECÍFICOS')
  console.log('='.repeat(80))
  
  const testQueries = [
    'art 11 constitucion',
    'art 11 constitución',
    'artículo 11 constitución política',
    'art 10 constitucion',
    'art 15 constitucion'
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
          console.log(`📄 Longitud de respuesta: ${data.message.length} caracteres`)
          
          // Buscar si menciona el artículo específico
          const articleMatch = query.match(/art\s*(\d+)/i)
          const articleNumber = articleMatch ? articleMatch[1] : 'específico'
          
          if (data.message.includes(`Artículo ${articleNumber}`) || data.message.includes(`artículo ${articleNumber}`)) {
            console.log(`✅ ✅ MENCIONA CORRECTAMENTE EL ARTÍCULO ${articleNumber}`)
          } else {
            console.log(`⚠️ ⚠️ NO MENCIONA ESPECÍFICAMENTE EL ARTÍCULO ${articleNumber}`)
          }
          
          // Buscar URLs constitucionales específicas
          const constitutionalUrls = data.message.match(/https?:\/\/[^\s\)]*secretariasenado[^\s\)]*/g) || []
          const courtUrls = data.message.match(/https?:\/\/[^\s\)]*corteconstitucional[^\s\)]*/g) || []
          
          console.log(`📚 URLs constitucionales encontradas:`)
          console.log(`   - Secretaría del Senado: ${constitutionalUrls.length}`)
          console.log(`   - Corte Constitucional: ${courtUrls.length}`)
          
          // Mostrar una muestra de la respuesta
          console.log(`\n📄 MUESTRA DE LA RESPUESTA:`)
          const lines = data.message.split('\n')
          const sampleLines = lines.slice(0, 10).join('\n')
          console.log(sampleLines)
          console.log(`... (${lines.length - 10} líneas más)`)
          
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
    
    // Pausa entre consultas
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('🏁 PRUEBA DE ARTÍCULOS CONSTITUCIONALES COMPLETADA')
  console.log('='.repeat(80))
  
  console.log(`\n📋 CRITERIOS DE ÉXITO:`)
  console.log(`✅ Debe mencionar específicamente el número del artículo`)
  console.log(`✅ Debe incluir URLs de sitios constitucionales oficiales`)
  console.log(`✅ Debe proporcionar contenido específico del artículo`)
  console.log(`✅ Debe usar formato estructurado (Marco Normativo, Artículo Específico, etc.)`)
}

// Ejecutar la prueba
testConstitutionalArticles().catch(console.error)
