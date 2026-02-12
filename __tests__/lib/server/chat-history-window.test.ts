import { clampTextForModel, toWindowedTextHistory } from "@/lib/server/chat-history-window"

describe("chat-history-window", () => {
  test("clampTextForModel trims and truncates text", () => {
    expect(clampTextForModel("   hola   ", 20)).toBe("hola")
    expect(clampTextForModel("abcdef", 4)).toBe("abcd")
  })

  test("toWindowedTextHistory keeps latest messages under configured limits", () => {
    const history = toWindowedTextHistory(
      [
        { role: "system", content: "system hidden" },
        { role: "user", content: "uno" },
        { role: "assistant", content: "dos" },
        { role: "user", content: "tres" },
        { role: "assistant", content: "cuatro" }
      ],
      {
        maxMessages: 2,
        maxTotalChars: 20,
        maxMessageChars: 20
      }
    )

    expect(history).toEqual([
      { role: "user", content: "tres" },
      { role: "assistant", content: "cuatro" }
    ])
  })

  test("toWindowedTextHistory truncates long messages and ignores empty/unknown roles", () => {
    const history = toWindowedTextHistory(
      [
        { role: "unknown", content: "x" },
        { role: "user", content: "" },
        { role: "assistant", content: [{ text: "mensaje muy largo para truncar" }] }
      ],
      {
        maxMessages: 5,
        maxTotalChars: 100,
        maxMessageChars: 10
      }
    )

    expect(history).toEqual([
      { role: "assistant", content: "mensaje mu" }
    ])
  })
})
