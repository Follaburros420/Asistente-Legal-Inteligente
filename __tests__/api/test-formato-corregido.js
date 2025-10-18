/**
 * Script para probar el formato corregido del endpoint simple-direct
 */

const testQuery = "Cual es el articulo 82 del cgp";

async function testFormatoCorregido() {
  console.log('🧪 PRUEBA DE FORMATO CORREGIDO');
  console.log('📋 Query de prueba:', testQuery);
  console.log('=' .repeat(60));

  try {
    console.log('\n🎯 TEST: Endpoint simple-direct con formato corregido');
    console.log('-'.repeat(40));
    
    const response = await fetch('http://localhost:3000/api/chat/simple-direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: testQuery
          }
        ]
      })
    });

    console.log('📊 Status:', response.status);
    console.log('📊 Status Text:', response.statusText);
    console.log('📊 Content-Type:', response.headers.get('content-type'));
    
    if (response.ok) {
      // Verificar que sea texto plano
      const contentType = response.headers.get('content-type') || '';
      const isPlainText = contentType.includes('text/plain');
      console.log('📄 Es texto plano:', isPlainText);
      
      if (isPlainText) {
        // Leer como texto plano
        const responseText = await response.text();
        console.log('\n📝 RESPUESTA (texto plano):');
        console.log('=' .repeat(80));
        console.log(responseText.substring(0, 1000) + '...');
        console.log('=' .repeat(80));
        console.log('📏 Longitud total:', responseText.length);
        
        // Análisis de calidad
        console.log('\n🔍 ANÁLISIS DE CALIDAD:');
        console.log('📏 Longitud:', responseText.length);
        console.log('🎯 ¿Contiene "artículo 82"?', responseText.toLowerCase().includes('artículo 82'));
        console.log('🎯 ¿Contiene "código general"?', responseText.toLowerCase().includes('código general'));
        console.log('🎯 ¿Contiene "requisitos"?', responseText.toLowerCase().includes('requisitos'));
        console.log('🎯 ¿Contiene "demandas"?', responseText.toLowerCase().includes('demandas'));
        console.log('🎯 ¿Contiene "marco normativo"?', responseText.toLowerCase().includes('marco normativo'));
        
        const hasStructure = responseText.includes('**Marco Normativo**') || 
                            responseText.includes('**Artículo Específico**') || 
                            responseText.includes('**Contenido Detallado**');
        console.log('📋 ¿Tiene estructura?', hasStructure);
        
        const hasSources = responseText.includes('## 📚 Fuentes Consultadas');
        console.log('📚 ¿Tiene fuentes?', hasSources);
        
        // Verificar que no sea un objeto JSON
        const isJsonObject = responseText.trim().startsWith('{') && responseText.trim().endsWith('}');
        console.log('❌ ¿Es objeto JSON?', isJsonObject);
        
        if (!isJsonObject && hasStructure && responseText.includes('artículo 82')) {
          console.log('\n🎉 ¡ÉXITO! Formato corregido funcionando perfectamente');
          console.log('✅ Respuesta en texto plano');
          console.log('✅ Con estructura profesional');
          console.log('✅ Contenido relevante');
          console.log('✅ Sin objeto JSON');
        } else {
          console.log('\n⚠️ La respuesta necesita ajustes');
          if (isJsonObject) {
            console.log('❌ Todavía devuelve objeto JSON');
          }
          if (!hasStructure) {
            console.log('❌ No tiene estructura adecuada');
          }
          if (!responseText.includes('artículo 82')) {
            console.log('❌ No contiene contenido específico');
          }
        }
      } else {
        // Si no es texto plano, mostrar como está
        const responseText = await response.text();
        console.log('\n❌ Respuesta no es texto plano:');
        console.log(responseText.substring(0, 500) + '...');
      }
    } else {
      console.error('❌ Error en endpoint:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('📄 Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 PRUEBA DE FORMATO CORREGIDO COMPLETADA');
}

// Ejecutar prueba
console.log('🔬 VERIFICANDO FORMATO CORREGIDO');
console.log('=' .repeat(60));
console.log('📋 Probando que el endpoint devuelva texto plano, no JSON');
console.log('');

testFormatoCorregido().catch(console.error);
