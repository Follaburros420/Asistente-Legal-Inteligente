/**
 * Script para verificar la API key de OpenRouter en la base de datos
 */

async function checkOpenRouterApiKey() {
  console.log('\n' + '='.repeat(80))
  console.log('🔍 VERIFICACIÓN DE API KEY DE OPENROUTER')
  console.log('='.repeat(80))
  
  try {
    // Verificar variable de entorno
    const envApiKey = process.env.OPENROUTER_API_KEY
    console.log(`📋 Variable de entorno OPENROUTER_API_KEY:`)
    console.log(`   - Configurada: ${envApiKey ? '✅' : '❌'}`)
    console.log(`   - Valor: ${envApiKey ? envApiKey.substring(0, 20) + '...' : 'No configurada'}`)
    console.log(`   - Es placeholder: ${envApiKey === 'sk-or-v1-your-api-key-here' ? '⚠️' : '✅'}`)
    
    // Intentar conectar a Supabase
    console.log(`\n📋 Verificando conexión a Supabase...`)
    
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    
    // Verificar si hay perfiles con API key
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('email, openrouter_api_key')
      .not('openrouter_api_key', 'is', null)
    
    if (error) {
      console.log(`❌ Error al consultar base de datos: ${error.message}`)
      return
    }
    
    console.log(`✅ Conexión a Supabase exitosa`)
    console.log(`📊 Perfiles con API key encontrados: ${profiles?.length || 0}`)
    
    if (profiles && profiles.length > 0) {
      profiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. Email: ${profile.email}`)
        console.log(`      API Key: ${profile.openrouter_api_key ? profile.openrouter_api_key.substring(0, 20) + '...' : 'No configurada'}`)
      })
      
      // Usar la primera API key encontrada
      const firstProfile = profiles[0]
      if (firstProfile.openrouter_api_key) {
        console.log(`\n🎯 Usando API key de: ${firstProfile.email}`)
        
        // Probar la API key
        console.log(`🧪 Probando API key con OpenRouter...`)
        
        const OpenAI = (await import('openai')).default
        const openai = new OpenAI({
          apiKey: firstProfile.openrouter_api_key,
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
          
          // Crear archivo .env.local con la API key que funciona
          const fs = await import('fs')
          const envContent = `OPENROUTER_API_KEY=${firstProfile.openrouter_api_key}`
          fs.writeFileSync('.env.local', envContent)
          console.log(`✅ API key guardada en .env.local`)
          
        } catch (apiError) {
          console.log(`❌ Error al probar API key: ${apiError.message}`)
        }
        
      } else {
        console.log(`❌ No hay API key válida en la base de datos`)
      }
    } else {
      console.log(`❌ No se encontraron perfiles con API key configurada`)
    }
    
  } catch (error) {
    console.log(`❌ Error general: ${error.message}`)
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('🏁 VERIFICACIÓN COMPLETADA')
  console.log('='.repeat(80))
}

// Ejecutar la verificación
checkOpenRouterApiKey().catch(console.error)
