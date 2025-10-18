/**
 * Script para diagnosticar el problema de autenticación con OpenRouter
 * 
 * IMPORTANTE: Configura la variable de entorno OPENROUTER_API_KEY
 * Ejemplo: OPENROUTER_API_KEY=tu_clave_aqui node test-openrouter-connection.js
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "TU_CLAVE_OPENROUTER_AQUI";

async function testOpenRouterConnection() {
  console.log('🔍 DIAGNÓSTICO DE CONEXIÓN CON OPENROUTER');
  console.log('=' .repeat(60));
  console.log('🔑 API Key:', OPENROUTER_API_KEY.substring(0, 10) + '...');
  
  try {
    // Test 1: Verificar conexión básica con OpenRouter
    console.log('\n🎯 TEST 1: Conexión básica con OpenRouter API');
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

    console.log('📊 Status:', response.status);
    console.log('📊 Status Text:', response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Conexión exitosa con OpenRouter');
      console.log('📊 Modelos disponibles:', data.data?.length || 0);
      
      // Buscar modelo GPT-4o
      const gpt4o = data.data?.find(model => model.id.includes('gpt-4o'));
      if (gpt4o) {
        console.log('✅ Modelo GPT-4o encontrado:', gpt4o.id);
      } else {
        console.log('⚠️ Modelo GPT-4o no encontrado');
      }
      
    } else {
      const errorText = await response.text();
      console.error('❌ Error en conexión con OpenRouter:');
      console.error('📄 Error details:', errorText);
      
      if (response.status === 401) {
        console.error('🚨 ERROR 401: API Key inválida o expirada');
      } else if (response.status === 403) {
        console.error('🚨 ERROR 403: Permiso denegado');
      } else if (response.status === 429) {
        console.error('🚨 ERROR 429: Límite de velocidad excedido');
      }
    }

  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
  }

  try {
    // Test 2: Probar una solicitud de chat simple
    console.log('\n🎯 TEST 2: Solicitud de chat simple');
    console.log('-'.repeat(40));
    
    const chatResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Legal Assistant Colombia'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
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

    console.log('📊 Status:', chatResponse.status);
    console.log('📊 Status Text:', chatResponse.statusText);
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('✅ Solicitud de chat exitosa');
      console.log('📝 Respuesta:', chatData.choices?.[0]?.message?.content?.substring(0, 100) + '...');
      console.log('🎯 Modelo usado:', chatData.model);
      console.log('📊 Tokens usados:', chatData.usage?.total_tokens || 0);
      
    } else {
      const errorText = await chatResponse.text();
      console.error('❌ Error en solicitud de chat:');
      console.error('📄 Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error en solicitud de chat:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 DIAGNÓSTICO COMPLETADO');
  console.log('💡 Revisa los resultados para identificar el problema');
}

// Ejecutar diagnóstico
console.log('🚀 INICIANDO DIAGNÓSTICO DE OPENROUTER');
console.log('=' .repeat(60));
console.log('📋 Verificando conexión y autenticación con OpenRouter API');
console.log('');

testOpenRouterConnection().catch(console.error);
