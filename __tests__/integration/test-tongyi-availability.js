/**
 * Script para verificar disponibilidad de Tongyi 30B en OpenRouter
 * 
 * IMPORTANTE: Configura la variable de entorno OPENROUTER_API_KEY
 * Ejemplo: OPENROUTER_API_KEY=tu_clave_aqui node test-tongyi-availability.js
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "TU_CLAVE_OPENROUTER_AQUI";

async function testTongyiAvailability() {
  console.log('🔍 VERIFICANDO DISPONIBILIDAD DE TONGYI 30B');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Listar modelos y buscar Tongyi
    console.log('\n🎯 TEST 1: Buscar modelo Tongyi Deep Research 30B');
    console.log('-'.repeat(40));
    
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Legal Assistant Colombia'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Conexión exitosa con OpenRouter');
      console.log('📊 Modelos disponibles:', data.data?.length || 0);
      
      // Buscar modelo Tongyi Deep Research 30B
      const tongyiModels = data.data?.filter(model => 
        model.id.includes('tongyi') || 
        model.id.includes('deepresearch') ||
        model.id.includes('30b')
      );
      
      console.log(`📊 Modelos Tongyi encontrados: ${tongyiModels.length}`);
      
      if (tongyiModels.length > 0) {
        tongyiModels.forEach(model => {
          console.log(`✅ Modelo: ${model.id}`);
          console.log(`   📝 Nombre: ${model.name}`);
          console.log(`   🏢 Proveedor: ${model.id.split('/')[0]}`);
          console.log(`   💰 Precio: ${model.pricing?.prompt || 'N/A'} per prompt`);
        });
        
        // Probar una solicitud con Tongyi Deep Research 30B
        const tongyiModel = tongyiModels.find(model => 
          model.id.includes('tongyi-deepresearch-30b')
        ) || tongyiModels[0];
        
        console.log('\n🎯 TEST 2: Probar solicitud con Tongyi');
        console.log('-'.repeat(40));
        console.log(`🎯 Usando modelo: ${tongyiModel.id}`);
        
        const chatResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Legal Assistant Colombia'
          },
          body: JSON.stringify({
            model: tongyiModel.id,
            messages: [
              {
                role: 'user',
                content: 'Responde brevemente: ¿Cuáles son los requisitos básicos para iniciar una prescripción adquisitiva en Colombia?'
              }
            ],
            temperature: 0.3,
            max_tokens: 200
          })
        });

        console.log('📊 Status Chat:', chatResponse.status);
        console.log('📊 Status Text:', chatResponse.statusText);
        
        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          console.log('✅ Solicitud con Tongyi exitosa');
          console.log('📝 Respuesta:', chatData.choices?.[0]?.message?.content?.substring(0, 100) + '...');
          console.log('🎯 Modelo usado:', chatData.model);
          console.log('📊 Tokens usados:', chatData.usage?.total_tokens || 0);
          
          return { success: true, model: tongyiModel.id };
          
        } else {
          const errorText = await chatResponse.text();
          console.error('❌ Error en chat con Tongyi:', errorText);
        }
      } else {
        console.log('⚠️ No se encontraron modelos Tongyi disponibles');
        console.log('💡 Mostrando primeros 5 modelos disponibles:');
        
        const firstModels = data.data?.slice(0, 5);
        firstModels.forEach(model => {
          console.log(`   📋 ${model.id} - ${model.name}`);
        });
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Error en conexión con OpenRouter:', errorText);
    }

  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 VERIFICACIÓN DE TONGYI COMPLETADA');
  
  return { success: false, model: null };
}

// Ejecutar verificación
console.log('🚀 INICIANDO VERIFICACIÓN DE TONGYI 30B');
console.log('=' .repeat(60));
console.log('📋 Verificando disponibilidad del modelo Tongyi Deep Research 30B');
console.log('');

testTongyiAvailability().then(result => {
  console.log('\n🎯 RESULTADO FINAL:');
  if (result.success) {
    console.log(`✅ Tongyi disponible: ${result.model}`);
    console.log('💡 Podemos usar este modelo para el sistema legal');
  } else {
    console.log('❌ Tongyi no disponible o con problemas');
    console.log('🔄 Usaremos modelo alternativo para pruebas');
  }
}).catch(console.error);
