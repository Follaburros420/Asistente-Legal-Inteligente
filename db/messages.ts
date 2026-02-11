import { supabase } from "@/lib/supabase/robust-client"
import { Tables, TablesInsert, TablesUpdate } from "@/supabase/types"

type MessageRow = Tables<"messages">

type MessageInsert = Partial<TablesInsert<"messages">> & {
  content: string
  role: string
  chat_id?: string
  session_id?: string
}

type MessageUpdate = Partial<TablesUpdate<"messages">> & {
  content?: string
  role?: string
  chat_id?: string
  session_id?: string
}

const MESSAGE_PERSISTENCE_ENABLED =
  process.env.NEXT_PUBLIC_LEGACY_MESSAGES_PERSISTENCE !== "false" &&
  process.env.LEGACY_MESSAGES_PERSISTENCE !== "false"

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null

const asNumber = (value: unknown): number | null =>
  typeof value === "number" ? value : null

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

const resolveChatId = (payload: Record<string, unknown>) => {
  const chatId = asString(payload.chat_id) ?? asString(payload.session_id)
  if (!chatId) {
    throw new Error("Missing chat_id for message persistence")
  }

  return chatId
}

const normalizeInsert = (
  message: Record<string, unknown>,
  fallbackSequence = 0
): TablesInsert<"messages"> => {
  const metadata = asRecord(message.metadata)

  return {
    id: asString(message.id) ?? undefined,
    chat_id: resolveChatId(message),
    assistant_id:
      asString(message.assistant_id) ?? asString(metadata.assistant_id) ?? null,
    user_id: asString(message.user_id) ?? asString(metadata.user_id) ?? "",
    content: asString(message.content) ?? "",
    model: asString(message.model) ?? asString(metadata.model) ?? "unknown",
    role: asString(message.role) ?? "user",
    sequence_number:
      asNumber(message.sequence_number) ??
      asNumber(metadata.sequence_number) ??
      fallbackSequence,
    image_paths: asStringArray(message.image_paths),
    metadata: (message.metadata as MessageRow["metadata"]) ?? null,
    created_at: asString(message.created_at) ?? new Date().toISOString(),
    updated_at: asString(message.updated_at) ?? null
  }
}

const buildFallbackMessage = (
  message: Record<string, unknown>,
  fallbackSequence = 0,
  fixedId?: string
): MessageRow => {
  const normalized = normalizeInsert(message, fallbackSequence)
  const createdAt = normalized.created_at || new Date().toISOString()

  return {
    id: fixedId ?? normalized.id ?? crypto.randomUUID(),
    chat_id: normalized.chat_id,
    assistant_id: normalized.assistant_id,
    user_id: normalized.user_id,
    content: normalized.content,
    model: normalized.model,
    role: normalized.role,
    sequence_number: normalized.sequence_number,
    image_paths: normalized.image_paths,
    metadata: normalized.metadata ?? null,
    created_at: createdAt,
    updated_at: normalized.updated_at
  }
}

export const getMessageById = async (messageId: string) => {
  if (!MESSAGE_PERSISTENCE_ENABLED) {
    throw new Error("Message persistence is disabled")
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Message not found")
  }

  return data
}

export const getMessagesByChatId = async (chatId: string) => {
  if (!MESSAGE_PERSISTENCE_ENABLED) {
    return []
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("sequence_number", { ascending: true })

  if (error || !data) {
    throw new Error(error?.message ?? "Messages not found")
  }

  return data
}

export const createMessage = async (message: MessageInsert) => {
  const payload = message as Record<string, unknown>
  if (!MESSAGE_PERSISTENCE_ENABLED) {
    return buildFallbackMessage(payload)
  }

  const rowToInsert = normalizeInsert(payload)
  const { data, error } = await supabase
    .from("messages")
    .insert([rowToInsert])
    .select("*")
    .single()

  if (error || !data) {
    console.warn("messages persistence fallback (single)", error?.message)
    return buildFallbackMessage(payload)
  }

  return data
}

export const createMessages = async (messages: MessageInsert[]) => {
  const payloads = messages.map(message => message as Record<string, unknown>)
  if (!MESSAGE_PERSISTENCE_ENABLED) {
    return payloads.map((payload, index) => buildFallbackMessage(payload, index))
  }

  const rowsToInsert = payloads.map((payload, index) =>
    normalizeInsert(payload, index)
  )

  const { data, error } = await supabase
    .from("messages")
    .insert(rowsToInsert)
    .select("*")

  if (error || !data) {
    console.warn("messages persistence fallback (bulk)", error?.message)
    return payloads.map((payload, index) => buildFallbackMessage(payload, index))
  }

  return data
}

export const updateMessage = async (messageId: string, message: MessageUpdate) => {
  const payload = message as Record<string, unknown>
  if (!MESSAGE_PERSISTENCE_ENABLED) {
    return buildFallbackMessage(payload, 0, messageId)
  }

  const update: Record<string, unknown> = {}
  if ("assistant_id" in payload) update.assistant_id = asString(payload.assistant_id)
  if ("content" in payload) update.content = asString(payload.content)
  if ("model" in payload) update.model = asString(payload.model)
  if ("role" in payload) update.role = asString(payload.role)
  if ("sequence_number" in payload) {
    update.sequence_number = asNumber(payload.sequence_number)
  }
  if ("image_paths" in payload) update.image_paths = asStringArray(payload.image_paths)
  if ("metadata" in payload) update.metadata = payload.metadata
  if ("updated_at" in payload) update.updated_at = asString(payload.updated_at)

  const { data, error } = await supabase
    .from("messages")
    .update(update as TablesUpdate<"messages">)
    .eq("id", messageId)
    .select("*")
    .single()

  if (error || !data) {
    console.warn("messages persistence fallback (update)", error?.message)
    return buildFallbackMessage(payload, 0, messageId)
  }

  return data
}

export const deleteMessage = async (messageId: string) => {
  if (!MESSAGE_PERSISTENCE_ENABLED) {
    return true
  }

  const { error } = await supabase.from("messages").delete().eq("id", messageId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export async function deleteMessagesIncludingAndAfter(
  userId: string,
  chatId: string,
  sequenceNumber: number
) {
  if (!MESSAGE_PERSISTENCE_ENABLED) {
    return true
  }

  void userId

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId)
    .gte("sequence_number", sequenceNumber)

  if (error) {
    return true
  }

  return true
}
