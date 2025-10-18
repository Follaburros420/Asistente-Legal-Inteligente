#!/usr/bin/env node

/**
 * Script para probar el parser de bibliografía corregido
 */

// Simular el parser corregido
function parseBibliographyCorrected(content) {
  if (!content) {
    return { bibliographyItems: [], contentWithoutBibliography: "" }
  }

  const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i
  const URL_REGEX = /(https?:\/\/[^\s)]+)/i

  const removeDiacritics = (value) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const lines = content.split(/\r?\n/)

  let headingIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const normalizedLine = removeDiacritics(line).toLowerCase()
    const isHeading = /^#{2,6}\s/.test(line.trim())
    const containsKeyword =
      normalizedLine.includes("bibliografia") ||
      normalizedLine.includes("fuentes consultadas") ||
      normalizedLine.includes("fuentes utilizadas") ||
      normalizedLine.includes("fuentes citadas") ||
      normalizedLine.includes("bibliography")

    // Buscar tanto headings como líneas que contengan bibliografía
    if ((isHeading && containsKeyword) || (!isHeading && containsKeyword && normalizedLine.includes("📚"))) {
      headingIndex = i
      break
    }
  }

  // Si no encontramos un heading específico, buscar líneas con URLs o enlaces markdown
  if (headingIndex === -1) {
    const urlLines = []
    let foundNonUrlLine = false
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      
      if (!line) {
        continue
      }
      
      if (MARKDOWN_LINK_REGEX.test(line) || URL_REGEX.test(line)) {
        urlLines.unshift(i)
      } else if (line.length > 10 && !line.includes('http') && !line.includes('www')) {
        urlLines.unshift(i)
      } else if (urlLines.length > 0) {
        foundNonUrlLine = true
        break
      }
    }
    
    if (urlLines.length >= 2) {
      headingIndex = urlLines[0]
    } else {
      return {
        bibliographyItems: [],
        contentWithoutBibliography: content
      }
    }
  }

  let endIndex = lines.length
  for (let j = headingIndex + 1; j < lines.length; j++) {
    const trimmed = lines[j].trim()
    if (!trimmed) continue
    if (/^#{1,6}\s/.test(trimmed)) {
      endIndex = j
      break
    }
    if (/^---+$/.test(trimmed)) {
      endIndex = j
      break
    }
  }

  const bibliographyLines = lines.slice(headingIndex + 1, endIndex)
  const normalizedEntries = bibliographyLines
    .map(line => line.replace(/^\s*[-*]\s*/, "").replace(/^\s*\d+[\).\s]+/, "").trim())
    .filter(entry => entry.length > 0)

  let bibliographyItems = normalizedEntries.map((entry, index) => {
    const markdownMatch = MARKDOWN_LINK_REGEX.exec(entry)
    if (markdownMatch) {
      return {
        id: `item-${index}`,
        title: markdownMatch[1].trim(),
        url: markdownMatch[2].trim(),
        type: 'ley'
      }
    }
    return {
      id: `item-${index}`,
      title: entry,
      url: null,
      type: 'ley'
    }
  })

  return {
    bibliographyItems,
    contentWithoutBibliography: content
  }
}

function testCorrectedBibliographyParsing() {
  console.log('\n🔧 PRUEBA DEL PARSER DE BIBLIOGRAFÍA CORREGIDO');
  console.log('='.repeat(70));

  const testCases = [
    {
      name: 'Caso 1: Saludo simple (NO debería detectar bibliografía)',
      content: `hola`
    },
    {
      name: 'Caso 2: Respuesta con texto que contiene "fuentes" (NO debería detectar bibliografía)',
      content: `Para mayor eficiencia, le recomiendo incluir en su pregunta:

El área del derecho que consulta (civil, laboral, constitucional, etc.)

La ley o código específico que le interesa

Cualquier artículo o norma que ya haya identificado

Estoy a su disposición.`
    },
    {
      name: 'Caso 3: Bibliografía real (SÍ debería detectar bibliografía)',
      content: `El artículo 90 del Código Civil establece que...

## 📚 Fuentes Consultadas

1. [Código Civil Artículo 90](https://www.leyes.co/codigo-civil/articulo-90)
2. [Leyes desde 1992](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=6921)`
    },
    {
      name: 'Caso 4: Texto con "fuentes" pero sin bibliografía real',
      content: `Para mayor eficiencia, le recomiendo incluir en su pregunta:

El área del derecho que consulta (civil, laboral, constitucional, etc.)

La ley o código específico que le interesa

Cualquier artículo o norma que ya haya identificado

Estoy a su disposición.

Doctrina
Fuente
Para mayor eficiencia, le recomiendo incluir en su pregunta:`
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n📝 ${testCase.name}`);
    console.log('-'.repeat(50));
    
    const result = parseBibliographyCorrected(testCase.content);
    
    console.log(`✅ Bibliografía encontrada: ${result.bibliographyItems.length} items`);
    
    if (result.bibliographyItems.length > 0) {
      console.log('📋 Items encontrados:');
      result.bibliographyItems.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.title}`);
        if (item.url) {
          console.log(`      URL: ${item.url}`);
        }
      });
    } else {
      console.log('❌ No se encontraron items de bibliografía');
    }
    
    console.log(`📄 Contenido sin bibliografía: ${result.contentWithoutBibliography.length} caracteres`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('🎯 PRUEBA DEL PARSER CORREGIDO COMPLETADA');
}

testCorrectedBibliographyParsing();
