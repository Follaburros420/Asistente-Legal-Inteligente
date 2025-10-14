require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

console.log('\n🔍 Verificando configuración de Supabase...\n')

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

console.log('📋 Variables de entorno:')
console.log('NEXT_PUBLIC_SUPABASE_URL:', NEXT_PUBLIC_SUPABASE_URL ? '✅ Configurada' : '❌ NO configurada')
console.log('  Valor:', NEXT_PUBLIC_SUPABASE_URL || 'undefined')
console.log('')
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ NO configurada')
console.log('  Valor:', SUPABASE_SERVICE_ROLE_KEY ? `${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'undefined')
console.log('')
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ NO configurada')
console.log('  Valor:', NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'undefined')
console.log('')
console.log('OPENROUTER_API_KEY:', OPENROUTER_API_KEY ? '✅ Configurada' : '❌ NO configurada')
console.log('  Valor:', OPENROUTER_API_KEY ? `${OPENROUTER_API_KEY.substring(0, 20)}...` : 'undefined')

console.log('\n🔍 Verificando formato de URL de Supabase:')
if (NEXT_PUBLIC_SUPABASE_URL) {
  if (NEXT_PUBLIC_SUPABASE_URL.includes('supabase.co')) {
    console.log('✅ URL apunta a Supabase Cloud')
  } else if (NEXT_PUBLIC_SUPABASE_URL.includes('localhost') || NEXT_PUBLIC_SUPABASE_URL.includes('127.0.0.1')) {
    console.log('⚠️  URL apunta a Supabase Local (esto podría causar problemas)')
  } else {
    console.log('❓ URL no reconocida')
  }
} else {
  console.log('❌ URL no configurada')
}

console.log('\n✅ Verificación completa\n')














