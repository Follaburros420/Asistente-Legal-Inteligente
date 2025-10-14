#!/usr/bin/env node

/**
 * Script para diagnosticar y solucionar problemas del tema oscuro
 */

const http = require('http')

async function fixDarkTheme() {
  console.log('🌙 Diagnosticando problema del tema oscuro...\n')

  // Verificar página principal
  console.log('📄 Verificando página principal...')
  try {
    const response = await fetch('http://localhost:3000')
    const html = await response.text()
    
    // Verificar si tiene la clase dark
    if (html.includes('class="dark"')) {
      console.log('✅ Clase dark: Presente en HTML')
    } else {
      console.log('❌ Clase dark: No encontrada en HTML')
    }
    
    // Verificar color-scheme
    if (html.includes('color-scheme: dark')) {
      console.log('✅ Color-scheme: Configurado como dark')
    } else {
      console.log('❌ Color-scheme: No configurado como dark')
    }
    
    // Verificar CSS
    if (html.includes('_next/static/css')) {
      console.log('✅ CSS: Referenciado en HTML')
    } else {
      console.log('❌ CSS: No referenciado en HTML')
    }
    
  } catch (error) {
    console.log('❌ Error verificando página principal:', error.message)
  }

  // Verificar CSS
  console.log('\n🎨 Verificando archivos CSS...')
  try {
    const response = await fetch('http://localhost:3000/_next/static/css/app/[locale]/layout.css')
    const css = await response.text()
    
    if (css.includes('.dark {')) {
      console.log('✅ Estilos tema oscuro: Presentes en CSS')
    } else {
      console.log('❌ Estilos tema oscuro: No encontrados en CSS')
    }
    
    if (css.includes('--background: 0 0% 3.9%')) {
      console.log('✅ Variables CSS tema oscuro: Configuradas')
    } else {
      console.log('❌ Variables CSS tema oscuro: No configuradas')
    }
    
  } catch (error) {
    console.log('❌ Error verificando CSS:', error.message)
  }

  console.log('\n🔧 Soluciones aplicadas:')
  console.log('1. ✅ Corregido lang="en" a lang={locale} en layout.tsx')
  console.log('2. ✅ Agregado enableSystem={false} al ThemeProvider')
  console.log('3. ✅ Agregados estilos de respaldo en globals.css')
  console.log('4. ✅ Forzados estilos !important para bg-background y text-foreground')

  console.log('\n🌐 Instrucciones para el usuario:')
  console.log('1. Abre http://localhost:3000 en tu navegador')
  console.log('2. Presiona Ctrl+F5 para forzar recarga completa')
  console.log('3. Si sigue en negro, presiona F12 y ejecuta en la consola:')
  console.log('   document.documentElement.classList.add("dark")')
  console.log('4. Verifica que el body tenga las clases correctas:')
  console.log('   document.body.className')
  console.log('5. Si persiste, prueba en modo incógnito')

  console.log('\n🎯 Comandos de emergencia (ejecutar en consola del navegador):')
  console.log('// Forzar tema oscuro')
  console.log('document.documentElement.classList.add("dark")')
  console.log('document.body.style.backgroundColor = "hsl(0, 0%, 3.9%)"')
  console.log('document.body.style.color = "hsl(0, 0%, 98%)"')
  
  console.log('\n// Verificar estado actual')
  console.log('console.log("HTML classes:", document.documentElement.className)')
  console.log('console.log("Body classes:", document.body.className)')
  console.log('console.log("Body styles:", window.getComputedStyle(document.body))')
}

// Ejecutar diagnóstico
fixDarkTheme()
  .then(() => {
    console.log('\n✅ Diagnóstico completado')
  })
  .catch(error => {
    console.log('\n❌ Error en diagnóstico:', error.message)
  })















