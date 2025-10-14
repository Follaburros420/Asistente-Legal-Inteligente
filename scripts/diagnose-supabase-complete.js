#!/usr/bin/env node

/**
 * Diagnóstico completo de Supabase
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnóstico Completo de Supabase\n');

// Función para cargar variables de entorno
function loadEnvVars() {
  const envFiles = ['.env', '.env.local'];
  const envVars = {};
  
  envFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      content.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (value && !value.startsWith('#')) {
            envVars[key.trim()] = value;
          }
        }
      });
    }
  });
  
  return envVars;
}

// Cargar variables de entorno
const envVars = loadEnvVars();

console.log('📋 Variables de Entorno Detectadas:');
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENROUTER_API_KEY'
];

requiredVars.forEach(varName => {
  const value = envVars[varName];
  if (value) {
    const masked = value.length > 20 
      ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
      : '***';
    console.log(`✅ ${varName}: ${masked}`);
  } else {
    console.log(`❌ ${varName}: NO CONFIGURADA`);
  }
});

// Verificar configuración de Supabase
console.log('\n🔧 Verificando Configuración de Supabase:');

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const anonKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const serviceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (supabaseUrl) {
  console.log(`📡 URL: ${supabaseUrl}`);
  
  if (supabaseUrl.includes('supabase_kong_chatbotui')) {
    console.log('❌ PROBLEMA DETECTADO: URL contiene referencia local incorrecta');
    console.log('   Esto causa el error "Could not resolve host: supabase_kong_chatbotui"');
  } else if (supabaseUrl.startsWith('https://') && supabaseUrl.includes('.supabase.co')) {
    console.log('✅ URL de Supabase Cloud válida');
  } else {
    console.log('⚠️  URL de Supabase no tiene formato esperado');
  }
} else {
  console.log('❌ NEXT_PUBLIC_SUPABASE_URL no configurada');
}

if (anonKey) {
  console.log('✅ Anon Key configurada');
} else {
  console.log('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no configurada');
}

if (serviceKey) {
  console.log('✅ Service Role Key configurada');
} else {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY no configurada');
}

// Verificar archivos de configuración
console.log('\n📁 Verificando Archivos de Configuración:');

const configFiles = [
  'supabase/config.toml',
  'lib/supabase/browser-client.ts',
  'lib/supabase/server.ts',
  'lib/supabase/robust-client.ts'
];

configFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}: Existe`);
    
    // Verificar contenido problemático
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('supabase_kong_chatbotui')) {
      console.log(`   ⚠️  Contiene referencia problemática: supabase_kong_chatbotui`);
    }
  } else {
    console.log(`❌ ${file}: No existe`);
  }
});

// Verificar archivos de entorno
console.log('\n📄 Verificando Archivos de Entorno:');

const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
envFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}: Existe`);
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('supabase_kong_chatbotui')) {
      console.log(`   ⚠️  Contiene referencia problemática: supabase_kong_chatbotui`);
    }
  } else {
    console.log(`⚪ ${file}: No existe`);
  }
});

// Recomendaciones
console.log('\n' + '='.repeat(60));
console.log('📚 RECOMENDACIONES:');

if (supabaseUrl && supabaseUrl.includes('supabase_kong_chatbotui')) {
  console.log('\n🚨 PROBLEMA CRÍTICO DETECTADO:');
  console.log('1. La URL de Supabase contiene una referencia local incorrecta');
  console.log('2. Esto causa el error "Could not resolve host: supabase_kong_chatbotui"');
  console.log('\n🔧 SOLUCIÓN:');
  console.log('1. Verifica tu archivo .env o .env.local');
  console.log('2. Asegúrate de que NEXT_PUBLIC_SUPABASE_URL sea:');
  console.log('   https://tu-proyecto-id.supabase.co');
  console.log('3. NO debe contener "supabase_kong_chatbotui"');
  console.log('4. Reinicia el servidor después de corregir');
} else if (!supabaseUrl) {
  console.log('\n⚠️  CONFIGURACIÓN FALTANTE:');
  console.log('1. Agrega NEXT_PUBLIC_SUPABASE_URL a tu archivo .env.local');
  console.log('2. Obtén la URL de tu proyecto en Supabase Cloud');
  console.log('3. Formato: https://tu-proyecto-id.supabase.co');
} else {
  console.log('\n✅ CONFIGURACIÓN CORRECTA:');
  console.log('1. Las variables de entorno están configuradas correctamente');
  console.log('2. El problema puede ser de caché o configuración del servidor');
  console.log('3. Intenta reiniciar el servidor completamente');
  console.log('4. Limpia la caché del navegador');
}

console.log('\n🔄 PASOS DE SOLUCIÓN:');
console.log('1. Detener servidor: Ctrl+C');
console.log('2. Limpiar caché: rm -rf .next');
console.log('3. Reiniciar: npm run dev');
console.log('4. Verificar en navegador: http://localhost:3000');

console.log('\n📞 Si el problema persiste:');
console.log('1. Verifica que tu proyecto de Supabase Cloud esté activo');
console.log('2. Confirma que las claves de API sean correctas');
console.log('3. Revisa los logs de Supabase en su dashboard');















