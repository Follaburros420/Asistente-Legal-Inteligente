#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

console.log('\n🔥 Verificando Firecrawl...\n');

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

if (!firecrawlApiKey) {
  console.log('❌ FIRECRAWL_API_KEY NO encontrada en .env');
  console.log('\n📝 Para agregar:');
  console.log('1. Edita el archivo .env');
  console.log('2. Agrega: FIRECRAWL_API_KEY=fc-eb5dbfa5b2384e8eb5fac8218b4c66fa\n');
  process.exit(1);
}

console.log('✅ FIRECRAWL_API_KEY encontrada');
console.log(`   Key: ${firecrawlApiKey.substring(0, 8)}...${firecrawlApiKey.substring(firecrawlApiKey.length - 4)}`);

// Probar la API
console.log('\n🧪 Probando API de Firecrawl...');

fetch('https://api.firecrawl.dev/v1/account', {
  headers: {
    'Authorization': `Bearer ${firecrawlApiKey}`
  }
})
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('\n✅ API de Firecrawl funcionando correctamente!');
    console.log('\n📊 Información de cuenta:');
    console.log(`   Plan: ${data.plan || 'Unknown'}`);
    console.log(`   Créditos restantes: ${data.credits || 'Unknown'}`);
    
    if (data.credits !== undefined) {
      const searches = Math.floor(data.credits / 5);
      console.log(`   Búsquedas disponibles: ~${searches}`);
      
      if (data.credits < 50) {
        console.log('\n⚠️  ADVERTENCIA: Créditos bajos!');
        console.log('   Considera actualizar tu plan en: https://firecrawl.dev/pricing');
      }
    }
    
    console.log('\n🎉 Todo listo para usar Firecrawl!');
    console.log('\n📚 Siguiente paso:');
    console.log('   1. Espera 10 segundos para que compile');
    console.log('   2. Cierra TODO el navegador');
    console.log('   3. Abre modo incógnito: Ctrl + Shift + N');
    console.log('   4. Ve a http://localhost:3000');
    console.log('   5. Crea un NUEVO chat');
    console.log('   6. Pregunta: "¿Cuándo murió Ozzy Osbourne?"');
    console.log('\n');
  })
  .catch(error => {
    console.log('\n❌ Error al conectar con Firecrawl:');
    console.log(`   ${error.message}`);
    
    if (error.message.includes('401')) {
      console.log('\n🔑 API key inválida o expirada');
      console.log('   Verifica tu API key en: https://firecrawl.dev/account');
    } else if (error.message.includes('429')) {
      console.log('\n⏱️  Rate limit excedido');
      console.log('   Espera unos minutos o actualiza tu plan');
    } else if (error.message.includes('fetch failed')) {
      console.log('\n🌐 Error de conexión');
      console.log('   Verifica tu conexión a internet');
    }
    
    console.log('\n');
    process.exit(1);
  });














