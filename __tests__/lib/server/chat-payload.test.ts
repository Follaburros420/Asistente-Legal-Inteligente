import {
  extractLastUserMessage,
  extractMessageText,
  parseAgentChatRequest,
  parseLegalWritingRequest
} from "@/lib/server/chat-payload"

describe("chat-payload schemas", () => {
  test("parseAgentChatRequest accepts valid payload", () => {
    const result = parseAgentChatRequest({
      chatSettings: { model: "deepseek/deepseek-v3.2", temperature: 0.3 },
      messages: [{ role: "user", content: "Consulta legal" }],
      chatId: "chat-1"
    })

    expect(result.success).toBe(true)
  })

  test("parseAgentChatRequest rejects missing model", () => {
    const result = parseAgentChatRequest({
      chatSettings: {},
      messages: [{ role: "user", content: "hola" }]
    })

    expect(result.success).toBe(false)
  })

  test("parseLegalWritingRequest rejects non-string content", () => {
    const result = parseLegalWritingRequest({
      chatSettings: { model: "deepseek/deepseek-v3.2" },
      messages: [{ role: "user", content: { bad: true } }]
    })

    expect(result.success).toBe(false)
  })
})

describe("chat-payload text extraction", () => {
  test("extractMessageText supports array content and parts", () => {
    const fromContent = extractMessageText({
      content: ["uno", { text: "dos" }, { text: "tres" }]
    })
    const fromParts = extractMessageText({
      parts: [{ text: "alpha" }, { text: "beta" }]
    })

    expect(fromContent).toContain("uno")
    expect(fromContent).toContain("dos")
    expect(fromParts).toBe("alpha\nbeta")
  })

  test("extractLastUserMessage returns latest user message", () => {
    const message = extractLastUserMessage([
      { role: "assistant", content: "anterior" },
      { role: "user", content: "primera" },
      { role: "assistant", content: "ok" },
      { role: "user", content: [{ text: "ultima" }] }
    ])

    expect(message).toBe("ultima")
  })
})
