/**
 * Script específico para probar el problema de prescripción adquisitiva
 */

const testQuery = "como inicio una prescripcion adquisitiva";

async function testPrescripcion() {
  console.log('🔬 DIAGNÓSTICO ESPECÍFICO: PRESCRIPCIÓN ADQUISITIVA');
  console.log('📋 Query de prueba:', testQuery);
  console.log('=' .repeat(60));

  try {
    // Test 1: Probar búsqueda web directa para ver qué información encuentra
    console.log('\n🎯 TEST 1: Búsqueda Web Directa - Prescripción Adquisitiva');
    console.log('-'.repeat(40));
    
    const searchResponse = await fetch('http://localhost:3000/api/tools/web-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: testQuery
      })
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('✅ Búsqueda web respondió correctamente');
      console.log('📊 Success:', searchData.success);
      console.log('📊 Resultados:', searchData.results?.length || 0);
      console.log('📊 Fuentes:', searchData.sources?.length || 0);
      
      if (searchData.results && searchData.results.length > 0) {
        console.log('🏛️ Fuentes oficiales:', searchData.results.filter(r => r.score === 3).length);
        console.log('🎓 Fuentes académicas:', searchData.results.filter(r => r.score === 2).length);
        
        console.log('\n📋 PRIMEROS 3 RESULTADOS:');
        searchData.results.slice(0, 3).forEach((result, index) => {
          console.log(`${index + 1}. ${result.title}`);
          console.log(`   📄 Snippet: ${result.snippet.substring(0, 200)}...`);
          console.log(`   🔗 URL: ${result.url}`);
          console.log(`   🏆 Score: ${result.score}`);
          console.log('');
        });
      }
      
    } else {
      console.error('❌ Error en búsqueda web:', searchResponse.status, searchResponse.statusText);
      const errorText = await searchResponse.text();
      console.error('📄 Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 ANÁLISIS COMPLETADO');
  console.log('💡 Revisa los resultados para identificar el problema de síntesis');
}

// Ejecutar prueba
console.log('🚀 DIAGNÓSTICO DE PRESCRIPCIÓN ADQUISITIVA');
console.log('=' .repeat(60));
console.log('📋 Analizando por qué el sistema no está procesando correctamente');
console.log('');

testPrescripcion().catch(console.error);
