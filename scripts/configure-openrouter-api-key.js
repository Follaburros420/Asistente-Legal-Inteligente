/**
 * Script para configurar la API key de OpenRouter
 */

async function configureOpenRouterApiKey() {
  console.log('\n' + '='.repeat(80))
  console.log('🔑 CONFIGURACIÓN DE API KEY DE OPENROUTER')
  console.log('='.repeat(80))
  
  console.log(`\n📋 PASOS PARA CONFIGURAR LA API KEY:`)
  console.log(`\n1. 🌐 Ve a OpenRouter: https://openrouter.ai/`)
  console.log(`2. 🔐 Crea una cuenta o inicia sesión`)
  console.log(`3. 🔑 Ve a API Keys: https://openrouter.ai/keys`)
  console.log(`4. ➕ Crea una nueva API Key`)
  console.log(`5. 📋 Copia la API Key (empieza con sk-or-v1-...)`)
  
  console.log(`\n📝 Una vez que tengas tu API key, ejecuta:`)
  console.log(`\n   echo "OPENROUTER_API_KEY=sk-or-v1-tu-api-key-real" > .env.local`)
  console.log(`\n   O reemplaza manualmente el contenido del archivo .env.local`)
  
  console.log(`\n🔄 Después de configurar la API key:`)
  console.log(`1. Reinicia el servidor: npm run dev`)
  console.log(`2. Prueba el sistema: node scripts/test-with-error-handling.js`)
  
  console.log(`\n✅ El sistema usará Tongyi Deep Research 30B A3B para:`)
  console.log(`   - Procesar consultas legales colombianas`)
  console.log(`   - Buscar información en internet`)
  console.log(`   - Generar respuestas estructuradas como chatbot legal`)
  console.log(`   - Incluir fuentes verificables`)
  
  console.log('\n' + '='.repeat(80))
  console.log('🏁 INSTRUCCIONES COMPLETADAS')
  console.log('='.repeat(80))
}

// Ejecutar las instrucciones
configureOpenRouterApiKey().catch(console.error)
