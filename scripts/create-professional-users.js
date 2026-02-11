/**
 * Script para crear usuarios con plan profesional por 6 meses
 * Uso: node scripts/create-professional-users.js
 */

const { createClient } = require('@supabase/supabase-js')

// Configuración - Usar variables de entorno o valores del proyecto
const SUPABASE_URL = 'https://givjfonqaiqhsjjjzedc.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpdmpmb25xYWlxaHNqamp6ZWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE4NzU3MiwiZXhwIjoyMDY3NzYzNTcyfQ.41C4P-gF2LxdpR0qGuAu61WV0NO1fl3edztxq0DLmXg'

console.log('🔌 Conectando a:', SUPABASE_URL)

// Usuarios a crear
const USERS = [
  {
    email: 'legal@dikaiosgroup.com',
    displayName: 'Dikaios Legal',
    password: 'TempPass2026!'
  },
  {
    email: 'derecho704@hotmail.com',
    displayName: 'Usuario Derecho704',
    password: 'TempPass2026!'
  },
  {
    email: 'hsepulvedapatino@yahoo.es',
    displayName: 'H. Sepulveda Patino',
    password: 'TempPass2026!'
  },
  {
    email: 'fhg8@hotmail.com',
    displayName: 'Usuario FHG8',
    password: 'TempPass2026!'
  },
  {
    email: 'dixonjafeth@gmail.com',
    displayName: 'Dixon Jafeth',
    password: 'TempPass2026!'
  }
]

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function findProfessionalPlan() {
  console.log('🔍 Buscando plan profesional...')
  
  const { data: plans, error } = await supabase
    .from('plans')
    .select('id, name, plan_type, amount_in_cents')
    .or('plan_type.eq.pro,name.ilike.%pro%,name.ilike.%profesional%')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)

  if (error) {
    console.error('❌ Error buscando plan:', error.message)
    throw error
  }

  if (!plans || plans.length === 0) {
    // Intentar buscar cualquier plan activo
    const { data: anyPlan, error: anyPlanError } = await supabase
      .from('plans')
      .select('id, name, plan_type')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
    
    if (anyPlanError || !anyPlan || anyPlan.length === 0) {
      throw new Error('No se encontró ningún plan activo en la base de datos')
    }
    
    console.log(`⚠️  No se encontró plan profesional específico, usando: ${anyPlan[0].name}`)
    return anyPlan[0].id
  }

  console.log(`✅ Plan profesional encontrado: ${plans[0].name} (${plans[0].id})`)
  return plans[0].id
}

async function findUserByEmail(email) {
  // Buscar en auth.users por email
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers()
  
  if (listError) {
    console.error(`  ⚠️  No se pudo listar usuarios: ${listError.message}`)
    return null
  }
  
  const authUser = authUsers.users.find(u => u.email === email)
  return authUser ? authUser.id : null
}

async function createOrUpdateUser(userData) {
  const { email, displayName, password } = userData
  
  console.log(`\n📧 Procesando: ${email}`)
  
  // Intentar encontrar usuario existente
  let userId = await findUserByEmail(email)
  
  if (userId) {
    console.log(`  ⚠️  Usuario ya existe en auth: ${userId}`)
    
    // Verificar si tiene perfil
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (!existingProfile) {
      console.log(`  📝 Creando perfil faltante...`)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          display_name: displayName,
          username: email.split('@')[0],
          has_onboarded: true,
          bio: 'Usuario profesional de ALI - Asistente Legal Inteligente'
        })
      
      if (profileError) {
        console.error(`  ❌ Error creando perfil: ${profileError.message}`)
      } else {
        console.log(`  ✅ Perfil creado`)
      }
    } else {
      console.log(`  ✅ Perfil existente: ${existingProfile.display_name}`)
    }
    
    return { userId, isNew: false }
  }
  
  // Crear nuevo usuario en auth.users
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName
    }
  })
  
  if (authError) {
    console.error(`  ❌ Error creando usuario auth: ${authError.message}`)
    throw authError
  }
  
  userId = authUser.user.id
  console.log(`  ✅ Usuario auth creado: ${userId}`)
  
  // Crear perfil
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      display_name: displayName,
      username: email.split('@')[0],
      has_onboarded: true,
      bio: 'Usuario profesional de ALI - Asistente Legal Inteligente'
    })
  
  if (profileError) {
    console.error(`  ❌ Error creando perfil: ${profileError.message}`)
  } else {
    console.log(`  ✅ Perfil creado`)
  }
  
  return { userId, isNew: true }
}

async function createWorkspace(userId) {
  // Verificar si ya tiene workspace
  const { data: existingWorkspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('user_id', userId)
    .eq('is_home', true)
    .maybeSingle()
  
  if (existingWorkspace) {
    console.log(`  🏠 Workspace existente: ${existingWorkspace.id}`)
    return existingWorkspace.id
  }
  
  // Crear workspace
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({
      user_id: userId,
      name: 'Home',
      is_home: true,
      default_model: 'google/gemini-3-pro-preview',
      default_context_length: 4096,
      default_temperature: 0.5,
      default_prompt: 'Eres ALI, un asistente de investigación jurídica especializado en derecho colombiano.',
      description: 'Espacio de trabajo profesional para investigación jurídica.',
      embeddings_provider: 'openai',
      include_profile_context: true,
      include_workspace_instructions: true,
      instructions: 'Como asistente legal especializado en derecho colombiano, proporciona información precisa basada en la legislación vigente.'
    })
    .select('id')
    .single()
  
  if (error) {
    console.error(`  ❌ Error creando workspace: ${error.message}`)
    throw error
  }
  
  console.log(`  ✅ Workspace creado: ${workspace.id}`)
  return workspace.id
}

async function createSubscription(userId, workspaceId, planId) {
  // Verificar si ya tiene suscripción activa
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id, status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()
  
  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 6) // 6 meses
  
  if (existingSub) {
    console.log(`  📝 Suscripción existente: ${existingSub.status}`)
    
    // Actualizar a profesional y extender a 6 meses
    const { error } = await supabase
      .from('subscriptions')
      .update({
        plan_id: planId,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        workspace_id: workspaceId,
        metadata: {
          updated_by: 'migration_script',
          updated_at: new Date().toISOString(),
          plan_duration_months: 6,
          is_promotional: true
        }
      })
      .eq('id', existingSub.id)
    
    if (error) {
      console.error(`  ❌ Error actualizando suscripción: ${error.message}`)
      throw error
    }
    
    console.log(`  ✅ Suscripción actualizada hasta: ${periodEnd.toISOString().split('T')[0]}`)
    return
  }
  
  // Crear nueva suscripción
  const { error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      plan_id: planId,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      metadata: {
        created_by: 'migration_script',
        created_at: new Date().toISOString(),
        plan_duration_months: 6,
        is_promotional: true
      }
    })
  
  if (error) {
    console.error(`  ❌ Error creando suscripción: ${error.message}`)
    throw error
  }
  
  console.log(`  ✅ Suscripción creada hasta: ${periodEnd.toISOString().split('T')[0]}`)
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  CREACIÓN DE USUARIOS PROFESIONALES - 6 MESES')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  try {
    // 1. Encontrar plan profesional
    const professionalPlanId = await findProfessionalPlan()
    
    console.log(`\n📋 Creando ${USERS.length} usuarios...\n`)
    
    // 2. Procesar cada usuario
    for (const userData of USERS) {
      try {
        // Crear usuario
        const { userId, isNew } = await createOrUpdateUser(userData)
        
        // Crear workspace
        const workspaceId = await createWorkspace(userId)
        
        // Crear suscripción
        await createSubscription(userId, workspaceId, professionalPlanId)
        
        console.log(`  ✨ Completado: ${userData.displayName}`)
        
      } catch (userError) {
        console.error(`  ❌ Error procesando ${userData.email}:`, userError.message)
        // Continuar con el siguiente usuario
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('  RESUMEN')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('✅ Proceso completado')
    console.log('\n📧 Usuarios creados/actualizados:')
    USERS.forEach(u => {
      console.log(`   • ${u.email}`)
      console.log(`     Contraseña: ${u.password}`)
    })
    console.log('\n⏱️  Duración: 6 meses desde hoy')
    console.log('═══════════════════════════════════════════════════════════\n')
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message)
    process.exit(1)
  }
}

main()
