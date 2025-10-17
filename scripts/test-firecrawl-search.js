#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

console.log('\n🔥 Probando Firecrawl Scrape...\n');

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY || 'fc-eb5dbfa5b2384e8eb5fac8218b4c66fa';

console.log(`🔑 API Key: ${firecrawlApiKey.substring(0, 8)}...${firecrawlApiKey.substring(firecrawlApiKey.length - 4)}`);

const query = 'Ozzy Osbourne muerte';
const testUrls = [
  'https://en.wikipedia.org/wiki/Ozzy_Osbourne',
  'https://www.biography.com/musician/ozzy-osbourne',
  'https://example.com'
];

console.log(`\n📍 Probando Firecrawl Scrape con URLs de prueba`);
console.log(`   Query: ${query}`);
console.log(`   URLs de prueba: ${testUrls.length}\n`);

// Probar scrape con URLs directas
let scrapePromises = testUrls.map((url, index) => {
  console.log(`📄 Probando scrape ${index + 1}: ${url}`);
  
  return fetch('http://104.155.176.60:3002/v0/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: url,
      pageOptions: {
        onlyMainContent: true,
        includeHtml: false,
        includeMarkdown: true
      }
    })
  })
  .then(response => {
    console.log(`📡 Respuesta Scrape ${index + 1}: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }
    
    return response.json();
  })
  .then(data => {
    console.log(`\n✅ Scrape ${index + 1} exitoso!`);
    console.log(`   Success: ${data.success}`);
    console.log(`   URL: ${data.data?.metadata?.url || 'N/A'}`);
    console.log(`   Título: ${data.data?.metadata?.title || 'N/A'}`);
    console.log(`   Contenido: ${data.data?.content ? data.data.content.substring(0, 200) + '...' : 'N/A'}`);
    console.log(`   Créditos usados: ${data.data?.metadata?.creditsUsed || 'N/A'}`);
    
    return {
      url: url,
      success: data.success,
      title: data.data?.metadata?.title || 'Sin título',
      content: data.data?.content || '',
      creditsUsed: data.data?.metadata?.creditsUsed || 0
    };
  })
  .catch(error => {
    console.error(`\n❌ Error en scrape ${index + 1}:`, error.message);
    return {
      url: url,
      success: false,
      title: 'Error',
      content: '',
      creditsUsed: 0,
      error: error.message
    };
  });
});

// Ejecutar todas las pruebas en paralelo
Promise.all(scrapePromises)
  .then(results => {
    console.log(`\n🎉 Pruebas completadas!`);
    
    const successful = results.filter(r => r.success).length;
    const totalCredits = results.reduce((sum, r) => sum + r.creditsUsed, 0);
    
    console.log(`\n📊 Resumen:`);
    console.log(`   URLs probadas: ${results.length}`);
    console.log(`   Exitosas: ${successful}`);
    console.log(`   Fallidas: ${results.length - successful}`);
    console.log(`   Créditos totales usados: ${totalCredits}`);
    
    if (successful > 0) {
      console.log(`\n✅ Firecrawl VPS funciona correctamente!`);
      console.log(`\n📚 Capacidades confirmadas:`);
      console.log('   - Extracción de contenido web');
      console.log('   - Conversión a Markdown');
      console.log('   - Metadatos (título, URL, etc.)');
      console.log('   - Manejo de diferentes tipos de sitios');
      
      console.log(`\n📝 URLs exitosas:`);
      results.filter(r => r.success).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.title} (${result.url})`);
      });
    } else {
      console.log(`\n❌ Todas las pruebas fallaron`);
      console.log(`\n🔍 Posibles causas:`);
      console.log('   - VPS no está funcionando correctamente');
      console.log('   - API key inválida');
      console.log('   - Problemas de conectividad');
      console.log('   - URLs de prueba no accesibles');
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
    console.error('\n❌ Error general:', error.message);
    process.exit(1);
  });