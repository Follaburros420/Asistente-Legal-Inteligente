#!/usr/bin/env node

/**
 * Script para verificar errores específicos en la aplicación
 */

const http = require('http')

async function checkAppErrors() {
  console.log('🔍 Verificando errores específicos de la aplicación...\n')

  // Verificar página principal
  console.log('📄 Verificando página principal...')
  try {
    const response = await fetch('http://localhost:3000')
    const html = await response.text()
    
    if (html.includes('<!DOCTYPE html>')) {
      console.log('✅ HTML básico: OK')
    } else {
      console.log('❌ HTML básico: Problema')
    }
    
    if (html.includes('Comenzar Chat')) {
      console.log('✅ Contenido de la página: OK')
    } else {
      console.log('❌ Contenido de la página: No encontrado')
    }
    
    if (html.includes('_next/static')) {
      console.log('✅ Archivos estáticos: Referenciados')
    } else {
      console.log('❌ Archivos estáticos: No referenciados')
    }
    
  } catch (error) {
    console.log('❌ Error verificando página principal:', error.message)
  }

  // Verificar archivos CSS
  console.log('\n🎨 Verificando archivos CSS...')
  try {
    const response = await fetch('http://localhost:3000/_next/static/css/app/[locale]/layout.css')
    if (response.ok) {
      console.log('✅ CSS principal: OK')
    } else {
      console.log('❌ CSS principal: Error', response.status)
    }
  } catch (error) {
    console.log('❌ Error verificando CSS:', error.message)
  }

  // Verificar archivos JS (pueden no existir hasta que se cargue la página)
  console.log('\n⚡ Verificando archivos JavaScript...')
  try {
    // Intentar obtener el HTML para ver qué archivos JS se referencian
    const response = await fetch('http://localhost:3000')
    const html = await response.text()
    
    const jsMatches = html.match(/_next\/static\/chunks\/[^"]*\.js/g)
    if (jsMatches && jsMatches.length > 0) {
      console.log(`✅ Archivos JS referenciados: ${jsMatches.length}`)
      
      // Probar el primer archivo JS
      const firstJs = jsMatches[0]
      const jsResponse = await fetch(`http://localhost:3000/${firstJs}`)
      if (jsResponse.ok) {
        console.log('✅ Primer archivo JS: OK')
      } else {
        console.log('❌ Primer archivo JS: Error', jsResponse.status)
      }
    } else {
      console.log('❌ No se encontraron archivos JS referenciados')
    }
  } catch (error) {
    console.log('❌ Error verificando JavaScript:', error.message)
  }

  // Verificar configuración de Next.js
  console.log('\n⚙️ Verificando configuración de Next.js...')
  try {
    const fs = require('fs')
    const path = require('path')
    
    // Verificar next.config.js
    if (fs.existsSync('next.config.js')) {
      console.log('✅ next.config.js: Existe')
    } else {
      console.log('❌ next.config.js: No existe')
    }
    
    // Verificar package.json
    if (fs.existsSync('package.json')) {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      console.log('✅ package.json: Existe')
      console.log(`   Next.js version: ${packageJson.dependencies?.next || 'No encontrada'}`)
    } else {
      console.log('❌ package.json: No existe')
    }
    
    // Verificar .next directory
    if (fs.existsSync('.next')) {
      console.log('✅ .next directory: Existe')
    } else {
      console.log('❌ .next directory: No existe (necesita compilación)')
    }
    
  } catch (error) {
    console.log('❌ Error verificando configuración:', error.message)
  }

  console.log('\n🌐 Soluciones sugeridas:')
  console.log('1. Abre http://localhost:3000 en tu navegador')
  console.log('2. Presiona F12 y ve a la pestaña "Console"')
  console.log('3. Busca errores en rojo')
  console.log('4. Ve a la pestaña "Network" y recarga la página')
  console.log('5. Verifica que todos los recursos se carguen correctamente')
  console.log('6. Si hay errores 404, ejecuta: npm run build')
  console.log('7. Si persisten problemas, prueba: rm -rf .next && npm run dev')
}

// Ejecutar verificación
checkAppErrors()
  .then(() => {
    console.log('\n✅ Verificación completada')
  })
  .catch(error => {
    console.log('\n❌ Error en verificación:', error.message)
  })















