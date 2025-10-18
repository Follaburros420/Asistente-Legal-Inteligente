/**
 * Script de prueba para Serper API
 * Verifica que la migración de Google CSE a Serper funcione correctamente
 */

const { searchWebEnhanced } = require('../lib/tools/enhanced-web-search.ts');
const { searchWebSimple } = require('../lib/tools/simple-web-search.ts');

async function testSerperAPI() {
  console.log('🧪 INICIANDO PRUEBAS DE SERPER API');
  console.log('='.repeat(60));

  // Verificar que la API key esté configurada
  if (!process.env.SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY no está configurada en las variables de entorno');
    console.log('💡 Por favor, configura tu API key de Serper en el archivo .env');
    return;
  }

  console.log('✅ SERPER_API_KEY configurada correctamente');
  console.log('');

  // Pruebas de búsqueda
  const testQueries = [
    'Código Civil Colombiano prescripción adquisitiva',
    'Ley 1564 de 2012 Código General del Proceso',
    'Corte Constitucional Colombia sentencias',
    'derecho contractual Colombia'
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n🔍 PRUEBA ${i + 1}: "${query}"`);
    console.log('-'.repeat(50));

    try {
      // Probar búsqueda simple
      console.log('📋 Probando búsqueda simple...');
      const simpleResult = await searchWebSimple(query, 3);
      
      if (simpleResult.success) {
        console.log(`✅ Búsqueda simple exitosa: ${simpleResult.results.length} resultados`);
        simpleResult.results.forEach((result, idx) => {
          console.log(`   ${idx + 1}. ${result.title}`);
          console.log(`      Fuente: ${result.source}`);
          console.log(`      URL: ${result.url.substring(0, 50)}...`);
        });
      } else {
        console.log(`❌ Búsqueda simple fallida: ${simpleResult.error}`);
      }

      console.log('');

      // Probar búsqueda enhanced
      console.log('📋 Probando búsqueda enhanced...');
      const enhancedResult = await searchWebEnhanced(query, 3);
      
      if (enhancedResult.success) {
        console.log(`✅ Búsqueda enhanced exitosa: ${enhancedResult.results.length} resultados`);
        console.log(`   Nivel de búsqueda: ${enhancedResult.searchLevel}`);
        enhancedResult.results.forEach((result, idx) => {
          console.log(`   ${idx + 1}. ${result.title}`);
          console.log(`      Tipo: ${result.type} | Score: ${result.score}`);
          console.log(`      Fuente: ${result.source}`);
        });
      } else {
        console.log(`❌ Búsqueda enhanced fallida: ${enhancedResult.error}`);
      }

    } catch (error) {
      console.error(`❌ Error en prueba ${i + 1}:`, error.message);
    }

    console.log('\n' + '='.repeat(60));
  }

  console.log('\n🎉 PRUEBAS COMPLETADAS');
  console.log('💡 Si todas las pruebas fueron exitosas, la migración a Serper API está funcionando correctamente');
}

// Ejecutar pruebas
testSerperAPI().catch(console.error);
