export const dynamic = 'force-dynamic'

import { env } from "@/lib/env/runtime-env"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Database } from "@/supabase/types"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { assertWorkspaceAccess } from "@/lib/server/workspaces/access"
import { ragBackendService } from "@/lib/services/rag-backend"
import { StreamingTextResponse } from "ai"
import { checkRateLimit, formatRateLimitHeaders, chatRateLimit } from "@/lib/rate-limit"
import { reenqueueProcessForRecovery } from "@/lib/server/jobs/process-ingestion-jobs"

export const runtime = "nodejs"
export const maxDuration = 60

interface RequestBody {
  message?: string // Campo directo (para compatibilidad)
  messages?: Array<{ role: string; content: string }> // Array de mensajes (formato useChat)
}

function shouldTriggerRecovery(error: any): boolean {
  const status = Number(error?.status || error?.response?.status || 0)
  const message = String(error?.message || "").toLowerCase()
  return (
    status === 404 ||
    status === 409 ||
    status === 422 ||
    message.includes("vector") ||
    message.includes("graph") ||
    message.includes("index") ||
    message.includes("qdrant") ||
    message.includes("neo4j") ||
    message.includes("no documents") ||
    message.includes("not found")
  )
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
    const { message, messages: bodyMessages } = body

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

    // Use RAG Backend for chat
    console.log(`🔍 [RAG Backend] Enviando mensaje al backend RAG...`)

    // NOTE: legacy chat message persistence is intentionally skipped here.
    // Process chat relies on external RAG streaming and should not depend on legacy tables.

    try {
      // Stream response from RAG backend
      const stream = await ragBackendService.streamChat({
        message: userMessage,
        workspace_id: processRecord.workspace_id,
        process_id: processId,
        search_type: "hybrid"
      })

      // Convert the SSE stream to a text stream for the client
      const textStream = new ReadableStream({
        async start(controller) {
          const reader = stream.getReader()
          const decoder = new TextDecoder()
          let buffer = ""

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value, { stream: true })
              buffer += chunk

              const lines = buffer.split("\n")
              buffer = lines.pop() || "" // Keep the last partial line in the buffer

              for (const line of lines) {
                const trimmedLine = line.trim()
                if (!trimmedLine.startsWith("data: ")) continue

                try {
                  const jsonStr = trimmedLine.slice(6)
                  if (jsonStr === "[DONE]") continue

                  const data = JSON.parse(jsonStr)

                  // Only send text content to the client
                  if (data.type === "text" && data.content) {
                    controller.enqueue(data.content)
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete chunks or invalid json
                }
              }
            }
          } catch (error) {
            controller.error(error)
          } finally {
            controller.close()
            try {
              reader.releaseLock()
            } catch (e) {
              // Ignore if already released
            }
          }
        }
      })

      return new StreamingTextResponse(textStream, {
        headers: {
          "X-Process-Id": processId
        }
      })

    } catch (ragError: any) {
      console.error("❌ Error en RAG Backend:", ragError)

      if (shouldTriggerRecovery(ragError)) {
        const recoveryJobs = await reenqueueProcessForRecovery({
          processId,
          ownerUserId: processRecord.user_id,
          workspaceId: processRecord.workspace_id,
          reason: "chat_missing_vectors_or_graph"
        }).catch(() => [])

        return NextResponse.json(
          {
            error: "No se encontraron índices listos para consulta. Se relanzó la ingesta.",
            recoveryTriggered: recoveryJobs.length > 0,
            queuedJobs: recoveryJobs.length
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          error: "Error al comunicarse con el asistente",
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
