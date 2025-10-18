#!/usr/bin/env node

/**
 * Script para probar la conexión con Serper API
 */

require('dotenv').config();

async function testSerperConnection() {
  console.log('\n🧪 PROBANDO CONEXIÓN CON SERPER API');
  console.log('='.repeat(50));
  
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey || apiKey === 'your_serper_api_key_here') {
    console.log('❌ SERPER_API_KEY no configurada o es placeholder');
    console.log('\n📝 Para configurar:');
    console.log('   1. Ve a https://serper.dev');
    console.log('   2. Crea cuenta gratuita');
    console.log('   3. Obtén API key');
    console.log('   4. Actualiza SERPER_API_KEY en .env');
    return;
  }
  
  console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
  
  try {
    console.log('\n🔍 Probando conexión...');
    
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: 'test colombia',
        num: 3
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Conexión exitosa!');
      console.log(`📊 Resultados encontrados: ${data.organic?.length || 0}`);
      
      if (data.organic && data.organic.length > 0) {
        console.log('\n📋 Primer resultado:');
        console.log(`   Título: ${data.organic[0].title}`);
        console.log(`   URL: ${data.organic[0].link}`);
        console.log(`   Snippet: ${data.organic[0].snippet?.substring(0, 100)}...`);
      }
      
      console.log('\n🎉 Serper está funcionando correctamente!');
      
    } else {
      console.log(`❌ Error ${response.status}: ${response.statusText}`);
      
      if (response.status === 403) {
        console.log('\n🔧 Posibles soluciones:');
        console.log('   1. Verificar que la API key sea correcta');
        console.log('   2. Verificar que la cuenta tenga créditos');
        console.log('   3. Verificar que no haya límites de rate');
      }
    }
    
  } catch (error) {
    console.log(`❌ Error de conexión: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(50));
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testSerperConnection().catch(console.error);
}

module.exports = { testSerperConnection };
