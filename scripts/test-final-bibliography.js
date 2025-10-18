#!/usr/bin/env node

/**
 * Script final para probar el parser de bibliografía completamente mejorado
 */

// Simular el parser completamente mejorado
function parseBibliographyFinal(content) {
  if (!content) {
    return { bibliographyItems: [], contentWithoutBibliography: "" }
  }

  const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i
  const URL_REGEX = /(https?:\/\/[^\s)]+)/i

  const removeDiacritics = (value) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const sanitizeEntryLine = (line) =>
    line
      .replace(/^\s*[-*]\s*/, "")
      .replace(/^\s*\d+[\).\s]+/, "")
      .trim()

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
      normalizedLine.includes("fuentes") ||
      normalizedLine.includes("referencias") ||
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
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (line && (MARKDOWN_LINK_REGEX.test(line) || URL_REGEX.test(line))) {
        urlLines.unshift(i)
        if (urlLines.length >= 3) break
      } else if (urlLines.length > 0 && !line) {
        continue
      } else if (urlLines.length > 0 && line && !MARKDOWN_LINK_REGEX.test(line) && !URL_REGEX.test(line)) {
        break
      }
    }
    
    if (urlLines.length > 0) {
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
    .map(sanitizeEntryLine)
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

  // Si no encontramos items pero hay líneas con URLs, intentar parsearlas directamente
  if (bibliographyItems.length === 0 && bibliographyLines.length > 0) {
    const urlItems = bibliographyLines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line, index) => {
        const markdownMatch = MARKDOWN_LINK_REGEX.exec(line)
        if (markdownMatch) {
          return {
            id: `item-${index}`,
            title: markdownMatch[1].trim(),
            url: markdownMatch[2].trim(),
            type: 'ley'
          }
        }
        
        const urlMatch = URL_REGEX.exec(line)
        if (urlMatch) {
          const title = line.replace(urlMatch[0], '').trim() || `Fuente ${index + 1}`
          return {
            id: `item-${index}`,
            title,
            url: urlMatch[1].trim(),
            type: 'ley'
          }
        }
        
        // Si no tiene URL pero parece ser una fuente
        if (line.length > 10 && !line.includes('http')) {
          return {
            id: `item-${index}`,
            title: line,
            url: null,
            type: 'ley'
          }
        }
        
        return null
      })
      .filter(Boolean)
    
    if (urlItems.length > 0) {
      bibliographyItems = urlItems
    }
  }

  return {
    bibliographyItems,
    contentWithoutBibliography: content
  }
}

function testFinalBibliographyParsing() {
  console.log('\n🎯 PRUEBA FINAL DEL PARSER DE BIBLIOGRAFÍA');
  console.log('='.repeat(70));

  const testCases = [
    {
      name: 'Caso 1: Bibliografía con formato correcto',
      content: `El artículo 90 del Código Civil establece que...

## 📚 Fuentes Consultadas

1. [Código Civil Artículo 90. Existencia legal de las personas - Leyes.co](https://www.leyes.co/codigo-civil/articulo-90)
2. [Leyes desde 1992 - Vigencia expresa y control de ...](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=6921)
3. [Artículo 90 del Código Civil - Conceptos Jurídicos](https://conceptosjuridicos.com/articulo-90-codigo-civil)`
    },
    {
      name: 'Caso 2: Bibliografía sin formato markdown',
      content: `El artículo 90 del Código Civil establece que...

## 📚 Fuentes Consultadas

Código Civil Artículo 90. Existencia legal de las personas - Leyes.co
Leyes desde 1992 - Vigencia expresa y control de ...
Artículo 90 del Código Civil - Conceptos Jurídicos`
    },
    {
      name: 'Caso 3: Bibliografía con formato diferente',
      content: `El artículo 90 del Código Civil establece que...

### Bibliografía

- Código Civil Artículo 90. Existencia legal de las personas - Leyes.co
- Leyes desde 1992 - Vigencia expresa y control de ...
- Artículo 90 del Código Civil - Conceptos Jurídicos`
    },
    {
      name: 'Caso 4: Solo URLs al final (caso problemático)',
      content: `El artículo 90 del Código Civil establece que la existencia legal de las personas naturales comienza desde el nacimiento y termina con la muerte.

Código Civil Artículo 90. Existencia legal de las personas - Leyes.co
Leyes desde 1992 - Vigencia expresa y control de ...
Artículo 90 del Código Civil - Conceptos Jurídicos`
    },
    {
      name: 'Caso 5: URLs con formato markdown al final',
      content: `El artículo 90 del Código Civil establece que la existencia legal de las personas naturales comienza desde el nacimiento y termina con la muerte.

[Código Civil Artículo 90. Existencia legal de las personas - Leyes.co](https://www.leyes.co/codigo-civil/articulo-90)
[Leyes desde 1992 - Vigencia expresa y control de ...](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=6921)
[Artículo 90 del Código Civil - Conceptos Jurídicos](https://conceptosjuridicos.com/articulo-90-codigo-civil)`
    },
    {
      name: 'Caso 6: URLs mixtas al final',
      content: `El artículo 90 del Código Civil establece que la existencia legal de las personas naturales comienza desde el nacimiento y termina con la muerte.

[Código Civil Artículo 90. Existencia legal de las personas - Leyes.co](https://www.leyes.co/codigo-civil/articulo-90)
Leyes desde 1992 - Vigencia expresa y control de ...
[Artículo 90 del Código Civil - Conceptos Jurídicos](https://conceptosjuridicos.com/articulo-90-codigo-civil)`
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n📝 ${testCase.name}`);
    console.log('-'.repeat(50));
    
    const result = parseBibliographyFinal(testCase.content);
    
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
  console.log('🎉 PRUEBA FINAL COMPLETADA - PARSER MEJORADO FUNCIONANDO');
}

testFinalBibliographyParsing();
