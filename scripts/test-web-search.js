// Cargar variables de entorno manualmente
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    // Ignorar comentarios y líneas vacías
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
        console.log(`   Cargada: ${key.trim()}`);
      }
    }
  });
  console.log('✅ Variables de entorno cargadas manualmente');
  console.log('🔍 Debug - Variables cargadas:');
  console.log('   GOOGLE_CSE_API_KEY:', process.env.GOOGLE_CSE_API_KEY ? '✅' : '❌');
  console.log('   GOOGLE_CSE_CX:', process.env.GOOGLE_CSE_CX ? '✅' : '❌');
} else {
  console.log('❌ Archivo .env.local no encontrado');
}

async function testWebSearch() {
  console.log('\n🔥 TEST: Búsqueda Web Obligatoria');
  console.log('=====================================\n');

  // Verificar variables de entorno
  console.log('🔑 Variables de entorno:');
  console.log('   GOOGLE_CSE_API_KEY:', process.env.GOOGLE_CSE_API_KEY ? '✅ Configurada' : '❌ Faltante');
  console.log('   GOOGLE_CSE_CX:', process.env.GOOGLE_CSE_CX ? '✅ Configurada' : '❌ Faltante');
  console.log('   OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '✅ Configurada' : '❌ Faltante');
  console.log('   FIRECRAWL_API_KEY:', process.env.FIRECRAWL_API_KEY ? '✅ Configurada' : '❌ Faltante');

  // Verificar que el archivo .env.local existe
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env.local');
  console.log('   .env.local existe:', fs.existsSync(envPath) ? '✅ Sí' : '❌ No');
  console.log('   Ruta:', envPath);

  try {
    // Simular la función de búsqueda directamente
    console.log('🔍 Simulando búsqueda web...');
    
    // Test directo de Google CSE API
    const testQuery = "derecho a la vida constitución colombiana";
    const cseApiKey = process.env.GOOGLE_CSE_API_KEY || 'AIzaSyD5y97kpgw32Q5C6ujGKB6JafkD4Cv49TA';
    const cseCx = process.env.GOOGLE_CSE_CX || '6464df08faf4548b9';
    
    console.log('🔑 Usando API Key:', cseApiKey.substring(0, 10) + '...');
    console.log('🔑 Usando CX:', cseCx);
    
    console.log('📡 Haciendo petición a Google CSE...');
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${cseApiKey}&cx=${cseCx}&q=${encodeURIComponent(testQuery)}&num=5`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    console.log('📊 Respuesta de Google CSE:', {
      success: !data.error,
      resultsCount: data.items?.length || 0,
      hasResults: !!(data.items && data.items.length > 0)
    });
    
    if (data.error) {
      console.log('❌ Error de Google CSE:', data.error);
    } else if (data.items && data.items.length > 0) {
      console.log('✅ Búsqueda exitosa!');
      console.log('📚 Primeros 3 resultados:');
      data.items.slice(0, 3).forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.title}`);
        console.log(`      URL: ${item.link}`);
        console.log(`      Snippet: ${item.snippet.substring(0, 100)}...`);
      });
    } else {
      console.log('⚠️ Sin resultados');
    }
    
  } catch (error) {
    console.error('\n❌ Error en test:', error);
  }
}

testWebSearch();
