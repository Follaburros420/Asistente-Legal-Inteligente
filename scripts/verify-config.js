#!/usr/bin/env node

/**
 * Script para verificar la configuración de Next.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de archivos de entorno...\n');

// Verificar archivos de entorno
const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
const foundFiles = [];

envFiles.forEach(file => {
  if (fs.existsSync(file)) {
    foundFiles.push(file);
    console.log(`✅ Encontrado: ${file}`);
  }
});

if (foundFiles.length === 0) {
  console.log('❌ No se encontraron archivos de entorno');
  process.exit(1);
}

console.log('\n📋 Contenido de archivos de entorno:');

foundFiles.forEach(file => {
  console.log(`\n📄 ${file}:`);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  lines.forEach(line => {
    const [key] = line.split('=');
    if (key) {
      console.log(`   ${key}`);
    }
  });
});

// Verificar variables específicas
console.log('\n🔍 Verificando variables específicas:');

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 
  'OPENROUTER_API_KEY'
];

let allFound = true;

foundFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  requiredVars.forEach(varName => {
    if (content.includes(varName)) {
      console.log(`✅ ${varName}: Encontrada en ${file}`);
    } else {
      console.log(`❌ ${varName}: NO encontrada en ${file}`);
      allFound = false;
    }
  });
});

console.log('\n' + '='.repeat(50));

if (allFound) {
  console.log('🎉 ¡Todas las variables requeridas están configuradas!');
  console.log('✅ Tu aplicación debería funcionar correctamente.');
  console.log('\n🌐 Accede a: http://localhost:3000 o http://localhost:3001');
} else {
  console.log('⚠️  Faltan algunas variables de entorno.');
  console.log('\n📝 Asegúrate de que tu archivo .env contenga:');
  console.log('   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key');
  console.log('   OPENROUTER_API_KEY=tu-clave-openrouter');
}

console.log('\n📚 Documentación disponible en:');
console.log('- docs/supabase-cloud-setup.md');
console.log('- docs/openrouter-setup.md');















