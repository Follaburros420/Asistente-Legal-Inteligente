/**
 * Script de prueba final para el asistente legal mejorado
 */

const testQuery = "como inicio una prescripcion adquisitiva";

async function testLegalFixed() {
  console.log('🚀 PRUEBA FINAL - ASISTENTE LEGAL MEJORADO');
  console.log('📋 Query de prueba:', testQuery);
  console.log('=' .repeat(60));

  try {
    // Test con el endpoint legal mejorado
    console.log('\n🎯 TEST: Endpoint Legal Mejorado');
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
      
      console.log('\n📝 RESPUESTA COMPLETA:');
      console.log('=' .repeat(80));
      console.log(responseText);
      console.log('=' .repeat(80));
      
      console.log('\n🔍 ANÁLISIS DE CALIDAD:');
      console.log('📏 Longitud de la respuesta:', responseText.length, 'caracteres');
      console.log('🎯 ¿Contiene "prescripción"?', responseText.toLowerCase().includes('prescripción'));
      console.log('🎯 ¿Contiene "requisitos"?', responseText.toLowerCase().includes('requisitos'));
      console.log('🎯 ¿Contiene "código civil"?', responseText.toLowerCase().includes('código civil'));
      console.log('🎯 ¿Contiene "fuentes"?', responseText.toLowerCase().includes('fuentes'));
      console.log('🎯 ¿Contiene "artículo"?', responseText.toLowerCase().includes('artículo'));
      
      // Verificar si tiene estructura correcta
      const hasStructure = responseText.includes('## 📋') || 
                          responseText.includes('## ⚖️') || 
                          responseText.includes('## 🔍') ||
                          responseText.includes('## ✅');
      console.log('📋 ¿Tiene estructura?', hasStructure);
      
      // Verificar si no es genérica
      const isGeneric = responseText.includes('Según la información encontrada') ||
                       responseText.includes('Esta información se basa en') ||
                       responseText.includes('Marco Normativo:');
      console.log('❌ ¿Es respuesta genérica?', isGeneric);
      
      if (!isGeneric && hasStructure && responseText.includes('prescripción')) {
        console.log('\n🎉 ¡ÉXITO! La respuesta es específica y bien estructurada');
      } else {
        console.log('\n⚠️ La respuesta aún necesita mejoras');
      }
      
    } else {
      console.error('❌ Error en endpoint legal:', legalResponse.status, legalResponse.statusText);
      const errorText = await legalResponse.text();
      console.error('📄 Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 PRUEBA FINAL COMPLETADA');
  console.log('💡 Revisa la respuesta para verificar la calidad');
}

// Ejecutar prueba
console.log('🔬 PRUEBA FINAL DEL SISTEMA MEJORADO');
console.log('=' .repeat(60));
console.log('📋 Verificando que las mejoras funcionen correctamente');
console.log('');

testLegalFixed().catch(console.error);
