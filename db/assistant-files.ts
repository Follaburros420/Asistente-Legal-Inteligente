import { supabase } from "@/lib/supabase/robust-client"
import { TablesInsert } from "@/supabase/types"

type AssistantFileInput = TablesInsert<"assistant_files">

const normalizeAssistantFile = (
  input: AssistantFileInput | string,
  assistantId?: string,
  fileId?: string
): AssistantFileInput => {
  if (typeof input !== "string") {
    return input
  }

  if (!assistantId || !fileId) {
    throw new Error("Missing assistant_id/file_id for assistant_files insert")
  }

  return {
    user_id: input,
    assistant_id: assistantId,
    file_id: fileId
  }
}

export const getAssistantFilesByAssistantId = async (assistantId: string) => {
  const { data: assistant, error } = await supabase
    .from("assistants")
    .select(
      `
      id,
      files (*)
    `
    )
    .eq("id", assistantId)
    .single()

  if (!assistant) {
    throw new Error(error?.message || "Assistant not found")
  }

  return { files: assistant.files ?? [] }
}

export const createAssistantFiles = async (items: AssistantFileInput[]) => {
  if (items.length === 0) return []

  const { data, error } = await supabase
    .from("assistant_files")
    .insert(items)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export const createAssistantFile = async (
  input: AssistantFileInput | string,
  assistantId?: string,
  fileId?: string
) => {
  const payload = normalizeAssistantFile(input, assistantId, fileId)

  const { data, error } = await supabase
    .from("assistant_files")
    .insert([payload])
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Failed to create assistant_file")
  }

  return data
}

export const deleteAssistantFile = async (
  assistantIdOrUserId: string,
  fileIdOrAssistantId: string,
  maybeFileId?: string
) => {
  const assistantId = maybeFileId ? fileIdOrAssistantId : assistantIdOrUserId
  const fileId = maybeFileId ?? fileIdOrAssistantId

  const { error } = await supabase
    .from("assistant_files")
    .delete()
    .eq("assistant_id", assistantId)
    .eq("file_id", fileId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}
