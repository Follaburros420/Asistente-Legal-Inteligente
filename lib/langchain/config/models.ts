/**
 * Configuración de Modelos LLM para el Asistente Legal Inteligente
 *
 * Modelos utilizados (todos vía OpenRouter):
 * - Gemini 3 Pro Preview: Modelo principal para TODAS las tareas
 * - Gemini 2.0 Flash Thinking: Alternativa gratuita con razonamiento
 *
 * Búsqueda web: Serper (única herramienta)
 *
 * NOTA: Solo se usan modelos Google Gemini para garantizar disponibilidad.
 * Los modelos OpenAI (gpt-5-mini, gpt-4o-mini) fueron removidos porque
 * no están disponibles en OpenRouter.
 */

import { ChatOpenAI } from "@langchain/openai"

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS Y INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ModelConfig {
  id: string
  name: string
  provider: string
  description: string
  contextLength: number
  supportsTools: boolean
  supportsStreaming: boolean
  pricing: {
    input: number  // $ per 1M tokens
    output: number // $ per 1M tokens
  }
  capabilities: string[]
  useCase: 'simple' | 'complex' | 'research' | 'default'
  fallback?: string // Modelo alternativo si este no está disponible
}

// Modelos principales deseados
export type ModelId =
  | 'google/gemini-3-pro-preview'         // M1 Pro - Tareas complejas
  | 'openai/gpt-5-mini'                   // M1 - Tareas simples
  | 'google/gemini-3-flash-preview'              // M1 Small - Rápido y eficiente

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO DE MODELOS
// ═══════════════════════════════════════════════════════════════════════════════

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // M1 PRO: Gemini 3 Pro Preview - Tareas complejas e investigación profunda
  // ═══════════════════════════════════════════════════════════════════════════
  'google/gemini-3-pro-preview': {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    provider: 'Google',
    description: 'Modelo Pro de Google con capacidades avanzadas de razonamiento jurídico y contexto extendido. Ideal para investigación legal compleja en derecho colombiano.',
    contextLength: 1000000, // 1M de contexto
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 0, output: 0 }, // Precio según OpenRouter
    capabilities: [
      'deep-reasoning',
      'tool-calling',
      'long-context',
      'legal-analysis',
      'multi-document-analysis',
      'complex-research',
      'colombian-law-expertise'
    ],
    useCase: 'complex',
    fallback: 'google/gemini-1.5-pro-latest' // Fallback si no está disponible
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK M1 PRO: Gemini 1.5 Pro (modelo estable)
  // ═══════════════════════════════════════════════════════════════════════════
  'google/gemini-1.5-pro-latest': {
    id: 'google/gemini-1.5-pro-latest',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    description: 'Modelo Pro estable de Google. Usado como fallback cuando Gemini 3 Pro no está disponible.',
    contextLength: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 3.5, output: 10.5 },
    capabilities: [
      'tool-calling',
      'long-context',
      'legal-analysis',
      'multi-document-analysis'
    ],
    useCase: 'complex',
    fallback: 'anthropic/claude-3.5-sonnet' // Segundo fallback
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SEGUNDO FALLBACK: Claude 3.5 Sonnet (muy capaz)
  // ═══════════════════════════════════════════════════════════════════════════
  'anthropic/claude-3.5-sonnet': {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Modelo alternativo de Anthropic con excelente capacidad de razonamiento legal.',
    contextLength: 200000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 3.0, output: 15.0 },
    capabilities: [
      'tool-calling',
      'long-context',
      'legal-analysis',
      'complex-reasoning'
    ],
    useCase: 'complex'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // M1: GPT-5 Mini - Tareas simples y respuestas rápidas
  // ═══════════════════════════════════════════════════════════════════════════
  'openai/gpt-5-mini': {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    description: 'Modelo eficiente de última generación para tareas simples, consultas directas y respuestas rápidas. Excelente relación costo-beneficio.',
    contextLength: 128000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 0.15, output: 0.60 },
    capabilities: [
      'tool-calling',
      'quick-responses',
      'instruction-following',
      'article-lookup',
      'simple-research'
    ],
    useCase: 'simple',
    fallback: 'openai/gpt-4o-mini' // Fallback si no está disponible
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK M1: GPT-4o Mini (modelo estable y económico)
  // ═══════════════════════════════════════════════════════════════════════════
  'openai/gpt-4o-mini': {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Modelo estable de OpenAI. Usado como fallback cuando GPT-5 Mini no está disponible.',
    contextLength: 128000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 0.15, output: 0.60 },
    capabilities: [
      'tool-calling',
      'quick-responses',
      'instruction-following'
    ],
    useCase: 'simple'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // M1 SMALL: Gemini 3 Flash Preview - Rápido y eficiente
  // ═══════════════════════════════════════════════════════════════════════════
  'google/gemini-3-flash-preview': {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    provider: 'Google',
    description: 'Modelo Flash de última generación. Rápido, eficiente y con capacidad de tool calling.',
    contextLength: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 0, output: 0 },
    capabilities: [
      'tool-calling',
      'fast-inference',
      'logical-analysis',
      'step-by-step-reasoning'
    ],
    useCase: 'simple',
    fallback: 'google/gemini-1.5-flash'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK FLASH: Gemini 1.5 Flash
  // ═══════════════════════════════════════════════════════════════════════════
  'google/gemini-1.5-flash': {
    id: 'google/gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    description: 'Modelo rápido y económico de Google.',
    contextLength: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 0.35, output: 0.70 },
    capabilities: [
      'tool-calling',
      'fast-inference'
    ],
    useCase: 'simple'
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN POR DEFECTO - SIEMPRE USAR GEMINI
// ═══════════════════════════════════════════════════════════════════════════════

// Modelo único para todas las tareas: Gemini 3 Pro Preview
export const DEFAULT_MODEL: ModelId = 'google/gemini-3-pro-preview'
export const SIMPLE_TASK_MODEL: ModelId = 'google/gemini-3-pro-preview'
export const RESEARCH_MODEL: ModelId = 'google/gemini-3-pro-preview'
export const RESEARCH_MODELS: ModelId[] = [
  RESEARCH_MODEL,
  'google/gemini-2.0-flash-thinking-exp:free',
  'anthropic/claude-3.5-sonnet'
]

// Modelos de fallback garantizados (solo Gemini)
export const GUARANTEED_FALLBACKS = {
  complex: 'google/gemini-1.5-pro-latest',
  simple: 'google/gemini-1.5-flash',
  fast: 'google/gemini-1.5-flash'
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER INTELIGENTE DE MODELOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ModelRouterConfig {
  model: ModelId | string
  temperature: number
  maxTokens: number
  tools: string[]
  reasoning?: boolean
}

/**
 * Determina el modelo y configuración óptima según el tipo de consulta
 *
 * NOTA: Por ahora siempre usamos Gemini 3 Pro Preview para garantizar
 * disponibilidad. El router puede reactivarse cuando haya más modelos
 * disponibles en OpenRouter.
 */
export function routeModel(query: string): ModelRouterConfig {
  // Siempre usar Gemini 3 Pro Preview - modelo principal
  return {
    model: DEFAULT_MODEL, // google/gemini-3-pro-preview
    temperature: 0.3,
    maxTokens: 4096,
    tools: ['search_legal_official', 'serper_web_search', 'buscar_articulo_ley'],
    reasoning: false
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESOLUCIÓN DE FALLBACKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el modelo efectivo, resolviendo fallbacks si es necesario
 * Verifica si un modelo existe en OpenRouter y retorna el fallback si no
 */
export function resolveModel(modelId: string, availableModels?: string[]): string {
  // Si tenemos lista de modelos disponibles, verificar
  if (availableModels && availableModels.length > 0) {
    if (availableModels.includes(modelId)) {
      return modelId
    }

    // Buscar fallback
    const config = MODEL_REGISTRY[modelId]
    if (config?.fallback && availableModels.includes(config.fallback)) {
      console.log(`⚠️ Modelo ${modelId} no disponible, usando fallback: ${config.fallback}`)
      return config.fallback
    }

    // Fallback final garantizado
    const useCase = config?.useCase || 'complex'
    const guaranteed = GUARANTEED_FALLBACKS[useCase as keyof typeof GUARANTEED_FALLBACKS]
      || GUARANTEED_FALLBACKS.complex

    if (availableModels.includes(guaranteed)) {
      console.log(`⚠️ Usando fallback garantizado: ${guaranteed}`)
      return guaranteed
    }
  }

  // Si no tenemos lista de disponibles, asumir que el modelo existe
  // y dejar que falle en runtime si realmente no existe
  return modelId
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY DE MODELOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateModelOptions {
  modelId: ModelId | string
  temperature?: number
  maxTokens?: number
  streaming?: boolean
}

/**
 * Crea una instancia de ChatOpenAI configurada para OpenRouter
 */
export function createModel(options: CreateModelOptions): ChatOpenAI {
  const { modelId, temperature = 0.3, maxTokens = 4096, streaming = true } = options

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no está configurada en las variables de entorno')
  }

  const modelConfig = MODEL_REGISTRY[modelId]
  if (!modelConfig) {
    console.warn(`⚠️ Modelo ${modelId} no está en el registro, usando configuración por defecto`)
  }

  return new ChatOpenAI({
    modelName: modelId,
    temperature,
    maxTokens,
    streaming,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
    },
    apiKey,
    modelKwargs: {
      headers: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Asistente Legal Inteligente'
      }
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE UTILIDAD
// ═══════════════════════════════════════════════════════════════════════════════

export function modelSupportsTools(modelId: string): boolean {
  const config = MODEL_REGISTRY[modelId]
  return config?.supportsTools ?? false
}

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_REGISTRY[modelId]
}

export function getToolCapableModels(): ModelConfig[] {
  return Object.values(MODEL_REGISTRY).filter(m => m.supportsTools)
}

export function getModelForUseCase(useCase: 'simple' | 'complex' | 'research'): ModelConfig {
  const model = Object.values(MODEL_REGISTRY).find(m => m.useCase === useCase)
  return model || MODEL_REGISTRY[DEFAULT_MODEL]
}

/**
 * Lista todos los modelos configurados con sus fallbacks
 */
export function getModelHierarchy(): Record<string, { primary: string; fallbacks: string[] }> {
  return {
    'Principal (Todas las tareas)': {
      primary: 'google/gemini-3-pro-preview',
      fallbacks: ['google/gemini-1.5-pro-latest', 'google/gemini-1.5-flash']
    },
    'M1 Small (Flash)': {
      primary: 'google/gemini-3-flash-preview',
      fallbacks: ['google/gemini-1.5-flash']
    }
  }
}

// Exportar RESEARCH_MODELS para compatibilidad
export const RESEARCH_MODELS = ['google/gemini-3-pro-preview', 'google/gemini-3-flash-preview']
