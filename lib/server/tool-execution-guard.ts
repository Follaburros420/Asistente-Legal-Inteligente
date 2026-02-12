export type ToolCallLike = {
  id: string
  function: {
    name: string
    arguments: string
  }
}

export type ToolCallResult = {
  tool_call_id: string
  role: "tool"
  name: string
  content: string
}

export type ToolExecutionState = {
  cache: Map<string, string>
  remainingExecutions: number
  executedCount: number
  cacheHits: number
}

export type ToolExecutionOptions = {
  maxArgumentsLength: number
  onWarn?: (event: string, data: Record<string, unknown>) => void
  executeTool: (name: string, args: unknown) => Promise<string>
}

export function createToolExecutionState(maxExecutions: number): ToolExecutionState {
  return {
    cache: new Map<string, string>(),
    remainingExecutions: Math.max(0, maxExecutions),
    executedCount: 0,
    cacheHits: 0
  }
}

export async function runToolCalls(
  toolCalls: ToolCallLike[],
  state: ToolExecutionState,
  options: ToolExecutionOptions
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = []

  for (const toolCall of toolCalls) {
    const {
      id,
      function: { name, arguments: argsString }
    } = toolCall

    try {
      if (state.remainingExecutions <= 0) {
        results.push({
          tool_call_id: id,
          role: "tool",
          name,
          content: "Error: limite de ejecuciones de herramientas alcanzado para esta solicitud."
        })
        continue
      }

      if (argsString.length > options.maxArgumentsLength) {
        throw new Error("argumentos de herramienta exceden el limite permitido")
      }

      const parsedArgs = JSON.parse(argsString)
      const cacheKey = `${name}:${JSON.stringify(parsedArgs)}`
      const cached = state.cache.get(cacheKey)
      if (cached) {
        state.cacheHits += 1
        results.push({
          tool_call_id: id,
          role: "tool",
          name,
          content: cached
        })
        continue
      }

      const toolResult = await options.executeTool(name, parsedArgs)
      state.cache.set(cacheKey, toolResult)
      state.remainingExecutions -= 1
      state.executedCount += 1

      results.push({
        tool_call_id: id,
        role: "tool",
        name,
        content: toolResult
      })
    } catch (error) {
      options.onWarn?.("tool_execution_failed", {
        tool: name,
        error: error instanceof Error ? error.message : String(error)
      })

      results.push({
        tool_call_id: id,
        role: "tool",
        name,
        content: `Error: ${error instanceof Error ? error.message : "Error desconocido"}`
      })
    }
  }

  return results
}
