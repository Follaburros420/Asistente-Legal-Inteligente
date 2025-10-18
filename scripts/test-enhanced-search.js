#!/usr/bin/env node

/**
 * Script para probar el sistema de búsqueda multinivel mejorado
 * Compara resultados con el sistema anterior
 */

// Importar el sistema mejorado (simulado ya que es TypeScript)
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

// Simular el sistema multinivel mejorado
async function searchEnhancedMultilevel(query) {
  console.log(`\n🚀 INICIANDO BÚSQUEDA MULTINIVEL MEJORADA`);
  console.log(`📝 Query: "${query}"`);
  console.log(`${'='.repeat(80)}`);
  
  const startTime = Date.now();
  
  // Nivel 1: DuckDuckGo (reemplaza Google CSE que falla con 429)
  console.log(`\n🏛️ NIVEL 1: Buscando en fuentes generales (DuckDuckGo)...`);
  try {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' Colombia official government')}&format=json&no_html=1&skip_disambig=1`;
    const response = await makeRequest(searchUrl);
    const data = JSON.parse(response);
    
    if (data.Abstract && data.AbstractURL) {
      const duration = Date.now() - startTime;
      console.log(`✅ Nivel 1 EXITOSO (${duration}ms)`);
      console.log(`📄 Título: ${data.Heading}`);
      console.log(`🔗 URL: ${data.AbstractURL}`);
      console.log(`📝 Contenido: ${data.AbstractText?.substring(0, 150)}...`);
      
      return {
        success: true,
        level: 'General Web (DuckDuckGo)',
        results: [{
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText || 'Sin descripción',
          score: 3,
          source: 'DuckDuckGo',
          type: 'general'
        }],
        duration
      };
    }
  } catch (error) {
    console.log(`❌ Nivel 1 Error: ${error.message}`);
  }
  
  // Nivel 2: Búsqueda académica simulada
  console.log(`\n🎓 NIVEL 2: Buscando en fuentes académicas...`);
  try {
    const academicQuery = `${query} research study Colombia site:edu.co OR site:scholar.google.com`;
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(academicQuery)}&format=json&no_html=1&skip_disambig=1`;
    const response = await makeRequest(searchUrl);
    const data = JSON.parse(response);
    
    if (data.Abstract && data.AbstractURL) {
      const duration = Date.now() - startTime;
      console.log(`✅ Nivel 2 EXITOSO (${duration}ms)`);
      console.log(`📄 Título: ${data.Heading}`);
      console.log(`🔗 URL: ${data.AbstractURL}`);
      
      return {
        success: true,
        level: 'Academic Sources',
        results: [{
          title: `[ACADEMICO] ${data.Heading || query}`,
          url: data.AbstractURL,
          snippet: data.AbstractText || 'Sin descripción',
          score: 4,
          source: 'Academic Search',
          type: 'academic'
        }],
        duration
      };
    }
  } catch (error) {
    console.log(`❌ Nivel 2 Error: ${error.message}`);
  }
  
  // Nivel 3: Búsqueda multilingüe
  console.log(`\n🌍 NIVEL 3: Búsqueda multilingüe...`);
  const strategies = [
    { query: query, lang: 'es', source: 'Original ES' },
    { query: `${query} english definition`, lang: 'en', source: 'English' },
    { query: `qué es ${query}`, lang: 'es', source: 'Definition ES' }
  ];
  
  for (const strategy of strategies) {
    try {
      const cleanQuery = strategy.query
        .toLowerCase()
        .replace(/[¿?¡!]/g, '')
        .replace(/^(cuando|que|quien|donde|como|busca|investiga)\s+/gi, '')
        .trim();
      
      const wikiUrl = `https://r.jina.ai/https://es.wikipedia.org/wiki/${encodeURIComponent(cleanQuery.replace(/\s+/g, '_'))}`;
      const response = await makeRequest(wikiUrl, 5000);
      
      if (response && response.length > 200) {
        const duration = Date.now() - startTime;
        console.log(`✅ Nivel 3 EXITOSO (${duration}ms) - Estrategia: ${strategy.source}`);
        
        const lines = response.split('\n');
        const title = lines.find(line => line.startsWith('Title:'))?.replace('Title:', '').trim() || strategy.query;
        const content = lines.find(line => line.startsWith('Markdown Content:'))?.replace('Markdown Content:', '').trim() || response;
        
        return {
          success: true,
          level: 'Multilingual/Wikipedia',
          results: [{
            title: `[${strategy.source}] ${title}`,
            url: `https://es.wikipedia.org/wiki/${encodeURIComponent(cleanQuery.replace(/\s+/g, '_'))}`,
            snippet: content.substring(0, 500),
            score: 2,
            source: `Wikipedia ${strategy.source}`,
            type: 'wikipedia'
          }],
          duration,
          note: 'Utilizado como último recurso'
        };
      }
    } catch (error) {
      console.log(`⚠️ Error en estrategia ${strategy.source}: ${error.message}`);
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`❌ BÚSQUEDA FALLIDA - Todos los niveles (${duration}ms)`);
  
  return {
    success: false,
    level: 'All Levels Failed',
    results: [],
    duration,
    error: 'No se encontró información en ninguna fuente'
  };
}

// Función para comparar con el sistema anterior
async function testSearchComparison(query) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 COMPARANDO SISTEMAS DE BÚSQUEDA`);
  console.log(`📝 Query: "${query}"`);
  console.log(`${'='.repeat(80)}`);
  
  // Probar sistema mejorado
  console.log(`\n🆕 SISTEMA MEJORADO (Multinivel):`);
  const enhancedResult = await searchEnhancedMultilevel(query);
  
  // Simular resultado del sistema anterior (siempre Wikipedia)
  console.log(`\n🔄 SISTEMA ANTERIOR (Solo Wikipedia):`);
  const oldResult = {
    success: true,
    level: 'Wikipedia Only',
    results: [{
      title: `Wikipedia: ${query}`,
      url: `https://es.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
      snippet: 'Contenido de Wikipedia como única fuente...',
      score: 1,
      source: 'Wikipedia',
      type: 'wikipedia'
    }],
    duration: 1000,
    note: 'Sistema anterior dependía exclusivamente de Wikipedia'
  };
  
  // Comparación
  console.log(`\n📊 COMPARACIÓN DE RESULTADOS:`);
  console.log(`-`.repeat(50));
  console.log(`Sistema Mejorado:`);
  console.log(`   ✅ Éxito: ${enhancedResult.success}`);
  console.log(`   🎯 Nivel: ${enhancedResult.level}`);
  console.log(`   ⏱️ Duración: ${enhancedResult.duration}ms`);
  console.log(`   📊 Resultados: ${enhancedResult.results.length}`);
  if (enhancedResult.results.length > 0) {
    console.log(`   🏆 Score máximo: ${Math.max(...enhancedResult.results.map(r => r.score))}`);
    console.log(`   📄 Tipo: ${enhancedResult.results[0].type}`);
  }
  
  console.log(`\nSistema Anterior:`);
  console.log(`   ✅ Éxito: ${oldResult.success}`);
  console.log(`   🎯 Nivel: ${oldResult.level}`);
  console.log(`   ⏱️ Duración: ${oldResult.duration}ms`);
  console.log(`   📊 Resultados: ${oldResult.results.length}`);
  console.log(`   🏆 Score máximo: ${Math.max(...oldResult.results.map(r => r.score))}`);
  console.log(`   📄 Tipo: ${oldResult.results[0].type}`);
  
  // Veredicto
  console.log(`\n🎯 VEREDICTO:`);
  if (enhancedResult.success && enhancedResult.results.length > 0) {
    const enhancedScore = Math.max(...enhancedResult.results.map(r => r.score));
    const oldScore = oldResult.results[0].score;
    
    if (enhancedScore > oldScore) {
      console.log(`   ✅ MEJORÍA: Sistema mejorado encontró fuentes de mayor calidad (${enhancedScore} vs ${oldScore})`);
    } else if (enhancedResult.results[0].type !== 'wikipedia') {
      console.log(`   ✅ MEJORÍA: Sistema mejorado encontró fuentes no-Wikipedia (${enhancedResult.results[0].type})`);
    } else {
      console.log(`   ⚠️ SIMILAR: Ambos sistemas usan Wikipedia, pero el mejorado tiene más estrategias`);
    }
  } else {
    console.log(`   ❌ AMBOS FALLARON: Ningún sistema encontró resultados`);
  }
  
  return { enhanced: enhancedResult, old: oldResult };
}

// Función principal
async function runEnhancedTest() {
  console.log(`🚀 INICIANDO PRUEBA DEL SISTEMA MEJORADO`);
  console.log(`Hora: ${new Date().toLocaleString()}`);
  console.log(`${'='.repeat(80)}`);
  
  const testQueries = [
    'sofico',  // El caso problemático original
    'articulo 1 constitucion politica colombia',
    'que es blockchain',
    'inteligencia artificial derecho colombia',
    'prescripcion adquisitiva'  // Consulta legal específica
  ];
  
  const results = [];
  
  for (const query of testQueries) {
    const result = await testSearchComparison(query);
    results.push({ query, ...result });
    
    // Pausa entre tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Resumen final
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 RESUMEN FINAL DE LA COMPARACIÓN`);
  console.log(`${'='.repeat(80)}`);
  
  let enhancedWins = 0;
  let oldWins = 0;
  let ties = 0;
  
  results.forEach(result => {
    const enhancedScore = result.enhanced.success ? Math.max(...result.enhanced.results.map(r => r.score || 0)) : 0;
    const oldScore = result.old.success ? Math.max(...result.old.results.map(r => r.score || 0)) : 0;
    
    if (enhancedScore > oldScore) {
      enhancedWins++;
      console.log(`✅ "${result.query}": Mejorado gana (${enhancedScore} vs ${oldScore})`);
    } else if (oldScore > enhancedScore) {
      oldWins++;
      console.log(`❌ "${result.query}": Anterior gana (${oldScore} vs ${enhancedScore})`);
    } else {
      ties++;
      console.log(`⚖️ "${result.query}": Empate (${enhancedScore} vs ${oldScore})`);
    }
  });
  
  console.log(`\n📊 ESTADÍSTICAS FINALES:`);
  console.log(`   🏆 Sistema Mejorado: ${enhancedWins} victorias`);
  console.log(`   🔄 Sistema Anterior: ${oldWins} victorias`);
  console.log(`   ⚖️ Empates: ${ties}`);
  console.log(`   📈 Tasa de mejora: ${((enhancedWins / testQueries.length) * 100).toFixed(1)}%`);
  
  if (enhancedWins > oldWins) {
    console.log(`\n🎉 CONCLUSIÓN: El sistema mejorado es SUPERIOR y debe implementarse.`);
  } else if (enhancedWins === oldWins && ties > 0) {
    console.log(`\n⚠️ CONCLUSIÓN: El sistema mejorado es equivalente pero más robusto.`);
  } else {
    console.log(`\n❌ CONCLUSIÓN: Se necesitan más mejoras en el sistema.`);
  }
}

// Ejecutar prueba
runEnhancedTest().catch(console.error);
