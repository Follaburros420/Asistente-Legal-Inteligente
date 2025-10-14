"use client"

import { useMemo } from 'react'

interface BibliographyItem {
  id: string
  title: string
  type: 'sentencia' | 'ley' | 'decreto' | 'articulo' | 'jurisprudencia' | 'doctrina'
  source: string
  url?: string
  date?: string
  number?: string
  magistrate?: string
  description?: string
}

export function useBibliographyParser(content: string) {
  const bibliographyItems = useMemo(() => {
    if (!content) return []

    const items: BibliographyItem[] = []
    
    // Buscar sección de bibliografía
    const bibliographyMatch = content.match(/##?\s*BIBLIOGRAF[ÍI]A[:\s]*\n([\s\S]*?)(?=\n##|\n$|$)/i)
    
    if (!bibliographyMatch) return []

    const bibliographyText = bibliographyMatch[1]
    
    // Patrones para diferentes tipos de fuentes
    const patterns = {
      // Sentencias de la Corte Constitucional
      sentenciaConstitucional: /(?:Sentencia|Auto)\s+(?:T-|C-|SU-)?(\d+)\s+de\s+(\d{4})\s*[,\-]?\s*(?:Magistrado\s+Ponente:\s*([^,\n]+))?[,\-]?\s*(?:Corte\s+Constitucional|CC)/gi,
      
      // Sentencias de la Corte Suprema
      sentenciaSuprema: /(?:Sentencia|Auto)\s+(?:SP|SL|ST|SC|SUP-)?(\d+)\s+de\s+(\d{4})\s*[,\-]?\s*(?:Magistrado\s+Ponente:\s*([^,\n]+))?[,\-]?\s*(?:Corte\s+Suprema|CSJ)/gi,
      
      // Sentencias del Consejo de Estado
      sentenciaConsejo: /(?:Sentencia|Auto)\s+(?:AP|SUP-)?(\d+)\s+de\s+(\d{4})\s*[,\-]?\s*(?:Magistrado\s+Ponente:\s*([^,\n]+))?[,\-]?\s*(?:Consejo\s+de\s+Estado|CE)/gi,
      
      // Leyes
      ley: /(?:Ley|Ley\s+\d+)\s+de\s+(\d{4})\s*[,\-]?\s*(?:por\s+la\s+cual\s+)?([^,\n]+)/gi,
      
      // Decretos
      decreto: /(?:Decreto|Decreto\s+\d+)\s+de\s+(\d{4})\s*[,\-]?\s*(?:por\s+el\s+cual\s+)?([^,\n]+)/gi,
      
      // Artículos de códigos
      articulo: /(?:Artículo|Art\.)\s+(\d+)\s+(?:del\s+)?(?:Código\s+)?([^,\n]+)/gi,
      
      // URLs
      url: /(https?:\/\/[^\s\)]+)/gi
    }

    // Procesar cada línea de la bibliografía
    const lines = bibliographyText.split('\n').filter(line => line.trim())
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) return

      let item: BibliographyItem | null = null
      let url: string | undefined

      // Extraer URL si existe
      const urlMatch = trimmedLine.match(patterns.url)
      if (urlMatch) {
        url = urlMatch[0]
      }

      // Detectar tipo de fuente y extraer información
      if (patterns.sentenciaConstitucional.test(trimmedLine)) {
        const match = trimmedLine.match(patterns.sentenciaConstitucional)
        if (match) {
          const [, number, year, magistrate] = match
          item = {
            id: `cc-${number}-${year}`,
            title: `Sentencia ${number} de ${year}`,
            type: 'sentencia',
            source: 'Corte Constitucional',
            url,
            date: year,
            number: number,
            magistrate: magistrate?.trim(),
            description: trimmedLine.replace(patterns.url, '').trim()
          }
        }
      } else if (patterns.sentenciaSuprema.test(trimmedLine)) {
        const match = trimmedLine.match(patterns.sentenciaSuprema)
        if (match) {
          const [, number, year, magistrate] = match
          item = {
            id: `csj-${number}-${year}`,
            title: `Sentencia ${number} de ${year}`,
            type: 'sentencia',
            source: 'Corte Suprema de Justicia',
            url,
            date: year,
            number: number,
            magistrate: magistrate?.trim(),
            description: trimmedLine.replace(patterns.url, '').trim()
          }
        }
      } else if (patterns.sentenciaConsejo.test(trimmedLine)) {
        const match = trimmedLine.match(patterns.sentenciaConsejo)
        if (match) {
          const [, number, year, magistrate] = match
          item = {
            id: `ce-${number}-${year}`,
            title: `Sentencia ${number} de ${year}`,
            type: 'sentencia',
            source: 'Consejo de Estado',
            url,
            date: year,
            number: number,
            magistrate: magistrate?.trim(),
            description: trimmedLine.replace(patterns.url, '').trim()
          }
        }
      } else if (patterns.ley.test(trimmedLine)) {
        const match = trimmedLine.match(patterns.ley)
        if (match) {
          const [, year, description] = match
          item = {
            id: `ley-${year}-${index}`,
            title: `Ley de ${year}`,
            type: 'ley',
            source: 'Congreso de la República',
            url,
            date: year,
            description: description?.trim() || trimmedLine.replace(patterns.url, '').trim()
          }
        }
      } else if (patterns.decreto.test(trimmedLine)) {
        const match = trimmedLine.match(patterns.decreto)
        if (match) {
          const [, year, description] = match
          item = {
            id: `decreto-${year}-${index}`,
            title: `Decreto de ${year}`,
            type: 'decreto',
            source: 'Gobierno Nacional',
            url,
            date: year,
            description: description?.trim() || trimmedLine.replace(patterns.url, '').trim()
          }
        }
      } else if (patterns.articulo.test(trimmedLine)) {
        const match = trimmedLine.match(patterns.articulo)
        if (match) {
          const [, number, code] = match
          item = {
            id: `art-${number}-${index}`,
            title: `Artículo ${number}`,
            type: 'articulo',
            source: code?.trim() || 'Código',
            url,
            number: number,
            description: trimmedLine.replace(patterns.url, '').trim()
          }
        }
      }

      // Si no se detectó un tipo específico, crear un item genérico
      if (!item) {
        item = {
          id: `generic-${index}`,
          title: trimmedLine.replace(patterns.url, '').trim(),
          type: 'doctrina',
          source: 'Fuente',
          url,
          description: trimmedLine.replace(patterns.url, '').trim()
        }
      }

      if (item) {
        items.push(item)
      }
    })

    return items
  }, [content])

  return { bibliographyItems }
}
