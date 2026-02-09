/**
 * Script para verificar qué modelos están disponibles en OpenRouter
 * 
 * Ejecutar: node scripts/verify-models.js
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const MODELS_TO_TEST = [
  'google/gemini-3-pro-preview',
  'openai/gpt-5-mini',
  'google/gemini-2.0-flash-thinking-exp:free',
  'google/gemini-2.0-pro-exp-02-05',
  'google/gemini-1.5-pro-latest',
  'openai/gpt-4o-mini',
  'openai/gpt-4o'
];

async function fetchOpenRouterModels() {
  try {
    console.log('🔍 Obteniendo lista de modelos de OpenRouter...\n');
    
    const response = await fetch('https://openrouter.ai/api/v1/models');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const { data } = await response.json();
    
    console.log(`✅ ${data.length} modelos disponibles en OpenRouter\n`);
    
    // Filtrar modelos de Google y OpenAI
    const googleModels = data.filter(m => m.id.includes('google/'));
    const openaiModels = data.filter(m => m.id.includes('openai/'));
    
    console.log('🤖 MODELOS GOOGLE disponibles:');
    googleModels.forEach(m => {
      const isTarget = MODELS_TO_TEST.includes(m.id);
      console.log(`  ${isTarget ? '✅' : '  '} ${m.id}`);
      console.log(`     Contexto: ${m.context_length?.toLocaleString() || 'N/A'} tokens`);
      console.log(`     Descripción: ${m.description?.substring(0, 80) || 'N/A'}...`);
      console.log();
    });
    
    console.log('\n🤖 MODELOS OPENAI disponibles:');
    openaiModels.forEach(m => {
      const isTarget = MODELS_TO_TEST.includes(m.id);
      console.log(`  ${isTarget ? '✅' : '  '} ${m.id}`);
      console.log(`     Contexto: ${m.context_length?.toLocaleString() || 'N/A'} tokens`);
      console.log(`     Descripción: ${m.description?.substring(0, 80) || 'N/A'}...`);
      console.log();
    });
    
    // Verificar si nuestros modelos objetivo existen
    console.log('\n📋 VERIFICACIÓN DE MODELOS CONFIGURADOS:');
    MODELS_TO_TEST.forEach(modelId => {
      const exists = data.find(m => m.id === modelId);
      if (exists) {
        console.log(`  ✅ ${modelId} - DISPONIBLE`);
      } else {
        console.log(`  ❌ ${modelId} - NO ENCONTRADO`);
        
        // Sugerir alternativas
        const alternatives = data.filter(m => {
          if (modelId.includes('google/') && m.id.includes('google/')) return true;
          if (modelId.includes('openai/') && m.id.includes('openai/')) return true;
          return false;
        }).slice(0, 3);
        
        if (alternatives.length > 0) {
          console.log(`     Alternativas sugeridas:`);
          alternatives.forEach(alt => console.log(`       - ${alt.id}`));
        }
      }
    });
    
    return data;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function testModel(modelId) {
  if (!OPENROUTER_API_KEY) {
    console.log('⚠️ OPENROUTER_API_KEY no configurada, saltando prueba de modelo\n');
    return;
  }
  
  console.log(`🧪 Probando modelo: ${modelId}`);
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'user', content: 'Responde solo con la palabra OK' }
        ],
        max_tokens: 10
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ Modelo funciona correctamente`);
      console.log(`  Respuesta: ${data.choices?.[0]?.message?.content || 'N/A'}\n`);
    } else {
      const error = await response.text();
      console.log(`  ❌ Error: ${error}\n`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('VERIFICACIÓN DE MODELOS OPENROUTER');
  console.log('='.repeat(80));
  console.log();
  
  const models = await fetchOpenRouterModels();
  
  // Probar modelos principales si existe la API key
  if (OPENROUTER_API_KEY) {
    console.log('\n' + '='.repeat(80));
    console.log('PRUEBA DE MODELOS');
    console.log('='.repeat(80));
    console.log();
    
    for (const modelId of MODELS_TO_TEST) {
      const exists = models.find(m => m.id === modelId);
      if (exists) {
        await testModel(modelId);
      }
    }
  }
}

main();
