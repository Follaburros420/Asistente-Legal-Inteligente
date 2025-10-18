#!/usr/bin/env node

/**
 * Script para diagnosticar problemas con la bibliografía
 */

require('dotenv').config();

// Simular el parser de bibliografía
function parseBibliography(content) {
  if (!content) {
    return { bibliographyItems: [], contentWithoutBibliography: "" }
  }

  const lines = content.split(/\r?\n/)

  let headingIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const normalizedLine = line.toLowerCase()
    const isHeading = /^#{2,6}\s/.test(line.trim())
    const containsKeyword =
      normalizedLine.includes("bibliografia") ||
      normalizedLine.includes("fuentes consultadas") ||
      normalizedLine.includes("fuentes utilizadas") ||
      normalizedLine.includes("fuentes citadas")

    if (isHeading && containsKeyword) {
      headingIndex = i
      break
    }
  }

  if (headingIndex === -1) {
    return {
      bibliographyItems: [],
      contentWithoutBibliography: content
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
  const bibliographyItems = bibliographyLines
    .map(line => line.replace(/^\s*[-*]\s*/, "").replace(/^\s*\d+[\).\s]+/, "").trim())
    .filter(entry => entry.length > 0)
    .map((entry, index) => {
      const markdownMatch = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i.exec(entry)
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

function testBibliographyParsing() {
  console.log('\n🔍 DIAGNÓSTICO DE BIBLIOGRAFÍA');
  console.log('='.repeat(60));

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
      name: 'Caso 3: Sin sección de bibliografía',
      content: `El artículo 90 del Código Civil establece que la existencia legal de las personas naturales comienza desde el nacimiento y termina con la muerte.`
    },
    {
      name: 'Caso 4: Bibliografía con formato diferente',
      content: `El artículo 90 del Código Civil establece que...

### Bibliografía

- Código Civil Artículo 90. Existencia legal de las personas - Leyes.co
- Leyes desde 1992 - Vigencia expresa y control de ...
- Artículo 90 del Código Civil - Conceptos Jurídicos`
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n📝 ${testCase.name}`);
    console.log('-'.repeat(50));
    
    const result = parseBibliography(testCase.content);
    
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

  console.log('\n' + '='.repeat(60));
  console.log('🎯 DIAGNÓSTICO COMPLETADO');
}

testBibliographyParsing();
