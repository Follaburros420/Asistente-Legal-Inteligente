export const dynamic = 'force-dynamic'

import { env } from "@/lib/env/runtime-env"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Database } from "@/supabase/types"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { assertWorkspaceAccess } from "@/lib/server/workspaces/access"
import { localRAGService } from "@/lib/services/local-rag-service"
import { StreamingTextResponse } from "ai"
import { checkRateLimit, formatRateLimitHeaders, chatRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

interface RequestBody {
  message?: string // Campo directo (para compatibilidad)
  messages?: Array<{ role: string; content: string }> // Array de mensajes (formato useChat)
  chatSettings?: {
    model?: string
    temperature?: number
  }
  match_count?: number // Configurable match count (default 10)
  chatId?: string // Optional chat ID for message history
}

export async function POST(
  request: NextRequest,
  { params }: { params: { processId: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const supabaseAdmin = createSupabaseClient<Database>(
      env.supabaseUrl(),
      env.supabaseServiceRole()
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    // Rate limiting check (per user)
    const rateLimitResult = await checkRateLimit(user.id, chatRateLimit);

    if (!rateLimitResult.success) {
      const headers = formatRateLimitHeaders(rateLimitResult);
      return NextResponse.json(
        {
          error: 'Too many chat requests. Please wait a moment.',
          retryAfter: headers['Retry-After'],
        },
        {
          status: 429,
          headers,
        }
      );
    }

    const { processId } = params
    const body: RequestBody = await request.json()
    const { message, messages: bodyMessages, chatSettings, match_count = 10, chatId } = body

    // Extraer el mensaje: puede venir como campo directo o como último mensaje del array
    let userMessage: string | undefined = message

    if (!userMessage && bodyMessages && Array.isArray(bodyMessages) && bodyMessages.length > 0) {
      // Buscar el último mensaje del usuario en el array
      const lastUserMessage = [...bodyMessages].reverse().find(msg => msg.role === "user")
      if (lastUserMessage) {
        userMessage = lastUserMessage.content
      }
    }

    if (!userMessage || userMessage.trim().length === 0) {
      console.error("❌ Mensaje vacío recibido. Body:", JSON.stringify(body, null, 2))
      return NextResponse.json(
        { error: "El mensaje no puede estar vacío" },
        { status: 400 }
      )
    }

    // Verify user has access to the process using admin client
    const { data: processRecord, error: processError } = await supabaseAdmin
      .from("processes")
      .select("id,user_id,workspace_id,name,indexing_status")
      .eq("id", processId)
      .single()

    if (processError || !processRecord) {
      return NextResponse.json(
        { error: "Proceso no encontrado", details: processError?.message },
        { status: 404 }
      )
    }

    if (processRecord.workspace_id) {
      const access = await assertWorkspaceAccess(
        supabaseAdmin,
        processRecord.workspace_id,
        user.id
      ).catch(() => null)

      if (!access) {
        return NextResponse.json(
          { error: "No tienes acceso a este proceso" },
          { status: 403 }
        )
      }
    } else if (processRecord.user_id !== user.id) {
      return NextResponse.json(
        { error: "No tienes acceso a este proceso" },
        { status: 403 }
      )
    }

    // Verify process is ready for chat
    if (processRecord.indexing_status !== "ready") {
      return NextResponse.json(
        {
          error: "El proceso no está listo para consultas",
          indexing_status: processRecord.indexing_status,
          message: processRecord.indexing_status === "processing"
            ? "Los documentos se están indexando. Por favor espera unos momentos."
            : processRecord.indexing_status === "pending"
              ? "No hay documentos indexados en este proceso."
              : "Hubo un error al indexar los documentos."
        },
        { status: 400 }
      )
    }

    // Check if local RAG service is configured
    if (!localRAGService.isConfigured()) {
      return NextResponse.json(
        { error: "El servicio de chat no está configurado. Falta la API key de OpenAI." },
        { status: 503 }
      )
    }

    console.log(`🔍 [Local RAG] Procesando mensaje para proceso: ${processId}`)

    try {
      // Create a text stream from the local RAG service
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Get conversation history from bodyMessages (excluding the current message)
            const conversationHistory = bodyMessages
              ?.filter(msg => msg.role !== "user" || msg.content !== userMessage)
              ?.slice(-6) // Keep last 6 messages for context

            // Stream from local RAG service
            for await (const chunk of localRAGService.streamChat({
              message: userMessage!,
              process_id: processId,
              workspace_id: processRecord.workspace_id,
              model: chatSettings?.model,
              conversationHistory
            })) {
              controller.enqueue(chunk)
            }
          } catch (error: any) {
            console.error("❌ Error en stream:", error)
            controller.error(error)
          } finally {
            controller.close()
          }
        }
      })

      return new StreamingTextResponse(stream, {
        headers: {
          "X-Process-Id": processId
        }
      })

    } catch (ragError: any) {
      console.error("❌ Error en Local RAG:", ragError)
      return NextResponse.json(
        {
          error: "Error al procesar la consulta",
          details: ragError.message
        },
        { status: 503 }
      )
    }

  } catch (error: any) {
    console.error("Error in process chat:", error)
    return NextResponse.json(
      {
        error: "Error al procesar la consulta",
        details: error.message
      },
      { status: 500 }
    )
  }
}
