/**
 * Configuración robusta de Supabase
 * Centraliza toda la configuración para evitar problemas de conectividad
 */

import { Database } from "@/supabase/types"
import { createBrowserClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

// Configuración centralizada
export const SUPABASE_CONFIG = {
  // URLs y claves
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  
  // Configuración adicional
  options: {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
}

// Validación de configuración
export function validateSupabaseConfig() {
  const errors: string[] = []
  
  if (!SUPABASE_CONFIG.url) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required')
  } else if (!SUPABASE_CONFIG.url.startsWith('https://') || !SUPABASE_CONFIG.url.includes('.supabase.co')) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase Cloud URL')
  }
  
  if (!SUPABASE_CONFIG.anonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
  }
  
  if (!SUPABASE_CONFIG.serviceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required')
  }
  
  if (errors.length > 0) {
    throw new Error(`Supabase configuration errors:\n${errors.join('\n')}`)
  }
  
  return true
}

// Cliente de navegador robusto
export function createSupabaseBrowserClient() {
  try {
    validateSupabaseConfig()
    
    console.log('🔧 Creando cliente de navegador de Supabase:', {
      url: SUPABASE_CONFIG.url?.substring(0, 30) + '...',
      hasAnonKey: !!SUPABASE_CONFIG.anonKey
    })
    
    return createBrowserClient<Database>(
      SUPABASE_CONFIG.url!,
      SUPABASE_CONFIG.anonKey!,
      SUPABASE_CONFIG.options
    )
  } catch (error) {
    console.error('❌ Error creando cliente de navegador:', error)
    throw error
  }
}

// Cliente de servidor robusto
export function createSupabaseServerClient() {
  try {
    validateSupabaseConfig()
    
    console.log('🔧 Creando cliente de servidor de Supabase:', {
      url: SUPABASE_CONFIG.url?.substring(0, 30) + '...',
      hasServiceKey: !!SUPABASE_CONFIG.serviceRoleKey
    })
    
    return createClient<Database>(
      SUPABASE_CONFIG.url!,
      SUPABASE_CONFIG.serviceRoleKey!,
      SUPABASE_CONFIG.options
    )
  } catch (error) {
    console.error('❌ Error creando cliente de servidor:', error)
    throw error
  }
}

// Instancias singleton
export const supabaseBrowser = createSupabaseBrowserClient()
export const supabaseServer = createSupabaseServerClient()

// Función de verificación de conexión
export async function verifySupabaseConnection() {
  try {
    console.log('🔄 Verificando conexión con Supabase...')
    
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      throw new Error(`Connection failed: ${error.message}`)
    }
    
    console.log('✅ Conexión con Supabase verificada exitosamente')
    return true
  } catch (error) {
    console.error('❌ Error verificando conexión:', error)
    throw error
  }
}

// Función para obtener configuración en formato de debug
export function getSupabaseDebugInfo() {
  return {
    url: SUPABASE_CONFIG.url,
    hasAnonKey: !!SUPABASE_CONFIG.anonKey,
    hasServiceKey: !!SUPABASE_CONFIG.serviceRoleKey,
    anonKeyPreview: SUPABASE_CONFIG.anonKey?.substring(0, 20) + '...',
    serviceKeyPreview: SUPABASE_CONFIG.serviceRoleKey?.substring(0, 20) + '...'
  }
}















