/**
 * Agente Legal Principal con LangChain
 * 
 * Implementa un agente con tool calling nativo usando:
 * - M1 Pro: Para tareas complejas
 * - M1 Small: Para tareas simples
 * - Serper: Única herramienta de búsqueda web
 */

import { AgentExecutor, createToolCallingAgent } from "langchain/agents"
import { ChatOpenAI } from "@langchain/openai"
import { AIMessage, HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { StructuredTool } from "@langchain/core/tools"
import { tool } from "@langchain/core/tools"
import { z } from "zod"

import { 
  createModel, 
  ModelId, 
  getModelConfig, 
  routeModel,
  ModelRouterConfig,
  DEFAULT_MODEL,
  SIMPLE_TASK_MODEL
} from "../config/models"
import { LEGAL_AGENT_SYSTEM_PROMPT } from "../config/prompts"
import { 
  searchLegalColombia, 
  searchJurisprudencia, 
  searchArticuloLey,
  formatSearchResultsForLLM 
} from "../../tools/search/serper-legal-search"

// ═══════════════════════════════════════════════════════════════════════════════
// HERRAMIENTAS LANGCHAIN (Tools)
// ═══════════════════════════════════════════════════════════════════════════════

const searchLegalOfficialTool = tool(
  async ({ query, num_results }) => {
    console.log(`🔧 Tool: search_legal_official("${query}")`)
    const safeNumResults = num_results ?? 5
    const results = await searchLegalColombia(query, { 
      numResults: safeNumResults,
      includeAcademic: false 
    })
    return formatSearchResultsForLLM(results)
  },
  {
    name: "search_legal_official",
    description: "Busca información legal en fuentes oficiales colombianas. " +
      "Usa esta herramienta para consultas sobre leyes, decretos, normas, jurisprudencia. " +
      "SIEMPRE usa esta herramienta PRIMERO antes de responder consultas legales.",
    schema: z.object({
      query: z.string().describe("Términos de búsqueda específicos"),
      num_results: z
        .number()
        .int()
        .min(1)
        .max(10)
        .nullable()
        .default(5)
        .transform(value => value ?? 5)
        .describe("Número de resultados (1-10)")
    })
  }
)

const searchJurisprudenciaTool = tool(
  async ({ query, tribunal, num_results }) => {
    const safeTribunal = tribunal ?? "all"
    const safeNumResults = num_results ?? 5
    console.log(`🔧 Tool: search_jurisprudencia("${query}", tribunal=${safeTribunal})`)
    const results = await searchJurisprudencia(query, {
      tribunal: safeTribunal as any,
      numResults: safeNumResults
    })
    return formatSearchResultsForLLM(results)
  },
  {
    name: "search_jurisprudencia",
    description: "Busca sentencias y jurisprudencia de altas cortes colombianas. " +
      "Especializado en Corte Constitucional, Corte Suprema y Consejo de Estado.",
    schema: z.object({
      query: z.string().describe("Términos de búsqueda de jurisprudencia"),
      tribunal: z.enum(["constitucional", "suprema", "consejo", "all"])
        .nullable()
        .default("all")
        .transform(value => value ?? "all")
        .describe("Tribunal específico o todos"),
      num_results: z
        .number()
        .int()
        .min(1)
        .max(10)
        .nullable()
        .default(5)
        .transform(value => value ?? 5)
        .describe("Número de sentencias")
    })
  }
)

const buscarArticuloTool = tool(
  async ({ articulo, norma }) => {
    console.log(`🔧 Tool: buscar_articulo_ley("${articulo}", "${norma}")`)
    const results = await searchArticuloLey(articulo, norma)
    
    if (results.length === 0) {
      return `No se encontró el artículo ${articulo} de ${norma}.`
    }
    
    let output = `📜 **Artículo ${articulo} - ${norma}**\n\n`
    const officialResult = results.find(r => r.source === 'official')
    
    if (officialResult) {
      output += `🏛️ **Fuente:** ${officialResult.sourceName}\n`
      output += `📎 ${officialResult.url}\n\n`
      output += `📝 ${officialResult.snippet}\n`
    } else {
      output += results.map((r, i) => 
        `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
      ).join('\n\n')
    }
    
    return output
  },
  {
    name: "buscar_articulo_ley",
    description: "Busca el texto literal de un artículo específico de una norma colombiana. " +
      "Úsala cuando el usuario pregunte por un artículo específico (ej: 'artículo 25 CP').",
    schema: z.object({
      articulo: z.string().describe("Número del artículo (ej: '25', '82')"),
      norma: z.string().describe("Nombre de la norma (ej: 'Código Penal')")
    })
  }
)

const serperWebSearchTool = tool(
  async ({ query, num_results }) => {
    console.log(`🔧 Tool: serper_web_search("${query}")`)
    const safeNumResults = num_results ?? 5
    const results = await searchLegalColombia(query, { 
      numResults: safeNumResults,
      includeAcademic: true 
    })
    return formatSearchResultsForLLM(results)
  },
  {
    name: "serper_web_search",
    description: "Búsqueda web general usando Serper. " +
      "Usa solo cuando necesites información actual no disponible en fuentes legales oficiales.",
    schema: z.object({
      query: z.string().describe("Consulta de búsqueda"),
      num_results: z
        .number()
        .int()
        .min(1)
        .max(10)
        .nullable()
        .default(5)
        .transform(value => value ?? 5)
        .describe("Número de resultados")
    })
  }
)

// Todas las herramientas disponibles
export const ALL_TOOLS = [
  searchLegalOfficialTool,
  searchJurisprudenciaTool,
  buscarArticuloTool,
  serperWebSearchTool
]

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS E INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentConfig {
  modelId?: ModelId | string
  temperature?: number
  maxIterations?: number
  verbose?: boolean
  tools?: StructuredTool[]
  useRouter?: boolean // Usar el router inteligente
}

export interface AgentInput {
  input: string
  chatHistory?: BaseMessage[]
}

export interface AgentResponse {
  output: string
  intermediateSteps?: any[]
  sources?: Array<{ title: string; url: string }>
  toolsUsed?: string[]
  modelUsed?: string
  metadata?: {
    model: string
    iterations: number
    processingTime: number
  }
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASE DEL AGENTE LEGAL
// ═══════════════════════════════════════════════════════════════════════════════

export class LegalAgent {
  private executor: AgentExecutor | null = null
  private model: ChatOpenAI | null = null
  private config: AgentConfig
  private chatHistory: BaseMessage[] = []
  private currentModelId: string = DEFAULT_MODEL

  private constructor(config: AgentConfig) {
    this.config = {
      maxIterations: 10,
      verbose: false,
      useRouter: true,
      ...config
    }
  }

  /**
   * Crea una nueva instancia del agente legal
   */
  static async create(config: AgentConfig = {}): Promise<LegalAgent> {
    const agent = new LegalAgent(config)
    
    // Si no se especifica modelo, usar el router
    if (config.useRouter !== false && !config.modelId) {
      // El modelo se seleccionará en invoke según la consulta
      console.log(`🤖 Agente Legal creado con router inteligente`)
    } else {
      await agent.initializeModel(config.modelId || DEFAULT_MODEL)
    }
    
    return agent
  }

  /**
   * Inicializa el modelo con el ID especificado
   */
  private async initializeModel(modelId: string): Promise<void> {
    console.log(`\n🤖 Inicializando modelo: ${modelId}`)
    
    this.currentModelId = modelId
    
    // Obtener configuración del modelo
    const modelConfig = getModelConfig(modelId)
    const temperature = this.config.temperature ?? (modelConfig?.useCase === 'simple' ? 0.1 : 0.3)

    // Crear el modelo
    this.model = createModel({
      modelId,
      temperature,
      maxTokens: modelConfig?.useCase === 'complex' ? 8192 : 4096,
      streaming: true
    })

    // Crear el executor del agente
    this.executor = await this.createExecutor(this.model, this.config.tools || ALL_TOOLS)

    console.log(`✅ Modelo ${modelId} inicializado`)
  }

  /**
   * Crea el executor del agente
   */
  private async createExecutor(model: ChatOpenAI, tools: StructuredTool[]): Promise<AgentExecutor> {
    // Crear el prompt del agente
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", LEGAL_AGENT_SYSTEM_PROMPT],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ])

    // Crear el agente con tool calling
    const agent = await createToolCallingAgent({
      llm: model,
      tools,
      prompt,
    })

    // Crear el ejecutor
    return new AgentExecutor({
      agent,
      tools,
      maxIterations: this.config.maxIterations,
      verbose: this.config.verbose,
      returnIntermediateSteps: true,
      handleParsingErrors: true,
      earlyStoppingMethod: "force",
    })
  }

  /**
   * Ejecuta una consulta al agente
   */
  async invoke(
    input: AgentInput,
    options?: { callbacks?: any[] }
  ): Promise<AgentResponse> {
    const startTime = Date.now()
    
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`🧠 LEGAL AGENT - PROCESANDO CONSULTA`)
    console.log(`${'═'.repeat(70)}`)
    console.log(`📝 Input: "${input.input.substring(0, 100)}..."`)

    try {
      // Determinar modelo a usar
      let routerConfig: ModelRouterConfig
      
      if (this.config.useRouter !== false && !this.config.modelId) {
        routerConfig = routeModel(input.input)
        console.log(`🎯 Router seleccionó: ${routerConfig.model} (caso: ${this.getUseCaseLabel(routerConfig.model)})`)
        
        // Re-inicializar si el modelo cambió
        if (routerConfig.model !== this.currentModelId) {
          await this.initializeModel(routerConfig.model)
        }
      } else {
        // Usar modelo fijo
        if (!this.executor || !this.model) {
          await this.initializeModel(this.config.modelId || DEFAULT_MODEL)
        }
        routerConfig = {
          model: this.currentModelId as ModelId,
          temperature: this.config.temperature ?? 0.3,
          maxTokens: 4096,
          tools: ALL_TOOLS.map(t => t.name)
        }
      }

      if (!this.executor) {
        throw new Error('Agente no inicializado correctamente')
      }

      // Usar historial proporcionado o el interno
      const history = input.chatHistory || this.chatHistory

      // Ejecutar el agente
      const result = await this.executor.invoke(
        {
          input: input.input,
          chat_history: history
        },
        {
          callbacks: options?.callbacks
        }
      )

      const processingTime = Date.now() - startTime

      // Extraer información de los pasos intermedios
      const toolsUsed = this.extractToolsUsed(result.intermediateSteps || [])
      const sources = this.extractSourcesFromSteps(result.intermediateSteps || [], result.output)

      // Actualizar historial interno
      this.chatHistory.push(new HumanMessage(input.input))
      this.chatHistory.push(new AIMessage(result.output))

      console.log(`\n${'─'.repeat(70)}`)
      console.log(`✅ RESPUESTA COMPLETADA`)
      console.log(`   ⏱️ Tiempo: ${(processingTime / 1000).toFixed(1)}s`)
      console.log(`   🤖 Modelo: ${this.currentModelId}`)
      console.log(`   🔧 Tools usadas: ${toolsUsed.length > 0 ? toolsUsed.join(', ') : 'Ninguna'}`)
      console.log(`   📚 Fuentes: ${sources.length}`)
      console.log(`${'═'.repeat(70)}\n`)

      return {
        output: result.output,
        intermediateSteps: result.intermediateSteps,
        sources,
        toolsUsed,
        modelUsed: this.currentModelId,
        metadata: {
          model: this.currentModelId,
          iterations: result.intermediateSteps?.length || 0,
          processingTime
        }
      }

    } catch (error: any) {
      console.error(`❌ Error en el agente:`, error)
      
      if (error.message?.includes('max iterations') || error.message?.includes('Agent stopped')) {
        return {
          output: "He recopilado información relevante pero la consulta requiere más investigación. " +
                  "Te recomiendo dividir tu pregunta en consultas más específicas. " +
                  "También puedes consultar directamente las fuentes oficiales.",
          intermediateSteps: [],
          sources: [],
          toolsUsed: [],
          modelUsed: this.currentModelId,
          metadata: {
            model: this.currentModelId,
            iterations: this.config.maxIterations || 10,
            processingTime: Date.now() - startTime
          }
        }
      }
      
      throw error
    }
  }

  /**
   * Ejecuta una consulta con streaming
   */
  async *stream(input: AgentInput): AsyncGenerator<string> {
    console.log(`\n🔄 Iniciando streaming para: "${input.input.substring(0, 50)}..."`)

    // Determinar modelo
    if (this.config.useRouter !== false && !this.config.modelId) {
      const routerConfig = routeModel(input.input)
      if (routerConfig.model !== this.currentModelId) {
        await this.initializeModel(routerConfig.model)
      }
    }

    if (!this.executor) {
      throw new Error('Agente no inicializado')
    }

    const history = input.chatHistory || this.chatHistory

    try {
      const stream = await this.executor.stream({
        input: input.input,
        chat_history: history
      })

      let fullOutput = ''

      for await (const chunk of stream) {
        if (chunk.output) {
          yield chunk.output
          fullOutput = chunk.output
        } else if (chunk.intermediateSteps) {
          for (const step of chunk.intermediateSteps) {
            console.log(`🔧 Tool: ${step.action?.tool}`)
          }
        }
      }

      // Actualizar historial
      this.chatHistory.push(new HumanMessage(input.input))
      this.chatHistory.push(new AIMessage(fullOutput))

    } catch (error) {
      console.error(`❌ Error en streaming:`, error)
      throw error
    }
  }

  /**
   * Limpia el historial de conversación
   */
  clearHistory(): void {
    this.chatHistory = []
    console.log('🧹 Historial de conversación limpiado')
  }

  /**
   * Obtiene el historial actual
   */
  getHistory(): BaseMessage[] {
    return [...this.chatHistory]
  }

  /**
   * Obtiene el modelo actual
   */
  getCurrentModel(): string {
    return this.currentModelId
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════════

  private getUseCaseLabel(modelId: string): string {
    const config = getModelConfig(modelId)
    const labels: Record<string, string> = {
      'simple': 'tarea simple',
      'complex': 'tarea compleja',
      'research': 'investigación'
    }
    return labels[config?.useCase || ''] || 'general'
  }

  private extractToolsUsed(steps: any[]): string[] {
    const tools = new Set<string>()
    for (const step of steps) {
      if (step.action?.tool) {
        tools.add(step.action.tool)
      }
    }
    return Array.from(tools)
  }

  private extractSourcesFromSteps(
    steps: any[], 
    output: string
  ): Array<{ title: string; url: string }> {
    const sources: Array<{ title: string; url: string }> = []
    const seenUrls = new Set<string>()

    // Extraer de los pasos intermedios
    for (const step of steps) {
      try {
        const observation = step.observation
        if (typeof observation === 'string') {
          // Buscar URLs en el resultado
          const urlMatches = observation.match(/https?:\/\/[^\s\)\]\>"]+/g) || []
          for (const url of urlMatches) {
            const cleanUrl = url.replace(/[,\.\]\}]+$/, '')
            if (!seenUrls.has(cleanUrl)) {
              seenUrls.add(cleanUrl)
              sources.push({
                title: this.extractTitleFromUrl(cleanUrl),
                url: cleanUrl
              })
            }
          }
        }
      } catch (e) {
        console.log('Error extrayendo fuentes:', e)
      }
    }

    // Si no hay fuentes de las tools, buscar en el output
    if (sources.length === 0) {
      const urlRegex = /https?:\/\/[^\s\)\]\>"]+/g
      const urls = output.match(urlRegex) || []

      for (const url of urls) {
        const cleanUrl = url.replace(/[,\.\]\}]+$/, '')
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl)
          sources.push({
            title: this.extractTitleFromUrl(cleanUrl),
            url: cleanUrl
          })
        }
      }
    }

    return sources.slice(0, 10)
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.replace('www.', '')
      
      const domainNames: Record<string, string> = {
        'secretariasenado.gov.co': 'Secretaría del Senado',
        'corteconstitucional.gov.co': 'Corte Constitucional',
        'consejodeestado.gov.co': 'Consejo de Estado',
        'suin-juriscol.gov.co': 'SUIN-Juriscol',
        'funcionpublica.gov.co': 'Función Pública',
        'dian.gov.co': 'DIAN',
        'minjusticia.gov.co': 'MinJusticia',
        'procuraduria.gov.co': 'Procuraduría',
        'defensoria.gov.co': 'Defensoría del Pueblo',
        'ramajudicial.gov.co': 'Rama Judicial',
        'cortesuprema.gov.co': 'Corte Suprema'
      }

      for (const [domain, name] of Object.entries(domainNames)) {
        if (hostname.includes(domain.split('.')[0])) {
          return name
        }
      }

      return hostname
    } catch {
      return 'Fuente legal'
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE UTILIDAD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convierte mensajes de conversación al formato de LangChain
 */
export function convertToLangChainMessages(messages: ConversationMessage[]): BaseMessage[] {
  return messages.map(msg => {
    switch (msg.role) {
      case 'user':
        return new HumanMessage(msg.content)
      case 'assistant':
        return new AIMessage(msg.content)
      case 'system':
        return new SystemMessage(msg.content)
      default:
        return new HumanMessage(msg.content)
    }
  })
}

/**
 * Crea un agente con el router inteligente (recomendado)
 */
export async function createSmartLegalAgent(): Promise<LegalAgent> {
  return LegalAgent.create({
    useRouter: true,
    verbose: process.env.NODE_ENV === 'development'
  })
}

/**
 * Crea un agente M1 Pro (tareas complejas)
 */
export async function createComplexLegalAgent(): Promise<LegalAgent> {
  return LegalAgent.create({
    modelId: 'moonshotai/kimi-k2.5',
    temperature: 0.2,
    maxIterations: 10,
    verbose: process.env.NODE_ENV === 'development'
  })
}

/**
 * Crea un agente M1 Small (tareas simples)
 */
export async function createSimpleLegalAgent(): Promise<LegalAgent> {
  return LegalAgent.create({
    modelId: 'openai/gpt-oss-120b',
    temperature: 0.1,
    maxIterations: 5,
    verbose: process.env.NODE_ENV === 'development'
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTACIONES
// ═══════════════════════════════════════════════════════════════════════════════

export default LegalAgent
