#!/usr/bin/env node

/**
 * Script para generar imágenes PNG del robot desde el SVG
 */

const fs = require('fs')
const path = require('path')

// SVG del robot (versión simplificada para mejor renderizado)
const robotSVG = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Cabeza del robot -->
  <circle cx="256" cy="200" r="120" fill="#E5E7EB" stroke="#000000" stroke-width="4"/>
  
  <!-- Antena -->
  <line x1="256" y1="80" x2="256" y2="120" stroke="#000000" stroke-width="3"/>
  <circle cx="256" cy="75" r="8" fill="#9CA3AF"/>
  
  <!-- Ojos -->
  <circle cx="220" cy="180" r="25" fill="#FFFFFF" stroke="#000000" stroke-width="3"/>
  <circle cx="220" cy="180" r="15" fill="#000000"/>
  <circle cx="225" cy="175" r="4" fill="#FFFFFF"/>
  
  <!-- Ojo cerrado (guiño) -->
  <path d="M 292 175 Q 302 180 292 185" stroke="#000000" stroke-width="3" fill="none"/>
  
  <!-- Sonrisa -->
  <path d="M 200 220 Q 256 250 312 220" stroke="#000000" stroke-width="3" fill="none"/>
  
  <!-- Auriculares -->
  <ellipse cx="180" cy="200" rx="35" ry="25" fill="#4B5563" stroke="#000000" stroke-width="2"/>
  <ellipse cx="332" cy="200" rx="35" ry="25" fill="#4B5563" stroke="#000000" stroke-width="2"/>
  <line x1="145" y1="200" x2="367" y2="200" stroke="#000000" stroke-width="3"/>
  
  <!-- Cuerpo (traje) -->
  <rect x="180" y="320" width="152" height="120" fill="#374151" stroke="#000000" stroke-width="4" rx="10"/>
  
  <!-- Camisa -->
  <rect x="200" y="340" width="112" height="80" fill="#FFFFFF" stroke="#000000" stroke-width="2" rx="5"/>
  
  <!-- Corbata -->
  <polygon points="256,340 240,380 272,380" fill="#F97316" stroke="#000000" stroke-width="2"/>
  <rect x="250" y="380" width="12" height="40" fill="#F97316" stroke="#000000" stroke-width="2"/>
  
  <!-- Cuello -->
  <rect x="240" y="320" width="32" height="20" fill="#FFFFFF" stroke="#000000" stroke-width="2"/>
  
  <!-- Brazos -->
  <rect x="140" y="340" width="40" height="80" fill="#374151" stroke="#000000" stroke-width="3" rx="20"/>
  <rect x="332" y="340" width="40" height="80" fill="#374151" stroke="#000000" stroke-width="3" rx="20"/>
  
  <!-- Manos -->
  <circle cx="160" cy="440" r="15" fill="#E5E7EB" stroke="#000000" stroke-width="2"/>
  <circle cx="352" cy="440" r="15" fill="#E5E7EB" stroke="#000000" stroke-width="2"/>
  
  <!-- Piernas -->
  <rect x="200" y="440" width="30" height="60" fill="#374151" stroke="#000000" stroke-width="3" rx="15"/>
  <rect x="282" y="440" width="30" height="60" fill="#374151" stroke="#000000" stroke-width="3" rx="15"/>
  
  <!-- Pies -->
  <ellipse cx="215" cy="510" rx="20" ry="8" fill="#1F2937" stroke="#000000" stroke-width="2"/>
  <ellipse cx="297" cy="510" rx="20" ry="8" fill="#1F2937" stroke="#000000" stroke-width="2"/>
</svg>`

// SVG del robot para tema claro (versión con colores invertidos)
const robotSVGLight = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Cabeza del robot -->
  <circle cx="256" cy="200" r="120" fill="#1F2937" stroke="#FFFFFF" stroke-width="4"/>
  
  <!-- Antena -->
  <line x1="256" y1="80" x2="256" y2="120" stroke="#FFFFFF" stroke-width="3"/>
  <circle cx="256" cy="75" r="8" fill="#6B7280"/>
  
  <!-- Ojos -->
  <circle cx="220" cy="180" r="25" fill="#000000" stroke="#FFFFFF" stroke-width="3"/>
  <circle cx="220" cy="180" r="15" fill="#FFFFFF"/>
  <circle cx="225" cy="175" r="4" fill="#000000"/>
  
  <!-- Ojo cerrado (guiño) -->
  <path d="M 292 175 Q 302 180 292 185" stroke="#FFFFFF" stroke-width="3" fill="none"/>
  
  <!-- Sonrisa -->
  <path d="M 200 220 Q 256 250 312 220" stroke="#FFFFFF" stroke-width="3" fill="none"/>
  
  <!-- Auriculares -->
  <ellipse cx="180" cy="200" rx="35" ry="25" fill="#9CA3AF" stroke="#FFFFFF" stroke-width="2"/>
  <ellipse cx="332" cy="200" rx="35" ry="25" fill="#9CA3AF" stroke="#FFFFFF" stroke-width="2"/>
  <line x1="145" y1="200" x2="367" y2="200" stroke="#FFFFFF" stroke-width="3"/>
  
  <!-- Cuerpo (traje) -->
  <rect x="180" y="320" width="152" height="120" fill="#E5E7EB" stroke="#FFFFFF" stroke-width="4" rx="10"/>
  
  <!-- Camisa -->
  <rect x="200" y="340" width="112" height="80" fill="#000000" stroke="#FFFFFF" stroke-width="2" rx="5"/>
  
  <!-- Corbata -->
  <polygon points="256,340 240,380 272,380" fill="#F97316" stroke="#FFFFFF" stroke-width="2"/>
  <rect x="250" y="380" width="12" height="40" fill="#F97316" stroke="#FFFFFF" stroke-width="2"/>
  
  <!-- Cuello -->
  <rect x="240" y="320" width="32" height="20" fill="#000000" stroke="#FFFFFF" stroke-width="2"/>
  
  <!-- Brazos -->
  <rect x="140" y="340" width="40" height="80" fill="#E5E7EB" stroke="#FFFFFF" stroke-width="3" rx="20"/>
  <rect x="332" y="340" width="40" height="80" fill="#E5E7EB" stroke="#FFFFFF" stroke-width="3" rx="20"/>
  
  <!-- Manos -->
  <circle cx="160" cy="440" r="15" fill="#1F2937" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="352" cy="440" r="15" fill="#1F2937" stroke="#FFFFFF" stroke-width="2"/>
  
  <!-- Piernas -->
  <rect x="200" y="440" width="30" height="60" fill="#E5E7EB" stroke="#FFFFFF" stroke-width="3" rx="15"/>
  <rect x="282" y="440" width="30" height="60" fill="#E5E7EB" stroke="#FFFFFF" stroke-width="3" rx="15"/>
  
  <!-- Pies -->
  <ellipse cx="215" cy="510" rx="20" ry="8" fill="#F3F4F6" stroke="#FFFFFF" stroke-width="2"/>
  <ellipse cx="297" cy="510" rx="20" ry="8" fill="#F3F4F6" stroke="#FFFFFF" stroke-width="2"/>
</svg>`

function generateImages() {
  console.log('🤖 Generando imágenes del robot...\n')

  // Crear directorio si no existe
  const publicDir = path.join(__dirname, '..', 'public')
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  // Guardar SVG original
  fs.writeFileSync(path.join(publicDir, 'robot-logo.svg'), robotSVG)
  console.log('✅ robot-logo.svg creado')

  // Guardar SVG para tema claro
  fs.writeFileSync(path.join(publicDir, 'robot-logo-light.svg'), robotSVGLight)
  console.log('✅ robot-logo-light.svg creado')

  // Crear versiones PNG básicas (placeholder)
  const createPNGPlaceholder = (filename, size) => {
    const pngSVG = robotSVG.replace('width="512" height="512"', `width="${size}" height="${size}"`)
    fs.writeFileSync(path.join(publicDir, filename), pngSVG)
    console.log(`✅ ${filename} creado (${size}x${size})`)
  }

  // Generar iconos en diferentes tamaños
  createPNGPlaceholder('icon-192x192.png', 192)
  createPNGPlaceholder('icon-256x256.png', 256)
  createPNGPlaceholder('icon-512x512.png', 512)

  // Generar logos
  createPNGPlaceholder('DARK_BRAND_LOGO.png', 512)
  createPNGPlaceholder('LIGHT_BRAND_LOGO.png', 512)

  // Generar imágenes de proveedores
  createPNGPlaceholder('providers/perplexity.png', 256)
  createPNGPlaceholder('providers/mistral.png', 256)
  createPNGPlaceholder('providers/meta.png', 256)
  createPNGPlaceholder('providers/groq.png', 256)

  console.log('\n🎉 Todas las imágenes del robot han sido generadas!')
  console.log('\n📋 Archivos creados:')
  console.log('- robot-logo.svg (versión original)')
  console.log('- robot-logo-light.svg (versión para tema claro)')
  console.log('- icon-192x192.png, icon-256x256.png, icon-512x512.png (iconos)')
  console.log('- DARK_BRAND_LOGO.png, LIGHT_BRAND_LOGO.png (logos)')
  console.log('- providers/*.png (imágenes de proveedores)')
  
  console.log('\n⚠️  Nota: Las imágenes PNG son placeholders SVG.')
  console.log('   Para producción, convierte los SVG a PNG usando herramientas como:')
  console.log('   - Inkscape: inkscape --export-png=file.png --export-width=512 file.svg')
  console.log('   - ImageMagick: convert file.svg -resize 512x512 file.png')
  console.log('   - Online: https://convertio.co/svg-png/')
}

// Ejecutar generación
generateImages()















