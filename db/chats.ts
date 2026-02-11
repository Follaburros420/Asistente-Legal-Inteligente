import { supabase } from "@/lib/supabase/robust-client"
import { Tables, TablesInsert, TablesUpdate } from "@/supabase/types"

type LegacyChat = Tables<"chats">
type LegacyChatInsert = Partial<TablesInsert<"chats">> & {
  user_id: string
  workspace_id: string
  name: string
  model: string
  prompt: string
  temperature: number
  context_length: number
  include_profile_context: boolean
  include_workspace_instructions: boolean
  embeddings_provider: string
}
type LegacyChatUpdate = Partial<TablesUpdate<"chats">>

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

const asBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null

const normalizeLegacyChat = (row: Record<string, unknown>): LegacyChat => {
  return {
    ...(row as LegacyChat),
    assistant_id: asString(row.assistant_id)
  }
}

const sanitizeChatInsert = (chat: LegacyChatInsert) => {
  const payload = asRecord(chat)

  return {
    id: asString(payload.id) ?? undefined,
    user_id: asString(payload.user_id) ?? "",
    workspace_id: asString(payload.workspace_id) ?? "",
    assistant_id: asString(payload.assistant_id),
    name: asString(payload.name) ?? "",
    model: asString(payload.model) ?? "",
    prompt: asString(payload.prompt) ?? "",
    temperature: asNumber(payload.temperature) ?? 0,
    context_length: asNumber(payload.context_length) ?? 0,
    include_profile_context: asBoolean(payload.include_profile_context) ?? false,
    include_workspace_instructions:
      asBoolean(payload.include_workspace_instructions) ?? false,
    embeddings_provider: asString(payload.embeddings_provider) ?? "openai",
    sharing: asString(payload.sharing) ?? undefined,
    created_at: asString(payload.created_at) ?? undefined,
    updated_at: asString(payload.updated_at) ?? undefined
  }
}

const sanitizeChatUpdate = (chat: LegacyChatUpdate) => {
  const payload = asRecord(chat)
  const update: Record<string, unknown> = {}

  if ("name" in payload) update.name = asString(payload.name)
  if ("assistant_id" in payload) update.assistant_id = asString(payload.assistant_id)
  if ("model" in payload) update.model = asString(payload.model)
  if ("prompt" in payload) update.prompt = asString(payload.prompt)
  if ("temperature" in payload) update.temperature = asNumber(payload.temperature)
  if ("context_length" in payload) {
    update.context_length = asNumber(payload.context_length)
  }
  if ("include_profile_context" in payload) {
    update.include_profile_context = asBoolean(payload.include_profile_context)
  }
  if ("include_workspace_instructions" in payload) {
    update.include_workspace_instructions = asBoolean(
      payload.include_workspace_instructions
    )
  }
  if ("embeddings_provider" in payload) {
    update.embeddings_provider = asString(payload.embeddings_provider)
  }
  if ("sharing" in payload) update.sharing = asString(payload.sharing)
  if ("updated_at" in payload) update.updated_at = asString(payload.updated_at)

  return update
}

export const getChatById = async (chatId: string) => {
  const { data } = await (supabase.from("chats") as any)
    .select("*")
    .eq("id", chatId)
    .maybeSingle()

  if (!data) return null

  return normalizeLegacyChat(data as Record<string, unknown>)
}

export const getChatsByWorkspaceId = async (workspaceId: string) => {
  const { data: chats, error } = await (supabase.from("chats") as any)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  if (!chats) {
    throw new Error(error?.message ?? "Failed to load chats")
  }

  return (chats as Record<string, unknown>[]).map(normalizeLegacyChat)
}

export const createChat = async (chat: LegacyChatInsert) => {
  const sanitized = sanitizeChatInsert(chat)

  const { data: createdChat, error } = await (supabase.from("chats") as any)
    .insert([sanitized])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeLegacyChat(createdChat as Record<string, unknown>)
}

export const createChats = async (chats: LegacyChatInsert[]) => {
  const sanitized = chats.map(sanitizeChatInsert)

  const { data: createdChats, error } = await (supabase.from("chats") as any)
    .insert(sanitized)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  return (createdChats as Record<string, unknown>[]).map(normalizeLegacyChat)
}

export const updateChat = async (
  chatId: string,
  chat: LegacyChatUpdate
) => {
  const sanitized = sanitizeChatUpdate(chat)

  const { data: updatedChat, error } = await (supabase.from("chats") as any)
    .update(sanitized)
    .eq("id", chatId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeLegacyChat(updatedChat as Record<string, unknown>)
}

export const deleteChat = async (chatId: string) => {
  const { error } = await supabase.from("chats").delete().eq("id", chatId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}
