#!/usr/bin/env node

/**
 * Script de diagnóstico para el sistema de búsqueda web
 * Testea todas las capas de búsqueda y muestra resultados detallados
 */

const { searchWebEnriched, searchWeb, searchWebWithFirecrawl } = require('../lib/tools/web-search.ts');

async function testSearchWithAnalysis(query) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 ANALIZANDO BÚSQUEDA: "${query}"`);
  console.log(`${"=".repeat(80)}`);
  
  const results = {
    query,
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Búsqueda enriquecida principal
  console.log(`\n📊 TEST 1: Búsqueda Enriquecida Principal`);
  console.log(`-`.repeat(50));
  try {
    const enriched = await searchWebEnriched(query);
    results.tests.push({
      name: 'Búsqueda Enriquecida',
      success: enriched.success,
      resultsCount: enriched.results?.length || 0,
      sources: enriched.results?.map(r => ({
        title: r.title,
        url: r.url,
        score: r.score,
        snippetLength: r.snippet?.length || 0
      })) || [],
      error: enriched.error
    });
    
    console.log(`✅ Éxito: ${enriched.success}`);
    console.log(`📊 Resultados: ${enriched.results?.length || 0}`);
    if (enriched.results?.length > 0) {
      console.log(`🏛️ Fuentes oficiales: ${enriched.results.filter(r => r.score === 3).length}`);
      console.log(`🎓 Fuentes académicas: ${enriched.results.filter(r => r.score === 2).length}`);
      console.log(`🌐 Otras fuentes: ${enriched.results.filter(r => r.score === 1).length}`);
      
      enriched.results.slice(0, 3).forEach((result, i) => {
        console.log(`\n   ${i + 1}. [${result.score === 3 ? 'OFICIAL' : result.score === 2 ? 'ACADEMICA' : 'GENERAL'}] ${result.title}`);
        console.log(`      URL: ${result.url}`);
        console.log(`      Snippet: ${result.snippet?.substring(0, 100)}...`);
      });
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    results.tests.push({
      name: 'Búsqueda Enriquecida',
      success: false,
      error: error.message
    });
  }

  // Test 2: Búsqueda Google CSE directa
  console.log(`\n📊 TEST 2: Búsqueda Google CSE Directa`);
  console.log(`-`.repeat(50));
  try {
    const cse = await searchWeb(query, 5);
    results.tests.push({
      name: 'Google CSE',
      success: cse.success,
      resultsCount: cse.results?.length || 0,
      sources: cse.results?.map(r => ({
        title: r.title,
        url: r.url,
        score: r.score
      })) || [],
      error: cse.error
    });
    
    console.log(`✅ Éxito: ${cse.success}`);
    console.log(`📊 Resultados: ${cse.results?.length || 0}`);
    if (cse.results?.length > 0) {
      cse.results.slice(0, 3).forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.title}`);
        console.log(`      ${result.url}`);
      });
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    results.tests.push({
      name: 'Google CSE',
      success: false,
      error: error.message
    });
  }

  // Test 3: Búsqueda con Firecrawl
  console.log(`\n📊 TEST 3: Búsqueda con Firecrawl`);
  console.log(`-`.repeat(50));
  try {
    const firecrawl = await searchWebWithFirecrawl(query, 3);
    results.tests.push({
      name: 'Firecrawl',
      success: firecrawl.success,
      resultsCount: firecrawl.results?.length || 0,
      sources: firecrawl.results?.map(r => ({
        title: r.title,
        url: r.url,
        score: r.score,
        snippetLength: r.snippet?.length || 0
      })) || [],
      error: firecrawl.error
    });
    
    console.log(`✅ Éxito: ${firecrawl.success}`);
    console.log(`📊 Resultados: ${firecrawl.results?.length || 0}`);
    if (firecrawl.results?.length > 0) {
      firecrawl.results.slice(0, 3).forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.title}`);
        console.log(`      Snippet length: ${result.snippet?.length || 0} chars`);
      });
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    results.tests.push({
      name: 'Firecrawl',
      success: false,
      error: error.message
    });
  }

  // Análisis de resultados
  console.log(`\n📈 ANÁLISIS COMPARATIVO`);
  console.log(`-`.repeat(50));
  const successfulTests = results.tests.filter(t => t.success);
  const failedTests = results.tests.filter(t => !t.success);
  
  console.log(`✅ Tests exitosos: ${successfulTests.length}/3`);
  console.log(`❌ Tests fallidos: ${failedTests.length}/3`);
  
  if (successfulTests.length > 0) {
    const totalResults = successfulTests.reduce((sum, t) => sum + t.resultsCount, 0);
    console.log(`📊 Total de resultados encontrados: ${totalResults}`);
    
    const allSources = successfulTests.flatMap(t => t.sources);
    const uniqueUrls = [...new Set(allSources.map(s => s.url))];
    console.log(`🔗 URLs únicas encontradas: ${uniqueUrls.length}`);
    
    // Detectar si hay Wikipedia
    const wikipediaSources = allSources.filter(s => s.url.includes('wikipedia.org'));
    if (wikipediaSources.length > 0) {
      console.log(`⚠️ ¡Wikipedia detectada! ${wikipediaSources.length} fuentes`);
    }
  }
  
  if (failedTests.length > 0) {
    console.log(`\n❌ ERRORES DETECTADOS:`);
    failedTests.forEach(test => {
      console.log(`   • ${test.name}: ${test.error}`);
    });
  }

  console.log(`\n${"=".repeat(80)}`);
  return results;
}

async function runDiagnosis() {
  console.log(`🚀 INICIANDO DIAGNÓSTICO COMPLETO DEL SISTEMA DE BÚSQUEDA`);
  console.log(`Hora: ${new Date().toLocaleString()}`);
  
  const testQueries = [
    'sofico',  // El caso problemático que mencionaste
    'articulo 1 constitucion politica',  // Consulta legal básica
    'prescripcion adquisitiva colombia',  // Consulta legal específica
    'que es blockchain',  // Consulta no legal
    'inteligencia artificial derecho'  // Consulta interdisciplinaria
  ];

  const allResults = [];
  
  for (const query of testQueries) {
    const result = await testSearchWithAnalysis(query);
    allResults.push(result);
    
    // Pequeña pausa entre tests para no sobrecargar APIs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Resumen final
  console.log(`\n🎯 RESUMEN FINAL DEL DIAGNÓSTICO`);
  console.log(`${"=".repeat(80)}`);
  
  allResults.forEach(result => {
    const successful = result.tests.filter(t => t.success).length;
    const totalResults = result.tests
      .filter(t => t.success)
      .reduce((sum, t) => sum + t.resultsCount, 0);
    
    console.log(`"${result.query}": ${successful}/3 tests exitosos, ${totalResults} resultados totales`);
  });

  // Guardar resultados en archivo
  const fs = require('fs');
  const reportPath = './search-diagnosis-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));
  console.log(`\n📄 Reporte completo guardado en: ${reportPath}`);
}

// Ejecutar diagnóstico
runDiagnosis().catch(console.error);
