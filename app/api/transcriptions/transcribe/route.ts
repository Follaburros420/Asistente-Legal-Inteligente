export const dynamic = 'force-dynamic'

import { env } from "@/lib/env/runtime-env"
import { getServerProfile, ProfileWithKeys } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import OpenAI from "openai"
import { FileItemChunk } from "@/types"
import { encode } from "gpt-tokenizer"
import { assertWorkspaceAccess } from "@/lib/server/workspaces/access"
import { downloadObjectFromBucket } from "@/lib/server/storage/object-storage"

export const maxDuration = 300 // 5 minutos para transcripción

export async function POST(request: Request) {
  let transcription_id: string | null = null
  let profile: ProfileWithKeys | null = null

  try {
    profile = await getServerProfile()
    const supabaseAdmin = createClient<Database>(
      env.supabaseUrl(),
      env.supabaseServiceRole()
    )

    const body = await request.json()
    transcription_id = body.transcription_id

    if (!transcription_id) {
      return NextResponse.json(
        { error: "transcription_id required" },
        { status: 400 }
      )
    }

    const { data: transcriptionRecord, error: transcriptionError } = await supabaseAdmin
      .from("transcriptions")
      .select("id,user_id,workspace_id,audio_path,status")
      .eq("id", transcription_id)
      .maybeSingle()

    if (transcriptionError) {
      throw new Error(`Failed to load transcription: ${transcriptionError.message}`)
    }

    if (!transcriptionRecord) {
      return NextResponse.json({ error: "Transcription not found" }, { status: 404 })
    }

    if (transcriptionRecord.user_id !== profile.user_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (transcriptionRecord.workspace_id) {
      const access = await assertWorkspaceAccess(
        supabaseAdmin,
        transcriptionRecord.workspace_id,
        profile.user_id
      ).catch(() => null)
      if (!access) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const audio_path = transcriptionRecord.audio_path
    if (!audio_path) {
      return NextResponse.json({ error: "audio_path missing on transcription" }, { status: 400 })
    }

    // Actualizar estado a "processing" usando el cliente admin
    const { error: statusError } = await supabaseAdmin
      .from("transcriptions")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", transcription_id)
      .eq("user_id", profile.user_id)

    if (statusError) {
      throw new Error(`Failed to update transcription status: ${statusError.message}`)
    }

    // Obtener audio desde object storage (Supabase/Wasabi)
    const audioFile = await downloadObjectFromBucket(audio_path, "files")

    // Convertir a Buffer para Whisper
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const audioFileBlob = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" })

    // Verificar API key de OpenAI
    const openaiApiKey = profile.openai_api_key
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not found in profile")
    }

    // Inicializar cliente de OpenAI
    const openai = new OpenAI({
      apiKey: openaiApiKey,
      organization: profile.openai_organization_id || undefined
    })

    // Transcribir con Whisper
    console.log(`🎙️ Transcribing audio with Whisper...`)
    const transcription = await openai.audio.transcriptions.create({
      file: audioFileBlob as any,
      model: "whisper-1",
      response_format: "verbose_json",
      temperature: 0.0
    })

    if (!transcription.text) {
      throw new Error("Transcription returned empty text")
    }

    console.log(`✅ Transcription completed: ${transcription.text.substring(0, 100)}...`)

    // Calcular tokens
    const tokens = encode(transcription.text).length
    const duration = (transcription as any).duration || 0

    // Actualizar transcripción con los resultados usando el cliente admin
    const { error: updateError } = await supabaseAdmin
      .from("transcriptions")
      .update({
        transcript: transcription.text,
        language: (transcription as any).language || null,
        duration: duration,
        tokens: tokens,
        model: "whisper-1",
        status: "completed",
        updated_at: new Date().toISOString()
      })
      .eq("id", transcription_id)
      .eq("user_id", profile.user_id)

    if (updateError) {
      throw new Error(`Failed to update transcription: ${updateError.message}`)
    }

    // Dividir transcripción en chunks para embeddings
    const chunks = splitTranscriptionIntoChunks(transcription.text)

    // Generar embeddings para cada chunk usando OpenAI
    const embeddingsResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks.map(chunk => chunk.content)
    })

    const embeddings = embeddingsResponse.data.map(item => item.embedding)

    // Guardar chunks en file_items
    const file_items = chunks.map((chunk, index) => ({
      file_id: transcription_id, // Usamos transcription_id como reference
      user_id: profile.user_id,
      content: chunk.content,
      tokens: chunk.tokens,
      openai_embedding: (embeddings[index] as any) || null,
      local_embedding: null
    }))

    await supabaseAdmin.from("file_items").upsert(file_items)

    console.log(`✅ Saved ${file_items.length} chunks with embeddings`)

    return NextResponse.json({
      success: true,
      text: transcription.text,
      language: (transcription as any).language,
      duration,
      tokens
    })

  } catch (error: any) {
    console.error("Error transcribing audio:", error)

    // Intentar actualizar estado a "failed" usando el cliente admin
    if (transcription_id && profile) {
      try {
        const supabaseAdmin = createClient<Database>(
          env.supabaseUrl(),
          env.supabaseServiceRole()
        )
        await supabaseAdmin
          .from("transcriptions")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", transcription_id)
          .eq("user_id", profile.user_id)
      } catch (updateError) {
        console.error("Error updating transcription status to failed:", updateError)
      }
    }

    return NextResponse.json(
      { error: error.message || "Failed to transcribe audio" },
      { status: 500 }
    )
  }
}

function splitTranscriptionIntoChunks(text: string): FileItemChunk[] {
  const maxChunkSize = 1000 // caracteres
  const chunks: FileItemChunk[] = []

  // Dividir por párrafos primero
  const paragraphs = text.split(/\n\n+/)

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue

    // Si el párrafo es pequeño, añadirlo como chunk
    if (paragraph.length <= maxChunkSize) {
      chunks.push({
        content: paragraph.trim(),
        tokens: encode(paragraph).length
      })
    } else {
      // Si es grande, dividir en oraciones
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || []
      let currentChunk = ""

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxChunkSize) {
          currentChunk += sentence
        } else {
          if (currentChunk) {
            chunks.push({
              content: currentChunk.trim(),
              tokens: encode(currentChunk).length
            })
          }
          currentChunk = sentence
        }
      }

      // Añadir último chunk
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: encode(currentChunk).length
        })
      }
    }
  }

  return chunks
}
