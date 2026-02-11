import { supabase } from "@/lib/supabase/robust-client"
import { Json, Tables, TablesInsert, TablesUpdate } from "@/supabase/types"

type LegacyMessage = Tables<"messages">

interface MessageRowActual {
  id: string
  session_id: string
  role: string
  content: string
  metadata: Json | null
  created_at: string | null
}

type LegacyMessageInsert = Partial<TablesInsert<"messages">> & {
  content: string
  role: string
  session_id?: string
}

type LegacyMessageUpdate = Partial<TablesUpdate<"messages">> & {
  content?: string
  role?: string
  session_id?: string
}

const LEGACY_MESSAGES_PERSISTENCE_ENABLED =
  process.env.NEXT_PUBLIC_LEGACY_MESSAGES_PERSISTENCE === "true" ||
  process.env.LEGACY_MESSAGES_PERSISTENCE === "true"

const EMPTY_ARRAY: string[] = []

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return EMPTY_ARRAY

  return value.filter((entry): entry is string => typeof entry === "string")
}

const toLegacyMessage = (
  row: MessageRowActual,
  fallbackSequence = 0
): LegacyMessage => {
  const metadata = asRecord(row.metadata)
  const chatId = asString(metadata.chat_id) ?? row.session_id
  const createdAt = row.created_at ?? new Date().toISOString()

  return {
    id: row.id,
    chat_id: chatId,
    assistant_id: asString(metadata.assistant_id),
    user_id: asString(metadata.user_id) ?? "",
    content: row.content,
    model: asString(metadata.model) ?? "unknown",
    role: row.role,
    sequence_number:
      typeof metadata.sequence_number === "number"
        ? metadata.sequence_number
        : fallbackSequence,
    image_paths: asStringArray(metadata.image_paths),
    metadata: row.metadata,
    created_at: createdAt,
    updated_at: asString(metadata.updated_at) ?? createdAt
  }
}

const resolveSessionId = (message: Record<string, unknown>) => {
  const sessionId = asString(message.session_id) ?? asString(message.chat_id)

  if (!sessionId) {
    throw new Error("Missing session_id/chat_id for message persistence")
  }

  return sessionId
}

const buildMetadata = (
  message: Record<string, unknown>,
  fallbackSequence = 0
): Json => {
  const metadata = asRecord(message.metadata)
  const messageImagePaths = asStringArray(message.image_paths)

  return {
    ...metadata,
    chat_id: asString(message.chat_id) ?? asString(message.session_id) ?? "",
    user_id: asString(message.user_id) ?? asString(metadata.user_id) ?? "",
    assistant_id:
      asString(message.assistant_id) ?? asString(metadata.assistant_id) ?? null,
    model: asString(message.model) ?? asString(metadata.model) ?? "unknown",
    sequence_number:
      typeof message.sequence_number === "number"
        ? message.sequence_number
        : typeof metadata.sequence_number === "number"
          ? metadata.sequence_number
          : fallbackSequence,
    image_paths:
      messageImagePaths.length > 0
        ? messageImagePaths
        : asStringArray(metadata.image_paths),
    updated_at:
      asString(message.updated_at) ??
      asString(metadata.updated_at) ??
      new Date().toISOString()
  }
}

const buildFallbackMessage = (
  message: Record<string, unknown>,
  fallbackSequence = 0,
  fixedId?: string
): LegacyMessage => {
  const metadata = buildMetadata(message, fallbackSequence)
  const createdAt = asString(message.created_at) ?? new Date().toISOString()

  return {
    id: fixedId ?? crypto.randomUUID(),
    chat_id: asString(message.chat_id) ?? asString(message.session_id) ?? "",
    assistant_id: asString(message.assistant_id),
    user_id: asString(message.user_id) ?? "",
    content: asString(message.content) ?? "",
    model: asString(message.model) ?? "unknown",
    role: asString(message.role) ?? "user",
    sequence_number:
      typeof message.sequence_number === "number"
        ? message.sequence_number
        : fallbackSequence,
    image_paths: asStringArray(message.image_paths),
    metadata,
    created_at: createdAt,
    updated_at: asString(message.updated_at) ?? createdAt
  }
}

export const getMessageById = async (messageId: string) => {
  if (!LEGACY_MESSAGES_PERSISTENCE_ENABLED) {
    throw new Error("Message persistence is disabled")
  }

  const { data, error } = await (supabase.from("messages") as any)
    .select("*")
    .eq("id", messageId)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Message not found")
  }

  return toLegacyMessage(data as MessageRowActual, 0)
}

export const getMessagesByChatId = async (chatId: string) => {
  if (!LEGACY_MESSAGES_PERSISTENCE_ENABLED) {
    return []
  }

  const { data, error } = await (supabase.from("messages") as any)
    .select("*")
    .eq("session_id", chatId)
    .order("created_at", { ascending: true })

  if (error || !data) {
    throw new Error(error?.message ?? "Messages not found")
  }

  return (data as MessageRowActual[]).map((row, index) =>
    toLegacyMessage(row, index)
  )
}

export const createMessage = async (message: LegacyMessageInsert) => {
  const payload = message as Record<string, unknown>
  if (!LEGACY_MESSAGES_PERSISTENCE_ENABLED) {
    return buildFallbackMessage(payload)
  }

  const sessionId = resolveSessionId(payload)
  const rowToInsert = {
    id: asString(payload.id) ?? undefined,
    session_id: sessionId,
    role: asString(payload.role) ?? "user",
    content: asString(payload.content) ?? "",
    metadata: buildMetadata(payload),
    created_at: asString(payload.created_at) ?? new Date().toISOString()
  }

  const { data, error } = await (supabase.from("messages") as any)
    .insert([rowToInsert])
    .select("*")
    .single()

  if (error || !data) {
    console.warn("messages persistence fallback (single)", error?.message)
    return buildFallbackMessage(payload)
  }

  return toLegacyMessage(data as MessageRowActual, 0)
}

export const createMessages = async (messages: LegacyMessageInsert[]) => {
  const payloads = messages.map(message => message as Record<string, unknown>)
  if (!LEGACY_MESSAGES_PERSISTENCE_ENABLED) {
    return payloads.map((payload, index) => buildFallbackMessage(payload, index))
  }

  const rowsToInsert = payloads.map((payload, index) => ({
    id: asString(payload.id) ?? undefined,
    session_id: resolveSessionId(payload),
    role: asString(payload.role) ?? "user",
    content: asString(payload.content) ?? "",
    metadata: buildMetadata(payload, index),
    created_at: asString(payload.created_at) ?? new Date().toISOString()
  }))

  const { data, error } = await (supabase.from("messages") as any)
    .insert(rowsToInsert)
    .select("*")

  if (error || !data) {
    console.warn("messages persistence fallback (bulk)", error?.message)
    return payloads.map((payload, index) => buildFallbackMessage(payload, index))
  }

  return (data as MessageRowActual[]).map((row, index) =>
    toLegacyMessage(row, index)
  )
}

export const updateMessage = async (
  messageId: string,
  message: LegacyMessageUpdate
) => {
  const payload = message as Record<string, unknown>
  if (!LEGACY_MESSAGES_PERSISTENCE_ENABLED) {
    return buildFallbackMessage(payload, 0, messageId)
  }

  const metadata = buildMetadata(payload)
  const rowToUpdate: Record<string, unknown> = { metadata }
  const content = asString(payload.content)
  const role = asString(payload.role)
  if (content !== null) rowToUpdate.content = content
  if (role !== null) rowToUpdate.role = role

  const { data, error } = await (supabase.from("messages") as any)
    .update(rowToUpdate)
    .eq("id", messageId)
    .select("*")
    .single()

  if (error || !data) {
    console.warn("messages persistence fallback (update)", error?.message)
    return buildFallbackMessage(payload, 0, messageId)
  }

  return toLegacyMessage(data as MessageRowActual, 0)
}

export const deleteMessage = async (messageId: string) => {
  if (!LEGACY_MESSAGES_PERSISTENCE_ENABLED) {
    return true
  }

  const { error } = await (supabase.from("messages") as any)
    .delete()
    .eq("id", messageId)

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
  if (!LEGACY_MESSAGES_PERSISTENCE_ENABLED) {
    return true
  }

  void userId
  const { data: rows, error: rowsError } = await (supabase.from("messages") as any)
    .select("id,metadata,created_at")
    .eq("session_id", chatId)
    .order("created_at", { ascending: true })

  if (rowsError || !rows) {
    return true
  }

  const idsToDelete = (rows as Array<{ id: string; metadata: Json | null }>)
    .filter((row, index) => {
      const metadata = asRecord(row.metadata)
      const rowSequence =
        typeof metadata.sequence_number === "number"
          ? metadata.sequence_number
          : index

      return rowSequence >= sequenceNumber
    })
    .map(row => row.id)

  if (idsToDelete.length === 0) {
    return true
  }

  const { error: deleteError } = await (supabase.from("messages") as any)
    .delete()
    .in("id", idsToDelete)

  if (deleteError) {
    return true
  }

  return true
}
