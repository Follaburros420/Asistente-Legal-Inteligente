export type NormalizedChatRole = "system" | "user" | "assistant"

export interface NormalizedChatMessage {
  role: NormalizedChatRole
  content: string
}

type IncomingMessage = {
  role?: unknown
  content?: unknown
  parts?: unknown
}

function normalizeRole(role: unknown): NormalizedChatRole | null {
  if (typeof role !== "string") return null

  const normalized = role.toLowerCase()
  if (normalized === "user") return "user"
  if (normalized === "assistant" || normalized === "model") return "assistant"
  if (normalized === "system") return "system"
  return null
}

function extractTextFromPart(part: unknown): string {
  if (!part) return ""
  if (typeof part === "string") return part

  if (typeof part === "object") {
    const maybePart = part as Record<string, unknown>

    if (typeof maybePart.text === "string") {
      return maybePart.text
    }

    if (typeof maybePart.content === "string") {
      return maybePart.content
    }

    if (Array.isArray(maybePart.parts)) {
      return maybePart.parts
        .map(extractTextFromPart)
        .filter(Boolean)
        .join("\n")
    }

    if (Array.isArray(maybePart.content)) {
      return maybePart.content
        .map(extractTextFromPart)
        .filter(Boolean)
        .join("\n")
    }
  }

  return ""
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content
  }

  if (Array.isArray(content)) {
    return content.map(extractTextFromPart).filter(Boolean).join("\n")
  }

  if (content && typeof content === "object") {
    const maybeContent = content as Record<string, unknown>

    if (Array.isArray(maybeContent.parts)) {
      return maybeContent.parts
        .map(extractTextFromPart)
        .filter(Boolean)
        .join("\n")
    }
  }

  return ""
}

export function normalizeIncomingMessages(
  messages: unknown
): NormalizedChatMessage[] {
  if (!Array.isArray(messages)) return []

  const normalized: NormalizedChatMessage[] = []

  for (const raw of messages) {
    if (!raw || typeof raw !== "object") continue

    const message = raw as IncomingMessage
    const role = normalizeRole(message.role)
    if (!role) continue

    const content = extractTextContent(message.content)
    const fallbackFromParts = extractTextContent({ parts: message.parts })
    const text = (content || fallbackFromParts || "").trim()
    if (!text) continue

    normalized.push({
      role,
      content: text
    })
  }

  return normalized
}

export function getLastUserMessage(messages: NormalizedChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && messages[i].content.trim()) {
      return messages[i].content.trim()
    }
  }

  return ""
}
