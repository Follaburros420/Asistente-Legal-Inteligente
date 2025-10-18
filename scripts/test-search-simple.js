#!/usr/bin/env node

/**
 * Script simple para probar el sistema de búsqueda web
 * Usa directamente las funciones disponibles sin importar TypeScript
 */

const https = require('https');
const http = require('http');

// Función simple para hacer peticiones HTTP
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AsistenteLegal/1.0)'
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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Función para probar Google CSE directamente
async function testGoogleCSE(query) {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || 'AIzaSyD5y97kpgw32Q5C6ujGKB6JafkD4Cv49TA';
  const cseCx = process.env.GOOGLE_CSE_CX || '6464df08faf4548b9';
  const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseCx}&q=${encodeURIComponent(query)}&num=5`;
  
  console.log(`🔍 Probando Google CSE con: "${query}"`);
  console.log(`📡 URL: ${searchUrl.substring(0, 100)}...`);
  
  try {
    const response = await makeRequest(searchUrl);
    const data = JSON.parse(response);
    
    if (data.items && data.items.length > 0) {
      console.log(`✅ Google CSE: ${data.items.length} resultados encontrados`);
      
      data.items.forEach((item, i) => {
        console.log(`\n   ${i + 1}. ${item.title}`);
        console.log(`      ${item.link}`);
        console.log(`      ${item.snippet?.substring(0, 100)}...`);
      });
      
      return { success: true, results: data.items };
    } else {
      console.log(`❌ Google CSE: No se encontraron resultados`);
      return { success: false, error: 'No results' };
    }
  } catch (error) {
    console.log(`❌ Google CSE Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Función para probar Jina AI Reader
async function testJinaAI(url) {
  const jinaUrl = `https://r.jina.ai/${url}`;
  
  console.log(`📖 Probando Jina AI Reader para: ${url}`);
  
  try {
    const content = await makeRequest(jinaUrl);
    console.log(`✅ Jina AI: ${content.length} caracteres extraídos`);
    console.log(`📝 Contenido: ${content.substring(0, 200)}...`);
    
    return { success: true, content };
  } catch (error) {
    console.log(`❌ Jina AI Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Función para probar búsqueda directa en Wikipedia (fallback actual)
async function testWikipediaFallback(query) {
  const cleanQuery = query
    .toLowerCase()
    .replace(/[¿?¡!]/g, '')
    .replace(/^(cuando|que|quien|donde|como|busca|investiga|murio|fallecio|muerte de|informacion sobre|en internet|que dia es hoy)\s+/gi, '')
    .trim();
  
  const searchUrls = [
    `https://es.wikipedia.org/wiki/${encodeURIComponent(cleanQuery.replace(/\s+/g, '_'))}`,
    `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanQuery.replace(/\s+/g, '_'))}`,
  ];
  
  console.log(`🌐 Probando Wikipedia fallback para: "${cleanQuery}"`);
  
  for (const url of searchUrls) {
    try {
      const content = await testJinaAI(url);
      if (content.success && content.content.length > 100) {
        console.log(`✅ Wikipedia: Encontrado en ${url}`);
        return { success: true, url, content: content.content };
      }
    } catch (error) {
      console.log(`⚠️ Intentando siguiente URL...`);
    }
  }
  
  console.log(`❌ Wikipedia: No se encontró información`);
  return { success: false, error: 'No encontrado en Wikipedia' };
}

// Función principal de prueba
async function runSimpleTest() {
  console.log(`🚀 INICIANDO PRUEBA SIMPLE DEL SISTEMA DE BÚSQUEDA`);
  console.log(`Hora: ${new Date().toLocaleString()}`);
  console.log(`${"=".repeat(80)}`);
  
  const testQueries = [
    'sofico',  // El caso problemático
    'articulo 1 constitucion politica colombia',
    'que es blockchain'
  ];
  
  for (const query of testQueries) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🔍 ANALIZANDO: "${query}"`);
    console.log(`${"=".repeat(80)}`);
    
    // Test 1: Google CSE
    console.log(`\n📊 TEST 1: Google Custom Search Engine`);
    console.log(`-`.repeat(50));
    const cseResult = await testGoogleCSE(query);
    
    // Test 2: Wikipedia Fallback (si CSE falla)
    if (!cseResult.success || cseResult.results?.length === 0) {
      console.log(`\n📊 TEST 2: Wikipedia Fallback`);
      console.log(`-`.repeat(50));
      const wikiResult = await testWikipediaFallback(query);
      
      if (wikiResult.success) {
        console.log(`⚠️ ¡ALERTA! El sistema está usando Wikipedia como fallback`);
        console.log(`📄 URL: ${wikiResult.url}`);
        console.log(`📝 Longitud del contenido: ${wikiResult.content.length} caracteres`);
      }
    }
    
    // Pequeña pausa entre tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🎯 PRUEBA COMPLETADA`);
  console.log(`${"=".repeat(80)}`);
}

// Ejecutar prueba
runSimpleTest().catch(console.error);
