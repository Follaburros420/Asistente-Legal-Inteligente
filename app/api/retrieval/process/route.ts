// Dynamic import for local embeddings to avoid onnxruntime-node loading in Alpine Linux
// import { generateLocalEmbedding } from "@/lib/generate-local-embedding"
import { generateOpenRouterEmbedding, generateMultipleOpenRouterEmbeddings } from "@/lib/generate-openrouter-embedding"
import {
  processCSV,
  processJSON,
  processMarkdown,
  processPdf,
  processTxt
} from "@/lib/retrieval/processing"
import mammoth from "mammoth"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { encode } from "gpt-tokenizer"
import { CHUNK_SIZE, CHUNK_OVERLAP } from "@/lib/retrieval/processing"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { FileItemChunk } from "@/types"
import { NextResponse } from "next/server"
import OpenAI from "openai"
import { assertFileAccess } from "@/lib/server/access/files"
import { ForbiddenError, NotFoundError } from "@/lib/server/errors"

// Dynamic import function for local embeddings (only loaded when needed)
// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getLocalEmbedding(text: string) {
  const { generateLocalEmbedding } = await import("@/lib/generate-local-embedding")
  return generateLocalEmbedding(text)
}

export async function POST(req: Request) {
  try {
    const { getSupabaseServer } = await import("@/lib/supabase/server-client");
    const supabaseAdmin = getSupabaseServer();

    const profile = await getServerProfile()

    const formData = await req.formData()

    const file_id = formData.get("file_id") as string
    let embeddingsProvider = formData.get("embeddingsProvider") as string

    // Detectar si hay API key de OpenAI disponible
    const hasOpenAI = profile.openai_api_key || process.env.OPENAI_API_KEY
    
    // Si no hay OpenAI pero sí OpenRouter, usar OpenRouter
    if (!hasOpenAI && (profile.openrouter_api_key || process.env.OPENROUTER_API_KEY)) {
      embeddingsProvider = "openrouter"
      console.log("🔥 Usando OpenRouter para embeddings (OpenAI no disponible)")
    } else {
      // FORZAR OpenAI Embeddings - SOLUCIÓN DEFINITIVA
      embeddingsProvider = "openai"
      console.log("🔥 FORZANDO embeddingsProvider a 'openai' (más confiable y económico)")
    }

    const fileMetadata = await assertFileAccess(supabaseAdmin, file_id, profile.user_id)

    const { data: file, error: fileError } = await supabaseAdmin.storage
      .from("files")
      .download(fileMetadata.file_path)

    if (fileError) {
      console.error("❌ Storage error:", fileError)
      throw new Error(`Failed to retrieve file from storage: ${fileError.message}. Please ensure the storage bucket exists and the file path is correct.`)
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const blob = new Blob([fileBuffer])
    const fileExtension = fileMetadata.name.split(".").pop()?.toLowerCase()

    // ============================================
    // CONFIGURACIÓN DE EMBEDDINGS PROVIDER
    // ============================================
    // Por defecto, usar OpenRouter (sin necesidad de OpenAI API key)
    if (!embeddingsProvider || embeddingsProvider === "") {
      embeddingsProvider = "openrouter"
      console.log("📌 Embeddings provider no especificado, usando OpenRouter por defecto")
    }

    console.log(`📌 Embeddings provider seleccionado: ${embeddingsProvider}`)

    // Verificar API keys según el proveedor
    if (embeddingsProvider === "openai") {
      // Para OpenAI (preferido para embeddings)
      try {
        if (profile.use_azure_openai) {
          checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")
          console.log("✅ Azure OpenAI API Key found")
        } else {
          checkApiKey(profile.openai_api_key, "OpenAI")
          console.log("✅ OpenAI API Key found")
        }
      } catch (error: any) {
        throw new Error(`❌ OpenAI API Key not found. Embeddings require an OpenAI API key. Error: ${error.message}`)
      }
    } else if (embeddingsProvider !== "local") {
      console.log(`⚠️ Unknown embeddings provider: ${embeddingsProvider}, defaulting to openai`)
      embeddingsProvider = "openai"
    }

    let chunks: FileItemChunk[] = []

    switch (fileExtension) {
      case "csv":
        chunks = await processCSV(blob)
        break
      case "json":
        chunks = await processJSON(blob)
        break
      case "md":
        chunks = await processMarkdown(blob)
        break
      case "pdf":
        chunks = await processPdf(blob)
        break
      case "txt":
        chunks = await processTxt(blob)
        break
      case "docx":
      case "doc":
        // Process DOCX using mammoth
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const result = await mammoth.extractRawText({ buffer })
        const textContent = result.value

        // Use the same chunking approach as other text files
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: CHUNK_SIZE,
          chunkOverlap: CHUNK_OVERLAP
        })
        const splitDocs = await splitter.createDocuments([textContent])
        chunks = splitDocs.map(doc => ({
          content: doc.pageContent,
          tokens: encode(doc.pageContent).length
        }))
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
      // 🔥 USAR OpenRouter para embeddings
      console.log('🚀 Using OpenRouter embeddings for document processing')
      const openrouterKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY

      embeddings = await generateMultipleOpenRouterEmbeddings(
        chunks.map(chunk => chunk.content),
        openrouterKey!
      )

      console.log(`✅ Generated ${embeddings.length} OpenRouter embeddings`)
    } else {
      // Usar embeddings locales solo si se especifica explícitamente
      console.log('Using local embeddings for document processing')
      const embeddingPromises = chunks.map(async chunk => {
        try {
          return await getLocalEmbedding(chunk.content)
        } catch (error) {
          console.error(`Error generating embedding for chunk: ${chunk}`, error)
          return null
        }
      })

      embeddings = await Promise.all(embeddingPromises)
    }

    const file_items = chunks.map((chunk, index) => ({
      file_id,
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
      .eq("id", file_id)

    return new NextResponse("Embed Successful", {
      status: 200
    })
  } catch (error: any) {
    console.log(`Error in retrieval/process: ${error.stack}`)
    const errorMessage = error?.message || "An unexpected error occurred"
    const errorCode =
      error instanceof NotFoundError ? 404 : error instanceof ForbiddenError ? 403 : error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
