import { supabase } from "@/lib/supabase/robust-client"
import { TablesInsert } from "@/supabase/types"

type AssistantToolInput = TablesInsert<"assistant_tools">

const normalizeAssistantTool = (
  input: AssistantToolInput | string,
  assistantId?: string,
  toolId?: string
): AssistantToolInput => {
  if (typeof input !== "string") {
    return input
  }

  if (!assistantId || !toolId) {
    throw new Error("Missing assistant_id/tool_id for assistant_tools insert")
  }

  return {
    user_id: input,
    assistant_id: assistantId,
    tool_id: toolId
  }
}

export const getAssistantToolsByAssistantId = async (assistantId: string) => {
  const { data: assistant, error } = await supabase
    .from("assistants")
    .select(
      `
      id,
      tools (*)
    `
    )
    .eq("id", assistantId)
    .single()

  if (!assistant) {
    throw new Error(error?.message || "Assistant not found")
  }

  return { tools: assistant.tools ?? [] }
}

export const createAssistantTools = async (items: AssistantToolInput[]) => {
  if (items.length === 0) return []

  const { data, error } = await supabase
    .from("assistant_tools")
    .insert(items)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export const createAssistantTool = async (
  input: AssistantToolInput | string,
  assistantId?: string,
  toolId?: string
) => {
  const payload = normalizeAssistantTool(input, assistantId, toolId)

  const { data, error } = await supabase
    .from("assistant_tools")
    .insert([payload])
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Failed to create assistant_tool")
  }

  return data
}

export const deleteAssistantTool = async (
  assistantIdOrUserId: string,
  toolIdOrAssistantId: string,
  maybeToolId?: string
) => {
  const assistantId = maybeToolId ? toolIdOrAssistantId : assistantIdOrUserId
  const toolId = maybeToolId ?? toolIdOrAssistantId

  const { error } = await supabase
    .from("assistant_tools")
    .delete()
    .eq("assistant_id", assistantId)
    .eq("tool_id", toolId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}
