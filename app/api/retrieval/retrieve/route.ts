// Dynamic import for local embeddings to avoid onnxruntime-node loading in Alpine Linux
// import { generateLocalEmbedding } from "@/lib/generate-local-embedding"
import { generateOpenRouterEmbedding } from "@/lib/generate-openrouter-embedding"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import OpenAI from "openai"
import { assertFilesAccess } from "@/lib/server/access/files"
import { ForbiddenError, NotFoundError } from "@/lib/server/errors"

// Force dynamic rendering to prevent build-time execution
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type EmbeddingsProvider = "openai" | "local" | "openrouter"

const DEFAULT_SOURCE_COUNT = 4
const MAX_SOURCE_COUNT = 12

// Dynamic import function for local embeddings (only loaded when needed)
async function getLocalEmbedding(text: string) {
  const { generateLocalEmbedding } = await import("@/lib/generate-local-embedding")
  return generateLocalEmbedding(text)
}

function isEmbeddingsProvider(value: unknown): value is EmbeddingsProvider {
  return value === "openai" || value === "local" || value === "openrouter"
}

function getStatusFromError(error: unknown, fallback?: number): number {
  if (error instanceof NotFoundError) return 404
  if (error instanceof ForbiddenError) return 403
  if (fallback) return fallback

  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("User not found") || message.includes("Profile not found")) {
    return 401
  }

  return 500
}

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null)
    if (!json || typeof json !== "object") {
      return new Response(JSON.stringify({ message: "Payload invalido" }), {
        status: 400
      })
    }

    let { userInput, fileIds, embeddingsProvider, sourceCount } = json as {
      userInput?: unknown
      fileIds?: unknown
      embeddingsProvider?: unknown
      sourceCount?: unknown
    }

    if (typeof userInput !== "string" || userInput.trim().length === 0) {
      return new Response(JSON.stringify({ message: "userInput es requerido" }), {
        status: 400
      })
    }

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return new Response(JSON.stringify({ message: "fileIds es requerido" }), {
        status: 400
      })
    }

    const uniqueFileIds = [...new Set(fileIds.filter((id): id is string => typeof id === "string"))]
    if (uniqueFileIds.length === 0) {
      return new Response(JSON.stringify({ message: "fileIds debe contener ids validos" }), {
        status: 400
      })
    }

    const normalizedSourceCount =
      typeof sourceCount === "number" && Number.isFinite(sourceCount)
        ? Math.min(Math.max(Math.trunc(sourceCount), 1), MAX_SOURCE_COUNT)
        : DEFAULT_SOURCE_COUNT

    let selectedProvider: EmbeddingsProvider = isEmbeddingsProvider(embeddingsProvider)
      ? embeddingsProvider
      : "openai"

    const profile = await getServerProfile()

    // Detectar disponibilidad de providers
    const hasOpenAI = Boolean(profile.openai_api_key || process.env.OPENAI_API_KEY)
    const hasOpenRouter = Boolean(profile.openrouter_api_key || process.env.OPENROUTER_API_KEY)

    // Si no hay OpenAI pero si OpenRouter, usar OpenRouter
    if (!hasOpenAI && hasOpenRouter) {
      selectedProvider = "openrouter"
      console.log("Using OpenRouter for retrieval (OpenAI unavailable)")
    } else if (hasOpenAI && (selectedProvider === "openrouter" || selectedProvider === "local")) {
      // Forzar OpenAI para retrieval cuando esta disponible
      selectedProvider = "openai"
      console.log("Switching retrieval provider to OpenAI for consistency")
    }

    const { getSupabaseServer } = await import("@/lib/supabase/server-client")
    const supabaseAdmin = getSupabaseServer()

    await assertFilesAccess(supabaseAdmin, uniqueFileIds, profile.user_id)

    if (selectedProvider === "openai") {
      if (profile.use_azure_openai) {
        checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")
      } else {
        checkApiKey(profile.openai_api_key, "OpenAI")
      }
    } else if (selectedProvider === "openrouter") {
      try {
        checkApiKey(profile.openrouter_api_key, "OpenRouter")
      } catch (error: any) {
        error.message = `${error.message}, make sure it is configured or else use local embeddings`
        throw error
      }
    }

    let chunks: any[] = []

    let openai
    if (profile.use_azure_openai) {
      openai = new OpenAI({
        apiKey: profile.azure_openai_api_key || "",
        baseURL: `${profile.azure_openai_endpoint}/openai/deployments/${profile.azure_openai_embeddings_id}`,
        defaultQuery: { "api-version": "2023-12-01-preview" },
        defaultHeaders: { "api-key": profile.azure_openai_api_key }
      })
    } else {
      openai = new OpenAI({
        apiKey: profile.openai_api_key || "",
        organization: profile.openai_organization_id
      })
    }

    if (selectedProvider === "openai") {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userInput
      })

      const openaiEmbedding = response.data.map(item => item.embedding)[0]

      const { data: openaiFileItems, error: openaiError } = await supabaseAdmin.rpc(
        "match_file_items_openai",
        {
          query_embedding: openaiEmbedding as any,
          match_count: normalizedSourceCount,
          file_ids: uniqueFileIds
        }
      )

      if (openaiError) {
        throw openaiError
      }

      chunks = openaiFileItems
    } else if (selectedProvider === "openrouter") {
      try {
        const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY

        const openrouterEmbedding = await generateOpenRouterEmbedding(
          userInput,
          openrouterKey!,
          "text-embedding-3-small"
        )

        const { data: openrouterFileItems, error: openrouterError } = await supabaseAdmin.rpc(
          "match_file_items_openai",
          {
            query_embedding: openrouterEmbedding as any,
            match_count: normalizedSourceCount,
            file_ids: uniqueFileIds
          }
        )

        if (openrouterError) {
          throw openrouterError
        }

        chunks = openrouterFileItems
      } catch (error) {
        throw new Error("Failed to retrieve with OpenRouter embeddings")
      }
    } else if (selectedProvider === "local") {
      const localEmbedding = await getLocalEmbedding(userInput)

      const { data: localFileItems, error: localFileItemsError } = await supabaseAdmin.rpc(
        "match_file_items_local",
        {
          query_embedding: localEmbedding as any,
          match_count: normalizedSourceCount,
          file_ids: uniqueFileIds
        }
      )

      if (localFileItemsError) {
        throw localFileItemsError
      }

      chunks = localFileItems
    }

    const mostSimilarChunks = chunks?.sort((a, b) => b.similarity - a.similarity)

    return new Response(JSON.stringify({ results: mostSimilarChunks }), {
      status: 200
    })
  } catch (error: any) {
    const errorMessage = error?.error?.message || error?.message || "An unexpected error occurred"
    const status = getStatusFromError(error, error?.status)

    return new Response(JSON.stringify({ message: errorMessage }), {
      status
    })
  }
}
