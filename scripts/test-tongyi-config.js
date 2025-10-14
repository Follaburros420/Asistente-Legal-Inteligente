/**
 * Script de prueba rápida para verificar la configuración de Tongyi
 */

console.log('\n🧪 Verificación de Configuración Tongyi\n');
console.log('=' .repeat(60));

// Test 1: Verificar que las variables de entorno están cargadas
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

console.log('\n✅ Variables de entorno cargadas');

// Test 2: Verificar OpenRouter API Key
const openrouterKey = process.env.OPENROUTER_API_KEY;
if (openrouterKey) {
  console.log(`✅ OpenRouter API Key: ${openrouterKey.substring(0, 8)}...`);
} else {
  console.log('❌ OpenRouter API Key NO encontrada');
}

// Test 3: Verificar OpenAI API Key (para embeddings)
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey) {
  console.log(`✅ OpenAI API Key: ${openaiKey.substring(0, 10)}...`);
} else {
  console.log('❌ OpenAI API Key NO encontrada');
}

// Test 4: Verificar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey) {
  console.log(`✅ Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
  console.log(`✅ Supabase Key: ${supabaseKey.substring(0, 15)}...`);
} else {
  console.log('❌ Supabase NO configurado correctamente');
}

console.log('\n' + '=' .repeat(60));
console.log('\n📋 Instrucciones para probar Tongyi:\n');
console.log('1. Reinicia el servidor: npm run dev');
console.log('2. Abre modo incógnito: Ctrl + Shift + N');
console.log('3. Ve a: http://localhost:3000');
console.log('4. Crea un NUEVO chat');
console.log('5. Pregunta algo sobre actualidad:');
console.log('   "¿Cuáles son las noticias sobre IA en Colombia?"');
console.log('\n🎯 Verifica:');
console.log('   ✅ Respuesta en español (sin caracteres chinos)');
console.log('   ✅ Sección "📚 Fuentes consultadas:" con URLs');
console.log('\n');














