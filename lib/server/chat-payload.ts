import { z } from "zod"

const MAX_MODEL_ID_LENGTH = 120
const MAX_CHAT_ID_LENGTH = 120
const MAX_MESSAGES = 50
const MAX_TEXT_CONTENT_LENGTH = 20_000
const MAX_CONTENT_PARTS = 64

const textPartSchema = z
  .object({
    text: z.string().max(MAX_TEXT_CONTENT_LENGTH).transform(value => value.trim())
  })
  .passthrough()

const contentSchema = z.union([
  z.string().max(MAX_TEXT_CONTENT_LENGTH).transform(value => value.trim()),
  z.array(
    z.union([z.string().max(MAX_TEXT_CONTENT_LENGTH).transform(value => value.trim()), textPartSchema])
  ).max(MAX_CONTENT_PARTS)
])

const chatMessageSchema = z
  .object({
    role: z.string().trim().min(1).max(32),
    content: contentSchema.optional(),
    parts: z.array(textPartSchema).max(MAX_CONTENT_PARTS).optional()
  })
  .passthrough()

const chatSettingsSchema = z.object({
  model: z.string().trim().min(1).max(MAX_MODEL_ID_LENGTH),
  temperature: z.number().min(0).max(2).optional()
})

export const agentChatRequestSchema = z.object({
  chatSettings: chatSettingsSchema,
  messages: z.array(chatMessageSchema).min(1).max(MAX_MESSAGES),
  chatId: z.string().trim().min(1).max(MAX_CHAT_ID_LENGTH).optional()
})

export const legalWritingRequestSchema = z.object({
  chatSettings: z.object({
    model: z.string().trim().min(1).max(MAX_MODEL_ID_LENGTH)
  }),
  messages: z
    .array(
      z.object({
        role: z.string().trim().min(1).max(32),
        content: z.string().trim().max(MAX_TEXT_CONTENT_LENGTH)
      })
    )
    .min(1)
    .max(MAX_MESSAGES),
  chatId: z.string().trim().min(1).max(MAX_CHAT_ID_LENGTH).optional()
})

export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>
export type LegalWritingRequest = z.infer<typeof legalWritingRequestSchema>
export type AgentChatMessage = AgentChatRequest["messages"][number]

export function parseAgentChatRequest(body: unknown) {
  return agentChatRequestSchema.safeParse(body)
}

export function parseLegalWritingRequest(body: unknown) {
  return legalWritingRequestSchema.safeParse(body)
}

export function extractMessageText(message: { content?: unknown; parts?: unknown }): string {
  if (typeof message.content === "string") {
    return message.content
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map(part =>
        typeof part === "string"
          ? part
          : typeof part?.text === "string"
            ? part.text
            : ""
      )
      .filter(Boolean)
      .join("\n")
      .trim()
  }

  if (Array.isArray(message.parts)) {
    return message.parts
      .map(part => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim()
  }

  return ""
}

export function extractLastUserMessage(
  messages: Array<{ role: string; content?: unknown; parts?: unknown }>
): string {
  const userMessages = messages.filter(m => m.role === "user")
  const lastUserMessage = extractMessageText(userMessages[userMessages.length - 1] || {})
  if (lastUserMessage) return lastUserMessage

  for (let i = messages.length - 1; i >= 0; i--) {
    const fallback = extractMessageText(messages[i])
    if (fallback) return fallback
  }

  return ""
}
