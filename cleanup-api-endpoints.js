const fs = require('fs');
const path = require('path');

console.log('🧹 Analizando y limpiando endpoints API redundantes...\n');

// Endpoints a eliminar (redundantes o no utilizados)
const endpointsToDelete = [
  'app/api/chat/anthropic',
  'app/api/chat/azure', 
  'app/api/chat/custom',
  'app/api/chat/google',
  'app/api/chat/groq',
  'app/api/chat/mistral',
  'app/api/chat/openai',
  'app/api/chat/perplexity',
  'app/api/chat/robust',
  'app/api/chat/sequential-thinking',
  'app/api/chat/web-only',
  'app/api/diagnose',
  'app/api/diagnose-api-key',
  'app/api/diagnose-complete',
  'app/api/keys',
  'app/api/retrieval/process-advanced',
  'app/api/retrieval/process/docx',
  'app/api/search/advanced',
  'app/api/test-auth',
  'app/api/test-document-processing',
  'app/api/test-openrouter',
  'app/api/test-openrouter-embeddings',
  'app/api/test-tools',
  'app/api/tongyi/direct-search',
  'app/api/tongyi/final-search',
  'app/api/tongyi/search',
  'app/api/tongyi/searx-search',
  'app/api/tongyi/test-integration',
  'app/api/tools/legal-search'
];

// Endpoints a conservar (críticos para el funcionamiento)
const endpointsToKeep = [
  'app/api/chat/legal',          // Endpoint principal del asistente legal
  'app/api/chat/simple',         // Endpoint simple con búsqueda
  'app/api/chat/simple-direct',  // Endpoint directo optimizado
  'app/api/chat/tools',          // Endpoint con herramientas
  'app/api/chat/independent',    // Endpoint independiente
  'app/api/chat/openrouter',     // Endpoint OpenRouter
  'app/api/retrieval/process',   // Procesamiento de documentos
  'app/api/retrieval/retrieve',  // Recuperación de información
  'app/api/search',              // Búsqueda básica
  'app/api/tools/web-search',    // Herramienta de búsqueda web
  'app/api/command',             // Comandos del sistema
  'app/api/assistants/openai',   // Asistentes OpenAI
  'app/api/username/available',  // Verificación de username
  'app/api/username/get',        // Obtención de username
  'app/auth/callback'            // Autenticación
];

console.log('📊 Análisis de endpoints:');
console.log(`   🗑️ Endpoints a eliminar: ${endpointsToDelete.length}`);
console.log(`   ✅ Endpoints a conservar: ${endpointsToKeep.length}`);

let deletedCount = 0;
let errorCount = 0;
let totalSizeSaved = 0;

for (const endpoint of endpointsToDelete) {
  try {
    if (fs.existsSync(endpoint)) {
      // Calcular tamaño antes de eliminar
      const stats = getDirectorySize(endpoint);
      totalSizeSaved += stats.size;
      
      // Eliminar recursivamente
      fs.rmSync(endpoint, { recursive: true, force: true });
      console.log(`✅ Eliminado: ${endpoint} (${formatBytes(stats.size)})`);
      deletedCount++;
    } else {
      console.log(`⚠️ No encontrado: ${endpoint}`);
    }
  } catch (error) {
    console.log(`❌ Error eliminando ${endpoint}:`, error.message);
    errorCount++;
  }
}

console.log(`\n📊 Resumen de limpieza:`);
console.log(`   ✅ Endpoints eliminados: ${deletedCount}`);
console.log(`   ❌ Errores: ${errorCount}`);
console.log(`   💾 Espacio ahorrado: ${formatBytes(totalSizeSaved)}`);

// Función para calcular tamaño de directorio
function getDirectorySize(dirPath) {
  let totalSize = 0;
  let fileCount = 0;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        const dirStats = getDirectorySize(fullPath);
        totalSize += dirStats.size;
        fileCount += dirStats.files;
      } else {
        totalSize += stats.size;
        fileCount++;
      }
    }
  } catch (error) {
    // Ignorar errores en archivos individuales
  }
  
  return { size: totalSize, files: fileCount };
}

// Función para formatear bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

console.log(`\n🎉 Limpieza de endpoints API completada!`);
console.log(`   📁 Estructura API simplificada`);
console.log(`   🚀 Mejora en rendimiento`);
console.log(`   🔧 Mantenimiento más sencillo`);

// Crear resumen de cambios
const summary = {
  endpointsDeleted: deletedCount,
  endpointsKept: endpointsToKeep.length,
  spaceSaved: formatBytes(totalSizeSaved),
  timestamp: new Date().toISOString(),
  remainingEndpoints: endpointsToKeep
};

fs.writeFileSync('api-cleanup-summary.json', JSON.stringify(summary, null, 2));
console.log(`\n📄 Resumen guardado en api-cleanup-summary.json`);
