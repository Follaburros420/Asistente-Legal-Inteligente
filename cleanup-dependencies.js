const fs = require('fs');
const path = require('path');

console.log('🧹 Analizando dependencias no utilizadas...\n');

// Leer package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = packageJson.dependencies || {};
const devDependencies = packageJson.devDependencies || {};

console.log(`📊 Dependencias totales:`);
console.log(`   📦 Producción: ${Object.keys(dependencies).length}`);
console.log(`   🔧 Desarrollo: ${Object.keys(devDependencies).length}`);

// Función para buscar imports en archivos
function findImports(dirPath, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const imports = new Set();
  
  function traverseDirectory(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          traverseDirectory(fullPath);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Buscar diferentes patrones de import
            const importPatterns = [
              /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
              /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
              /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
            ];
            
            for (const pattern of importPatterns) {
              let match;
              while ((match = pattern.exec(content)) !== null) {
                let importPath = match[1];
                
                // Limpiar el path
                importPath = importPath.replace(/^[@\/\.]/, '').split('/')[0];
                
                // Convertir a nombre de paquete
                if (importPath && !importPath.startsWith('.') && !importPath.startsWith('/')) {
                  // Manejar casos especiales
                  if (importPath.startsWith('ui/')) continue;
                  if (importPath.startsWith('lib/')) continue;
                  if (importPath.startsWith('components/')) continue;
                  if (importPath.startsWith('app/')) continue;
                  if (importPath.startsWith('db/')) continue;
                  if (importPath.startsWith('context/')) continue;
                  if (importPath.startsWith('types/')) continue;
                  if (importPath.startsWith('hooks/')) continue;
                  if (importPath.startsWith('utils/')) continue;
                  if (importPath.startsWith('store/')) continue;
                  if (importPath.startsWith('middleware/')) continue;
                  if (importPath.includes('next/navigation')) {
                    imports.add('next');
                    continue;
                  }
                  if (importPath.includes('next-auth')) {
                    imports.add('next-auth');
                    continue;
                  }
                  
                  imports.add(importPath);
                }
              }
            }
          } catch (error) {
            // Ignorar errores en archivos individuales
          }
        }
      }
    } catch (error) {
      // Ignorar errores en directorios
    }
  }
  
  traverseDirectory(dirPath);
  return imports;
}

// Buscar imports en el proyecto
const usedImports = findImports('./app');
const libImports = findImports('./lib');
const componentImports = findImports('./components');

// Combinar todos los imports
const allImports = new Set([...usedImports, ...libImports, ...componentImports]);

console.log(`\n🔍 Imports encontrados: ${allImports.size}`);

// Analizar dependencias de producción
const unusedProduction = [];
const usedProduction = [];

for (const [dep, version] of Object.entries(dependencies)) {
  if (allImports.has(dep) || isCoreDependency(dep)) {
    usedProduction.push({ name: dep, version });
  } else {
    unusedProduction.push({ name: dep, version });
  }
}

// Analizar dependencias de desarrollo
const unusedDev = [];
const usedDev = [];

for (const [dep, version] of Object.entries(devDependencies)) {
  if (isDevDependencyUsed(dep)) {
    usedDev.push({ name: dep, version });
  } else {
    unusedDev.push({ name: dep, version });
  }
}

console.log(`\n📊 Análisis de dependencias de producción:`);
console.log(`   ✅ Usadas: ${usedProduction.length}`);
console.log(`   ❌ No usadas: ${unusedProduction.length}`);

console.log(`\n📊 Análisis de dependencias de desarrollo:`);
console.log(`   ✅ Usadas: ${usedDev.length}`);
console.log(`   ❌ No usadas: ${unusedDev.length}`);

// Mostrar dependencias no utilizadas
if (unusedProduction.length > 0) {
  console.log(`\n❌ Dependencias de producción NO UTILIZADAS:`);
  unusedProduction.forEach(dep => {
    console.log(`   - ${dep.name}@${dep.version}`);
  });
}

if (unusedDev.length > 0) {
  console.log(`\n❌ Dependencias de desarrollo NO UTILIZADAS:`);
  unusedDev.forEach(dep => {
    console.log(`   - ${dep.name}@${dep.version}`);
  });
}

// Funciones auxiliares
function isCoreDependency(dep) {
  const coreDeps = [
    'next', 'react', 'react-dom', 'typescript', '@types/node', 
    '@types/react', '@types/react-dom', 'tailwindcss', 'postcss',
    'autoprefixer', 'eslint', 'prettier', 'jest', '@testing-library'
  ];
  return coreDeps.some(core => dep.includes(core));
}

function isDevDependencyUsed(dep) {
  const alwaysUsedDevDeps = [
    'typescript', '@types/node', '@types/react', '@types/react-dom',
    'tailwindcss', 'postcss', 'autoprefixer', 'eslint', 'prettier',
    'jest', '@testing-library/react', '@testing-library/jest-dom'
  ];
  return alwaysUsedDevDeps.includes(dep) || dep.startsWith('@types/');
}

// Crear script de limpieza
const cleanupScript = `
#!/bin/bash
# Script para eliminar dependencias no utilizadas

echo "🧹 Eliminando dependencias no utilizadas..."

# Dependencias de producción no utilizadas
${unusedProduction.map(dep => `npm uninstall ${dep.name}`).join('\n')}

# Dependencias de desarrollo no utilizadas
${unusedDev.map(dep => `npm uninstall --save-dev ${dep.name}`).join('\n')}

echo "✅ Limpieza de dependencias completada"
echo "💾 Espacio ahorrado en node_modules"
`;

fs.writeFileSync('cleanup-dependencies.sh', cleanupScript);
fs.chmodSync('cleanup-dependencies.sh', '755');

// Crear resumen
const summary = {
  production: {
    total: Object.keys(dependencies).length,
    used: usedProduction.length,
    unused: unusedProduction.length,
    unusedList: unusedProduction
  },
  development: {
    total: Object.keys(devDependencies).length,
    used: usedDev.length,
    unused: unusedDev.length,
    unusedList: unusedDev
  },
  totalImports: allImports.size,
  timestamp: new Date().toISOString()
};

fs.writeFileSync('dependency-analysis.json', JSON.stringify(summary, null, 2));

console.log(`\n📄 Análisis guardado en dependency-analysis.json`);
console.log(`📜 Script de limpieza creado: cleanup-dependencies.sh`);
console.log(`\n💡 Para ejecutar la limpieza: bash cleanup-dependencies.sh`);

// Calcular espacio potencial ahorrado
const totalUnused = unusedProduction.length + unusedDev.length;
const estimatedSpace = totalUnused * 5; // Estimado de 5MB por dependencia

console.log(`\n📊 Resumen final:`);
console.log(`   🗑️ Dependencias a eliminar: ${totalUnused}`);
console.log(`   💾 Espacio estimado ahorrado: ~${estimatedSpace} MB`);
console.log(`   🚀 Mejora en tiempo de instalación: significativa`);

console.log(`\n🎉 Análisis de dependencias completado!`);
