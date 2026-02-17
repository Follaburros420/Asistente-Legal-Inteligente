/**
 * API Route: POST /api/chat/deep-research
 * 
 * Deep Research endpoint that performs exhaustive multi-round web searches.
 * Uses the runDeepResearchWorkflow for comprehensive legal research.
 * 
 * Events emitted (SSE format):
 * 1. meta: { message_id, intent, render_mode }
 * 2. status: { phase, message, round?, total_rounds? }
 * 3. delta: { text } (multiple, during streaming)
 * 4. citations: { items } (optional)
 * 5. done: { ok: true, metadata } | error: { message, code }
 */

import { NextRequest } from "next/server"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { runDeepResearchWorkflow } from "@/lib/tongyi/deep-research-orchestrator"
import { DEEP_RESEARCH_SYSTEM_PROMPT } from "@/lib/tongyi/deep-research-prompts"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"

export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes for deep research

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_MODEL = "google/gemini-2.0-flash-001"

interface RequestBody {
  message: string
  history: Array<{ role: string; content: string }>
  config?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  console.log(`[${requestId}] 🔬 Deep Research started`)

  try {
    const body = await req.json() as RequestBody
    const { message, history = [], config = {} } = body

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get API key
    const profile = await getProfile()
    const apiKey = process.env.OPENROUTER_API_KEY || profile?.openrouter_api_key || ""

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No API key configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
    })

    const model = config.model || DEFAULT_MODEL

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: string, data: any) => {
          controller.enqueue(
            encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        }

        try {
          // Emit meta
          sendEvent("meta", {
            message_id: requestId,
            intent: "deep_research",
            render_mode: "chat"
          })

          // Emit initial status
          sendEvent("status", {
            phase: "planning",
            message: "Planificando estrategia de investigación..."
          })

          // Run deep research workflow
          const researchResult = await runDeepResearchWorkflow(message, {
            client,
            model,
            maxResearchRounds: 6,
            maxSearchesPerRound: 6,
            searchTimeoutMs: 35000,
            onProgress: (round, totalRounds, phase, message) => {
              sendEvent("status", {
                phase,
                message,
                round,
                total_rounds: totalRounds
              })
            }
          })

          console.log(`[${requestId}] 📊 Research completed:`, {
            rounds: researchResult.metadata.totalRounds,
            sources: researchResult.metadata.totalSources,
            quality: researchResult.metadata.averageQuality
          })

          // Emit status for synthesis
          sendEvent("status", {
            phase: "synthesizing",
            message: "Sintetizando hallazgos..."
          })

          // Build messages for final synthesis
           const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
             { role: "system", content: DEEP_RESEARCH_SYSTEM_PROMPT },
             ...history.filter(m => m.role === "user" || m.role === "assistant").map(m => ({
               role: m.role as "user" | "assistant",
               content: m.content
             })),
             { role: "user", content: `${message}\n\n${researchResult.context}` }
           ]

          // Stream final response
          const response = await client.chat.completions.create({
            model: model as ChatCompletionCreateParamsBase["model"],
            messages,
            temperature: 0.2,
            max_tokens: config.maxTokens || 8000,
            stream: true,
          })

          let fullText = ""
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              fullText += content
              sendEvent("delta", { text: content })
            }
          }

          // Emit citations
          if (researchResult.sources.length > 0) {
            sendEvent("citations", {
              items: researchResult.sources.slice(0, 10).map((source, i) => ({
                id: `source-${i}`,
                title: source.title,
                url: source.url,
                type: source.type,
                snippet: source.snippet?.substring(0, 200)
              }))
            })
          }

          // Emit done
          sendEvent("done", {
            metadata: {
              model,
              totalRounds: researchResult.metadata.totalRounds,
              totalSources: researchResult.metadata.totalSources,
              highQualitySources: researchResult.metadata.highQualitySources,
              officialSources: researchResult.metadata.officialSources,
              researchQuality: researchResult.metadata.averageQuality,
              processingTime: `${researchResult.metadata.totalDurationMs}ms`
            }
          })

          controller.close()

        } catch (error: any) {
          console.error(`[${requestId}] ❌ Error:`, error)
          sendEvent("error", {
            message: error.message || "Error en investigación profunda",
            code: "DEEP_RESEARCH_ERROR"
          })
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    })

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Outer error:`, error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

async function getProfile() {
  try {
    return await getServerProfile()
  } catch {
    return null
  }
}
