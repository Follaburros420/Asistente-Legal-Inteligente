// Dynamic import for local embeddings to avoid onnxruntime-node loading in Alpine Linux
// import { generateLocalEmbedding } from "@/lib/generate-local-embedding"
import { generateOpenRouterEmbedding } from "@/lib/generate-openrouter-embedding"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import OpenAI from "openai"
import { assertFilesAccess } from "@/lib/server/access/files"
import { ForbiddenError, NotFoundError } from "@/lib/server/errors"

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Dynamic import function for local embeddings (only loaded when needed)
async function getLocalEmbedding(text: string) {
  const { generateLocalEmbedding } = await import("@/lib/generate-local-embedding")
  return generateLocalEmbedding(text)
}

export async function POST(request: Request) {
  const json = await request.json()
  let { userInput, fileIds, embeddingsProvider, sourceCount } = json as {
    userInput: string
    fileIds: string[]
    embeddingsProvider: "openai" | "local" | "openrouter"
    sourceCount: number
  }

  // Detectar si hay API key de OpenAI disponible
  const hasOpenAI = profile.openai_api_key || process.env.OPENAI_API_KEY
  
  // Si no hay OpenAI pero sí OpenRouter, usar OpenRouter
  if (!hasOpenAI && (profile.openrouter_api_key || process.env.OPENROUTER_API_KEY)) {
    embeddingsProvider = "openrouter"
    console.log("🔍 Usando OpenRouter para retrieval (OpenAI no disponible)")
  } else if (embeddingsProvider === "openrouter" || embeddingsProvider === "local") {
    // FORZAR OpenAI Embeddings para retrieval
    embeddingsProvider = "openai"
    console.log("🔍 Cambiando a 'openai' para retrieval (más confiable)")
  }

  const uniqueFileIds = [...new Set(fileIds)]

  try {
    const { getSupabaseServer } = await import("@/lib/supabase/server-client");
    const supabaseAdmin = getSupabaseServer();

    const profile = await getServerProfile()

    await assertFilesAccess(supabaseAdmin, uniqueFileIds, profile.user_id)

    if (embeddingsProvider === "openai") {
      if (profile.use_azure_openai) {
        checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")
      } else {
        checkApiKey(profile.openai_api_key, "OpenAI")
      }
    } else if (embeddingsProvider === "openrouter") {
      try {
        checkApiKey(profile.openrouter_api_key, "OpenRouter")
      } catch (error: any) {
        error.message =
          error.message +
          ", make sure it is configured or else use local embeddings"
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

    if (embeddingsProvider === "openai") {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userInput
      })

      const openaiEmbedding = response.data.map(item => item.embedding)[0]

      const { data: openaiFileItems, error: openaiError } =
        await supabaseAdmin.rpc("match_file_items_openai", {
          query_embedding: openaiEmbedding as any,
          match_count: sourceCount,
          file_ids: uniqueFileIds
        })

      if (openaiError) {
        throw openaiError
      }

      chunks = openaiFileItems
    } else if (embeddingsProvider === "openrouter") {
      try {
        const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY
        console.log('🔍 Generando embedding de búsqueda con OpenRouter...')

        const openrouterEmbedding = await generateOpenRouterEmbedding(
          userInput,
          openrouterKey!,
          'text-embedding-3-small'
        )

        console.log('✅ Embedding generado, buscando en base de datos...')

        const { data: openrouterFileItems, error: openrouterError } =
          await supabaseAdmin.rpc("match_file_items_openai", {
            query_embedding: openrouterEmbedding as any,
            match_count: sourceCount,
            file_ids: uniqueFileIds
          })

        if (openrouterError) {
          console.error('❌ Error en búsqueda de Supabase:', openrouterError)
          throw openrouterError
        }

        console.log(`✅ Encontrados ${openrouterFileItems?.length || 0} chunks relevantes`)
        chunks = openrouterFileItems
      } catch (error) {
        console.error('❌ OpenRouter retrieval error:', error)
        throw new Error('Failed to retrieve with OpenRouter embeddings')
      }
    } else if (embeddingsProvider === "local") {
      const localEmbedding = await getLocalEmbedding(userInput)

      const { data: localFileItems, error: localFileItemsError } =
        await supabaseAdmin.rpc("match_file_items_local", {
          query_embedding: localEmbedding as any,
          match_count: sourceCount,
          file_ids: uniqueFileIds
        })

      if (localFileItemsError) {
        throw localFileItemsError
      }

      chunks = localFileItems
    }

    const mostSimilarChunks = chunks?.sort(
      (a, b) => b.similarity - a.similarity
    )

    return new Response(JSON.stringify({ results: mostSimilarChunks }), {
      status: 200
    })
  } catch (error: any) {
    const errorMessage = error.error?.message || error?.message || "An unexpected error occurred"
    const errorCode =
      error instanceof NotFoundError ? 404 : error instanceof ForbiddenError ? 403 : error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
