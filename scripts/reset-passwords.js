/**
 * Script para resetear contraseñas de usuarios
 * Uso: node scripts/reset-passwords.js
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://givjfonqaiqhsjjjzedc.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpdmpmb25xYWlxaHNqamp6ZWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE4NzU3MiwiZXhwIjoyMDY3NzYzNTcyfQ.41C4P-gF2LxdpR0qGuAu61WV0NO1fl3edztxq0DLmXg'

const USERS = [
  { email: 'legal@dikaiosgroup.com', password: 'TempPass2026!' },
  { email: 'derecho704@hotmail.com', password: 'TempPass2026!' },
  { email: 'hsepulvedapatino@yahoo.es', password: 'TempPass2026!' },
  { email: 'fhg8@hotmail.com', password: 'TempPass2026!' },
  { email: 'dixonjafeth@gmail.com', password: 'TempPass2026!' }
]

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function findUserByEmail(email) {
  const { data: authUsers, error } = await supabase.auth.admin.listUsers()
  
  if (error) {
    console.error(`❌ Error listando usuarios: ${error.message}`)
    return null
  }
  
  const user = authUsers.users.find(u => u.email === email)
  return user
}

async function resetPassword(email, newPassword) {
  console.log(`\n📧 Procesando: ${email}`)
  
  // Buscar usuario
  const user = await findUserByEmail(email)
  
  if (!user) {
    console.log(`  ❌ Usuario no encontrado`)
    return false
  }
  
  console.log(`  ✅ Usuario encontrado: ${user.id}`)
  console.log(`  📅 Creado: ${user.created_at}`)
  console.log(`  ✉️  Email confirmado: ${user.email_confirmed_at ? 'SÍ' : 'NO'}`)
  
  // Actualizar contraseña
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  )
  
  if (error) {
    console.error(`  ❌ Error actualizando contraseña: ${error.message}`)
    return false
  }
  
  console.log(`  ✅ Contraseña actualizada exitosamente`)
  
  // Asegurar que el email esté confirmado
  if (!user.email_confirmed_at) {
    console.log(`  📝 Confirmando email...`)
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    )
    
    if (confirmError) {
      console.error(`  ⚠️  Error confirmando email: ${confirmError.message}`)
    } else {
      console.log(`  ✅ Email confirmado`)
    }
  }
  
  return true
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  RESET DE CONTRASEÑAS - USUARIOS PROFESIONALES')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  let successCount = 0
  
  for (const user of USERS) {
    const success = await resetPassword(user.email, user.password)
    if (success) successCount++
  }
  
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  RESUMEN')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`✅ Usuarios actualizados: ${successCount}/${USERS.length}`)
  console.log('\n📧 Credenciales actualizadas:')
  USERS.forEach(u => {
    console.log(`   • ${u.email}`)
    console.log(`     Contraseña: ${u.password}`)
  })
  console.log('═══════════════════════════════════════════════════════════\n')
}

main().catch(console.error)
