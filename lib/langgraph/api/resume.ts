/**
 * API Endpoint: Resume LangGraph Pipeline
 * 
 * Resumes execution after an interrupt with user-provided answers.
 */

import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

import { mainGraph } from "../graphs/mainGraph"

// ============================================================================
// TYPES
// ============================================================================

interface ResumeRequest {
  /** Thread ID from the original run */
  threadId: string
  /** User's answers to the interrupt questions */
  answers: Record<string, any>
  /** Optional: Run ID for tracking */
  runId?: string
}

interface ResumeResponse {
  success: boolean
  runId: string
  threadId: string
  status: "running" | "interrupted" | "completed" | "error"
  interruptPayload?: any
  result?: {
    finalDocument?: string
    citations?: any[]
    todo?: any[]
    messages?: any[]
    audit?: any
  }
  error?: string
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const newRunId = uuidv4()
  
  try {
    // Parse request body
    const body: ResumeRequest = await request.json()
    
    if (!body.threadId) {
      return NextResponse.json({
        success: false,
        error: "threadId is required"
      }, { status: 400 })
    }
    
    if (!body.answers || Object.keys(body.answers).length === 0) {
      return NextResponse.json({
        success: false,
        error: "answers are required"
      }, { status: 400 })
    }
    
    console.log(`[API/resume] Resuming thread ${body.threadId}`)
    console.log(`[API/resume] Answers:`, JSON.stringify(body.answers))
    
    // Get the current state
    const config = {
      configurable: {
        thread_id: body.threadId,
        run_id: newRunId
      }
    }
    
    const currentState = await mainGraph.getState(config)
    
    if (!currentState) {
      return NextResponse.json({
        success: false,
        error: "Thread not found or expired"
      }, { status: 404 })
    }
    
    console.log(`[API/resume] Current state found, next node: ${currentState.next}`)
    
    // Update state with answers
    // The answers will be picked up by the interrupt_for_user_answers node
    await mainGraph.updateState(config, {
      answers: body.answers,
      interrupt_payload: null
    })
    
    // Resume execution from the interrupt point
    const result = await mainGraph.invoke(null, config)
    
    const duration = Date.now() - startTime
    console.log(`[API/resume] Resume completed in ${duration}ms`)
    
    // Check if there's another interrupt
    const isInterrupted = result.interrupt_payload !== null && result.interrupt_payload !== undefined
    
    // Build response
    const response: ResumeResponse = {
      success: true,
      runId: newRunId,
      threadId: body.threadId,
      status: isInterrupted ? "interrupted" : "completed",
      interruptPayload: isInterrupted ? result.interrupt_payload : undefined,
      result: {
        finalDocument: result.final_document || undefined,
        citations: result.citations.length > 0 ? result.citations : undefined,
        todo: result.todo.length > 0 ? result.todo : undefined,
        messages: result.messages.slice(-5).map(m => ({
          type: m._getType(),
          content: m.content.toString().substring(0, 500)
        })),
        audit: result.audit || undefined
      }
    }
    
    return NextResponse.json(response)
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[API/resume] Error after ${duration}ms:`, error)
    
    return NextResponse.json({
      success: false,
      runId: newRunId,
      threadId: "",
      status: "error",
      error: error.message || "Unknown error during resume"
    }, { status: 500 })
  }
}

// ============================================================================
// GET STATE (for checking current state without resuming)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get("threadId")
    
    if (!threadId) {
      return NextResponse.json({
        success: false,
        error: "threadId is required"
      }, { status: 400 })
    }
    
    const config = {
      configurable: {
        thread_id: threadId
      }
    }
    
    const state = await mainGraph.getState(config)
    
    if (!state) {
      return NextResponse.json({
        success: false,
        error: "Thread not found"
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      threadId: threadId,
      status: state.next.length > 0 ? "paused" : "completed",
      next: state.next,
      values: {
        mode: state.values.mode,
        todo: state.values.todo,
        interruptPayload: state.values.interrupt_payload,
        docType: state.values.doc_type,
        docOutline: state.values.doc_outline,
        messages: state.values.messages?.slice(-3).map((m: any) => ({
          type: m._getType(),
          content: m.content?.toString().substring(0, 200)
        }))
      }
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// ============================================================================
// STREAMING RESUME
// ============================================================================

export async function POST_STREAM(request: NextRequest) {
  const startTime = Date.now()
  const newRunId = uuidv4()
  
  try {
    const body: ResumeRequest = await request.json()
    
    if (!body.threadId || !body.answers) {
      return new Response(JSON.stringify({ error: "threadId and answers are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }
    
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send start event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "resume_start",
            runId: newRunId,
            threadId: body.threadId
          })}\n\n`))
          
          const config = {
            configurable: {
              thread_id: body.threadId,
              run_id: newRunId
            }
          }
          
          // Update state with answers
          await mainGraph.updateState(config, {
            answers: body.answers,
            interrupt_payload: null
          })
          
          // Stream events
          const eventStream = await mainGraph.streamEvents(null, {
            ...config,
            version: "v2"
          })
          
          for await (const event of eventStream) {
            if (event.event === "on_chain_start") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: "node_start",
                node: event.name
              })}\n\n`))
            } else if (event.event === "on_chain_end") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: "node_end",
                node: event.name
              })}\n\n`))
            } else if (event.event === "on_chat_model_stream") {
              const content = event.data?.chunk?.content
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: "token",
                  content: content.toString()
                })}\n\n`))
              }
            }
          }
          
          // Get final state
          const finalState = await mainGraph.getState(config)
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "complete",
            status: finalState.values.interrupt_payload ? "interrupted" : "completed",
            finalDocument: finalState.values.final_document?.substring(0, 1000),
            todo: finalState.values.todo
          })}\n\n`))
          
          controller.close()
        } catch (streamError: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "error",
            error: streamError.message
          })}\n\n`))
          controller.close()
        }
      }
    })
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    })
    
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
}