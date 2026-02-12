import {
  createRequestContext,
  getElapsedMs,
  logRequestError,
  logRequestInfo,
  logRequestWarn,
  withRequestIdHeaders
} from "@/lib/server/request-context"

describe("request-context", () => {
  test("createRequestContext reuses valid incoming request id", () => {
    const request = new Request("http://localhost/test", {
      headers: { "x-request-id": "req_123" }
    })

    const context = createRequestContext(request, "route/test")
    expect(context.requestId).toBe("req_123")
    expect(context.route).toBe("route/test")
  })

  test("createRequestContext generates new id when incoming is invalid", () => {
    const request = new Request("http://localhost/test", {
      headers: { "x-request-id": "x".repeat(200) }
    })

    const context = createRequestContext(request, "route/test")
    expect(context.requestId).toBeTruthy()
    expect(context.requestId.length).toBeGreaterThan(10)
  })

  test("withRequestIdHeaders adds x-request-id", () => {
    const headers = withRequestIdHeaders({ "Content-Type": "application/json" }, "rid-1")
    expect(headers.get("x-request-id")).toBe("rid-1")
    expect(headers.get("content-type")).toBe("application/json")
  })

  test("logging helpers do not throw and include context", () => {
    const request = new Request("http://localhost/test")
    const context = createRequestContext(request, "route/test")

    expect(() => logRequestInfo(context, "start")).not.toThrow()
    expect(() => logRequestWarn(context, "warn")).not.toThrow()
    expect(() => logRequestError(context, "error", new Error("boom"))).not.toThrow()
  })

  test("getElapsedMs returns a non-negative number", () => {
    const context = createRequestContext(new Request("http://localhost/test"), "route/test")
    const elapsed = getElapsedMs(context)
    expect(elapsed).toBeGreaterThanOrEqual(0)
  })
})
