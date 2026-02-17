/**
 * API Endpoint: Run LangGraph Pipeline
 * 
 * Starts a new execution of the legal assistant pipeline.
 */

import { NextRequest, NextResponse } from "next/server"
import { HumanMessage } from "@langchain/core/messages"
import { v4 as uuidv4 } from "uuid"

import { mainGraph } from "../graphs/mainGraph"
import { AgentStateAnnotation, CaseContext, Constraints } from "../state/schema"

// ============================================================================
// TYPES
// ============================================================================

interface RunRequest {
  /** User's query or request */
  query: string
  /** Optional case context */
  caseContext?: CaseContext
  /** Optional constraints */
  constraints?: Constraints
  /** User ID for tracking */
  userId?: string
  /** Workspace ID */
  workspaceId?: string
  /** Thread ID for conversation continuity */
  threadId?: string
}

interface RunResponse {
  success: boolean
  runId: string
  threadId: string
  status: "running" | "interrupted" | "completed" | "error"
  mode?: "investigate" | "draft"
  interruptPayload?: any
  result?: {
    finalDocument?: string
    citations?: any[]
    todo?: any[]
    messages?: any[]
  }
  error?: string
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const runId = uuidv4()
  
  try {
    // Parse request body
    const body: RunRequest = await request.json()
    
    if (!body.query) {
      return NextResponse.json({
        success: false,
        error: "Query is required"
      }, { status: 400 })
    }
    
    console.log(`[API/run] Starting run ${runId}`)
    console.log(`[API/run] Query: "${body.query.substring(0, 100)}..."`)
    
    // Generate or use existing thread ID
    const threadId = body.threadId || uuidv4()
    
    // Build initial state
    const initialState = {
      messages: [new HumanMessage(body.query)],
      user_goal: body.query,
      case_context: body.caseContext || {},
      constraints: {
        tone: "formal" as const,
        format: "markdown" as const,
        language: "es" as const,
        ...body.constraints
      }
    }
    
    // Configure the run
    const config = {
      configurable: {
        thread_id: threadId,
        user_id: body.userId,
        workspace_id: body.workspaceId,
        run_id: runId
      }
    }
    
    // Execute the graph
    const result = await mainGraph.invoke(initialState, config)
    
    const duration = Date.now() - startTime
    console.log(`[API/run] Run ${runId} completed in ${duration}ms`)
    
    // Check if interrupted
    const isInterrupted = result.interrupt_payload !== null && result.interrupt_payload !== undefined
    
    // Build response
    const response: RunResponse = {
      success: true,
      runId: runId,
      threadId: threadId,
      status: isInterrupted ? "interrupted" : "completed",
      mode: result.mode,
      interruptPayload: isInterrupted ? result.interrupt_payload : undefined,
      result: {
        finalDocument: result.final_document || undefined,
        citations: result.citations.length > 0 ? result.citations : undefined,
        todo: result.todo.length > 0 ? result.todo : undefined,
        messages: result.messages.map(m => ({
          type: m._getType(),
          content: m.content.toString()
        }))
      }
    }
    
    return NextResponse.json(response)
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[API/run] Error after ${duration}ms:`, error)
    
    return NextResponse.json({
      success: false,
      runId: runId,
      threadId: "",
      status: "error",
      error: error.message || "Unknown error during execution"
    }, { status: 500 })
  }
}

// ============================================================================
// STREAMING VERSION (for real-time updates)
// ============================================================================

export async function POST_STREAM(request: NextRequest) {
  const startTime = Date.now()
  const runId = uuidv4()
  
  try {
    const body: RunRequest = await request.json()
    
    if (!body.query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }
    
    const threadId = body.threadId || uuidv4()
    
    // Create a streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "start",
            runId,
            threadId
          })}\n\n`))
          
          // Build initial state
          const initialState = {
            messages: [new HumanMessage(body.query)],
            user_goal: body.query,
            case_context: body.caseContext || {},
            constraints: {
              tone: "formal" as const,
              format: "markdown" as const,
              language: "es" as const,
              ...body.constraints
            }
          }
          
          const config = {
            configurable: {
              thread_id: threadId,
              user_id: body.userId,
              workspace_id: body.workspaceId,
              run_id: runId
            }
          }
          
          // Stream events from the graph
          const eventStream = await mainGraph.streamEvents(initialState, {
            ...config,
            version: "v2"
          })
          
          for await (const event of eventStream) {
            // Send different event types
            if (event.event === "on_chain_start") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: "node_start",
                node: event.name,
                timestamp: new Date().toISOString()
              })}\n\n`))
            } else if (event.event === "on_chain_end") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: "node_end",
                node: event.name,
                timestamp: new Date().toISOString()
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
          
          // Send completion event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "complete",
            status: finalState.values.interrupt_payload ? "interrupted" : "completed",
            mode: finalState.values.mode,
            interruptPayload: finalState.values.interrupt_payload,
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