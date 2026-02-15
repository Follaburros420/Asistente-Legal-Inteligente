/**
 * Guardado de mensajes en BD sin modificar estado
 * 
 * Esta función solo guarda mensajes en la base de datos
 * sin tocar el estado de React (para evitar sobrescribir
 * mensajes que ya se mostraron en UI).
 */

import { createMessages } from "@/db/messages"
import { Tables } from "@/supabase/types"
import { ChatMessage } from "@/types"
import { BibliographyItem } from "@/types/chat-message"

interface SaveMessagesParams {
  userMessage: ChatMessage
  assistantMessage: ChatMessage
  currentChat: Tables<"chats">
  profile: Tables<"profiles">
  bibliography?: BibliographyItem[]
}

/**
 * Guarda mensajes en BD sin modificar estado de React
 */
export async function saveMessagesToDB({
  userMessage,
  assistantMessage,
  currentChat,
  profile,
  bibliography
}: SaveMessagesParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Preparar mensajes para BD (con IDs de chat correctos)
    const userMessageForDB = {
      chat_id: currentChat.id,
      user_id: profile.user_id,
      content: userMessage.message.content,
      model: userMessage.message.model,
      role: "user" as const,
      sequence_number: userMessage.message.sequence_number,
      image_paths: userMessage.message.image_paths || [],
      // NOTA: assistant_id removido temporalmente - no existe en schema
    }

    const assistantMessageForDB = {
      chat_id: currentChat.id,
      user_id: profile.user_id,
      content: assistantMessage.message.content,
      model: assistantMessage.message.model,
      role: "assistant" as const,
      sequence_number: assistantMessage.message.sequence_number,
      image_paths: assistantMessage.message.image_paths || [],
      // NOTA: assistant_id removido temporalmente - no existe en schema
    }

    // Guardar en BD
    const createdMessages = await createMessages([
      userMessageForDB,
      assistantMessageForDB
    ])

    console.log("[saveMessagesToDB] ✅ Messages saved:", createdMessages.length)
    
    return { success: true }
  } catch (error: any) {
    console.error("[saveMessagesToDB] ❌ Error saving messages:", error)
    return { 
      success: false, 
      error: error.message || "Error saving messages" 
    }
  }
}
