import { NextResponse } from "next/server"
const mockCreateCompletion = jest.fn()
const mockLangChainInvoke = jest.fn()

jest.mock("@/lib/server/chat-auth-guard", () => ({
  requireChatAuthAndRateLimit: jest.fn()
}))

jest.mock("@/lib/billing/plan-access", () => ({
  canContinueChat: jest.fn(async () => ({ allowed: true })),
  canUseModel: jest.fn(async () => ({ allowed: true })),
  incrementModelUsage: jest.fn(async () => ({ success: true }))
}))

jest.mock("@/db/usage-tracking", () => ({
  incrementTokenUsage: jest.fn(async () => ({ success: true }))
}))

jest.mock("@/lib/tools/legal/legal-search-toolkit", () => ({
  LEGAL_TOOLS_DEFINITIONS: [],
  executeTool: jest.fn(async () => "ok")
}))

jest.mock("@/lib/draft-detection", () => ({
  detectDraftIntent: jest.fn(() => ({ isDraft: false, confidence: 0.1 }))
}))

jest.mock("@/lib/classifiers/document-classifier", () => ({
  classifyDocumentIntent: jest.fn(async () => ({
    is_document: false,
    doc_type: "otro",
    confidence: 0.1
  }))
}))

jest.mock("@/lib/utils/draft-utils", () => ({
  validateDraftContent: jest.fn((value: any) => ({ valid: false, draft: value }))
}))

jest.mock("@/lib/langchain/config/models", () => ({
  GUARANTEED_FALLBACKS: ["deepseek/deepseek-v3.2"]
}))

jest.mock("@/lib/tools/search/serper-legal-search", () => ({
  checkSerperConfig: jest.fn(() => ({ configured: true, message: "ok" }))
}))

jest.mock("@/lib/langchain/config/prompts", () => ({
  LEGAL_AGENT_SYSTEM_PROMPT: "system"
}))

jest.mock("@/lib/langchain", () => ({
  RESEARCH_MODELS: ["deepseek/deepseek-v3.2"],
  LegalAgent: {
    create: jest.fn(async () => ({
      invoke: jest.fn(async () => ({
        output: "respuesta",
        toolsUsed: [],
        sources: []
      }))
    }))
  }
}))

jest.mock("@/lib/agents/legal-writing-agent", () => ({
  LegalWritingAgent: jest.fn().mockImplementation(() => ({
    processWithStreaming: jest.fn(async () => new ReadableStream())
  }))
}))

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: (...args: any[]) => mockLangChainInvoke(...args)
  }))
}))

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args: any[]) => mockCreateCompletion(...args)
      }
    }
  }))
})

const { requireChatAuthAndRateLimit } = jest.requireMock("@/lib/server/chat-auth-guard") as {
  requireChatAuthAndRateLimit: jest.Mock
}
const { canContinueChat, canUseModel } = jest.requireMock("@/lib/billing/plan-access") as {
  canContinueChat: jest.Mock
  canUseModel: jest.Mock
}

describe("Chat API contracts - request id", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key"
    process.env.NEXT_PUBLIC_BILLING_ENABLED = "false"
    requireChatAuthAndRateLimit.mockResolvedValue({ ok: true, userId: "user-1" })
    canContinueChat.mockResolvedValue({ allowed: true })
    canUseModel.mockResolvedValue({ allowed: true })
    mockLangChainInvoke.mockResolvedValue({ content: "{\"ok\":true}" })
    mockCreateCompletion.mockResolvedValue({
      choices: [{ message: { content: "respuesta final", tool_calls: undefined } }]
    })
  })

  test("legal-agent returns 400 with request id on invalid payload", async () => {
    const { POST } = await import("@/app/api/chat/legal-agent/route")
    const response = await POST(
      new Request("http://localhost/api/chat/legal-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wrong: true })
      }) as any
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toBeTruthy()
  })

  test("legal-agent propagates request id on auth guard failure", async () => {
    requireChatAuthAndRateLimit.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 })
    })

    const { POST } = await import("@/app/api/chat/legal-agent/route")
    const response = await POST(
      new Request("http://localhost/api/chat/legal-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatSettings: { model: "deepseek/deepseek-v3.2" },
          messages: [{ role: "user", content: "hola" }]
        })
      }) as any
    )

    expect(response.status).toBe(401)
    expect(response.headers.get("x-request-id")).toBeTruthy()
  })

  test("langchain-agent returns 400 with request id on invalid payload", async () => {
    const { POST } = await import("@/app/api/chat/langchain-agent/route")
    const response = await POST(
      new Request("http://localhost/api/chat/langchain-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nope: 1 })
      }) as any
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toBeTruthy()
  })

  test("langchain-agent returns 402 with request id when plan usage limit is exceeded", async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = "true"
    canContinueChat.mockResolvedValueOnce({
      allowed: false,
      reason: "Limite mensual alcanzado"
    })

    const { POST } = await import("@/app/api/chat/langchain-agent/route")
    const response = await POST(
      new Request("http://localhost/api/chat/langchain-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatSettings: { model: "deepseek/deepseek-v3.2" },
          messages: [{ role: "user", content: "hola" }]
        })
      }) as any
    )

    expect(response.status).toBe(402)
    expect(response.headers.get("x-request-id")).toBeTruthy()
    const payload = await response.json()
    expect(payload.code).toBe("USAGE_LIMIT_EXCEEDED")
  })

  test("langchain-agent returns 402 with request id when model usage limit is exceeded", async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = "true"
    canUseModel.mockResolvedValueOnce({
      allowed: false,
      reason: "Limite de modelo alcanzado"
    })

    const { POST } = await import("@/app/api/chat/langchain-agent/route")
    const response = await POST(
      new Request("http://localhost/api/chat/langchain-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatSettings: { model: "deepseek/deepseek-v3.2" },
          messages: [{ role: "user", content: "hola" }]
        })
      }) as any
    )

    expect(response.status).toBe(402)
    expect(response.headers.get("x-request-id")).toBeTruthy()
    const payload = await response.json()
    expect(payload.code).toBe("MODEL_LIMIT_EXCEEDED")
  })

  test("langchain-agent returns 500 with request id when OPENROUTER_API_KEY is missing", async () => {
    delete process.env.OPENROUTER_API_KEY

    const { POST } = await import("@/app/api/chat/langchain-agent/route")
    const response = await POST(
      new Request("http://localhost/api/chat/langchain-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatSettings: { model: "deepseek/deepseek-v3.2" },
          messages: [{ role: "user", content: "hola" }]
        })
      }) as any
    )

    expect(response.status).toBe(500)
    expect(response.headers.get("x-request-id")).toBeTruthy()
  })

  test("legal-writing returns 400 with request id on invalid payload", async () => {
    const { POST } = await import("@/app/api/chat/legal-writing/route")
    const response = await POST(
      new Request("http://localhost/api/chat/legal-writing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invalid: true })
      }) as any
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toBeTruthy()
  })

  test("legal-writing returns 400 with request id on empty chat history window", async () => {
    const { POST } = await import("@/app/api/chat/legal-writing/route")
    const response = await POST(
      new Request("http://localhost/api/chat/legal-writing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatSettings: { model: "deepseek/deepseek-v3.2" },
          messages: [{ role: "user", content: "   " }]
        })
      }) as any
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toBeTruthy()
    const payload = await response.json()
    expect(payload.code).toBe("EMPTY_CHAT_HISTORY")
  })

  test("refine-document returns 400 with request id on invalid payload", async () => {
    const { POST } = await import("@/app/api/chat/refine-document/route")
    const response = await POST(
      new Request("http://localhost/api/chat/refine-document", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bad: true })
      }) as any
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toBeTruthy()
  })

  test("legal-agent returns 402 when plan usage limit is exceeded", async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = "true"
    canContinueChat.mockResolvedValueOnce({
      allowed: false,
      reason: "Limite mensual alcanzado"
    })

    const { POST } = await import("@/app/api/chat/legal-agent/route")
    const response = await POST(
      new Request("http://localhost/api/chat/legal-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatSettings: { model: "deepseek/deepseek-v3.2" },
          messages: [{ role: "user", content: "hola" }]
        })
      }) as any
    )

    expect(response.status).toBe(402)
    expect(response.headers.get("x-request-id")).toBeTruthy()
    const payload = await response.json()
    expect(payload.code).toBe("USAGE_LIMIT_EXCEEDED")
  })

  test("legal-agent returns 402 when model limit is exceeded", async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = "true"
    canUseModel.mockResolvedValueOnce({
      allowed: false,
      reason: "Limite de modelo alcanzado"
    })

    const { POST } = await import("@/app/api/chat/legal-agent/route")
    const response = await POST(
      new Request("http://localhost/api/chat/legal-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatSettings: { model: "deepseek/deepseek-v3.2" },
          messages: [{ role: "user", content: "hola" }]
        })
      }) as any
    )

    expect(response.status).toBe(402)
    expect(response.headers.get("x-request-id")).toBeTruthy()
    const payload = await response.json()
    expect(payload.code).toBe("MODEL_LIMIT_EXCEEDED")
  })

  test("legal-agent propagates rate-limit headers on guard 429", async () => {
    requireChatAuthAndRateLimit.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: "rate limited" },
        {
          status: 429,
          headers: {
            "Retry-After": "5",
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": "0"
          }
        }
      )
    })

    const { POST } = await import("@/app/api/chat/legal-agent/route")
    const response = await POST(
      new Request("http://localhost/api/chat/legal-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatSettings: { model: "deepseek/deepseek-v3.2" },
          messages: [{ role: "user", content: "hola" }]
        })
      }) as any
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("5")
    expect(response.headers.get("x-ratelimit-limit")).toBe("60")
    expect(response.headers.get("x-request-id")).toBeTruthy()
  })

})
