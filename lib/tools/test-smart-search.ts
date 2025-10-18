/**
 * Script de prueba para el sistema de búsqueda web inteligente
 * Prueba diferentes tipos de consultas para verificar el comportamiento
 */

import { detectLegalQuery, testLegalDetection } from './smart-legal-detector'
import { executeConditionalWebSearch } from './conditional-web-search'

// Casos de prueba
const testCases = [
  // Saludos - NO deberían buscar
  "Hola",
  "Buenos días",
  "¿Cómo estás?",
  "Gracias",
  "Adiós",
  
  // Conversación casual - NO deberían buscar
  "¿Qué tal el clima?",
  "¿Te gusta el fútbol?",
  "¿Qué música escuchas?",
  
  // Consultas legales específicas - SÍ deberían buscar
  "¿Qué es la prescripción?",
  "Artículo 15 de la Constitución",
  "Código Civil artículo 100",
  "¿Qué es la tutela?",
  "Derecho laboral en Colombia",
  "Jurisprudencia sobre contratos",
  "Corte Constitucional",
  "Proceso civil",
  
  // Consultas ambiguas - Depende del contexto
  "¿Qué es un contrato?",
  "Responsabilidad civil",
  "Derechos fundamentales",
  
  // Consultas muy específicas - SÍ deberían buscar
  "Ley 100 de 1993",
  "Decreto 1071 de 2015",
  "Sentencia C-123 de 2020",
  "Acción de tutela contra EPS",
  
  // Consultas mixtas
  "Hola, ¿qué es la prescripción?",
  "Buenos días, necesito información sobre contratos",
  "Gracias, pero también quería saber sobre la Corte Constitucional"
]

async function runTests() {
  console.log(`\n🧪 INICIANDO PRUEBAS DEL SISTEMA INTELIGENTE`)
  console.log(`${'='.repeat(80)}`)
  
  let totalTests = testCases.length
  let correctPredictions = 0
  let incorrectPredictions = 0
  
  for (let i = 0; i < testCases.length; i++) {
    const query = testCases[i]
    console.log(`\n${i + 1}. "${query}"`)
    
    try {
      // Probar solo la detección (más rápido)
      const detectionResult = detectLegalQuery(query)
      
      // Determinar si la predicción es correcta
      const isLegalQuery = query.toLowerCase().includes('derecho') || 
                          query.toLowerCase().includes('ley') ||
                          query.toLowerCase().includes('artículo') ||
                          query.toLowerCase().includes('código') ||
                          query.toLowerCase().includes('tutela') ||
                          query.toLowerCase().includes('jurisprudencia') ||
                          query.toLowerCase().includes('corte') ||
                          query.toLowerCase().includes('proceso') ||
                          query.toLowerCase().includes('contrato') ||
                          query.toLowerCase().includes('responsabilidad') ||
                          query.toLowerCase().includes('prescripción') ||
                          query.toLowerCase().includes('colombia') ||
                          query.toLowerCase().includes('constitucional')
      
      const isGreeting = query.toLowerCase().match(/^(hola|buenos?\s+días|buenas?\s+tardes|buenas?\s+noches|gracias|adiós)$/)
      const isCasual = query.toLowerCase().includes('clima') || 
                      query.toLowerCase().includes('fútbol') || 
                      query.toLowerCase().includes('música')
      
      const shouldSearch = isLegalQuery && !isGreeting && !isCasual
      
      const predictionCorrect = detectionResult.requiresWebSearch === shouldSearch
      
      if (predictionCorrect) {
        correctPredictions++
        console.log(`   ✅ CORRECTO: ${detectionResult.requiresWebSearch ? 'Buscar' : 'No buscar'} (${(detectionResult.confidence * 100).toFixed(1)}%)`)
      } else {
        incorrectPredictions++
        console.log(`   ❌ INCORRECTO: Predijo ${detectionResult.requiresWebSearch ? 'Buscar' : 'No buscar'}, debería ${shouldSearch ? 'Buscar' : 'No buscar'} (${(detectionResult.confidence * 100).toFixed(1)}%)`)
      }
      
      console.log(`   📋 Razón: ${detectionResult.reason}`)
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error}`)
      incorrectPredictions++
    }
  }
  
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📊 RESULTADOS FINALES:`)
  console.log(`   ✅ Correctos: ${correctPredictions}/${totalTests} (${((correctPredictions/totalTests)*100).toFixed(1)}%)`)
  console.log(`   ❌ Incorrectos: ${incorrectPredictions}/${totalTests} (${((incorrectPredictions/totalTests)*100).toFixed(1)}%)`)
  
  if (correctPredictions / totalTests >= 0.8) {
    console.log(`\n🎉 SISTEMA FUNCIONANDO CORRECTAMENTE (≥80% precisión)`)
  } else {
    console.log(`\n⚠️ SISTEMA NECESITA AJUSTES (<80% precisión)`)
  }
  
  console.log(`${'='.repeat(80)}\n`)
}

// Función para probar casos específicos con búsqueda real
async function testSpecificCases() {
  console.log(`\n🔍 PROBANDO CASOS ESPECÍFICOS CON BÚSQUEDA REAL`)
  console.log(`${'='.repeat(80)}`)
  
  const specificCases = [
    "Hola", // No debería buscar
    "¿Qué es la prescripción?", // Sí debería buscar
    "Artículo 15 de la Constitución", // Sí debería buscar
    "¿Cómo está el clima?" // No debería buscar
  ]
  
  for (const query of specificCases) {
    console.log(`\n🧪 Probando: "${query}"`)
    
    try {
      const result = await executeConditionalWebSearch(query, {
        logDetection: true
      })
      
      console.log(`   🔍 Búsqueda ejecutada: ${result.shouldSearch ? 'SÍ' : 'NO'}`)
      if (result.searchResults) {
        console.log(`   📊 Resultados: ${result.searchResults.results?.length || 0}`)
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error}`)
    }
  }
  
  console.log(`${'='.repeat(80)}\n`)
}

// Ejecutar pruebas
if (require.main === module) {
  runTests().then(() => {
    return testSpecificCases()
  }).catch(console.error)
}

export { runTests, testSpecificCases }
