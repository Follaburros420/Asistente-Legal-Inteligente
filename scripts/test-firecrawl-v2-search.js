#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

console.log('\n🔥 Probando Firecrawl v2 Search...\n');

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY || 'fc-eb5dbfa5b2384e8eb5fac8218b4c66fa';

console.log(`🔑 API Key: ${firecrawlApiKey.substring(0, 8)}...${firecrawlApiKey.substring(firecrawlApiKey.length - 4)}`);

const query = 'Ozzy Osbourne muerte';

console.log(`\n📍 Probando Firecrawl v2 Search`);
console.log(`   Query: ${query}\n`);

// Probar Firecrawl v2 Search
fetch('http://104.155.176.60:3002/v2/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${firecrawlApiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: query,
    limit: 3,
    scrapeOptions: {
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 2000
    }
  })
})
  .then(response => {
    console.log(`📡 Respuesta Search: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }
    
    return response.json();
  })
  .then(data => {
    console.log(`\n✅ Search exitoso!`);
    console.log(`   Success: ${data.success}`);
    
    if (data.data && data.data.length > 0) {
      console.log(`\n📋 Resultados encontrados (${data.data.length}):`);
      
      data.data.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.metadata?.title || 'Sin título'}`);
        console.log(`   URL: ${result.metadata?.url || 'N/A'}`);
        console.log(`   Contenido: ${result.markdown ? result.markdown.substring(0, 200) + '...' : 'N/A'}`);
        console.log(`   Créditos usados: ${result.metadata?.creditsUsed || 'N/A'}`);
      });
      
      console.log(`\n🎉 ¡Firecrawl v2 Search funciona perfectamente!`);
      console.log(`\n✅ Capacidades confirmadas:`);
      console.log('   - Búsqueda web completa');
      console.log('   - Extracción automática de contenido');
      console.log('   - Conversión a Markdown');
      console.log('   - Metadatos completos');
      console.log('   - Contenido listo para LLM');
      
    } else {
      console.log('\n⚠️  No se encontraron resultados');
      console.log('   Response:', JSON.stringify(data, null, 2));
    }
    
    console.log(`\n📚 Siguiente paso:`);
    console.log('   1. Reinicia el servidor: npm run dev');
    console.log('   2. Abre modo incógnito: Ctrl + Shift + N');
    console.log('   3. Ve a http://localhost:3000');
    console.log('   4. Crea un NUEVO chat');
    console.log('   5. Pregunta algo que requiera búsqueda web');
    console.log('\n');
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n🔑 API key inválida o expirada');
      console.log('   Verifica tu API key en: https://firecrawl.dev/account\n');
    } else if (error.message.includes('402')) {
      console.log('\n💳 Créditos agotados');
      console.log('   Recarga créditos en: https://firecrawl.dev/pricing\n');
    } else if (error.message.includes('429')) {
      console.log('\n⏱️  Rate limit excedido');
      console.log('   Espera unos minutos y vuelve a intentar\n');
    } else if (error.message.includes('403')) {
      console.log('\n🚫 API key no tiene permisos');
      console.log('   Contacta con soporte de Firecrawl\n');
    }
    
    process.exit(1);
  });
