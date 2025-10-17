/**
 * Script de prueba para el Asistente Legal Colombiano
 * Prueba la consulta específica sobre requisitos para acción de tutela
 */

const testQuery = "qué necesito para iniciar una acción de tutela";

async function testLegalAssistant() {
  console.log('🔬 INICIANDO PRUEBA DEL ASISTENTE LEGAL COLOMBIANO');
  console.log('📋 Query de prueba:', testQuery);
  console.log('=' .repeat(60));

  try {
    // Test 1: Probar el endpoint legal especializado
    console.log('\n🎯 TEST 1: Endpoint Legal Especializado');
    console.log('-'.repeat(40));
    
    const legalResponse = await fetch('http://localhost:3000/api/chat/legal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatSettings: {
          model: 'openai/gpt-4o',
          temperature: 0.3
        },
        messages: [
          {
            role: 'user',
            content: testQuery
          }
        ]
      })
    });

    if (legalResponse.ok) {
      console.log('✅ Endpoint legal respondió correctamente');
      console.log('📊 Status:', legalResponse.status);
      
      // Leer respuesta en streaming
      const reader = legalResponse.body.getReader();
      const decoder = new TextDecoder();
      let responseText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const content = JSON.parse(line.slice(2));
              responseText += content;
            } catch (e) {
              // Ignorar errores de parsing
            }
          }
        }
      }
      
      console.log('📝 Longitud de la respuesta:', responseText.length, 'caracteres');
      console.log('🔍 ¿Contiene "tutela"?', responseText.toLowerCase().includes('tutela'));
      console.log('🔍 ¿Contiene "requisitos"?', responseText.toLowerCase().includes('requisitos'));
      console.log('🔍 ¿Contiene "fuentes"?', responseText.toLowerCase().includes('fuentes'));
      
    } else {
      console.error('❌ Error en endpoint legal:', legalResponse.status, legalResponse.statusText);
      const errorText = await legalResponse.text();
      console.error('📄 Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }

  try {
    // Test 2: Probar el endpoint de tools (actualizado)
    console.log('\n🎯 TEST 2: Endpoint Tools (Actualizado)');
    console.log('-'.repeat(40));
    
    const toolsResponse = await fetch('http://localhost:3000/api/chat/tools', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatSettings: {
          model: 'openai/gpt-4o',
          temperature: 0.3
        },
        messages: [
          {
            role: 'user',
            content: testQuery
          }
        ],
        selectedTools: [] // Sin herramientas para usar chat simple
      })
    });

    if (toolsResponse.ok) {
      console.log('✅ Endpoint tools respondió correctamente');
      console.log('📊 Status:', toolsResponse.status);
      
      // Leer respuesta en streaming
      const reader = toolsResponse.body.getReader();
      const decoder = new TextDecoder();
      let responseText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const content = JSON.parse(line.slice(2));
              responseText += content;
            } catch (e) {
              // Ignorar errores de parsing
            }
          }
        }
      }
      
      console.log('📝 Longitud de la respuesta:', responseText.length, 'caracteres');
      console.log('🔍 ¿Contiene "búsqueda web"?', responseText.toLowerCase().includes('búsqueda web'));
      console.log('🔍 ¿Contiene "tutela"?', responseText.toLowerCase().includes('tutela'));
      
    } else {
      console.error('❌ Error en endpoint tools:', toolsResponse.status, toolsResponse.statusText);
      const errorText = await toolsResponse.text();
      console.error('📄 Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }

  try {
    // Test 3: Probar endpoint de búsqueda web directamente
    console.log('\n🎯 TEST 3: Búsqueda Web Directa');
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
        console.log('📋 Primer resultado:', searchData.results[0]?.title?.substring(0, 50) + '...');
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
  console.log('🏁 PRUEBAS COMPLETADAS');
  console.log('💡 Para probar manualmente, abre: http://localhost:3000');
  console.log('💡 Usa la consulta:', testQuery);
}

// Instrucciones
console.log('🚀 ASISTENTE LEGAL COLOMBIANO - SCRIPT DE PRUEBA');
console.log('=' .repeat(60));
console.log('📋 Este script prueba los siguientes componentes:');
console.log('   1. Endpoint legal especializado (/api/chat/legal)');
console.log('   2. Endpoint tools actualizado (/api/chat/tools)');
console.log('   3. Búsqueda web directa (/api/tools/web-search)');
console.log('');
console.log('🔍 Query de prueba:', testQuery);
console.log('');
console.log('⚠️  REQUISITOS:');
console.log('   - Servidor corriendo en http://localhost:3000');
console.log('   - Variables de entorno configuradas');
console.log('');
console.log('🚀 Ejecutando pruebas...');
console.log('');

// Ejecutar pruebas
testLegalAssistant().catch(console.error);
