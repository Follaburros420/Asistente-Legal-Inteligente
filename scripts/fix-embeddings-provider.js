require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('\n🔧 Actualizando embeddings_provider de todos los workspaces a "openrouter"...\n')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno de Supabase')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixWorkspaces() {
  try {
    // Obtener todos los workspaces que tienen embeddings_provider como "openai"
    const { data: workspaces, error: selectError } = await supabase
      .from('workspaces')
      .select('id, name, embeddings_provider')
      .eq('embeddings_provider', 'openai')
    
    if (selectError) {
      console.error('❌ Error obteniendo workspaces:', selectError)
      return
    }
    
    if (!workspaces || workspaces.length === 0) {
      console.log('✅ No hay workspaces con embeddings_provider="openai". Todos ya están configurados correctamente.')
      return
    }
    
    console.log(`📋 Encontrados ${workspaces.length} workspaces con embeddings_provider="openai":\n`)
    workspaces.forEach(ws => {
      console.log(`  - ${ws.name} (ID: ${ws.id})`)
    })
    
    console.log('\n🔄 Actualizando a "openrouter"...\n')
    
    // Actualizar todos los workspaces a "openrouter"
    const { data: updated, error: updateError } = await supabase
      .from('workspaces')
      .update({ embeddings_provider: 'openrouter' })
      .eq('embeddings_provider', 'openai')
      .select()
    
    if (updateError) {
      console.error('❌ Error actualizando workspaces:', updateError)
      return
    }
    
    console.log(`✅ Actualizados ${updated.length} workspaces exitosamente:\n`)
    updated.forEach(ws => {
      console.log(`  ✓ ${ws.name} → embeddings_provider: ${ws.embeddings_provider}`)
    })
    
    console.log('\n🎉 ¡Todos los workspaces ahora usan OpenRouter para embeddings!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

async function fixChats() {
  try {
    // Obtener todos los chats que tienen embeddings_provider como "openai"
    const { data: chats, error: selectError } = await supabase
      .from('chats')
      .select('id, name, embeddings_provider')
      .eq('embeddings_provider', 'openai')
    
    if (selectError) {
      console.error('❌ Error obteniendo chats:', selectError)
      return
    }
    
    if (!chats || chats.length === 0) {
      console.log('\n✅ No hay chats con embeddings_provider="openai". Todos ya están configurados correctamente.')
      return
    }
    
    console.log(`\n📋 Encontrados ${chats.length} chats con embeddings_provider="openai"`)
    
    console.log('\n🔄 Actualizando chats a "openrouter"...\n')
    
    // Actualizar todos los chats a "openrouter"
    const { data: updated, error: updateError } = await supabase
      .from('chats')
      .update({ embeddings_provider: 'openrouter' })
      .eq('embeddings_provider', 'openai')
      .select()
    
    if (updateError) {
      console.error('❌ Error actualizando chats:', updateError)
      return
    }
    
    console.log(`✅ Actualizados ${updated.length} chats exitosamente`)
    
    console.log('\n🎉 ¡Todos los chats ahora usan OpenRouter para embeddings!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

async function run() {
  await fixWorkspaces()
  await fixChats()
  console.log('\n✅ Script completado. Recarga la aplicación en el navegador.\n')
}

run()














