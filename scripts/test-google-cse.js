#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

console.log('\n🔍 Probando Google Custom Search Engine...\n');

const apiKey = process.env.GOOGLE_CSE_API_KEY || 'AIzaSyD5y97kpgw32Q5C6ujGKB6JafkD4Cv49TA';
const cx = process.env.GOOGLE_CSE_CX || '6464df08faf4548b9';

console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
console.log(`🔍 CX (Search Engine ID): ${cx}`);

const query = 'artículo 29 constitución Colombia';
const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=5`;

console.log(`\n📡 Buscando: "${query}"\n`);

fetch(url)
  .then(response => {
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 500)}`);
      });
    }
    
    return response.json();
  })
  .then(data => {
    if (!data.items || data.items.length === 0) {
      console.log('\n⚠️  No se encontraron resultados');
      console.log('\n📝 Respuesta completa:', JSON.stringify(data, null, 2));
      return;
    }
    
    console.log(`\n✅ Encontrados ${data.items.length} resultados:\n`);
    
    data.items.forEach((item, i) => {
      const isOfficial = item.link.includes('.gov.co');
      const icon = isOfficial ? '⚖️ ' : '';
      
      console.log(`${i + 1}. ${icon}${item.title}`);
      console.log(`   URL: ${item.link}`);
      console.log(`   Snippet: ${item.snippet.substring(0, 100)}...`);
      console.log('');
    });
    
    const officialCount = data.items.filter(item => item.link.includes('.gov.co')).length;
    
    console.log(`📊 Resumen:`);
    console.log(`   Total: ${data.items.length} resultados`);
    console.log(`   Oficiales (.gov.co): ${officialCount}`);
    console.log(`   Otros: ${data.items.length - officialCount}`);
    
    if (data.searchInformation) {
      console.log(`   Tiempo: ${data.searchInformation.searchTime} segundos`);
      console.log(`   Total disponibles: ${data.searchInformation.totalResults}`);
    }
    
    console.log('\n✅ Google CSE funciona correctamente!');
    console.log('\n📝 Siguiente paso:');
    console.log('   1. Reinicia el servidor: Ctrl+C, luego npm run dev');
    console.log('   2. Cierra TODO el navegador');
    console.log('   3. Modo incógnito nuevo');
    console.log('   4. Pregunta: "¿Qué dice el artículo 29 de la constitución?"');
    console.log('');
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('400')) {
      console.log('\n⚠️  Error 400: Verifica que el API Key y CX sean correctos');
      console.log('   API Key: https://console.cloud.google.com/apis/credentials');
      console.log('   CX: https://programmablesearchengine.google.com/');
    } else if (error.message.includes('403')) {
      console.log('\n⚠️  Error 403: API Key sin permisos o cuota excedida');
      console.log('   Verifica en: https://console.cloud.google.com/apis/api/customsearch.googleapis.com');
    } else if (error.message.includes('429')) {
      console.log('\n⚠️  Error 429: Límite de búsquedas excedido');
      console.log('   Límite gratuito: 100 búsquedas/día');
    }
    
    console.log('');
    process.exit(1);
  });














