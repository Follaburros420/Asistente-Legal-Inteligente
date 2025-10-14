#!/usr/bin/env node

/**
 * Script para probar la configuración de OpenRouter
 */

const fetch = require('node-fetch');

async function testOpenRouter() {
  console.log('🧪 Probando configuración de OpenRouter...\n');

  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.log('❌ OPENROUTER_API_KEY no está configurada');
    return;
  }

  console.log('✅ OPENROUTER_API_KEY encontrada');
  console.log(`🔑 Clave: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);

  try {
    console.log('\n🔄 Probando API de OpenRouter...');
    
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Asistente Legal Inteligente'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'Prueba de embedding con OpenRouter'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ OpenRouter API funcionando correctamente');
      console.log(`📊 Embedding generado: ${data.data[0].embedding.length} dimensiones`);
      console.log('🎉 ¡Configuración exitosa!');
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ Error en OpenRouter API:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${errorData.error?.message || response.statusText}`);
    }
  } catch (error) {
    console.log('❌ Error de conexión:');
    console.log(`   ${error.message}`);
  }
}

testOpenRouter();















