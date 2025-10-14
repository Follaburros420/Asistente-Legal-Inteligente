#!/usr/bin/env node

/**
 * Script para diagnosticar problemas de interfaz de usuario
 */

const http = require('http')
const https = require('https')

async function checkServer() {
  console.log('🔍 Diagnosticando servidor y interfaz...\n')

  // Verificar servidor principal
  console.log('📡 Verificando servidor principal...')
  try {
    const response = await fetch('http://localhost:3000')
    if (response.ok) {
      console.log('✅ Servidor principal: OK')
      console.log(`   Status: ${response.status}`)
      console.log(`   Content-Type: ${response.headers.get('content-type')}`)
      console.log(`   Content-Length: ${response.headers.get('content-length')} bytes`)
    } else {
      console.log('❌ Servidor principal: Error')
      console.log(`   Status: ${response.status}`)
    }
  } catch (error) {
    console.log('❌ Servidor principal: No responde')
    console.log(`   Error: ${error.message}`)
  }

  // Verificar endpoint de diagnóstico
  console.log('\n🔧 Verificando endpoint de diagnóstico...')
  try {
    const response = await fetch('http://localhost:3000/api/diagnose')
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Endpoint de diagnóstico: OK')
      console.log(`   Status: ${data.status}`)
      console.log(`   URL: ${data.configuration?.url}`)
      console.log(`   Has Anon Key: ${data.configuration?.hasAnonKey}`)
      console.log(`   Has Service Key: ${data.configuration?.hasServiceKey}`)
    } else {
      console.log('❌ Endpoint de diagnóstico: Error')
      console.log(`   Status: ${response.status}`)
    }
  } catch (error) {
    console.log('❌ Endpoint de diagnóstico: No responde')
    console.log(`   Error: ${error.message}`)
  }

  // Verificar archivos estáticos
  console.log('\n📁 Verificando archivos estáticos...')
  try {
    const response = await fetch('http://localhost:3000/_next/static/css/app/[locale]/layout.css')
    if (response.ok) {
      console.log('✅ CSS: OK')
      console.log(`   Status: ${response.status}`)
    } else {
      console.log('❌ CSS: Error')
      console.log(`   Status: ${response.status}`)
    }
  } catch (error) {
    console.log('❌ CSS: No responde')
    console.log(`   Error: ${error.message}`)
  }

  // Verificar JavaScript
  console.log('\n⚡ Verificando JavaScript...')
  try {
    const response = await fetch('http://localhost:3000/_next/static/chunks/pages/_app.js')
    if (response.ok) {
      console.log('✅ JavaScript: OK')
      console.log(`   Status: ${response.status}`)
    } else {
      console.log('❌ JavaScript: Error')
      console.log(`   Status: ${response.status}`)
    }
  } catch (error) {
    console.log('❌ JavaScript: No responde')
    console.log(`   Error: ${error.message}`)
  }

  // Verificar variables de entorno
  console.log('\n🔐 Verificando variables de entorno...')
  require('dotenv').config({ path: '.env.local' })
  
  const envVars = {
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'OPENROUTER_API_KEY': process.env.OPENROUTER_API_KEY
  }

  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      console.log(`✅ ${key}: Configurada`)
    } else {
      console.log(`❌ ${key}: No configurada`)
    }
  })

  console.log('\n🌐 Instrucciones para el navegador:')
  console.log('1. Abre http://localhost:3000 en tu navegador')
  console.log('2. Presiona F12 para abrir las herramientas de desarrollador')
  console.log('3. Ve a la pestaña "Console" para ver errores de JavaScript')
  console.log('4. Ve a la pestaña "Network" para ver si hay recursos que no cargan')
  console.log('5. Presiona Ctrl+F5 para forzar la recarga de la página')
  console.log('6. Si persisten problemas, prueba en modo incógnito')

  console.log('\n🔧 Comandos útiles:')
  console.log('- Limpiar caché: rm -rf .next && npm run dev')
  console.log('- Ver logs: npm run dev (en otra terminal)')
  console.log('- Verificar puerto: netstat -an | findstr :3000')
}

// Ejecutar diagnóstico
checkServer()
  .then(() => {
    console.log('\n✅ Diagnóstico completado')
  })
  .catch(error => {
    console.log('\n❌ Error en diagnóstico:', error.message)
  })















