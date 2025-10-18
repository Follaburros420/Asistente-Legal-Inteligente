#!/usr/bin/env node

/**
 * Script simple para probar Serper directamente
 */

require('dotenv').config();

async function testSerperDirect() {
  console.log('\n🧪 PROBANDO SERPER DIRECTAMENTE');
  console.log('='.repeat(50));
  
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey || apiKey === 'your_serper_api_key_here') {
    console.log('❌ SERPER_API_KEY no configurada');
    return;
  }
  
  console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
  
  const testQueries = [
    'artículo 700 código civil',
    'prescripción colombia',
    'tutela constitucional'
  ];
  
  for (const query of testQueries) {
    console.log(`\n🔍 Probando: "${query}"`);
    
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          num: 3
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Éxito: ${data.organic?.length || 0} resultados`);
        
        if (data.organic && data.organic.length > 0) {
          console.log(`   📋 Primer resultado: ${data.organic[0].title}`);
        }
      } else {
        console.log(`   ❌ Error ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
}

testSerperDirect().catch(console.error);
