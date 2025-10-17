/**
 * Script para probar el sistema legal directamente sin streaming
 */

const testQuery = "como inicio una prescripcion adquisitiva";

async function testLegalDirect() {
  console.log('🚀 PRUEBA DIRECTA - ASISTENTE LEGAL MEJORADO');
  console.log('📋 Query de prueba:', testQuery);
  console.log('=' .repeat(60));

  try {
    // Test directo sin streaming
    console.log('\n🎯 TEST: Petición directa sin streaming');
    console.log('-'.repeat(40));
    
    const legalResponse = await fetch('http://localhost:3000/api/chat/legal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatSettings: {
          model: 'alibaba/tongyi-deepresearch-30b-a3b:free',
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

    console.log('📊 Status:', legalResponse.status);
    console.log('📊 Status Text:', legalResponse.statusText);
    console.log('📊 Headers:', Object.fromEntries(legalResponse.headers.entries()));
    
    if (legalResponse.ok) {
      // Intentar leer como texto plano primero
      const responseText = await legalResponse.text();
      console.log('\n📝 RESPUESTA COMPLETA (texto plano):');
      console.log('=' .repeat(80));
      console.log(responseText);
      console.log('=' .repeat(80));
      console.log('📏 Longitud:', responseText.length);
      
      // Intentar procesar como streaming si tiene formato SSE
      if (responseText.includes('data: ') || responseText.includes('0:')) {
        console.log('\n🔄 Procesando como streaming...');
        const lines = responseText.split('\n');
        let streamingContent = '';
        
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const content = JSON.parse(line.slice(2));
              streamingContent += content;
            } catch (e) {
              console.log('⚠️ Error parsing line:', line);
            }
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                streamingContent += parsed.choices[0].delta.content;
              }
            } catch (e) {
              console.log('⚠️ Error parsing SSE:', line);
            }
          }
        }
        
        if (streamingContent) {
          console.log('\n📝 CONTENIDO PROCESADO:');
          console.log('=' .repeat(80));
          console.log(streamingContent);
          console.log('=' .repeat(80));
          
          // Análisis de calidad
          console.log('\n🔍 ANÁLISIS DE CALIDAD:');
          console.log('📏 Longitud:', streamingContent.length);
          console.log('🎯 ¿Contiene "prescripción"?', streamingContent.toLowerCase().includes('prescripción'));
          console.log('🎯 ¿Contiene "requisitos"?', streamingContent.toLowerCase().includes('requisitos'));
          console.log('🎯 ¿Contiene "código civil"?', streamingContent.toLowerCase().includes('código civil'));
          console.log('🎯 ¿Contiene "fuentes"?', streamingContent.toLowerCase().includes('fuentes'));
          console.log('🎯 ¿Contiene "artículo"?', streamingContent.toLowerCase().includes('artículo'));
          
          const hasStructure = streamingContent.includes('## 📋') || 
                              streamingContent.includes('## ⚖️') || 
                              streamingContent.includes('## 🔍') ||
                              streamingContent.includes('## ✅');
          console.log('📋 ¿Tiene estructura?', hasStructure);
          
          const isGeneric = streamingContent.includes('Según la información encontrada') ||
                           streamingContent.includes('Esta información se basa en') ||
                           streamingContent.includes('Marco Normativo:');
          console.log('❌ ¿Es respuesta genérica?', isGeneric);
          
          if (!isGeneric && hasStructure && streamingContent.includes('prescripción')) {
            console.log('\n🎉 ¡ÉXITO! La respuesta es específica y bien estructurada');
          } else {
            console.log('\n⚠️ La respuesta necesita mejoras');
          }
        } else {
          console.log('\n❌ No se pudo procesar el contenido del streaming');
        }
      }
    } else {
      console.error('❌ Error en endpoint legal:', legalResponse.status, legalResponse.statusText);
      const errorText = await legalResponse.text();
      console.error('📄 Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    console.error('📄 Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 PRUEBA DIRECTA COMPLETADA');
  console.log('💡 Revisa los resultados para identificar el problema');
}

// Ejecutar prueba
console.log('🔬 PRUEBA DIRECTA DEL SISTEMA LEGAL');
console.log('=' .repeat(60));
console.log('📋 Verificando el procesamiento de la respuesta');
console.log('');

testLegalDirect().catch(console.error);
