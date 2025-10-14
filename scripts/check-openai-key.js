require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

console.log('\n🔑 Verificando OpenAI API Key...\n')

const openaiKey = process.env.OPENAI_API_KEY

if (openaiKey) {
  console.log('✅ OPENAI_API_KEY encontrada')
  console.log(`   Comienza con: ${openaiKey.substring(0, 10)}...`)
  console.log(`   Longitud: ${openaiKey.length} caracteres`)
} else {
  console.log('❌ OPENAI_API_KEY NO encontrada')
  console.log('\n📝 Para agregar la API key:')
  console.log('1. Ve a: https://platform.openai.com/api-keys')
  console.log('2. Crea una nueva API key')
  console.log('3. Agrégala al archivo .env:')
  console.log('   OPENAI_API_KEY=sk-...')
  console.log('\n💰 Costo de embeddings:')
  console.log('   ~$0.0001 por 1,000 tokens')
  console.log('   Ejemplo: 100 páginas ≈ $0.01')
}

console.log('')














