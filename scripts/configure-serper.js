#!/usr/bin/env node

/**
 * Script para configurar Serper API Key
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔧 CONFIGURADOR DE SERPER API');
console.log('='.repeat(50));

// Verificar si existe el archivo .env
const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.log('❌ No se encontró el archivo .env');
  console.log('💡 Creando archivo .env...');
  
  const defaultEnv = `# Serper API Key
SERPER_API_KEY=your_serper_api_key_here

# OpenRouter API Key  
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Google CSE (fallback)
GOOGLE_CSE_API_KEY=AIzaSyD5y97kpgw32Q5C6ujGKB6JafkD4Cv49TA
GOOGLE_CSE_CX=6464df08faf4548b9
`;
  
  fs.writeFileSync(envPath, defaultEnv);
  console.log('✅ Archivo .env creado');
}

// Leer el archivo .env actual
const envContent = fs.readFileSync(envPath, 'utf8');

// Verificar configuración actual
const serperMatch = envContent.match(/SERPER_API_KEY=(.+)/);
const currentKey = serperMatch ? serperMatch[1] : 'no encontrada';

console.log(`\n📋 Configuración actual:`);
console.log(`   SERPER_API_KEY: ${currentKey}`);

if (currentKey === 'your_serper_api_key_here' || currentKey === 'no encontrada') {
  console.log('\n⚠️  API Key no configurada correctamente');
  console.log('\n📝 Para configurar Serper:');
  console.log('   1. Ve a https://serper.dev');
  console.log('   2. Crea una cuenta gratuita');
  console.log('   3. Obtén tu API key del dashboard');
  console.log('   4. Ejecuta: node scripts/configure-serper.js TU_API_KEY');
  
  console.log('\n💡 O puedes editar manualmente el archivo .env:');
  console.log(`   SERPER_API_KEY=tu_api_key_real_aqui`);
  
} else {
  console.log('\n✅ API Key configurada');
  console.log('\n🧪 Para probar la conexión:');
  console.log('   node scripts/test-serper.js');
}

console.log('\n' + '='.repeat(50));
