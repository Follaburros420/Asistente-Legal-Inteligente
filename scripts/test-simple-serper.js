#!/usr/bin/env node

/**
 * Script para probar el sistema simplificado de Serper
 */

require('dotenv').config();

async function testSimpleSerper() {
  console.log('\n🧪 PROBANDO SISTEMA SIMPLIFICADO DE SERPER');
  console.log('='.repeat(60));
  
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey || apiKey === 'your_serper_api_key_here') {
    console.log('❌ SERPER_API_KEY no configurada');
    return;
  }
  
  console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
  
  const testQueries = [
    'hola', // No debería buscar
    'artículo 700 código civil', // Sí debería buscar
    'prescripción colombia' // Sí debería buscar
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Probando: "${query}"`);
    
    // Simular detección legal simple
    const isLegalQuery = query.toLowerCase().includes('artículo') || 
                        query.toLowerCase().includes('código') ||
                        query.toLowerCase().includes('prescripción') ||
                        query.toLowerCase().includes('colombia');
    
    if (isLegalQuery) {
      console.log(`   🧠 Detección: Buscar (consulta legal)`);
      
      try {
        // Query simplificada
        let simpleQuery = query;
        if (!query.toLowerCase().includes('colombia')) {
          simpleQuery = `${query} Colombia`;
        }
        
        console.log(`   📝 Query simplificada: "${simpleQuery}"`);
        
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: simpleQuery,
            num: 3
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ Éxito: ${data.organic?.length || 0} resultados`);
          
          if (data.organic && data.organic.length > 0) {
            console.log(`   📋 Primer resultado: ${data.organic[0].title}`);
            console.log(`   🔗 URL: ${data.organic[0].link}`);
          }
        } else {
          console.log(`   ❌ Error ${response.status}: ${response.statusText}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    } else {
      console.log(`   ✅ No se ejecuta búsqueda (saludo)`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

testSimpleSerper().catch(console.error);
