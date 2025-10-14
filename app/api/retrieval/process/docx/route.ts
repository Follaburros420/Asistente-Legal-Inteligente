import { generateLocalEmbedding } from "@/lib/generate-local-embedding"
import { generateMultipleOpenRouterEmbeddings } from "@/lib/generate-openrouter-embedding"
import { processDocX } from "@/lib/retrieval/processing"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { FileItemChunk } from "@/types"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import OpenAI from "openai"

export async function POST(req: Request) {
  const json = await req.json()
  let { text, fileId, embeddingsProvider, fileExtension } = json as {
    text: string
    fileId: string
    embeddingsProvider: "openai" | "local" | "openrouter"
    fileExtension: string
  }
  
  // 🔥 FORZAR OpenAI Embeddings - SOLUCIÓN DEFINITIVA
  // OpenRouter no tiene embeddings, local tiene problemas de descarga
  embeddingsProvider = "openai"
  console.log("🔥 [DOCX] FORZANDO embeddingsProvider a 'openai' (más confiable)")

  try {
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const profile = await getServerProfile()

    console.log(`📌 [DOCX] Embeddings provider: ${embeddingsProvider}`)

    // Verificar API keys según el proveedor
    if (embeddingsProvider === "openrouter") {
      const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY
      if (!openrouterKey) {
        throw new Error("❌ OpenRouter API Key not found. Please add it to your profile or OPENROUTER_API_KEY environment variable.")
      }
      console.log("✅ [DOCX] OpenRouter API Key found")
    } else if (embeddingsProvider === "openai") {
      if (profile.use_azure_openai) {
        checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")
      } else {
        checkApiKey(profile.openai_api_key, "OpenAI")
      }
    }

    let chunks: FileItemChunk[] = []

    switch (fileExtension) {
      case "docx":
        chunks = await processDocX(text)
        break
      default:
        return new NextResponse("Unsupported file type", {
          status: 400
        })
    }

    let embeddings: any = []

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
        input: chunks.map(chunk => chunk.content)
      })

      embeddings = response.data.map((item: any) => {
        return item.embedding
      })
    } else if (embeddingsProvider === "openrouter") {
      try {
        console.log('🚀 [DOCX] Using OpenRouter embeddings for document processing')
        const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY
        
        embeddings = await generateMultipleOpenRouterEmbeddings(
          chunks.map(chunk => chunk.content),
          openrouterKey!,
          'text-embedding-3-small'
        )
        
        console.log(`✅ [DOCX] Generated ${embeddings.length} OpenRouter embeddings`)
      } catch (error) {
        console.error('❌ [DOCX] OpenRouter embeddings error:', error)
        throw new Error('Failed to generate OpenRouter embeddings')
      }
    } else if (embeddingsProvider === "local") {
      const embeddingPromises = chunks.map(async chunk => {
        try {
          return await generateLocalEmbedding(chunk.content)
        } catch (error) {
          console.error(`Error generating embedding for chunk: ${chunk}`, error)
          return null
        }
      })

      embeddings = await Promise.all(embeddingPromises)
    }

    const file_items = chunks.map((chunk, index) => ({
      file_id: fileId,
      user_id: profile.user_id,
      content: chunk.content,
      tokens: chunk.tokens,
      openai_embedding:
        embeddingsProvider === "openai" || embeddingsProvider === "openrouter"
          ? ((embeddings[index] || null) as any)
          : null,
      local_embedding:
        embeddingsProvider === "local"
          ? ((embeddings[index] || null) as any)
          : null
    }))

    await supabaseAdmin.from("file_items").upsert(file_items)

    const totalTokens = file_items.reduce((acc, item) => acc + item.tokens, 0)

    await supabaseAdmin
      .from("files")
      .update({ tokens: totalTokens })
      .eq("id", fileId)

    return new NextResponse("Embed Successful", {
      status: 200
    })
  } catch (error: any) {
    console.error(error)
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
