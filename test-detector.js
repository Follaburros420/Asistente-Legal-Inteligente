// Script de prueba simple para el detector
const testCases = [
  "hola",
  "buenos días", 
  "¿qué es la prescripción?",
  "artículo 15 de la constitución"
];

// Simular la lógica del detector
function testDetector(query) {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Patrones que indican consulta NO legal
  const nonLegalPatterns = [
    /^(hola|hi|hello|buenos?\s+dias|buenas?\s+tardes|buenas?\s+noches)$/i,
    /como\s+estas/i,
    /que\s+tal/i
  ];
  
  // Verificar patrones NO legales primero
  for (const pattern of nonLegalPatterns) {
    if (pattern.test(normalizedQuery)) {
      return {
        requiresWebSearch: false,
        confidence: 0.95,
        reason: 'Consulta identificada como saludo o conversación casual'
      };
    }
  }
  
  // Palabras clave legales
  const legalKeywords = [
    'derecho', 'ley', 'norma', 'articulo', 'codigo', 'prescripcion',
    'constitucion', 'tutela', 'jurisprudencia', 'corte', 'proceso'
  ];
  
  const legalMatches = legalKeywords.filter(keyword => 
    normalizedQuery.includes(keyword.toLowerCase())
  );
  
  if (legalMatches.length > 0) {
    return {
      requiresWebSearch: true,
      confidence: 0.9,
      reason: `Contiene palabras clave legales: ${legalMatches.join(', ')}`
    };
  }
  
  return {
    requiresWebSearch: false,
    confidence: 0.6,
    reason: 'Consulta ambigua, no se detectó contexto legal específico'
  };
}

console.log('🧪 PROBANDO DETECTOR LEGAL INTELIGENTE');
console.log('='.repeat(50));

testCases.forEach((query, index) => {
  console.log(`\n${index + 1}. "${query}"`);
  const result = testDetector(query);
  console.log(`   🔍 Requiere búsqueda: ${result.requiresWebSearch ? '✅ SÍ' : '❌ NO'}`);
  console.log(`   🎯 Confianza: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`   📋 Razón: ${result.reason}`);
});

console.log('\n' + '='.repeat(50));
console.log('✅ Prueba completada');
