#!/usr/bin/env node

/**
 * Script para probar el sistema de búsqueda simplificado
 * Solo filtra Wikipedia, permite todas las demás fuentes
 */

const https = require('https');
const http = require('http');

// Función simple para hacer peticiones HTTP
function makeRequest(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AsistenteLegal/1.0)',
        'Accept': 'application/json, text/plain, */*'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Función para filtrar Wikipedia
function filterWikipedia(results) {
  return results.filter(result => {
    const urlLower = result.url.toLowerCase();
    const titleLower = result.title.toLowerCase();
    
    if (urlLower.includes('wikipedia.org') || titleLower.includes('wikipedia')) {
      console.log(`🚫 Filtrando resultado de Wikipedia: ${result.title}`);
      return false;
    }
    
    return true;
  });
}

// Búsqueda con Google CSE
async function searchWithGoogle(query, numResults = 5) {
  console.log(`🔍 Buscando con Google CSE: "${query}"`);
  
  try {
    const apiKey = 'AIzaSyD5y97kpgw32Q5C6ujGKB6JafkD4Cv49TA';
    const cseCx = '6464df08faf4548b9';
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseCx}&q=${encodeURIComponent(query)}&num=${numResults}`;
    
    const response = await makeRequest(searchUrl);
    const data = JSON.parse(response);
    
    if (data.items && data.items.length > 0) {
      const results = data.items.map(item => ({
        title: item.title || 'Sin título',
        url: item.link || item.formattedUrl || '',
        snippet: item.snippet || item.htmlSnippet || 'Sin descripción',
        score: 1,
        source: 'Google CSE'
      }));
      
      const filteredResults = filterWikipedia(results);
      
      console.log(`✅ Google CSE: ${filteredResults.length} resultados (filtrados de ${results.length})`);
      return {
        success: true,
        query,
        results: filteredResults,
        timestamp: new Date().toISOString()
      };
    }
    
    console.log(`⚠️ Google CSE: No se encontraron resultados`);
    return { success: false, query, results: [], timestamp: new Date().toISOString() };
    
  } catch (error) {
    console.log(`❌ Google CSE Error: ${error.message}`);
    return { 
      success: false, 
      query, 
      results: [], 
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

// Búsqueda con DuckDuckGo
async function searchWithDuckDuckGo(query, numResults = 5) {
  console.log(`🦆 Buscando con DuckDuckGo: "${query}"`);
  
  try {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await makeRequest(searchUrl);
    const data = JSON.parse(response);
    
    const results = [];
    
    if (data.Abstract && data.AbstractURL && data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.AbstractText,
        score: 1,
        source: 'DuckDuckGo Abstract'
      });
    }
    
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, numResults - 1).forEach(topic => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || 'Sin título',
            url: topic.FirstURL,
            snippet: topic.Text,
            score: 1,
            source: 'DuckDuckGo Related'
          });
        }
      });
    }
    
    const filteredResults = filterWikipedia(results);
    
    if (filteredResults.length > 0) {
      console.log(`✅ DuckDuckGo: ${filteredResults.length} resultados (filtrados de ${results.length})`);
      return {
        success: true,
        query,
        results: filteredResults,
        timestamp: new Date().toISOString()
      };
    }
    
    console.log(`⚠️ DuckDuckGo: No se encontraron resultados`);
    return { success: false, query, results: [], timestamp: new Date().toISOString() };
    
  } catch (error) {
    console.log(`❌ DuckDuckGo Error: ${error.message}`);
    return { 
      success: false, 
      query, 
      results: [], 
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

// Función principal de búsqueda simplificada
async function searchWebSimple(query, numResults = 5) {
  console.log(`\n🚀 BÚSQUEDA WEB SIMPLIFICADA (SIN WIKIPEDIA)`);
  console.log(`📝 Query: "${query}"`);
  console.log(`🎯 Resultados deseados: ${numResults}`);
  console.log(`${'='.repeat(60)}`);
  
  const startTime = Date.now();
  
  // Primero intentar con Google CSE
  let googleResult = await searchWithGoogle(query, numResults);
  if (googleResult.success && googleResult.results.length > 0) {
    const duration = Date.now() - startTime;
    console.log(`🎯 BÚSQUEDA EXITOSA - Google CSE (${duration}ms)`);
    return googleResult;
  }
  
  // Si Google falla, intentar con DuckDuckGo
  console.log(`🔄 Google CSE falló, intentando DuckDuckGo...`);
  let duckResult = await searchWithDuckDuckGo(query, numResults);
  if (duckResult.success && duckResult.results.length > 0) {
    const duration = Date.now() - startTime;
    console.log(`🎯 BÚSQUEDA EXITOSA - DuckDuckGo (${duration}ms)`);
    return duckResult;
  }
  
  // Si todo falla
  const duration = Date.now() - startTime;
  console.log(`❌ BÚSQUEDA FALLIDA - Todos los motores (${duration}ms)`);
  return {
    success: false,
    query,
    results: [],
    timestamp: new Date().toISOString(),
    error: 'No se encontró información en ningún motor de búsqueda (Wikipedia está filtrada)'
  };
}

// Función principal de prueba
async function runSimpleTest() {
  console.log(`🚀 PRUEBA DEL SISTEMA DE BÚSQUEDA SIMPLIFICADO`);
  console.log(`Hora: ${new Date().toLocaleString()}`);
  console.log(`Objetivo: Probar sistema que solo filtra Wikipedia`);
  console.log(`${'='.repeat(80)}`);
  
  const testCases = [
    {
      query: 'sofico',
      description: 'Caso problemático original - término ambiguo'
    },
    {
      query: 'artículo 1 constitución política colombia',
      description: 'Consulta legal específica'
    },
    {
      query: 'inteligencia artificial derecho colombia',
      description: 'Consulta técnica con contexto legal'
    },
    {
      query: 'prescripción adquisitiva colombia',
      description: 'Concepto legal específico'
    },
    {
      query: 'ley 1564 código general del proceso',
      description: 'Normativa legal específica'
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 CASO DE PRUEBA: ${testCase.description}`);
    console.log(`📝 Query: "${testCase.query}"`);
    console.log(`${'='.repeat(80)}`);
    
    const result = await searchWebSimple(testCase.query, 5);
    results.push({
      ...testCase,
      result,
      success: result.success,
      resultCount: result.results?.length || 0,
      duration: result.duration || 0
    });
    
    // Mostrar resultados encontrados
    if (result.success && result.results.length > 0) {
      console.log(`\n📋 RESULTADOS ENCONTRADOS:`);
      result.results.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.title}`);
        console.log(`      📎 ${r.url}`);
        console.log(`      📝 ${r.snippet.substring(0, 100)}...`);
        console.log(`      🏷️  Fuente: ${r.source}`);
        console.log(`   `);
      });
    }
    
    // Pequeña pausa entre tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Análisis final
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 ANÁLISIS FINAL DE RESULTADOS`);
  console.log(`${'='.repeat(80)}`);
  
  let successfulSearches = 0;
  let totalResults = 0;
  let totalDuration = 0;
  
  results.forEach(test => {
    console.log(`\n📋 "${test.query}"`);
    console.log(`   ✅ Búsqueda: ${test.success ? 'EXITOSA' : 'FALLÓ'}`);
    console.log(`   📊 Resultados: ${test.resultCount}`);
    console.log(`   ⏱️ Duración: ${test.duration}ms`);
    
    if (test.success) successfulSearches++;
    totalResults += test.resultCount;
    totalDuration += test.duration;
  });
  
  console.log(`\n📊 ESTADÍSTICAS FINALES:`);
  console.log(`   🔍 Búsquedas exitosas: ${successfulSearches}/${results.length} (${((successfulSearches/results.length)*100).toFixed(1)}%)`);
  console.log(`   📊 Total resultados encontrados: ${totalResults}`);
  console.log(`   📈 Promedio resultados por búsqueda: ${(totalResults/results.length).toFixed(1)}`);
  console.log(`   ⏱️ Tiempo promedio: ${(totalDuration/results.length).toFixed(0)}ms`);
  console.log(`   🚫 Wikipedia: Siempre filtrada`);
  
  if (successfulSearches >= results.length * 0.8) {
    console.log(`\n🎉 CONCLUSIÓN: El sistema simplificado está FUNCIONAL y listo para producción`);
    console.log(`✅ Ventaja: Simple, rápido y sin Wikipedia`);
  } else {
    console.log(`\n⚠️ CONCLUSIÓN: El sistema necesita ajustes antes de producción`);
  }
  
  console.log(`\n✅ PRUEBA DEL SISTEMA SIMPLIFICADO COMPLETADA`);
}

// Ejecutar prueba
runSimpleTest().catch(console.error);
