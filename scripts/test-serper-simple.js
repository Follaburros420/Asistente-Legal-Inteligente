/**
 * Script de prueba simple para Serper API
 * Verifica la configuración básica sin dependencias complejas
 */

// Cargar variables de entorno
require('dotenv').config({ path: '.env' });

async function testSerperBasic() {
  console.log('🧪 PRUEBA BÁSICA DE SERPER API');
  console.log('='.repeat(50));

  // Verificar API key
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey || apiKey === 'your_serper_api_key_here') {
    console.error('❌ SERPER_API_KEY no está configurada o usa el valor por defecto');
    console.log('💡 Por favor, configura tu API key real de Serper en el archivo .env');
    console.log('📝 Ejemplo: SERPER_API_KEY=tu_api_key_real_aqui');
    return false;
  }

  console.log('✅ SERPER_API_KEY configurada');
  console.log('🔑 API Key (primeros 10 caracteres):', apiKey.substring(0, 10) + '...');

  // Probar conexión básica con Serper API
  console.log('\n🌐 Probando conexión con Serper API...');
  
  try {
    const testQuery = 'Código Civil Colombiano';
    const searchUrl = 'https://google.serper.dev/search';
    
    const requestBody = {
      q: testQuery,
      num: 3
    };

    console.log('📤 Enviando query de prueba:', testQuery);
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Respuesta HTTP:', response.status, response.statusText);

    if (!response.ok) {
      if (response.status === 401) {
        console.error('❌ Error 401: API key inválida o no autorizada');
        console.log('💡 Verifica que tu API key sea correcta y esté activa');
      } else if (response.status === 429) {
        console.error('❌ Error 429: Límite de cuota alcanzado');
        console.log('💡 Considera upgrade tu plan de Serper');
      } else {
        console.error('❌ Error HTTP:', response.status, response.statusText);
      }
      return false;
    }

    const data = await response.json();
    
    if (data.organic && data.organic.length > 0) {
      console.log('✅ Conexión exitosa con Serper API');
      console.log(`📊 Resultados obtenidos: ${data.organic.length}`);
      
      console.log('\n📋 Primeros resultados:');
      data.organic.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.title}`);
        console.log(`      URL: ${result.link}`);
        console.log(`      Snippet: ${result.snippet?.substring(0, 100)}...`);
        console.log('');
      });
      
      return true;
    } else {
      console.log('⚠️ La respuesta no contiene resultados orgánicos');
      console.log('📄 Respuesta completa:', JSON.stringify(data, null, 2));
      return false;
    }

  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('💡 Problema de conexión a internet o DNS');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Conexión rechazada, verifica tu firewall');
    }
    
    return false;
  }
}

// Función para probar búsqueda especializada
async function testSpecializedSearch() {
  console.log('\n🏛️ PRUEBA DE BÚSQUEDA ESPECIALIZADA');
  console.log('='.repeat(50));

  const apiKey = process.env.SERPER_API_KEY;
  
  try {
    // Query especializada para fuentes gubernamentales
    const officialQuery = 'Ley 1564 de 2012 site:gov.co OR site:secretariasenado.gov.co';
    
    const searchUrl = 'https://google.serper.dev/search';
    const requestBody = {
      q: officialQuery,
      num: 5
    };

    console.log('📤 Query especializada:', officialQuery);

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.organic && data.organic.length > 0) {
        console.log('✅ Búsqueda especializada exitosa');
        console.log('📊 Resultados de fuentes oficiales:');
        
        data.organic.forEach((result, index) => {
          const isOfficial = result.link.includes('.gov.co') || 
                           result.link.includes('secretariasenado.gov.co') ||
                           result.link.includes('corteconstitucional.gov.co');
          
          console.log(`   ${index + 1}. ${result.title}`);
          console.log(`      URL: ${result.link}`);
          console.log(`      Oficial: ${isOfficial ? '✅' : '❌'}`);
          console.log('');
        });
        
        return true;
      }
    }
    
    console.log('⚠️ La búsqueda especializada no produjo resultados');
    return false;
    
  } catch (error) {
    console.error('❌ Error en búsqueda especializada:', error.message);
    return false;
  }
}

// Ejecutar pruebas
async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS DE MIGRACIÓN A SERPER API');
  console.log('📅 Fecha:', new Date().toLocaleString('es-CO'));
  console.log('');

  const basicTest = await testSerperBasic();
  
  if (basicTest) {
    const specializedTest = await testSpecializedSearch();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS');
    console.log('='.repeat(60));
    console.log(`✅ Prueba básica: ${basicTest ? 'EXITOSA' : 'FALLIDA'}`);
    console.log(`✅ Prueba especializada: ${specializedTest ? 'EXITOSA' : 'FALLIDA'}`);
    
    if (basicTest && specializedTest) {
      console.log('\n🎉 ¡MIGRACIÓN A SERPER API COMPLETADA CON ÉXITO!');
      console.log('💡 El sistema está listo para usar Serper API');
      console.log('🔍 Los endpoints legales ahora usarán Serper API para búsquedas');
    } else {
      console.log('\n⚠️ ALGUNAS PRUEBAS FALLARON');
      console.log('💡 Revisa la configuración y los errores mostrados arriba');
    }
  } else {
    console.log('\n❌ LA PRUEBA BÁSICA FALLÓ');
    console.log('💡 Corrige los problemas de configuración antes de continuar');
  }
}

// Ejecutar
runTests().catch(console.error);
