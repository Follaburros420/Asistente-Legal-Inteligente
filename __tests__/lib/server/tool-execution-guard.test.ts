import {
  createToolExecutionState,
  runToolCalls
} from "@/lib/server/tool-execution-guard"

describe("tool-execution-guard", () => {
  test("executes tool once and reuses cache for repeated args", async () => {
    const state = createToolExecutionState(5)
    const executeTool = jest.fn(async () => "tool-result")

    const calls = [
      {
        id: "1",
        function: {
          name: "search_legal_official",
          arguments: JSON.stringify({ query: "ley 80", num_results: 2 })
        }
      },
      {
        id: "2",
        function: {
          name: "search_legal_official",
          arguments: JSON.stringify({ query: "ley 80", num_results: 2 })
        }
      }
    ]

    const results = await runToolCalls(calls, state, {
      maxArgumentsLength: 1_000,
      executeTool
    })

    expect(results).toHaveLength(2)
    expect(executeTool).toHaveBeenCalledTimes(1)
    expect(state.executedCount).toBe(1)
    expect(state.cacheHits).toBe(1)
    expect(state.remainingExecutions).toBe(4)
  })

  test("enforces execution budget", async () => {
    const state = createToolExecutionState(1)
    const executeTool = jest.fn(async () => "ok")

    const calls = [
      {
        id: "1",
        function: { name: "a", arguments: JSON.stringify({ q: "1" }) }
      },
      {
        id: "2",
        function: { name: "b", arguments: JSON.stringify({ q: "2" }) }
      }
    ]

    const results = await runToolCalls(calls, state, {
      maxArgumentsLength: 1_000,
      executeTool
    })

    expect(executeTool).toHaveBeenCalledTimes(1)
    expect(results[1].content).toContain("limite de ejecuciones")
  })

  test("rejects oversized arguments and emits warning callback", async () => {
    const state = createToolExecutionState(2)
    const executeTool = jest.fn(async () => "ok")
    const onWarn = jest.fn()

    const longArgs = "x".repeat(200)
    const results = await runToolCalls(
      [
        {
          id: "1",
          function: { name: "tool", arguments: longArgs }
        }
      ],
      state,
      {
        maxArgumentsLength: 50,
        executeTool,
        onWarn
      }
    )

    expect(executeTool).not.toHaveBeenCalled()
    expect(onWarn).toHaveBeenCalled()
    expect(results[0].content).toContain("argumentos de herramienta exceden")
  })
})
