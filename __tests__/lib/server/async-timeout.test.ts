import { TimeoutError, withTimeout } from "@/lib/server/async-timeout"

describe("async-timeout", () => {
  test("returns operation result when it finishes before timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 100)
    expect(result).toBe("ok")
  })

  test("throws TimeoutError when operation exceeds timeout", async () => {
    const originalSetTimeout = global.setTimeout
    const originalClearTimeout = global.clearTimeout

    ;(global as any).setTimeout = ((fn: TimerHandler) => {
      if (typeof fn === "function") {
        fn()
      }
      return 1
    }) as typeof setTimeout
    ;(global as any).clearTimeout = (() => {}) as typeof clearTimeout

    try {
      const neverResolves = new Promise<string>(() => {})
      await expect(
        withTimeout(neverResolves, 5, "custom timeout")
      ).rejects.toBeInstanceOf(TimeoutError)
    } finally {
      ;(global as any).setTimeout = originalSetTimeout
      ;(global as any).clearTimeout = originalClearTimeout
    }
  })
})
