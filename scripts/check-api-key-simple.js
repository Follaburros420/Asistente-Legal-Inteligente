/**
 * Script simple para verificar la API key de OpenRouter
 */

async function checkOpenRouterApiKeySimple() {
  console.log('\n' + '='.repeat(80))
  console.log('🔍 VERIFICACIÓN SIMPLE DE API KEY DE OPENROUTER')
  console.log('='.repeat(80))
  
  // Verificar variable de entorno
  const envApiKey = process.env.OPENROUTER_API_KEY
  console.log(`📋 Variable de entorno OPENROUTER_API_KEY:`)
  console.log(`   - Configurada: ${envApiKey ? '✅' : '❌'}`)
  console.log(`   - Valor: ${envApiKey ? envApiKey.substring(0, 20) + '...' : 'No configurada'}`)
  console.log(`   - Es placeholder: ${envApiKey === 'sk-or-v1-your-api-key-here' ? '⚠️' : '✅'}`)
  
  // Verificar archivo .env.local
  try {
    const fs = await import('fs')
    const path = await import('path')
    
    const envPath = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      console.log(`\n📋 Archivo .env.local encontrado:`)
      console.log(`   - Contenido: ${envContent}`)
      
      const apiKeyMatch = envContent.match(/OPENROUTER_API_KEY=(.+)/)
      if (apiKeyMatch) {
        const apiKey = apiKeyMatch[1]
        console.log(`   - API Key extraída: ${apiKey.substring(0, 20)}...`)
        console.log(`   - Es placeholder: ${apiKey === 'sk-or-v1-your-api-key-here' ? '⚠️' : '✅'}`)
        
        if (apiKey !== 'sk-or-v1-your-api-key-here') {
          console.log(`\n🧪 Probando API key con OpenRouter...`)
          
          const OpenAI = (await import('openai')).default
          const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://openrouter.ai/api/v1"
          })
          
          try {
            const completion = await openai.chat.completions.create({
              model: "alibaba/tongyi-deepresearch-30b-a3b",
              messages: [
                { role: "system", content: "Responde solo 'API key funcionando' si puedes leer este mensaje." },
                { role: "user", content: "Prueba" }
              ],
              max_tokens: 10
            })
            
            const response = completion.choices[0].message.content
            console.log(`✅ API key funcionando correctamente`)
            console.log(`📝 Respuesta de prueba: ${response}`)
            
          } catch (apiError) {
            console.log(`❌ Error al probar API key: ${apiError.message}`)
            if (apiError.status === 401) {
              console.log(`💡 La API key no es válida o ha expirado`)
            }
          }
        }
      }
    } else {
      console.log(`\n❌ Archivo .env.local no encontrado`)
    }
  } catch (error) {
    console.log(`❌ Error al leer archivo: ${error.message}`)
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('🏁 VERIFICACIÓN COMPLETADA')
  console.log('='.repeat(80))
  
  console.log(`\n💡 RECOMENDACIONES:`)
  console.log(`1. Obtén una API key válida de OpenRouter en: https://openrouter.ai/keys`)
  console.log(`2. Crea un archivo .env.local con: OPENROUTER_API_KEY=sk-or-v1-tu-api-key-real`)
  console.log(`3. Reinicia el servidor: npm run dev`)
  console.log(`4. Prueba el sistema nuevamente`)
}

// Ejecutar la verificación
checkOpenRouterApiKeySimple().catch(console.error)
