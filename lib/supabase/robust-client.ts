import { Database } from "@/supabase/types"
import { createBrowserClient } from "@supabase/ssr"

// Función para obtener configuración robusta de Supabase
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase configuration. Please check your environment variables:\n' +
      '- NEXT_PUBLIC_SUPABASE_URL\n' +
      '- NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  // Verificar que la URL sea válida
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    throw new Error(
      `Invalid Supabase URL: ${url}\n` +
      'Expected format: https://your-project-id.supabase.co'
    )
  }

  return { url, anonKey }
}

// Variable para cachear el cliente
let _supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null

// Cliente de Supabase robusto con lazy initialization
export const supabase = (() => {
  // Retornar proxy que crea el cliente solo cuando se necesita
  return new Proxy({} as ReturnType<typeof createBrowserClient<Database>>, {
    get(target, prop) {
      // Crear cliente solo cuando se accede por primera vez
      if (!_supabaseClient) {
        try {
          const { url, anonKey } = getSupabaseConfig()
          
          console.log('🔧 Configurando cliente de Supabase:', {
            url: url.substring(0, 30) + '...',
            hasAnonKey: !!anonKey
          })

          _supabaseClient = createBrowserClient<Database>(url, anonKey)
        } catch (error) {
          console.error('❌ Error configurando Supabase:', error)
          throw error
        }
      }
      
      const value = (_supabaseClient as any)[prop]
      return typeof value === 'function' ? value.bind(_supabaseClient) : value
    }
  })
})()

// Función para verificar la conexión
export async function verifySupabaseConnection() {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1)
    
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`)
    }

    console.log('✅ Conexión con Supabase verificada exitosamente')
    return true
  } catch (error) {
    console.error('❌ Error verificando conexión con Supabase:', error)
    throw error
  }
}

// Función para obtener configuración de Supabase para el servidor
export function getServerSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase server configuration. Please check your environment variables:\n' +
      '- NEXT_PUBLIC_SUPABASE_URL\n' +
      '- SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return { url, serviceRoleKey }
}



