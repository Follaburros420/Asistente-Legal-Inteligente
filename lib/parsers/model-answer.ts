import { BibliographyItem } from "@/types/chat-message";
import { ModelAnswer, NormalizedCitation } from "@/types/model-answer";

type ParseModelAnswerOptions = {
  citationsFromBackend?: BibliographyItem[];
};

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i;
const URL_REGEX = /(https?:\/\/[^\s)]+)/i;
const HEADING_KEYWORDS = [
  "bibliografia",
  "bibliografia - fuentes oficiales colombianas",
  "bibliography",
  "referencias",
  "referencias bibliograficas",
  "fuentes consultadas",
  "fuentes utilizadas",
  "fuentes citadas",
  "sources",
  "bibliografia consultada",
];

const NUMBER_PREFIX_REGEX = /^\s*(?:[-*]|[\d]+[\])\.:])\s*/;
const TECHNICAL_TAG_REGEX = /^[A-Z0-9_]+$/i;

const normalizeSpacing = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const removeDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizeForMatch = (value: string) =>
  removeDiacritics(value)
    .toLowerCase()
    .replace(/[#!*_`~>:]/g, "")
    .trim();

const sanitizeEntryLine = (line: string) =>
  line.replace(NUMBER_PREFIX_REGEX, "").trim();

const looksLikeHeading = (line: string) =>
  HEADING_KEYWORDS.some(
    (keyword) => line === keyword || line.startsWith(`${keyword} `),
  );

const looksLikeCitationLine = (line: string, afterBibHeading = false) => {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Si estamos después de un encabezado de bibliografía, ser más permisivo
  if (afterBibHeading) {
    if (URL_REGEX.test(trimmed)) return true;
    if (/^\s*[-*•]\s/.test(trimmed)) return true;
    if (/^\s*\d+[\]\).:-]\s/.test(trimmed)) return true;
    return trimmed.length < 200; // Cualquier línea corta después del encabezado
  }

  // Si NO estamos después de un encabezado, ser muy estricto
  // Solo detectar URLs como citas
  if (URL_REGEX.test(trimmed)) return true;

  // Solo detectar formatos muy específicos de citación legal colombiana
  // Ejemplo: "Sentencia T-123 de 2020" o "Ley 100 de 1993"
  const specificPatterns = [
    /^sentencia\s+[A-Z]-?\d+\s+de\s+\d{4}/i,
    /^ley\s+\d+\s+de\s+\d{4}/i,
    /^decreto\s+\d+\s+de\s+\d{4}/i,
    /^resolucion\s+\d+\s+de\s+\d{4}/i,
    /^acuerdo\s+\d+\s+de\s+\d{4}/i,
  ];

  const normalized = normalizeForMatch(trimmed);
  return specificPatterns.some((pattern) => pattern.test(normalized));
};

const trimTrailingEmptyLines = (lines: string[]) => {
  const copy = [...lines];
  while (copy.length > 0 && copy[copy.length - 1].trim() === "") {
    copy.pop();
  }
  return copy;
};

const determineSource = (normalized: string, type?: string) => {
  if (normalized.includes("corte constitucional"))
    return "Corte Constitucional";
  if (normalized.includes("corte suprema")) return "Corte Suprema de Justicia";
  if (normalized.includes("consejo de estado")) return "Consejo de Estado";
  if (
    normalized.includes("ramajudicial") ||
    normalized.includes("rama judicial")
  )
    return "Rama Judicial";
  if (normalized.includes("congreso")) return "Congreso de la Republica";
  if (normalized.includes("senado")) return "Senado de la Republica";
  if (normalized.includes("camara de representantes"))
    return "Camara de Representantes";
  if (normalized.includes("ministerio")) return "Ministerio Colombiano";
  if (normalized.includes("superintendencia")) return "Superintendencia";
  if (normalized.includes("gaceta")) return "Gaceta del Congreso";
  if (normalized.includes("diario oficial")) return "Diario Oficial";
  if (normalized.includes("jep")) return "Jurisdiccion Especial para la Paz";
  if (normalized.includes("fiscalia")) return "Fiscalia General de la Nacion";
  if (normalized.includes("procuraduria")) return "Procuraduria General";

  if (type === "ley") return "Congreso de la Republica";
  if (type === "decreto") return "Gobierno Nacional";
  if (type === "sentencia" || type === "jurisprudencia")
    return "Jurisdiccion Colombiana";

  return undefined;
};

const determineSourceFromUrl = (url?: string) => {
  if (!url) return undefined;

  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");

    const domains: Record<string, string> = {
      "corteconstitucional.gov.co": "Corte Constitucional",
      "cortesuprema.gov.co": "Corte Suprema de Justicia",
      "consejodeestado.gov.co": "Consejo de Estado",
      "ramajudicial.gov.co": "Rama Judicial",
      "suin-juriscol.gov.co": "SUIN-Juriscol",
      "funcionpublica.gov.co": "Funcion Publica",
      "secretariasenado.gov.co": "Secretaria del Senado",
      "leyes.co": "Leyes.co",
    };

    for (const [domain, label] of Object.entries(domains)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return label;
      }
    }

    return hostname;
  } catch {
    return undefined;
  }
};

const normalizeCitationType = (type?: string) => {
  const safeType = type?.trim();
  if (!safeType) return undefined;

  if (TECHNICAL_TAG_REGEX.test(safeType)) {
    return undefined;
  }

  return safeType;
};

const determineType = (normalized: string): string | undefined => {
  if (normalized.includes("sentencia") || normalized.includes("tutela"))
    return "sentencia";
  if (normalized.includes("jurisprudencia")) return "jurisprudencia";
  if (normalized.includes("ley")) return "ley";
  if (normalized.includes("decreto")) return "decreto";
  if (normalized.includes("articulo") || normalized.includes("articulo"))
    return "articulo";
  if (normalized.includes("resolucion")) return "resolucion";
  if (normalized.includes("doctrina")) return "doctrina";
  return undefined;
};

const extractIssuedAt = (text: string) => {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : undefined;
};

const buildCitation = (line: string, index: number): NormalizedCitation => {
  let workingLine = sanitizeEntryLine(line);
  let title = workingLine;
  let url: string | undefined;

  const markdownMatch = MARKDOWN_LINK_REGEX.exec(workingLine);

  if (markdownMatch) {
    title = markdownMatch[1].trim();
    url = markdownMatch[2].trim();
    workingLine = workingLine
      .replace(MARKDOWN_LINK_REGEX, markdownMatch[1])
      .trim();
  } else {
    const urlMatch = URL_REGEX.exec(workingLine);
    if (urlMatch) {
      url = urlMatch[1].trim();
      workingLine = workingLine
        .replace(urlMatch[0], "")
        .replace(/\(\)/g, "")
        .trim();
      if (!title || title === urlMatch[0]) {
        title = workingLine || url;
      }
    }
  }

  if (!title) {
    title = workingLine || `Fuente ${index + 1}`;
  }

  const normalized = normalizeForMatch(workingLine);
  const type = determineType(normalized);
  const source = determineSource(normalized, type);
  const issuedAt = extractIssuedAt(workingLine);

  const description =
    workingLine && workingLine.toLowerCase() !== title.toLowerCase()
      ? workingLine
      : undefined;

  return {
    id: `citation-${index + 1}`,
    title,
    url,
    type,
    source,
    description,
    issuedAt,
  };
};

const normalizeBibliographyItems = (
  items: BibliographyItem[],
): NormalizedCitation[] =>
  items.map((item, index) => {
    const normalizedType = normalizeCitationType(item.type);

    return {
      id: item.id ?? `citation-${index + 1}`,
      title: item.title,
      url: item.url,
      type: normalizedType,
      description: item.description,
      source:
        item.source ||
        determineSourceFromUrl(item.url) ||
        (normalizedType
          ? determineSource(normalizeForMatch(normalizedType), normalizedType)
          : undefined),
    };
  });

const dedupeCitations = (items: NormalizedCitation[]): NormalizedCitation[] => {
  const seen = new Map<string, NormalizedCitation>();

  items.forEach((item) => {
    const key = (item.url ?? item.title).toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  });

  return Array.from(seen.values()).map((citation, index) => ({
    ...citation,
    id: citation.id || `citation-${index + 1}`,
  }));
};

const splitInlineCitations = (line: string) => {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return [];

  const tail = line.slice(colonIndex + 1).trim();
  if (!tail) return [];

  return tail
    .split(/(?:;|\||\s{2,})/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

const collectSectionAfterHeading = (lines: string[], headingIndex: number) => {
  let endIndex = lines.length;

  for (let i = headingIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const normalized = normalizeForMatch(trimmed);

    if (!trimmed) continue;

    if (/^#{1,6}\s/.test(trimmed)) {
      endIndex = i;
      break;
    }

    if (looksLikeHeading(normalized)) {
      endIndex = i;
      break;
    }

    // Después de un encabezado de bibliografía, ser más permisivo
    if (
      !looksLikeCitationLine(raw, true) &&
      normalized.length > 0 &&
      normalized.length < 20
    ) {
      endIndex = i;
      break;
    }
  }

  const bibliographyLines = lines.slice(headingIndex + 1, endIndex);
  const before = trimTrailingEmptyLines(lines.slice(0, headingIndex));
  const after = lines.slice(endIndex);

  return {
    citations: bibliographyLines.map((line) => line.trim()).filter(Boolean),
    remainder: [...before, ...after],
  };
};

const collectTrailingCitations = (lines: string[]) => {
  let startIndex = lines.length;
  let collecting = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (collecting) {
        startIndex = i;
      }
      continue;
    }

    // Sin encabezado de bibliografía, solo URLs son citas válidas al final
    if (looksLikeCitationLine(line, false)) {
      collecting = true;
      startIndex = i;
      continue;
    }

    if (collecting) {
      break;
    } else {
      // stop scanning once we encounter non-citation line before starting collection
      if (lines.length - i > 6) {
        break;
      }
    }
  }

  if (!collecting) {
    return { citations: [] as string[], remainder: lines };
  }

  const citations = lines
    .slice(startIndex)
    .map((line) => line.trim())
    .filter(Boolean);
  const remainder = trimTrailingEmptyLines(lines.slice(0, startIndex));

  return { citations, remainder };
};

const extractCitationsFromContent = (content: string) => {
  if (!content.trim()) {
    return { text: "", citationLines: [] as string[] };
  }

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let headingIndex = -1;
  let inlineCitations: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const normalized = normalizeForMatch(raw);

    if (!normalized) continue;

    if (looksLikeHeading(normalized)) {
      headingIndex = i;

      const inlineParts = splitInlineCitations(raw);
      if (inlineParts.length > 0) {
        inlineCitations = inlineParts;
      }
      break;
    }

    if (
      normalized.includes("fuentes consultadas:") ||
      normalized.includes("bibliografia:")
    ) {
      headingIndex = i;

      const inlineParts = splitInlineCitations(raw);
      if (inlineParts.length > 0) {
        inlineCitations = inlineParts;
      }
      break;
    }
  }

  let citationLines: string[] = [];
  let remainderLines = lines;

  if (headingIndex >= 0) {
    const { citations, remainder } = collectSectionAfterHeading(
      lines,
      headingIndex,
    );
    citationLines = citations;
    remainderLines = remainder;
  } else {
    const { citations, remainder } = collectTrailingCitations(lines);
    citationLines = citations;
    remainderLines = remainder;
  }

  if (inlineCitations.length > 0) {
    citationLines = [...inlineCitations, ...citationLines];
  }

  const text = normalizeSpacing(remainderLines.join("\n"));

  return {
    text,
    citationLines,
  };
};

export const parseModelAnswer = (
  rawContent: string,
  options?: ParseModelAnswerOptions,
): ModelAnswer => {
  const safeContent = rawContent ?? "";
  const { text, citationLines } = extractCitationsFromContent(safeContent);

  const backendCitations = options?.citationsFromBackend
    ? normalizeBibliographyItems(options.citationsFromBackend)
    : [];

  const parsedCitations =
    backendCitations.length > 0
      ? backendCitations
      : citationLines.map((line, index) => buildCitation(line, index));

  const uniqueCitations = dedupeCitations(parsedCitations);

  const outputText = text.length > 0 ? text : normalizeSpacing(safeContent);

  return {
    text: outputText,
    citations: uniqueCitations.length > 0 ? uniqueCitations : undefined,
  };
};

export { extractCitationsFromContent };
