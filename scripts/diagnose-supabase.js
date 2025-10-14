#!/usr/bin/env node

/**
 * Script para diagnosticar problemas de conectividad con Supabase
 */

console.log('🔍 Diagnosticando configuración de Supabase...\n');

// Verificar variables de entorno
console.log('📋 Variables de Entorno:');
console.log(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'NO CONFIGURADA'}`);
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA'}`);
console.log(`OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA'}`);

// Verificar conectividad con Supabase
async function testSupabaseConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('\n❌ Variables de Supabase no configuradas');
    return;
  }
  
  console.log('\n🔄 Probando conectividad con Supabase...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Conexión con Supabase exitosa');
      console.log(`📊 Status: ${response.status}`);
    } else {
      console.log('❌ Error de conexión con Supabase');
      console.log(`📊 Status: ${response.status}`);
      console.log(`📊 Status Text: ${response.statusText}`);
    }
  } catch (error) {
    console.log('❌ Error de conectividad:');
    console.log(`   ${error.message}`);
  }
}

// Verificar conectividad con OpenRouter
async function testOpenRouterConnection() {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  
  if (!openrouterKey) {
    console.log('\n❌ OPENROUTER_API_KEY no configurada');
    return;
  }
  
  console.log('\n🔄 Probando conectividad con OpenRouter...');
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Asistente Legal Inteligente'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'Prueba de conectividad'
      })
    });
    
    if (response.ok) {
      console.log('✅ Conexión con OpenRouter exitosa');
      console.log(`📊 Status: ${response.status}`);
    } else {
      console.log('❌ Error de conexión con OpenRouter');
      console.log(`📊 Status: ${response.status}`);
      const errorData = await response.json().catch(() => ({}));
      console.log(`📊 Error: ${errorData.error?.message || response.statusText}`);
    }
  } catch (error) {
    console.log('❌ Error de conectividad con OpenRouter:');
    console.log(`   ${error.message}`);
  }
}

// Ejecutar diagnósticos
async function runDiagnostics() {
  await testSupabaseConnection();
  await testOpenRouterConnection();
  
  console.log('\n' + '='.repeat(50));
  console.log('📚 Recomendaciones:');
  console.log('1. Verifica que las variables de entorno estén en .env.local');
  console.log('2. Reinicia el servidor: npm run dev');
  console.log('3. Verifica que no haya procesos de Supabase local ejecutándose');
  console.log('4. Asegúrate de que la URL de Supabase sea correcta');
}

runDiagnostics();















