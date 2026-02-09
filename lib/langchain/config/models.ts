/**
 * Configuración de Modelos LLM para el Asistente Legal Inteligente
 * 
 * Modelos utilizados (todos vía OpenRouter):
 * - Gemini 3 Pro Preview: Modelo principal para tareas complejas (M1 Pro)
 * - GPT-5 Mini: Modelo para tareas simples y rápidas (M1)
 * 
 * Búsqueda web: Serper (única herramienta)
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
}

export type ModelId = 
  | 'google/gemini-3-pro-preview'         // M1 Pro - Tareas complejas
  | 'openai/gpt-5-mini'                   // M1 - Tareas simples
  | 'google/gemini-2.0-flash-thinking-exp:free' // Razonamiento rápido

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
    useCase: 'simple'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ALTERNATIVA: Gemini 2.0 Flash Thinking - Razonamiento rápido gratuito
  // ═══════════════════════════════════════════════════════════════════════════
  'google/gemini-2.0-flash-thinking-exp:free': {
    id: 'google/gemini-2.0-flash-thinking-exp:free',
    name: 'Gemini 2.0 Flash Thinking',
    provider: 'Google',
    description: 'Modelo de razonamiento rápido con capacidad de pensamiento step-by-step. Gratuito vía OpenRouter.',
    contextLength: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 0, output: 0 },
    capabilities: [
      'step-by-step-reasoning',
      'tool-calling',
      'fast-inference',
      'logical-analysis'
    ],
    useCase: 'research'
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN POR DEFECTO
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_MODEL: ModelId = 'google/gemini-3-pro-preview'
export const SIMPLE_TASK_MODEL: ModelId = 'openai/gpt-5-mini'
export const RESEARCH_MODEL: ModelId = 'google/gemini-3-pro-preview'

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER INTELIGENTE DE MODELOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ModelRouterConfig {
  model: ModelId
  temperature: number
  maxTokens: number
  tools: string[]
  reasoning?: boolean
}

/**
 * Determina el modelo y configuración óptima según el tipo de consulta
 */
export function routeModel(query: string): ModelRouterConfig {
  const normalized = query.toLowerCase()
  
  // Detectar consulta simple de artículo específico
  const isArticleQuery = /art(í|i)culo\s+\d+/i.test(normalized) && normalized.length < 150
  
  // Detectar consulta simple
  const isSimpleQuery = normalized.length < 100 && 
    !/(investiga|analiza|compara|diferencia|estudio|tesis)/i.test(normalized)
  
  // Detectar investigación compleja
  const isComplexResearch = /(investiga|analiza en profundidad|compara|diferencia|estudio|tesis|doctrina|jurisprudencia completa)/i.test(normalized) ||
    normalized.length > 500
  
  // Detectar caso práctico complejo
  const isCaseAnalysis = /(caso|situaci(ó|o)n|me pas(ó|o)|fue despedido|quiere demandar|problema legal)/i.test(normalized) &&
    normalized.length > 200

  // ═══════════════════════════════════════════════════════════════════════════
  // M1: Tareas simples (GPT-5 Mini)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isArticleQuery || isSimpleQuery) {
    return {
      model: SIMPLE_TASK_MODEL,
      temperature: 0.1,
      maxTokens: 2048,
      tools: ['search_legal_official', 'buscar_articulo_ley'],
      reasoning: false
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M1 PRO: Tareas complejas (Gemini 3 Pro Preview)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isComplexResearch || isCaseAnalysis) {
    return {
      model: RESEARCH_MODEL,
      temperature: 0.2,
      maxTokens: 8192,
      tools: ['search_legal_official', 'serper_web_search', 'buscar_articulo_ley'],
      reasoning: true
    }
  }

  // Default: Gemini 3 Pro Preview para todo lo demás
  return {
    model: DEFAULT_MODEL,
    temperature: 0.3,
    maxTokens: 4096,
    tools: ['search_legal_official', 'serper_web_search'],
    reasoning: false
  }
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
