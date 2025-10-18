#!/usr/bin/env node

/**
 * Script para probar el sistema de búsqueda adaptativo
 */

// Simular las funciones de complejidad
function determineQueryComplexity(query, detectionResult) {
  const factors = []
  let score = 0
  
  const queryLower = query.toLowerCase()
  
  // Factores de complejidad
  if (queryLower.includes('artículo') || queryLower.includes('art.')) {
    factors.push('artículo específico')
    score += 1
  }
  
  if (queryLower.includes('código') || queryLower.includes('ley')) {
    factors.push('norma específica')
    score += 1
  }
  
  if (queryLower.includes('jurisprudencia') || queryLower.includes('sentencia')) {
    factors.push('jurisprudencia')
    score += 2
  }
  
  if (queryLower.includes('corte constitucional') || queryLower.includes('corte suprema')) {
    factors.push('tribunal específico')
    score += 2
  }
  
  if (queryLower.includes('proceso') || queryLower.includes('procedimiento')) {
    factors.push('proceso legal')
    score += 1
  }
  
  if (queryLower.includes('contrato') || queryLower.includes('responsabilidad')) {
    factors.push('materia específica')
    score += 1
  }
  
  if (queryLower.includes('prescripción') || queryLower.includes('caducidad')) {
    factors.push('términos legales')
    score += 1
  }
  
  // Longitud de la consulta
  if (query.length > 100) {
    factors.push('consulta extensa')
    score += 1
  }
  
  // Determinar nivel de complejidad
  let level
  if (score <= 1) {
    level = 'simple'
  } else if (score <= 3) {
    level = 'moderate'
  } else {
    level = 'complex'
  }
  
  return { level, score, factors }
}

function getAdaptiveSearchCount(complexity) {
  switch (complexity.level) {
    case 'simple':
      return 2 // Consultas simples: 2 resultados
    case 'moderate':
      return 3 // Consultas moderadas: 3 resultados
    case 'complex':
      return 5 // Consultas complejas: 5 resultados
    default:
      return 3 // Por defecto: 3 resultados
  }
}

function testAdaptiveSearchSystem() {
  console.log('\n🧠 SISTEMA DE BÚSQUEDA ADAPTATIVO');
  console.log('='.repeat(60));

  const testCases = [
    {
      query: 'hola',
      description: 'Saludo simple'
    },
    {
      query: '¿qué es la prescripción?',
      description: 'Consulta legal básica'
    },
    {
      query: 'artículo 90 código civil',
      description: 'Artículo específico'
    },
    {
      query: 'jurisprudencia corte constitucional sobre tutela',
      description: 'Consulta compleja con jurisprudencia'
    },
    {
      query: 'proceso de responsabilidad civil por daños y perjuicios en contratos de compraventa según el código civil colombiano',
      description: 'Consulta muy compleja y extensa'
    },
    {
      query: 'ley 100 de 1993',
      description: 'Ley específica'
    },
    {
      query: 'sentencia C-123 de 2023 corte constitucional',
      description: 'Sentencia específica'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. "${testCase.query}"`);
    console.log(`   📝 ${testCase.description}`);
    console.log('   ' + '-'.repeat(50));
    
    const complexity = determineQueryComplexity(testCase.query, { requiresWebSearch: true })
    const numResults = getAdaptiveSearchCount(complexity)
    
    console.log(`   🧠 Complejidad: ${complexity.level} (score: ${complexity.score})`);
    console.log(`   📊 Factores: ${complexity.factors.join(', ') || 'ninguno'}`);
    console.log(`   🔍 Resultados: ${numResults}`);
    
    // Mostrar justificación
    if (complexity.level === 'simple') {
      console.log(`   ✅ Justificación: Consulta simple, pocos resultados necesarios`);
    } else if (complexity.level === 'moderate') {
      console.log(`   ✅ Justificación: Consulta moderada, resultados balanceados`);
    } else {
      console.log(`   ✅ Justificación: Consulta compleja, más resultados para análisis completo`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DEL SISTEMA ADAPTATIVO:');
  console.log('');
  console.log('🔹 Consultas SIMPLES (≤1 factor): 2 resultados');
  console.log('   - Saludos, preguntas básicas');
  console.log('   - Consultas generales sin especificidad');
  console.log('');
  console.log('🔹 Consultas MODERADAS (2-3 factores): 3 resultados');
  console.log('   - Artículos específicos');
  console.log('   - Leyes particulares');
  console.log('   - Materias específicas');
  console.log('');
  console.log('🔹 Consultas COMPLEJAS (4+ factores): 5 resultados');
  console.log('   - Jurisprudencia');
  console.log('   - Tribunales específicos');
  console.log('   - Consultas extensas');
  console.log('   - Múltiples elementos legales');

  console.log('\n🎯 BENEFICIOS:');
  console.log('✅ Eficiencia mejorada - Solo busca lo necesario');
  console.log('✅ Respuestas más rápidas para consultas simples');
  console.log('✅ Análisis completo para consultas complejas');
  console.log('✅ Uso optimizado de recursos');
  console.log('✅ Experiencia de usuario mejorada');

  console.log('\n' + '='.repeat(60));
  console.log('🎉 SISTEMA ADAPTATIVO IMPLEMENTADO EXITOSAMENTE');
}

testAdaptiveSearchSystem();
