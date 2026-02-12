/**
 * Configuracion de modelos LLM para el asistente legal.
 * Este modulo solo permite los tres modelos M definidos para produccion.
 */

import { ChatOpenAI } from "@langchain/openai"
import {
  ALLOWED_M_MODELS,
  M1_MODEL_ID,
  M1_PRO_MODEL_ID,
  M1_SMALL_MODEL_ID,
  PROVIDER_HINTS
} from "@/lib/models/m1-models"

export interface ModelConfig {
  id: string
  name: string
  provider: string
  description: string
  contextLength: number
  supportsTools: boolean
  supportsStreaming: boolean
  pricing: {
    input: number
    output: number
  }
  capabilities: string[]
  useCase: "simple" | "complex" | "research" | "default"
  providerHint?: string
}

export type ModelId =
  | typeof M1_SMALL_MODEL_ID
  | typeof M1_MODEL_ID
  | typeof M1_PRO_MODEL_ID

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  [M1_SMALL_MODEL_ID]: {
    id: M1_SMALL_MODEL_ID,
    name: "M1 Small",
    provider: "OpenRouter",
    description: "Modelo rapido y liviano para respuestas cortas y consultas directas.",
    contextLength: 128000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 0, output: 0 },
    capabilities: ["tool-calling", "fast-inference", "quick-responses"],
    useCase: "simple",
    providerHint: PROVIDER_HINTS[M1_SMALL_MODEL_ID]
  },
  [M1_MODEL_ID]: {
    id: M1_MODEL_ID,
    name: "M1",
    provider: "OpenRouter",
    description: "Modelo balanceado para la mayoria de consultas legales.",
    contextLength: 128000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 0, output: 0 },
    capabilities: ["tool-calling", "legal-analysis", "balanced-reasoning"],
    useCase: "default"
  },
  [M1_PRO_MODEL_ID]: {
    id: M1_PRO_MODEL_ID,
    name: "M1 Pro",
    provider: "OpenRouter",
    description: "Modelo para analisis complejos y tareas de razonamiento profundo.",
    contextLength: 128000,
    supportsTools: true,
    supportsStreaming: true,
    pricing: { input: 0, output: 0 },
    capabilities: ["deep-reasoning", "tool-calling", "complex-research"],
    useCase: "complex",
    providerHint: PROVIDER_HINTS[M1_PRO_MODEL_ID]
  }
}

export const DEFAULT_MODEL: ModelId = M1_MODEL_ID
export const SIMPLE_TASK_MODEL: ModelId = M1_SMALL_MODEL_ID
export const RESEARCH_MODEL: ModelId = M1_PRO_MODEL_ID

export const GUARANTEED_FALLBACKS = {
  complex: M1_MODEL_ID,
  simple: M1_SMALL_MODEL_ID,
  fast: M1_SMALL_MODEL_ID
}

export interface ModelRouterConfig {
  model: ModelId | string
  temperature: number
  maxTokens: number
  tools: string[]
  reasoning?: boolean
}

export function routeModel(query: string): ModelRouterConfig {
  const normalized = (query || "").toLowerCase()
  const looksComplex =
    normalized.length > 800 ||
    normalized.includes("jurisprudencia") ||
    normalized.includes("comparado") ||
    normalized.includes("excepcion") ||
    normalized.includes("demanda")

  if (looksComplex) {
    return {
      model: RESEARCH_MODEL,
      temperature: 0.2,
      maxTokens: 4096,
      tools: ["search_legal_official", "serper_web_search", "buscar_articulo_ley"],
      reasoning: true
    }
  }

  return {
    model: DEFAULT_MODEL,
    temperature: 0.3,
    maxTokens: 4096,
    tools: ["search_legal_official", "serper_web_search", "buscar_articulo_ley"],
    reasoning: false
  }
}

export function resolveModel(modelId: string, availableModels?: string[]): string {
  if (!(ALLOWED_M_MODELS as readonly string[]).includes(modelId)) {
    return DEFAULT_MODEL
  }

  if (availableModels && availableModels.length > 0) {
    if (availableModels.includes(modelId)) {
      return modelId
    }
    if (availableModels.includes(DEFAULT_MODEL)) {
      return DEFAULT_MODEL
    }
    if (availableModels.includes(M1_SMALL_MODEL_ID)) {
      return M1_SMALL_MODEL_ID
    }
  }

  return modelId
}

export interface CreateModelOptions {
  modelId: ModelId | string
  temperature?: number
  maxTokens?: number
  streaming?: boolean
}

export function createModel(options: CreateModelOptions): ChatOpenAI {
  const { modelId, temperature = 0.3, maxTokens = 4096, streaming = true } = options

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY no esta configurada en las variables de entorno")
  }

  const resolvedModel = resolveModel(String(modelId))

  return new ChatOpenAI({
    modelName: resolvedModel,
    temperature,
    maxTokens,
    streaming,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1"
    },
    apiKey,
    modelKwargs: {
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Asistente Legal Inteligente"
      }
    }
  })
}

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

export function getModelForUseCase(useCase: "simple" | "complex" | "research"): ModelConfig {
  if (useCase === "simple") return MODEL_REGISTRY[SIMPLE_TASK_MODEL]
  if (useCase === "complex" || useCase === "research") return MODEL_REGISTRY[RESEARCH_MODEL]
  return MODEL_REGISTRY[DEFAULT_MODEL]
}

export function getModelHierarchy(): Record<string, { primary: string; fallbacks: string[] }> {
  return {
    "M1 Pro": {
      primary: M1_PRO_MODEL_ID,
      fallbacks: [M1_MODEL_ID, M1_SMALL_MODEL_ID]
    },
    M1: {
      primary: M1_MODEL_ID,
      fallbacks: [M1_SMALL_MODEL_ID]
    },
    "M1 Small": {
      primary: M1_SMALL_MODEL_ID,
      fallbacks: [M1_MODEL_ID]
    }
  }
}

export const RESEARCH_MODELS = [...ALLOWED_M_MODELS]
