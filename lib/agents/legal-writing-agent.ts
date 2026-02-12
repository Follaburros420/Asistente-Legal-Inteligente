import { ChatOpenAI } from "@langchain/openai"
import { BufferMemory } from "langchain/memory"
import { ConversationChain } from "langchain/chains"

interface ChatMessage {
  role: string
  content: string
}

type RequirementStatus = "pending" | "collected" | "needs_search"

interface RequirementItem {
  name: string
  description: string
  status: RequirementStatus
  legalBasis?: string
  value?: string
}

interface PromptBlockPayload {
  documentType: string
  headline: string
  referenceNote?: string
  items: Array<{
    id: string
    name: string
    status: RequirementStatus
    description?: string
    legalBasis?: string
  }>
}

const DEFAULT_MODEL = "deepseek/deepseek-v3.2"

const REQUIREMENT_LIBRARY: Record<string, { label: string; reference?: string; items: RequirementItem[] }> = {
  tutela: {
    label: "tutela",
    reference: "Decreto 2591 de 1991, articulos 14 al 18",
    items: [
      { name: "accionante", description: "Datos personales del accionante", legalBasis: "Art. 14 - Decreto 2591", status: "pending" },
      { name: "accionado", description: "Entidad o persona que vulnera los derechos", legalBasis: "Art. 17 - Decreto 2591", status: "pending" },
      { name: "derechos_vulnerados", description: "Derechos fundamentales afectados", legalBasis: "Art. 15 - Decreto 2591", status: "pending" },
      { name: "hechos", description: "Relato claro y cronologico de los hechos", legalBasis: "Art. 15 - Decreto 2591", status: "pending" },
      { name: "pretensiones", description: "Amparo o proteccion solicitada", legalBasis: "Art. 27 - Decreto 2591", status: "pending" },
      { name: "requisitos_procedibilidad", description: "Inmediatez y subsidiariedad", legalBasis: "Art. 6 - Decreto 2591", status: "pending" }
    ]
  },
  demanda: {
    label: "demanda",
    reference: "Codigo General del Proceso, articulo 82",
    items: [
      { name: "partes", description: "Identificacion del demandante y del demandado", legalBasis: "Art. 82 literal a CGP", status: "pending" },
      { name: "hechos", description: "Narracion cronologica de los hechos", legalBasis: "Art. 82 literal b CGP", status: "pending" },
      { name: "fundamentos_derecho", description: "Normas sustantivas aplicables", legalBasis: "Art. 82 literal c CGP", status: "pending" },
      { name: "pretensiones", description: "Lo que se solicita al juez", legalBasis: "Art. 82 literal d CGP", status: "pending" },
      { name: "pruebas", description: "Relacion de los medios probatorios", legalBasis: "Art. 82 literal e CGP", status: "pending" },
      { name: "cuantia", description: "Estimacion economica cuando aplique", legalBasis: "Art. 82 literal f CGP", status: "pending" }
    ]
  },
  contrato: {
    label: "contrato",
    reference: "Codigo Civil Colombiano",
    items: [
      { name: "partes_contratantes", description: "Identificacion completa de las partes", legalBasis: "Art. 1502 C.C.", status: "pending" },
      { name: "objeto", description: "Objeto y alcance del contrato", legalBasis: "Art. 1517 C.C.", status: "pending" },
      { name: "obligaciones", description: "Obligaciones de cada parte", legalBasis: "Art. 1602 C.C.", status: "pending" },
      { name: "plazo", description: "Vigencia o plazo", legalBasis: "Art. 1551 C.C.", status: "pending" },
      { name: "precio", description: "Precio o contraprestacion", legalBasis: "Art. 1849 C.C.", status: "pending" },
      { name: "clausulas_especiales", description: "Clausulas adicionales relevantes", legalBasis: "Art. 1602 C.C.", status: "pending" }
    ]
  }
}

function detectDocumentKind(message: string): keyof typeof REQUIREMENT_LIBRARY {
  const normalized = message.toLowerCase()
  if (normalized.includes("tutela")) return "tutela"
  if (normalized.includes("ejecutivo") || normalized.includes("demanda")) return "demanda"
  if (normalized.includes("contrato")) return "contrato"
  return "demanda"
}

function cloneRequirements(kind: keyof typeof REQUIREMENT_LIBRARY): RequirementItem[] {
  return REQUIREMENT_LIBRARY[kind].items.map(item => ({ ...item }))
}

function buildPromptBlock(kind: keyof typeof REQUIREMENT_LIBRARY, requirements: RequirementItem[]): PromptBlockPayload {
  const library = REQUIREMENT_LIBRARY[kind]
  return {
    documentType: library.label,
    headline: `Necesito estos datos para redactar la ${library.label}:`,
    referenceNote: library.reference,
    items: requirements.map(req => ({
      id: req.name,
      name: capitalize(req.name.replace(/_/g, " ")), 
      status: req.status,
      description: req.description,
      legalBasis: req.legalBasis
    }))
  }
}

function serializePromptBlock(block: PromptBlockPayload): string {
  return `[PROMPT_BLOCK_START]${JSON.stringify(block)}[PROMPT_BLOCK_END]`
}

function capitalize(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export class LegalWritingAgent {
  private model: ChatOpenAI
  private memory: BufferMemory
  private chatId?: string
  private userId?: string

  constructor(config: { model: string; chatId?: string; userId?: string }) {
    this.chatId = config.chatId
    this.userId = config.userId

    this.model = new ChatOpenAI({
      modelName: config.model || process.env.LEGAL_WRITING_MODEL || DEFAULT_MODEL,
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: false
    })

    this.memory = new BufferMemory({ returnMessages: true, memoryKey: "chat_history" })
  }

  async processWithStreaming(messages: ChatMessage[]) {
    const lastMessage = messages[messages.length - 1]?.content ?? ""
    const kind = detectDocumentKind(lastMessage)
    const requirements = cloneRequirements(kind)
    const promptBlock = buildPromptBlock(kind, requirements)

    if (this.shouldGenerateDraft(lastMessage)) {
      const reasoningDraft = [
        `[REASONING:analyzing:Analizando solicitud del usuario]`,
        `[REASONING:generating:Elaborando borrador del documento legal]`,
        `[REASONING:complete:Borrador inicial entregado]`
      ]

      const draftBody = await this.composeInitialDraftResponse(kind, lastMessage)

      const responseBody = [
        reasoningDraft.join("\n\n"),
        draftBody,
        serializePromptBlock(promptBlock)
      ].join("\n\n")

      return this.streamText(responseBody)
    }

    const reasoningLines = [
      `[REASONING:analyzing:Analizando solicitud del usuario]`,
      `[REASONING:requirements:Identificando requisitos segun ${REQUIREMENT_LIBRARY[kind].label}]`,
      `[REASONING:gathering:Solicitando informacion faltante]`
    ]

    const summary = this.composeSummary(kind, lastMessage)

    const responseBody = [
      reasoningLines.join("\n\n"),
      summary,
      serializePromptBlock(promptBlock)
    ].join("\n\n")

    return this.streamText(responseBody)
  }

  async handleFollowUp(message: string) {
    const chain = new ConversationChain({ llm: this.model, memory: this.memory })
    const result = await chain.call({ input: message })
    return this.streamText(result.response)
  }

  async generateDocument(documentType: string, data: Record<string, string>) {
    const kind = detectDocumentKind(documentType)
    const requirements = cloneRequirements(kind).map(req => ({
      ...req,
      status: data[req.name] ? "collected" : req.status,
      value: data[req.name]
    }))

    const prompt = this.composeDraftPrompt(kind, requirements)
    const result = await this.model.call([{ role: "user", content: prompt }])
    const text = typeof result.content === "string" ? result.content : JSON.stringify(result.content)

    const reasoning = [
      `[REASONING:generating:Elaborando borrador del documento legal]`,
      `[REASONING:complete:Documento generado correctamente]`
    ].join("\n\n")

    const wrapped = `${reasoning}\n\n[DOCUMENT_START]\n${text}\n[DOCUMENT_END]`
    return this.streamText(wrapped)
  }

  private composeSummary(kind: keyof typeof REQUIREMENT_LIBRARY, userMessage: string): string {
    const kindLabel = REQUIREMENT_LIBRARY[kind].label
    return [
      `Vamos a trabajar en ${kindLabel}.`,
      "Resumen del caso:",
      `- Solicitud del usuario: ${userMessage.trim() || "No se proporciono detalle adicional"}`,
      "",
      "Comparte la informacion solicitada para poder redactar el documento."
    ].join("\n")
  }

  private composeDraftPrompt(kind: keyof typeof REQUIREMENT_LIBRARY, requirements: RequirementItem[]): string {
    const base = REQUIREMENT_LIBRARY[kind]
    const collected = requirements
      .filter(req => req.value)
      .map(req => `${capitalize(req.name.replace(/_/g, " "))}: ${req.value}`)
      .join("\n")

    return `Eres un redactor juridico experto en derecho colombiano.

Documento a elaborar: ${base.label}
Referencia normativa clave: ${base.reference ?? "Consulta el marco normativo colombiano vigente."}

Informacion proporcionada por el usuario:
${collected || "(Sin datos. Solicita mas informacion antes de generar el documento.)"}

Redacta el documento completo siguiendo la estructura y lenguaje juridico colombiano.`
  }

  private shouldGenerateDraft(message: string): boolean {
    if (!message) return false
    const normalized = message.toLowerCase()
    const keywords = [
      "redacta",
      "borrador",
      "escrito",
      "accion de tutela",
      "tutela",
      "demanda",
      "contrato"
    ]
    return keywords.some(keyword => normalized.includes(keyword))
  }

  private async composeInitialDraftResponse(kind: keyof typeof REQUIREMENT_LIBRARY, userMessage: string): Promise<string> {
    const documentLabel = this.getDocumentLabel(kind)
    const docType = kind === "tutela" ? "tutela" : kind === "contrato" ? "contrato" : "demanda"

    const instructions = `
Eres un redactor jurídico experto en derecho colombiano. Genera un documento legal en formato JSON estricto.

IMPORTANTE: Responde SOLO con un objeto JSON válido (sin markdown, sin texto adicional).

Esquema requerido:
{
  "type": "draft",
  "doc_type": "${docType}",
  "title": "Título corto y descriptivo del documento",
  "jurisdiction": "CO",
  "language": "es-CO",
  "content_markdown": "Contenido completo del documento en Markdown estructurado. Debe incluir:\n- Encabezado con datos de las partes\n- Hechos (narración cronológica)\n- Fundamentos jurídicos (normas aplicables)\n- Pretensiones (lo que se solicita)\n- Pruebas (medios probatorios)\n- Juramento y notificaciones\n\nUsa placeholders en formato {{KEY}} para datos faltantes (ej: {{NOMBRE_CLIENTE}}, {{FECHA}}).",
  "placeholders": [
    {"key": "NOMBRE_CLIENTE", "label": "Nombre completo del cliente", "example": "Juan Pérez García"},
    {"key": "FECHA", "label": "Fecha del documento", "example": "15 de enero de 2024"}
  ],
  "missing_info": ["Lista de información específica que falta para completar el documento"],
  "notes": [
    "⚠️ Documento preliminar, requiere revisión profesional, no sustituye asesoría legal.",
    "Revisar y completar todos los placeholders antes de usar el documento.",
    "Verificar fechas, nombres y datos específicos del caso."
  ],
  "email": {
    "subject": "Asunto del correo si aplica",
    "to": "",
    "cc": "",
    "body": "Cuerpo del correo si aplica"
  }
}

REGLAS CRÍTICAS:
- NO inventes hechos ni jurisprudencia
- Usa placeholders {{KEY}} para datos faltantes
- Incluye estructura legal típica según el tipo de documento
- Siempre agrega el disclaimer en notes
- content_markdown debe ser Markdown válido (sin code fences)
- El JSON debe ser válido y parseable

Solicitud del usuario: ${userMessage || "Sin información adicional"}
`

    const result = await this.model.call([
      { role: "system", content: instructions.trim() }
    ])

    const text = this.normalizeModelOutput(result.content)
    
    // Validar que sea JSON válido
    try {
      // Intentar extraer JSON si está envuelto en markdown
      const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/
      const match = text.match(jsonBlockRegex)
      let jsonText = match ? match[1] : text.trim()
      
      // Si no empieza con {, buscar el primer {
      if (!jsonText.startsWith('{')) {
        const firstBrace = jsonText.indexOf('{')
        if (firstBrace !== -1) {
          jsonText = jsonText.substring(firstBrace)
        }
      }
      
      // Validar que sea JSON válido
      const parsed = JSON.parse(jsonText)
      
      // Asegurar que tenga el disclaimer
      if (!parsed.notes || !Array.isArray(parsed.notes)) {
        parsed.notes = []
      }
      if (!parsed.notes.some((n: string) => n.includes("preliminar") || n.includes("revisión"))) {
        parsed.notes.unshift("⚠️ Documento preliminar, requiere revisión profesional, no sustituye asesoría legal.")
      }
      
      return JSON.stringify(parsed)
    } catch (error) {
      console.error("Error validando JSON del draft:", error)
      // Si falla, retornar el texto original (el frontend intentará parsearlo)
      return text.trim()
    }
  }

  private getDocumentLabel(kind: keyof typeof REQUIREMENT_LIBRARY): string {
    switch (kind) {
      case "tutela":
        return "accion de tutela"
      case "contrato":
        return "contrato"
      default:
        return "demanda"
    }
  }

  private normalizeModelOutput(content: unknown): string {
    if (typeof content === "string") {
      return content
    }

    if (Array.isArray(content)) {
      return content
        .map(part => {
          if (typeof part === "string") return part
          if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
            return part.text
          }
          return ""
        })
        .join("")
    }

    if (content && typeof content === "object" && "text" in content && typeof (content as { text: unknown }).text === "string") {
      return (content as { text: string }).text
    }

    return JSON.stringify(content ?? "")
  }

  private streamText(text: string) {
    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(text))
        controller.close()
      }
    })
  }
}
