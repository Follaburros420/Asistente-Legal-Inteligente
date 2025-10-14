#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

console.log('\n🔥 Probando Firecrawl Search...\n');

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY || 'fc-eb5dbfa5b2384e8eb5fac8218b4c66fa';

console.log(`🔑 API Key: ${firecrawlApiKey.substring(0, 8)}...${firecrawlApiKey.substring(firecrawlApiKey.length - 4)}`);

const query = 'Ozzy Osbourne muerte';
const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

console.log(`\n📍 Paso 1: Firecrawl Map (encontrar URLs)`);
console.log(`   Query: ${query}`);
console.log(`   Search URL: ${searchUrl}\n`);

// Paso 1: Firecrawl Map
fetch('https://api.firecrawl.dev/v1/map', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${firecrawlApiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: searchUrl,
    search: query,
    limit: 5
  })
})
  .then(response => {
    console.log(`📡 Respuesta Map: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }
    
    return response.json();
  })
  .then(data => {
    console.log(`\n✅ Map exitoso!`);
    console.log(`   Success: ${data.success}`);
    
    if (data.links && data.links.length > 0) {
      console.log(`\n📋 URLs encontradas (${data.links.length}):`);
      
      // Filtrar URLs válidas
      const validUrls = data.links
        .filter(url => 
          url && 
          url.startsWith('http') && 
          !url.includes('google.com') &&
          !url.includes('google.es')
        )
        .slice(0, 3);
      
      validUrls.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });
      
      if (validUrls.length === 0) {
        console.log('\n⚠️  No se encontraron URLs válidas (todas son de Google)');
        console.log('   Esto es normal, Firecrawl necesita una suscripción activa');
        console.log('   para acceder a resultados de búsqueda de Google.\n');
        process.exit(0);
      }
      
      // Paso 2: Probar Scrape con la primera URL
      console.log(`\n📄 Paso 2: Firecrawl Scrape (extraer contenido)`);
      console.log(`   URL: ${validUrls[0]}\n`);
      
      return fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: validUrls[0],
          formats: ['markdown'],
          onlyMainContent: true
        })
      });
      
    } else {
      console.log('\n⚠️  No se encontraron links en la respuesta');
      console.log('   Response:', JSON.stringify(data, null, 2));
      process.exit(0);
    }
  })
  .then(response => {
    if (!response) return null;
    
    console.log(`📡 Respuesta Scrape: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }
    
    return response.json();
  })
  .then(data => {
    if (!data) return;
    
    console.log(`\n✅ Scrape exitoso!`);
    console.log(`   Success: ${data.success}`);
    
    if (data.data) {
      console.log(`   Título: ${data.data.metadata?.title || 'N/A'}`);
      console.log(`   Contenido: ${data.data.markdown ? data.data.markdown.substring(0, 200) + '...' : 'N/A'}`);
    }
    
    console.log('\n🎉 ¡Firecrawl funciona correctamente!');
    console.log('\n✅ Tu API key es válida y puede:');
    console.log('   - Mapear URLs de búsquedas');
    console.log('   - Extraer contenido completo de páginas');
    console.log('\n📝 Nota: Si las URLs son solo de Google, es porque necesitas');
    console.log('   una suscripción premium para acceso completo a búsquedas.\n');
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














