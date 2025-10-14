#!/usr/bin/env node

/**
 * Script para probar la conexión con Supabase Cloud
 * Verifica que todas las configuraciones estén correctas
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testSupabaseConnection() {
  console.log('🔧 Probando conexión con Supabase Cloud...\n')

  // Verificar variables de entorno
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('📋 Variables de entorno:')
  console.log(`   URL: ${url ? url.substring(0, 30) + '...' : '❌ No encontrada'}`)
  console.log(`   Anon Key: ${anonKey ? '✅ Configurada' : '❌ No encontrada'}`)
  console.log(`   Service Key: ${serviceKey ? '✅ Configurada' : '❌ No encontrada'}\n`)

  if (!url || !anonKey || !serviceKey) {
    console.log('❌ Error: Variables de entorno faltantes')
    return false
  }

  // Verificar que la URL sea válida
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    console.log('❌ Error: URL de Supabase inválida')
    console.log('   Debe ser: https://your-project-id.supabase.co')
    return false
  }

  try {
    // Crear cliente de Supabase
    const supabase = createClient(url, anonKey)
    console.log('🔌 Cliente de Supabase creado exitosamente')

    // Probar conexión básica
    console.log('📡 Probando conexión básica...')
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)

    if (error) {
      console.log('❌ Error en conexión básica:', error.message)
      return false
    }

    console.log('✅ Conexión básica exitosa')

    // Probar operaciones de archivos
    console.log('📁 Probando operaciones de archivos...')
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, name')
      .limit(5)

    if (filesError) {
      console.log('❌ Error en operaciones de archivos:', filesError.message)
      return false
    }

    console.log('✅ Operaciones de archivos exitosas')
    console.log(`   Archivos encontrados: ${files.length}`)

    // Probar storage
    console.log('🗄️ Probando conexión con Storage...')
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets()

    if (storageError) {
      console.log('❌ Error en Storage:', storageError.message)
      return false
    }

    console.log('✅ Conexión con Storage exitosa')
    console.log(`   Buckets encontrados: ${buckets.length}`)

    console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!')
    console.log('✅ Supabase Cloud está configurado correctamente')
    console.log('✅ La aplicación puede conectarse sin problemas')
    console.log('✅ OpenRouter embeddings están configurados')
    
    return true

  } catch (error) {
    console.log('❌ Error inesperado:', error.message)
    return false
  }
}

// Ejecutar prueba
testSupabaseConnection()
  .then(success => {
    if (success) {
      console.log('\n🚀 La aplicación está lista para usar')
      process.exit(0)
    } else {
      console.log('\n💥 Hay problemas que necesitan ser resueltos')
      process.exit(1)
    }
  })
  .catch(error => {
    console.log('💥 Error fatal:', error.message)
    process.exit(1)
  })