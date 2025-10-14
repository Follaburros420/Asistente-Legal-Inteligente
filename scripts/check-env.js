#!/usr/bin/env node

/**
 * Script para verificar las variables de entorno requeridas
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENROUTER_API_KEY'
];

const optionalEnvVars = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_API_KEY'
];

console.log('🔍 Verificando variables de entorno...\n');

let allRequiredPresent = true;

// Verificar variables requeridas
console.log('📋 Variables Requeridas:');
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    // Mostrar solo los primeros y últimos caracteres por seguridad
    const masked = value.length > 10 
      ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}`
      : '***';
    console.log(`✅ ${envVar}: ${masked}`);
  } else {
    console.log(`❌ ${envVar}: NO CONFIGURADA`);
    allRequiredPresent = false;
  }
});

console.log('\n📋 Variables Opcionales:');
optionalEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    const masked = value.length > 10 
      ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}`
      : '***';
    console.log(`✅ ${envVar}: ${masked}`);
  } else {
    console.log(`⚪ ${envVar}: No configurada (opcional)`);
  }
});

console.log('\n' + '='.repeat(50));

if (allRequiredPresent) {
  console.log('🎉 ¡Todas las variables requeridas están configuradas!');
  console.log('✅ Tu aplicación debería funcionar correctamente.');
} else {
  console.log('⚠️  Faltan variables de entorno requeridas.');
  console.log('\n📝 Para configurar:');
  console.log('1. Crea un archivo .env.local en la raíz del proyecto');
  console.log('2. Agrega las variables faltantes:');
  console.log('\n   # Supabase Cloud');
  console.log('   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto-id.supabase.co');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key');
  console.log('\n   # OpenRouter');
  console.log('   OPENROUTER_API_KEY=tu-clave-openrouter');
  console.log('\n3. Reinicia el servidor: npm run dev');
}

console.log('\n📚 Para más información, consulta:');
console.log('- docs/supabase-cloud-setup.md');
console.log('- docs/openrouter-setup.md');















