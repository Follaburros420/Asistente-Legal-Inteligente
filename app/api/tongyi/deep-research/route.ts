export const dynamic = 'force-dynamic'

import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { runDeepResearchWorkflow } from "@/lib/tongyi/deep-research-orchestrator"
import { DEEP_RESEARCH_SYSTEM_PROMPT } from "@/lib/tongyi/deep-research-prompts"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const FALLBACK_USERNAME = "usuario-anonimo"
const DEFAULT_MAX_TOKENS = 8000
const DEFAULT_TEMPERATURE = 0.2
const DEFAULT_RESEARCH_MODEL = "google/gemini-3-pro-preview"

interface RequestBody {
  chatSettings: ChatSettings
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
}

export async function POST(request: Request) {
  const { chatSettings, messages } = (await request.json()) as RequestBody

  try {
    const profile = await resolveProfile()
    const apiKey =
      process.env.OPENROUTER_API_KEY || profile.openrouter_api_key || ""

    if (!apiKey) {
      throw new Error(
        "OpenRouter API Key no configurada. Define OPENROUTER_API_KEY o agrega la clave en el perfil del usuario."
      )
    }

    const client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
    })

    const resolvedModel =
      typeof chatSettings.model === "string" && chatSettings.model.length > 0
        ? (chatSettings.model as string)
        : DEFAULT_RESEARCH_MODEL
    const userQuery = extractLastUserMessage(messages)

    // Ejecutar el flujo de investigación profunda
    const researchResult = await runDeepResearchWorkflow(userQuery, {
      client,
      model: resolvedModel,
      maxResearchRounds: 6,
      maxSearchesPerRound: 6,
      searchTimeoutMs: 35000,
    })

    // Construir el contexto del sistema con los resultados de investigación
    const systemContent = `${DEEP_RESEARCH_SYSTEM_PROMPT}\n\n${researchResult.modelContext}`
    prependOrMergeSystemMessage(messages, systemContent)

    logDeepResearchWorkflow(profile.username, userQuery, researchResult)

    // Generar respuesta final con toda la información recopilada
    const response = await client.chat.completions.create({
      model: resolvedModel as ChatCompletionCreateParamsBase["model"],
      messages,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS,
      stream: true,
    })

    const stream = OpenAIStream(response)
    return new StreamingTextResponse(stream)
  } catch (error: any) {
    console.error("[deep-research-route] Error:", error)
    const message =
      error?.error?.message ||
      error?.message ||
      "Error en el sistema de investigación legal profunda"

    const status = typeof error?.status === "number" ? error.status : 500

    return new Response(
      JSON.stringify({
        message,
        error: "DEEP_RESEARCH_ERROR",
      }),
      { status }
    )
  }
}

export const runtime = "edge"

async function resolveProfile() {
  try {
    const profile = await getServerProfile()
    return profile ?? { username: FALLBACK_USERNAME, openrouter_api_key: "" }
  } catch (_error) {
    console.log("[deep-research-route] Usuario no autenticado, usando configuracion por defecto")
    return { username: FALLBACK_USERNAME, openrouter_api_key: "" }
  }
}

function extractLastUserMessage(messages: RequestBody["messages"]): string {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
  return typeof lastUserMessage?.content === "string"
    ? lastUserMessage.content
    : ""
}

function prependOrMergeSystemMessage(
  messages: RequestBody["messages"],
  newContent: string
) {
  if (!messages.length || messages[0].role !== "system") {
    messages.unshift({ role: "system", content: newContent })
    return
  }

  messages[0] = {
    ...messages[0],
    content: `${messages[0].content}\n\n${newContent}`,
  }
}

function logDeepResearchWorkflow(
  username: string | undefined,
  userQuery: string,
  workflow: Awaited<ReturnType<typeof runDeepResearchWorkflow>>
) {
  const displayUser = username || FALLBACK_USERNAME
  const truncatedQuery = userQuery.length > 120 ? `${userQuery.slice(0, 117)}...` : userQuery

  console.log("[deep-research] ===============================")
  console.log(`[deep-research] Usuario: ${displayUser}`)
  console.log(`[deep-research] Consulta: "${truncatedQuery}"`)
  console.log(`[deep-research] Rondas de investigación: ${workflow.metadata.totalRounds}`)
  console.log(`[deep-research] Búsquedas totales: ${workflow.metadata.totalSearches}`)
  console.log(`[deep-research] Fuentes encontradas: ${workflow.metadata.totalSources}`)
  console.log(`[deep-research] Duración total: ${workflow.metadata.totalDurationMs}ms`)
  console.log(`[deep-research] Estrategia final: ${workflow.metadata.finalStrategy}`)
  
  if (workflow.metadata.gapsIdentified > 0) {
    console.log(`[deep-research] Brechas identificadas y resueltas: ${workflow.metadata.gapsIdentified}`)
  }
  
  console.log(`[deep-research] Calidad de investigación: ${workflow.metadata.researchQuality}/10`)
  
  if (workflow.sources.length > 0) {
    console.log("[deep-research] Principales fuentes:")
    workflow.sources.slice(0, 5).forEach((source: any, index: number) => {
      console.log(`  ${index + 1}. ${source.title} (${source.type}) -> ${source.url}`)
    })
  }
  
  console.log("[deep-research] ===============================")
}
