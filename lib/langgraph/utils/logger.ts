/**
 * LangGraph Logging and Tracing Utility
 * 
 * Provides structured logging and tracing for the legal assistant pipeline.
 */

import { v4 as uuidv4 } from "uuid"

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  run_id?: string
  thread_id?: string
  node?: string
  duration_ms?: number
  data?: Record<string, any>
  error?: string
  stack?: string
}

export interface RunTrace {
  run_id: string
  thread_id: string
  user_id?: string
  workspace_id?: string
  start_time: string
  end_time?: string
  status: "running" | "completed" | "error" | "interrupted"
  mode?: "investigate" | "draft"
  nodes_visited: string[]
  tool_calls: ToolCallTrace[]
  total_tokens?: number
  total_duration_ms?: number
  error?: string
}

export interface ToolCallTrace {
  id: string
  tool_name: string
  input: Record<string, any>
  output?: any
  start_time: string
  end_time?: string
  duration_ms?: number
  error?: string
}

// ============================================================================
// LOGGER CLASS
// ============================================================================

class LangGraphLogger {
  private logs: LogEntry[] = []
  private traces: Map<string, RunTrace> = new Map()
  private maxLogs: number = 1000
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info"
  
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }
  
  /**
   * Log a message
   */
  log(
    level: LogLevel,
    message: string,
    data?: {
      run_id?: string
      thread_id?: string
      node?: string
      duration_ms?: number
      data?: Record<string, any>
      error?: string
      stack?: string
    }
  ) {
    // Check if we should log this level
    if (this.levelPriority[level] < this.levelPriority[this.logLevel]) {
      return
    }
    
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data
    }
    
    // Add to in-memory logs
    this.logs.push(entry)
    
    // Trim if needed
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
    
    // Console output with formatting
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`
    const context = data?.run_id ? ` [run:${data.run_id.slice(0, 8)}]` : ""
    const node = data?.node ? ` [${data.node}]` : ""
    
    const formattedMessage = `${prefix}${context}${node} ${message}`
    
    switch (level) {
      case "debug":
        console.debug(formattedMessage, data?.data || "")
        break
      case "info":
        console.info(formattedMessage, data?.data || "")
        break
      case "warn":
        console.warn(formattedMessage, data?.data || "")
        break
      case "error":
        console.error(formattedMessage, data?.error || "", data?.stack || "")
        break
    }
  }
  
  debug(message: string, data?: Omit<LogEntry, "id" | "timestamp" | "level" | "message">) {
    this.log("debug", message, data)
  }
  
  info(message: string, data?: Omit<LogEntry, "id" | "timestamp" | "level" | "message">) {
    this.log("info", message, data)
  }
  
  warn(message: string, data?: Omit<LogEntry, "id" | "timestamp" | "level" | "message">) {
    this.log("warn", message, data)
  }
  
  error(message: string, error?: Error, data?: Omit<LogEntry, "id" | "timestamp" | "level" | "message">) {
    this.log("error", message, {
      ...data,
      error: error?.message,
      stack: error?.stack
    })
  }
  
  /**
   * Start a new run trace
   */
  startRun(params: {
    run_id: string
    thread_id: string
    user_id?: string
    workspace_id?: string
  }): RunTrace {
    const trace: RunTrace = {
      run_id: params.run_id,
      thread_id: params.thread_id,
      user_id: params.user_id,
      workspace_id: params.workspace_id,
      start_time: new Date().toISOString(),
      status: "running",
      nodes_visited: [],
      tool_calls: []
    }
    
    this.traces.set(params.run_id, trace)
    this.info("Run started", { run_id: params.run_id, thread_id: params.thread_id })
    
    return trace
  }
  
  /**
   * Update run trace
   */
  updateRun(run_id: string, updates: Partial<RunTrace>) {
    const trace = this.traces.get(run_id)
    if (trace) {
      Object.assign(trace, updates)
    }
  }
  
  /**
   * Record node visit
   */
  recordNodeVisit(run_id: string, node: string) {
    const trace = this.traces.get(run_id)
    if (trace) {
      trace.nodes_visited.push(node)
      this.debug(`Node visited: ${node}`, { run_id, node })
    }
  }
  
  /**
   * Record tool call
   */
  recordToolCall(
    run_id: string,
    toolCall: Omit<ToolCallTrace, "id" | "start_time">
  ): ToolCallTrace {
    const trace = this.traces.get(run_id)
    
    const fullToolCall: ToolCallTrace = {
      id: uuidv4(),
      start_time: new Date().toISOString(),
      ...toolCall
    }
    
    if (trace) {
      trace.tool_calls.push(fullToolCall)
    }
    
    this.debug(`Tool called: ${toolCall.tool_name}`, {
      run_id,
      data: { input: toolCall.input }
    })
    
    return fullToolCall
  }
  
  /**
   * Complete tool call
   */
  completeToolCall(run_id: string, toolCallId: string, output: any, duration_ms: number) {
    const trace = this.traces.get(run_id)
    if (trace) {
      const toolCall = trace.tool_calls.find(tc => tc.id === toolCallId)
      if (toolCall) {
        toolCall.output = output
        toolCall.end_time = new Date().toISOString()
        toolCall.duration_ms = duration_ms
      }
    }
  }
  
  /**
   * End run trace
   */
  endRun(run_id: string, status: RunTrace["status"], error?: string) {
    const trace = this.traces.get(run_id)
    if (trace) {
      trace.end_time = new Date().toISOString()
      trace.status = status
      trace.error = error
      trace.total_duration_ms = 
        new Date(trace.end_time).getTime() - new Date(trace.start_time).getTime()
      
      this.info(`Run ${status}`, {
        run_id,
        duration_ms: trace.total_duration_ms,
        data: {
          nodes_visited: trace.nodes_visited.length,
          tool_calls: trace.tool_calls.length
        }
      })
    }
  }
  
  /**
   * Get logs for a run
   */
  getLogs(run_id?: string): LogEntry[] {
    if (run_id) {
      return this.logs.filter(l => l.run_id === run_id)
    }
    return [...this.logs]
  }
  
  /**
   * Get trace for a run
   */
  getTrace(run_id: string): RunTrace | undefined {
    return this.traces.get(run_id)
  }
  
  /**
   * Get all traces
   */
  getAllTraces(): RunTrace[] {
    return Array.from(this.traces.values())
  }
  
  /**
   * Clear logs and traces
   */
  clear() {
    this.logs = []
    this.traces.clear()
  }
  
  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      traces: Array.from(this.traces.values())
    }, null, 2)
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const logger = new LangGraphLogger()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a timed logger for a node execution
 */
export function timedNodeLog(run_id: string, node: string) {
  const startTime = Date.now()
  
  logger.debug(`Node started: ${node}`, { run_id, node })
  logger.recordNodeVisit(run_id, node)
  
  return {
    end: (data?: Record<string, any>) => {
      const duration = Date.now() - startTime
      logger.debug(`Node completed: ${node}`, {
        run_id,
        node,
        duration_ms: duration,
        data
      })
      return duration
    },
    error: (error: Error) => {
      const duration = Date.now() - startTime
      logger.error(`Node failed: ${node}`, error, {
        run_id,
        node,
        duration_ms: duration
      })
    }
  }
}

/**
 * Create a timed logger for a tool call
 */
export function timedToolLog(run_id: string, toolName: string, input: Record<string, any>) {
  const startTime = Date.now()
  
  const toolCall = logger.recordToolCall(run_id, {
    tool_name: toolName,
    input
  })
  
  return {
    end: (output: any) => {
      const duration = Date.now() - startTime
      logger.completeToolCall(run_id, toolCall.id, output, duration)
      return { output, duration_ms: duration }
    },
    error: (error: Error) => {
      const duration = Date.now() - startTime
      logger.error(`Tool failed: ${toolName}`, error, {
        run_id,
        duration_ms: duration
      })
      return { error: error.message, duration_ms: duration }
    }
  }
}

// ============================================================================
// DECORATOR FOR NODE FUNCTIONS
// ============================================================================

/**
 * Decorator to add logging to a node function
 */
export function withNodeLogging<TInput, TOutput>(
  nodeName: string,
  fn: (input: TInput) => Promise<TOutput>
): (input: TInput & { run_id?: string }) => Promise<TOutput> {
  return async (input) => {
    const run_id = (input as any)?.run_id
    const timer = timedNodeLog(run_id || "unknown", nodeName)
    
    try {
      const result = await fn(input)
      timer.end()
      return result
    } catch (error: any) {
      timer.error(error)
      throw error
    }
  }
}