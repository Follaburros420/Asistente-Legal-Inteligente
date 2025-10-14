import { generateLocalEmbedding } from "@/lib/generate-local-embedding"
import { generateMultipleOpenRouterEmbeddings } from "@/lib/generate-openrouter-embedding"
import { 
  processAdvancedPDF, 
  processAdvancedDocx, 
  processAdvancedHTML,
  improveChunking,
  type ProcessedDocument 
} from "@/lib/retrieval/advanced-processing"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import OpenAI from "openai"

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const profile = await getServerProfile()

    const formData = await req.formData()
    const file_id = formData.get("file_id") as string
    let embeddingsProvider = formData.get("embeddingsProvider") as string

    // Usar OpenRouter como proveedor por defecto
    if (!embeddingsProvider) {
      embeddingsProvider = "openrouter"
    }

    // Verificar claves de API
    if (embeddingsProvider === "openai") {
      try {
        if (profile.use_azure_openai) {
          checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")
        } else {
          checkApiKey(profile.openai_api_key, "OpenAI")
        }
      } catch (error: any) {
        error.message = error.message + ", make sure it is configured or else use openrouter embeddings"
        throw error
      }
    } else if (embeddingsProvider === "openrouter") {
      try {
        checkApiKey(profile.openrouter_api_key, "OpenRouter")
      } catch (error: any) {
        error.message = error.message + ", make sure it is configured or else use local embeddings"
        throw error
      }
    }

    // Obtener metadatos del archivo
    const { data: fileMetadata, error: metadataError } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("id", file_id)
      .single()

    if (metadataError) {
      throw new Error(`Failed to retrieve file metadata: ${metadataError.message}`)
    }

    if (!fileMetadata) {
      throw new Error("File not found")
    }

    if (fileMetadata.user_id !== profile.user_id) {
      throw new Error("Unauthorized")
    }

    // Descargar archivo
    const { data: file, error: fileError } = await supabaseAdmin.storage
      .from("files")
      .download(fileMetadata.file_path)

    if (fileError) {
      throw new Error(`Failed to retrieve file: ${fileError.message}`)
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileExtension = fileMetadata.name.split(".").pop()?.toLowerCase()

    // Procesar archivo con sistema avanzado
    let processedDocument: ProcessedDocument

    switch (fileExtension) {
      case "pdf":
        processedDocument = await processAdvancedPDF(fileBuffer)
        break
      case "docx":
        processedDocument = await processAdvancedDocx(fileBuffer)
        break
      case "html":
      case "htm":
        const htmlContent = fileBuffer.toString('utf-8')
        processedDocument = await processAdvancedHTML(htmlContent)
        break
      case "md":
      case "txt":
        const textContent = fileBuffer.toString('utf-8')
        processedDocument = {
          chunks: [{
            content: textContent,
            tokens: Math.ceil(textContent.length / 4),
            metadata: { type: 'text' }
          }],
          metadata: {
            wordCount: textContent.split(/\s+/).length,
            language: 'es'
          }
        }
        break
      default:
        return new NextResponse("Unsupported file type for advanced processing", {
          status: 400
        })
    }

    // Mejorar chunking
    const improvedChunks = improveChunking(processedDocument.chunks, 800)

    // Generar embeddings
    let embeddings: any = []

    if (embeddingsProvider === "openai") {
      const openai = new OpenAI({
        apiKey: profile.openai_api_key || "",
        organization: profile.openai_organization_id
      })

      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: improvedChunks.map(chunk => chunk.content)
      })

      embeddings = response.data.map((item: any) => item.embedding)
    } else if (embeddingsProvider === "openrouter") {
      try {
        embeddings = await generateMultipleOpenRouterEmbeddings(
          improvedChunks.map(chunk => chunk.content),
          'text-embedding-3-small'
        )
      } catch (error) {
        console.error('OpenRouter embeddings error:', error)
        throw new Error('Failed to generate OpenRouter embeddings')
      }
    } else if (embeddingsProvider === "local") {
      const embeddingPromises = improvedChunks.map(async chunk => {
        try {
          return await generateLocalEmbedding(chunk.content)
        } catch (error) {
          console.error(`Error generating embedding for chunk: ${chunk.content.substring(0, 100)}`, error)
          return null
        }
      })

      embeddings = await Promise.all(embeddingPromises)
    }

    // Preparar datos para inserción
    const file_items = improvedChunks.map((chunk, index) => ({
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

    // Insertar en base de datos
    await supabaseAdmin.from("file_items").upsert(file_items)

    // Actualizar tokens totales
    const totalTokens = file_items.reduce((acc, item) => acc + item.tokens, 0)
    await supabaseAdmin
      .from("files")
      .update({ tokens: totalTokens })
      .eq("id", file_id)

    return new NextResponse(JSON.stringify({
      message: "Advanced processing successful",
      metadata: {
        chunks: improvedChunks.length,
        totalTokens,
        documentMetadata: processedDocument.metadata
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })

  } catch (error: any) {
    console.error(`Error in advanced retrieval/process: ${error.stack}`)
    const errorMessage = error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}















