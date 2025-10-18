/**
 * Script para probar conexión con API alternatives
 * 
 * IMPORTANTE: Configura las siguientes variables de entorno:
 * - OPENAI_API_KEY: Tu clave API de OpenAI
 * - OPENROUTER_API_KEY: Tu clave API de OpenRouter
 * 
 * Ejemplo de uso:
 * OPENAI_API_KEY=tu_clave_aqui OPENROUTER_API_KEY=tu_clave_aqui node test-alternative-connection.js
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "TU_CLAVE_OPENAI_AQUI";

async function testAlternativeConnections() {
  console.log('🔍 DIAGNÓSTICO DE CONEXIONES ALTERNATIVAS');
  console.log('=' .repeat(60));
  
  // Test 1: Probar con OpenAI directamente
  console.log('\n🎯 TEST 1: Conexión con OpenAI API');
  console.log('-'.repeat(40));
  
  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Status OpenAI:', openaiResponse.status);
    console.log('📊 Status Text:', openaiResponse.statusText);
    
    if (openaiResponse.ok) {
      const data = await openaiResponse.json();
      console.log('✅ Conexión exitosa con OpenAI');
      console.log('📊 Modelos disponibles:', data.data?.length || 0);
      
      // Buscar modelo GPT-4o
      const gpt4o = data.data?.find(model => model.id.includes('gpt-4o'));
      if (gpt4o) {
        console.log('✅ Modelo GPT-4o encontrado:', gpt4o.id);
        
        // Probar una solicitud de chat
        console.log('\n🎯 TEST 2: Solicitud de chat con OpenAI');
        console.log('-'.repeat(40));
        
        const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o',
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
          console.log('✅ Solicitud de chat exitosa con OpenAI');
          console.log('📝 Respuesta:', chatData.choices?.[0]?.message?.content?.substring(0, 100) + '...');
          console.log('🎯 Modelo usado:', chatData.model);
          console.log('📊 Tokens usados:', chatData.usage?.total_tokens || 0);
          
          return { success: true, provider: 'openai', model: 'gpt-4o' };
          
        } else {
          const errorText = await chatResponse.text();
          console.error('❌ Error en chat con OpenAI:', errorText);
        }
      }
    } else {
      const errorText = await openaiResponse.text();
      console.error('❌ Error en conexión con OpenAI:', errorText);
    }
  } catch (error) {
    console.error('❌ Error de conexión con OpenAI:', error.message);
  }

  // Test 3: Probar con un modelo gratuito de OpenRouter
  console.log('\n🎯 TEST 3: Intentar con modelo gratuito en OpenRouter');
  console.log('-'.repeat(40));
  
  try {
    const freeModelResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || "TU_CLAVE_OPENROUTER_AQUI"}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Legal Assistant Colombia'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
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

    console.log('📊 Status Modelo Gratuito:', freeModelResponse.status);
    console.log('📊 Status Text:', freeModelResponse.statusText);
    
    if (freeModelResponse.ok) {
      const chatData = await freeModelResponse.json();
      console.log('✅ Solicitud con modelo gratuito exitosa');
      console.log('📝 Respuesta:', chatData.choices?.[0]?.message?.content?.substring(0, 100) + '...');
      
      return { success: true, provider: 'openrouter-free', model: 'meta-llama/llama-3.2-3b-instruct:free' };
      
    } else {
      const errorText = await freeModelResponse.text();
      console.error('❌ Error con modelo gratuito:', errorText);
    }
  } catch (error) {
    console.error('❌ Error con modelo gratuito:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 DIAGNÓSTICO DE ALTERNATIVAS COMPLETADO');
  console.log('💡 Si ninguna opción funciona, necesitas una nueva API key de OpenRouter');
  
  return { success: false, provider: null, model: null };
}

// Ejecutar diagnóstico
console.log('🚀 INICIANDO DIAGNÓSTICO DE CONEXIONES ALTERNATIVAS');
console.log('=' .repeat(60));
console.log('📋 Verificando opciones alternativas para OpenRouter');
console.log('');

testAlternativeConnections().then(result => {
  console.log('\n🎯 RESULTADO FINAL:');
  if (result.success) {
    console.log(`✅ Conexión exitosa con ${result.provider} usando ${result.model}`);
    console.log('💡 Podemos usar esta configuración para probar el sistema legal');
  } else {
    console.log('❌ No se encontraron conexiones funcionales');
    console.log('🔑 Necesitas generar una nueva API key de OpenRouter');
    console.log('📗 Ve a: https://openrouter.ai/keys');
  }
}).catch(console.error);
