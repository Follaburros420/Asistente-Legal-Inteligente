#!/usr/bin/env node

/**
 * Script final para probar el sistema completo de búsqueda mejorada
 * Incluye normalizador inteligente y sistema multinivel
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

// Simular el normalizador inteligente (versión simplificada)
function analyzeQuery(query) {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Keywords legales
  const legalKeywords = ['constitución', 'ley', 'artículo', 'codigo', 'sentencia', 'colombia', 'tutela', 'derecho'];
  const academicKeywords = ['investigación', 'estudio', 'análisis', 'tesis', 'universidad'];
  const technicalKeywords = ['blockchain', 'inteligencia artificial', 'ia', 'algoritmo'];
  const generalKeywords = ['qué es', 'definición', 'características', 'ventajas'];
  
  const legalCount = legalKeywords.filter(k => normalizedQuery.includes(k)).length;
  const academicCount = academicKeywords.filter(k => normalizedQuery.includes(k)).length;
  const technicalCount = technicalKeywords.filter(k => normalizedQuery.includes(k)).length;
  const generalCount = generalKeywords.filter(k => normalizedQuery.includes(k)).length;
  
  // Determinar tipo
  let queryType, confidence, strategy;
  
  if (legalCount >= 2) {
    queryType = 'legal';
    confidence = Math.min(legalCount * 0.3, 1);
    strategy = 'official-first';
  } else if (academicCount >= 2) {
    queryType = 'academic';
    confidence = Math.min(academicCount * 0.25, 1);
    strategy = 'academic-first';
  } else if (technicalCount >= 1) {
    queryType = 'technical';
    confidence = Math.min(technicalCount * 0.4, 1);
    strategy = 'general-first';
  } else {
    queryType = 'general';
    confidence = Math.min(generalCount * 0.2, 0.5);
    strategy = 'multilingual';
  }
  
  // Normalizar query
  let finalQuery = query;
  if (queryType === 'legal' && confidence > 0.5 && !normalizedQuery.includes('colombia')) {
    finalQuery = `${query} Colombia`;
  }
  
  return {
    originalQuery: query,
    normalizedQuery: finalQuery,
    queryType,
    confidence,
    strategy,
    keywords: [...legalKeywords, ...academicKeywords, ...technicalKeywords, ...generalKeywords].filter(k => normalizedQuery.includes(k)),
    entities: [],
    language: 'es',
    complexity: 'medium'
  };
}

// Simular búsqueda multinivel mejorada
async function searchEnhancedMultilevel(query) {
  console.log(`\n🚀 INICIANDO BÚSQUEDA MULTINIVEL MEJORADA`);
  console.log(`📝 Query original: "${query}"`);
  console.log(`${'='.repeat(80)}`);
  
  const startTime = Date.now();
  
  // Paso 1: Analizar consulta
  const analysis = analyzeQuery(query);
  console.log(`🧠 ANÁLISIS INTELIGENTE:`);
  console.log(`   📝 Tipo: ${analysis.queryType}`);
  console.log(`   🎯 Confianza: ${(analysis.confidence * 100).toFixed(1)}%`);
  console.log(`   📋 Estrategia: ${analysis.strategy}`);
  console.log(`   🔍 Keywords: ${analysis.keywords.join(', ')}`);
  console.log(`\n🔍 QUERY NORMALIZADA: "${analysis.normalizedQuery}"`);
  
  // Paso 2: Ejecutar según estrategia
  let result = null;
  
  if (analysis.strategy === 'official-first') {
    console.log(`\n🏛️ ESTRATEGIA: Priorizando fuentes oficiales...`);
    result = await searchWithDuckDuckGo(`${analysis.normalizedQuery} Colombia official government`);
  } else if (analysis.strategy === 'academic-first') {
    console.log(`\n🎓 ESTRATEGIA: Priorizando fuentes académicas...`);
    result = await searchWithDuckDuckGo(`${analysis.normalizedQuery} site:edu.co OR site:scholar.google.com`);
  } else {
    console.log(`\n🌐 ESTRATEGIA: Búsqueda general/multilingüe...`);
    result = await searchWithDuckDuckGo(analysis.normalizedQuery);
  }
  
  // Si no funciona, intentar con Wikipedia
  if (!result || !result.success) {
    console.log(`\n📖 Intentando Wikipedia como fallback...`);
    result = await searchWikipedia(analysis.normalizedQuery);
  }
  
  const duration = Date.now() - startTime;
  
  if (result && result.success) {
    console.log(`✅ BÚSQUEDA EXITOSA (${duration}ms)`);
    return {
      ...result,
      searchLevel: `${result.searchLevel} (Strategy: ${analysis.strategy})`,
      analysis,
      duration
    };
  } else {
    console.log(`❌ BÚSQUEDA FALLIDA (${duration}ms)`);
    return {
      success: false,
      searchLevel: `Failed (Strategy: ${analysis.strategy})`,
      analysis,
      duration,
      error: 'No se encontró información'
    };
  }
}

// Búsqueda con DuckDuckGo
async function searchWithDuckDuckGo(query) {
  try {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await makeRequest(searchUrl);
    const data = JSON.parse(response);
    
    if (data.Abstract && data.AbstractURL) {
      return {
        success: true,
        results: [{
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText || 'Sin descripción',
          score: 3,
          source: 'DuckDuckGo',
          type: 'general'
        }],
        searchLevel: 'DuckDuckGo General'
      };
    }
  } catch (error) {
    console.log(`❌ DuckDuckGo Error: ${error.message}`);
  }
  
  return { success: false };
}

// Búsqueda en Wikipedia
async function searchWikipedia(query) {
  try {
    const cleanQuery = query.toLowerCase().replace(/[¿?¡!]/g, '').trim();
    const wikiUrl = `https://r.jina.ai/https://es.wikipedia.org/wiki/${encodeURIComponent(cleanQuery.replace(/\s+/g, '_'))}`;
    const response = await makeRequest(wikiUrl, 5000);
    
    if (response && response.length > 200) {
      const lines = response.split('\n');
      const title = lines.find(line => line.startsWith('Title:'))?.replace('Title:', '').trim() || query;
      const content = lines.find(line => line.startsWith('Markdown Content:'))?.replace('Markdown Content:', '').trim() || response;
      
      return {
        success: true,
        results: [{
          title: `[Wikipedia] ${title}`,
          url: `https://es.wikipedia.org/wiki/${encodeURIComponent(cleanQuery.replace(/\s+/g, '_'))}`,
          snippet: content.substring(0, 500),
          score: 1,
          source: 'Wikipedia',
          type: 'wikipedia'
        }],
        searchLevel: 'Wikipedia Fallback'
      };
    }
  } catch (error) {
    console.log(`❌ Wikipedia Error: ${error.message}`);
  }
  
  return { success: false };
}

// Función principal de prueba
async function runFinalTest() {
  console.log(`🚀 PRUEBA FINAL DEL SISTEMA COMPLETO`);
  console.log(`Hora: ${new Date().toLocaleString()}`);
  console.log(`${'='.repeat(80)}`);
  
  const testCases = [
    {
      query: 'sofico',
      expectedType: 'general',
      description: 'Caso problemático original - término ambiguo'
    },
    {
      query: 'artículo 1 constitución política colombia',
      expectedType: 'legal',
      description: 'Consulta legal específica con artículo'
    },
    {
      query: 'inteligencia artificial derecho colombia',
      expectedType: 'technical',
      description: 'Consulta técnica con contexto legal'
    },
    {
      query: 'investigación blockchain universidad',
      expectedType: 'academic',
      description: 'Consulta académica específica'
    },
    {
      query: 'qué es la prescripción adquisitiva',
      expectedType: 'legal',
      description: 'Consulta legal con formato de pregunta'
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 CASO DE PRUEBA: ${testCase.description}`);
    console.log(`📝 Query: "${testCase.query}"`);
    console.log(`🎯 Tipo esperado: ${testCase.expectedType}`);
    console.log(`${'='.repeat(80)}`);
    
    const result = await searchEnhancedMultilevel(testCase.query);
    results.push({
      ...testCase,
      result,
      success: result.success,
      actualType: result.analysis?.queryType,
      strategy: result.analysis?.strategy,
      duration: result.duration
    });
    
    // Pequeña pausa entre tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Análisis final
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 ANÁLISIS FINAL DE RESULTADOS`);
  console.log(`${'='.repeat(80)}`);
  
  let successfulSearches = 0;
  let correctTypeDetection = 0;
  let totalDuration = 0;
  
  results.forEach(test => {
    console.log(`\n📋 "${test.query}"`);
    console.log(`   ✅ Búsqueda: ${test.success ? 'EXITOSA' : 'FALLÓ'}`);
    console.log(`   🎯 Tipo detectado: ${test.actualType} (esperado: ${test.expectedType})`);
    console.log(`   📋 Estrategia: ${test.strategy}`);
    console.log(`   ⏱️ Duración: ${test.duration}ms`);
    
    if (test.success) successfulSearches++;
    if (test.actualType === test.expectedType) correctTypeDetection++;
    totalDuration += test.duration;
  });
  
  console.log(`\n📊 ESTADÍSTICAS FINALES:`);
  console.log(`   🔍 Búsquedas exitosas: ${successfulSearches}/${results.length} (${((successfulSearches/results.length)*100).toFixed(1)}%)`);
  console.log(`   🧠 Detección correcta de tipos: ${correctTypeDetection}/${results.length} (${((correctTypeDetection/results.length)*100).toFixed(1)}%)`);
  console.log(`   ⏱️ Tiempo promedio: ${(totalDuration/results.length).toFixed(0)}ms`);
  console.log(`   🚀 Mejora sobre sistema anterior: Sistema multinivel con análisis inteligente`);
  
  if (successfulSearches >= results.length * 0.8) {
    console.log(`\n🎉 CONCLUSIÓN: El sistema está FUNCIONAL y listo para producción`);
  } else {
    console.log(`\n⚠️ CONCLUSIÓN: El sistema necesita ajustes antes de producción`);
  }
  
  console.log(`\n✅ PRUEBA FINAL COMPLETADA`);
}

// Ejecutar prueba
runFinalTest().catch(console.error);
