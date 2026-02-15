import { supabase, executeWithSchemaRetry } from "@/lib/supabase/browser-client"
import { TablesInsert } from "@/supabase/types"

export const getChatFilesByChatId = async (chatId: string) => {
  const { data: chatFiles, error } = await supabase
    .from("chats")
    .select(
      `
      id, 
      name, 
      files (*)
    `
    )
    .eq("id", chatId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!chatFiles) {
    // Si no se encuentra el chat, retornar un objeto vacío con estructura válida
    return {
      id: chatId,
      name: "",
      files: []
    }
  }

  return chatFiles
}

export const createChatFile = async (chatFile: TablesInsert<"chat_files">) => {
  const { data: createdChatFile, error } = await supabase
    .from("chat_files")
    .insert(chatFile)
    .select("*")

  if (!createdChatFile) {
    throw new Error(error.message)
  }

  return createdChatFile
}

export const createChatFiles = async (
  chatFiles: TablesInsert<"chat_files">[]
) => {
  const { data: createdChatFiles, error } = await executeWithSchemaRetry(() =>
    supabase
      .from("chat_files")
      .insert(chatFiles)
      .select("*")
  )

  if (error || !createdChatFiles) {
    throw new Error(error?.message || "Failed to create chat files")
  }

  return createdChatFiles
}
