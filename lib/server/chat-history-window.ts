import { extractMessageText } from "@/lib/server/chat-payload"

export type WindowedTextRole = "user" | "assistant" | "system"

export interface WindowedTextMessage {
  role: WindowedTextRole
  content: string
}

export interface HistoryWindowOptions {
  includeSystem?: boolean
  maxMessages?: number
  maxMessageChars?: number
  maxTotalChars?: number
}

const DEFAULT_MAX_MESSAGES = 14
const DEFAULT_MAX_MESSAGE_CHARS = 1_800
const DEFAULT_MAX_TOTAL_CHARS = 12_000

export function clampTextForModel(input: string, maxChars: number): string {
  if (!Number.isFinite(maxChars) || maxChars <= 0) return ""
  const normalized = (input || "").trim()
  if (normalized.length <= maxChars) return normalized
  return normalized.slice(0, maxChars).trimEnd()
}

function toWindowedRole(role: string): WindowedTextRole | null {
  if (role === "user" || role === "assistant" || role === "system") {
    return role
  }
  return null
}

/**
 * Selects only the most recent, non-empty messages under fixed char budgets.
 * This keeps request token usage stable across long chats.
 */
export function toWindowedTextHistory(
  messages: Array<{ role: string; content?: unknown; parts?: unknown }>,
  options: HistoryWindowOptions = {}
): WindowedTextMessage[] {
  const includeSystem = options.includeSystem ?? false
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES
  const maxMessageChars = options.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS
  const maxTotalChars = options.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS

  const selected: WindowedTextMessage[] = []
  let totalChars = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    const role = toWindowedRole(messages[i]?.role || "")
    if (!role) continue
    if (!includeSystem && role === "system") continue

    const content = clampTextForModel(extractMessageText(messages[i]), maxMessageChars)
    if (!content) continue

    if (selected.length >= maxMessages) break
    if (selected.length > 0 && totalChars + content.length > maxTotalChars) break

    selected.push({ role, content })
    totalChars += content.length
  }

  return selected.reverse()
}
