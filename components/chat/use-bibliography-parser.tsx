"use client"

import { useMemo } from "react"

interface BibliographyItem {
  id: string
  title: string
  type: "sentencia" | "ley" | "decreto" | "articulo" | "jurisprudencia" | "doctrina"
  source: string
  url?: string
  date?: string
  number?: string
  magistrate?: string
  description?: string
}

interface BibliographyParseResult {
  bibliographyItems: BibliographyItem[]
  contentWithoutBibliography: string
}

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i
const URL_REGEX = /(https?:\/\/[^\s)]+)/i

const removeDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const sanitizeEntryLine = (line: string) =>
  line
    .replace(/^\s*[-*]\s*/, "")
    .replace(/^\s*\d+[\).\s]+/, "")
    .trim()

const determineSource = (normalized: string) => {
  if (normalized.includes("corte constitucional")) return "Corte Constitucional"
  if (normalized.includes("corte suprema")) return "Corte Suprema de Justicia"
  if (normalized.includes("consejo de estado")) return "Consejo de Estado"
  if (normalized.includes("council of state")) return "Consejo de Estado"
  if (normalized.includes("tribunal")) return "Tribunal Colombiano"
  if (normalized.includes("congreso")) return "Congreso de la Republica"
  if (normalized.includes("ministerio")) return "Ministerio Colombiano"
  if (normalized.includes("superintendencia")) return "Superintendencia"
  if (normalized.includes("fiscalia")) return "Fiscalia General"
  if (normalized.includes("ramajudicial") || normalized.includes("rama judicial"))
    return "Rama Judicial"
  return "Fuente"
}

const buildBibliographyItem = (line: string, index: number): BibliographyItem => {
  let workingLine = line.trim()
  let title = workingLine
  let url: string | undefined

  const markdownMatch = MARKDOWN_LINK_REGEX.exec(workingLine)
  if (markdownMatch) {
    title = markdownMatch[1].trim()
    url = markdownMatch[2].trim()
    workingLine = workingLine.replace(MARKDOWN_LINK_REGEX, markdownMatch[1]).trim()
  } else {
    const urlMatch = URL_REGEX.exec(workingLine)
    if (urlMatch) {
      url = urlMatch[1].trim()
      workingLine = workingLine.replace(urlMatch[0], "").replace(/\(\)/g, "").trim()
      if (!title || title === urlMatch[0]) {
        title = workingLine || url
      }
    }
  }

  const normalized = removeDiacritics(workingLine).toLowerCase()

  let type: BibliographyItem["type"] = "doctrina"
  let source = determineSource(normalized)
  let date: string | undefined
  let number: string | undefined
  let magistrate: string | undefined

  const sentenciaMatch = normalized.match(/sentencia\s+(?:[a-z]{0,3}-)?(\d+)\s+de\s+((?:19|20)\d{2})/)
  if (sentenciaMatch) {
    type = "sentencia"
    number = sentenciaMatch[1]
    date = sentenciaMatch[2]
    if (source === "Fuente") {
      source = "Jurisdiccion Colombiana"
    }
  } else {
    const leyMatch = normalized.match(/ley\s+(?:n[ouº.]?\s*)?(\d+)\s+de\s+((?:19|20)\d{2})/)
    if (leyMatch) {
      type = "ley"
      number = leyMatch[1]
      date = leyMatch[2]
      source = "Congreso de la Republica"
    } else {
      const decretoMatch = normalized.match(/decreto\s+(?:n[ouº.]?\s*)?(\d+)\s+de\s+((?:19|20)\d{2})/)
      if (decretoMatch) {
        type = "decreto"
        number = decretoMatch[1]
        date = decretoMatch[2]
        source = "Gobierno Nacional"
      } else {
        const articuloMatch = normalized.match(/art(?:iculo|\.?)\s+(\d+)/)
        if (articuloMatch) {
          type = "articulo"
          number = articuloMatch[1]
          const codeMatch = workingLine.match(/c[oó]digo\s+[^,\.;]+/i)
          if (codeMatch) {
            source = codeMatch[0].trim()
          } else {
            source = "Codigo Colombiano"
          }
        } else if (normalized.includes("jurisprudencia")) {
          type = "jurisprudencia"
          source = "Jurisprudencia Colombiana"
        }
      }
    }
  }

  const magistrateMatch = workingLine.match(/magistrad[ao]\s+ponente[:\s]+([^,\.;]+)/i)
  if (magistrateMatch) {
    magistrate = magistrateMatch[1].trim()
  }

  return {
    id: `item-${index}`,
    title: title || `Fuente ${index + 1}`,
    type,
    source,
    url,
    date,
    number,
    magistrate,
    description: workingLine || title
  }
}

const sanitizeContentSpacing = (value: string) =>
  value.replace(/\n{3,}/g, "\n\n").trim()

export function useBibliographyParser(content: string): BibliographyParseResult {
  return useMemo(() => {
    if (!content) {
      return { bibliographyItems: [], contentWithoutBibliography: "" }
    }

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
        normalizedLine.includes("fuentes citadas")

      if (isHeading && containsKeyword) {
        headingIndex = i
        break
      }
    }

    if (headingIndex === -1) {
      return {
        bibliographyItems: [],
        contentWithoutBibliography: sanitizeContentSpacing(content)
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

    const beforeHeading = lines.slice(0, headingIndex)
    while (beforeHeading.length > 0 && beforeHeading[beforeHeading.length - 1].trim() === "") {
      beforeHeading.pop()
    }
    if (beforeHeading.length > 0 && beforeHeading[beforeHeading.length - 1].trim() === "---") {
      beforeHeading.pop()
      while (beforeHeading.length > 0 && beforeHeading[beforeHeading.length - 1].trim() === "") {
        beforeHeading.pop()
      }
    }

    const remainingLines = [
      ...beforeHeading,
      ...lines.slice(endIndex).filter((line, idx) => !(idx === 0 && line.trim() === ""))
    ]

    const contentWithoutBibliography = sanitizeContentSpacing(remainingLines.join("\n"))

    const normalizedEntries = bibliographyLines
      .map(sanitizeEntryLine)
      .filter(entry => entry.length > 0)

    const bibliographyItems = normalizedEntries.map((entry, index) =>
      buildBibliographyItem(entry, index)
    )

    return {
      bibliographyItems,
      contentWithoutBibliography
    }
  }, [content])
}
