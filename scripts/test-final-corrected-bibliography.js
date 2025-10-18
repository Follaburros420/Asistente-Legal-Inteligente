#!/usr/bin/env node

/**
 * Script final para probar el parser de bibliografía completamente corregido
 */

// Simular el parser completamente corregido
function parseBibliographyFinalCorrected(content) {
  if (!content) {
    return { bibliographyItems: [], contentWithoutBibliography: "" }
  }

  const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i
  const URL_REGEX = /(https?:\/\/[^\s)]+)/i

  const removeDiacritics = (value) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const sanitizeContentSpacing = (value) =>
    value.replace(/\n{3,}/g, "\n\n").trim()

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
    // Solo buscar bibliografía al final si hay URLs reales (más estricto)
    const urlLines = []
    let hasRealUrls = false
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      
      if (!line) {
        continue
      }
      
      // Solo considerar líneas con URLs reales o enlaces markdown
      if (MARKDOWN_LINK_REGEX.test(line) || URL_REGEX.test(line)) {
        urlLines.unshift(i)
        hasRealUrls = true
      } else if (urlLines.length > 0 && line.length > 10 && !line.includes('http') && !line.includes('www')) {
        // Solo agregar si ya tenemos URLs y parece ser una fuente
        urlLines.unshift(i)
      } else if (urlLines.length > 0) {
        // Si ya encontramos URLs y esta línea no es una URL, parar
        break
      }
    }
    
    // Solo usar detección automática si hay URLs reales y al menos 2 líneas
    if (hasRealUrls && urlLines.length >= 2) {
      headingIndex = urlLines[0]
    } else {
      return {
        bibliographyItems: [],
        contentWithoutBibliography: sanitizeContentSpacing(content)
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
    contentWithoutBibliography: sanitizeContentSpacing(content)
  }
}

function testFinalCorrectedBibliographyParsing() {
  console.log('\n🎯 PRUEBA FINAL DEL PARSER DE BIBLIOGRAFÍA CORREGIDO');
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
      name: 'Caso 4: Texto problemático del usuario (NO debería detectar bibliografía)',
      content: `Para mayor eficiencia, le recomiendo incluir en su pregunta:

El área del derecho que consulta (civil, laboral, constitucional, etc.)

La ley o código específico que le interesa

Cualquier artículo o norma que ya haya identificado

Estoy a su disposición.

Doctrina
Fuente
Para mayor eficiencia, le recomiendo incluir en su pregunta:

El área del derecho que consulta (civil, laboral, constitucional, etc.)

La ley o código específico que le interesa

Cualquier artículo o norma que ya haya identificado

Estoy a su disposición.`
    },
    {
      name: 'Caso 5: URLs reales al final (SÍ debería detectar bibliografía)',
      content: `El artículo 90 del Código Civil establece que la existencia legal de las personas naturales comienza desde el nacimiento y termina con la muerte.

[Código Civil Artículo 90](https://www.leyes.co/codigo-civil/articulo-90)
[Leyes desde 1992](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=6921)
[Artículo 90 del Código Civil](https://conceptosjuridicos.com/articulo-90-codigo-civil)`
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n📝 ${testCase.name}`);
    console.log('-'.repeat(50));
    
    const result = parseBibliographyFinalCorrected(testCase.content);
    
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
  console.log('🎉 PRUEBA FINAL DEL PARSER CORREGIDO COMPLETADA');
}

testFinalCorrectedBibliographyParsing();
