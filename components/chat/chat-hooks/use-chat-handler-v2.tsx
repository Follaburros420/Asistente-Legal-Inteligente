/**
 * useChatHandler V2
 * 
 * Usa el orquestador thin con streaming real.
 * Reemplaza handleHostedChat legacy.
 */

import { useContext, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ALIContext } from "@/context/context"
import { streamChat, StreamCallbacks } from "@/components/chat/chat-helpers/stream-chat"
import { createTempMessages, handleCreateChat, handleCreateMessages } from "@/components/chat/chat-helpers"
import { updateChat } from "@/db/chats"
import { deleteMessagesIncludingAndAfter } from "@/db/messages"
import { ChatMessage } from "@/types"
import { M1_MODEL_ID, normalizeMModel } from "@/lib/models/m1-models"
import { INITIAL_STREAM_STATE } from "@/lib/stream-protocol"
import { v4 as uuidv4 } from "uuid"

export const useChatHandlerV2 = () => {
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const {
    userInput,
    setUserInput,
    profile,
    selectedChat,
    selectedWorkspace,
    selectedAssistant,
    chatMessages,
    setChatMessages,
    setSelectedChat,
    setChats,
    chatSettings,
    setChatSettings,
    setStreamState,
    setStreamPhase,
    setStreamMessage,
    newMessageImages,
    setNewMessageImages,
    chatImages,
    setChatImages
  } = useContext(ALIContext)

  const handleNewChat = useCallback(() => {
    if (!selectedWorkspace) return
    
    // Cancelar stream activo si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    setUserInput("")
    setChatMessages([])
    setSelectedChat(null)
    setStreamState(INITIAL_STREAM_STATE)
    setStreamPhase("idle")
    
    router.push(`/${selectedWorkspace.id}/chat`)
  }, [selectedWorkspace, router, setUserInput, setChatMessages, setSelectedChat, setStreamState, setStreamPhase])

  const handleStopMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      
      setStreamPhase("cancelled")
      setStreamMessage("Cancelado por usuario")
    }
  }, [setStreamPhase, setStreamMessage])

  const handleSendMessage = useCallback(async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    if (!messageContent.trim() || !selectedWorkspace) return
    
    console.log("[ChatV2] 🚀 Sending:", messageContent.substring(0, 50))
    
    // Crear AbortController nuevo
    abortControllerRef.current = new AbortController()
    const abortController = abortControllerRef.current
    
    // Crear mensajes temporales
    const { tempUserChatMessage, tempAssistantChatMessage } = createTempMessages(
      messageContent,
      chatMessages,
      chatSettings || {
        model: M1_MODEL_ID,
        prompt: "",
        temperature: 0.3,
        contextLength: 4096,
        includeProfileContext: true,
        includeWorkspaceInstructions: true,
        embeddingsProvider: "openai"
      },
      [],
      isRegeneration,
      setChatMessages,
      selectedAssistant
    )
    
    const assistantMessageId = tempAssistantChatMessage.message.id
    
    // Inicializar estado del stream
    setStreamState({
      ...INITIAL_STREAM_STATE,
      phase: "classifying",
      messageId: assistantMessageId,
      startedAt: Date.now(),
      statusMessage: "Analizando tu consulta legal…"
    })
    setStreamPhase("classifying")
    setStreamMessage("Analizando tu consulta legal…")
    setUserInput("")
    
    // Preparar historial
    const history = chatMessages.map(msg => ({
      role: msg.message.role as "user" | "assistant",
      content: msg.message.content
    }))
    
    // Callbacks del stream
    const callbacks: StreamCallbacks = {
      onMeta: (messageId, intent, renderMode) => {
        console.log("[ChatV2] 📋 Meta:", { intent, renderMode })
        setStreamState(prev => ({
          ...prev,
          intent: intent as any,
          renderMode
        }))
      },
      
      onStatus: (phase, message) => {
        console.log("[ChatV2] 📊 Status:", phase, message)
        setStreamPhase(phase as any)
        setStreamMessage(message)
        setStreamState(prev => ({
          ...prev,
          phase: phase as any,
          statusMessage: message
        }))
      },
      
      onDelta: (text) => {
        // Actualizar mensaje del asistente
        setChatMessages(prev => prev.map(msg => {
          if (msg.message.id === assistantMessageId) {
            return {
              ...msg,
              message: {
                ...msg.message,
                content: msg.message.content + text
              }
            }
          }
          return msg
        }))
        
        setStreamState(prev => ({
          ...prev,
          textBuffer: prev.textBuffer + text
        }))
      },
      
      onCitations: (items) => {
        console.log("[ChatV2] 📚 Citations:", items.length)
        setStreamState(prev => ({
          ...prev,
          citations: items
        }))
      },
      
      onDone: (metadata) => {
        console.log("[ChatV2] ✅ Done:", metadata)
        setStreamPhase("completed")
        setStreamMessage("Respuesta completa")
        setStreamState(prev => ({
          ...prev,
          phase: "completed",
          completedAt: Date.now()
        }))
      },
      
      onError: (message, code) => {
        console.error("[ChatV2] ❌ Error:", message, code)
        setStreamPhase("error")
        setStreamMessage(`Error: ${message}`)
        setStreamState(prev => ({
          ...prev,
          phase: "error",
          error: message,
          completedAt: Date.now()
        }))
      },
      
      onCancelled: (reason) => {
        console.log("[ChatV2] 🛑 Cancelled:", reason)
        setStreamPhase("cancelled")
        setStreamMessage("Cancelado")
        setStreamState(prev => ({
          ...prev,
          phase: "cancelled",
          completedAt: Date.now()
        }))
      }
    }
    
    try {
      // Ejecutar stream
      const result = await streamChat(
        messageContent,
        history,
        {
          model: normalizeMModel(chatSettings?.model || M1_MODEL_ID),
          temperature: chatSettings?.temperature ?? 0.3,
          maxTokens: chatSettings?.contextLength ?? 4000
        },
        abortController,
        callbacks
      )
      
      console.log("[ChatV2] 🏁 Stream ended:", {
        textLength: result.text.length,
        citations: result.citations.length,
        cancelled: result.cancelled
      })
      
      // Guardar en BD
      let currentChat = selectedChat
      
      if (!currentChat && !isRegeneration) {
        // Crear nuevo chat
        currentChat = await handleCreateChat(
          chatSettings || {
            model: M1_MODEL_ID,
            prompt: "",
            temperature: 0.3,
            contextLength: 4096,
            includeProfileContext: true,
            includeWorkspaceInstructions: true,
            embeddingsProvider: "openai"
          },
          profile!,
          selectedWorkspace,
          messageContent,
          selectedAssistant,
          [],
          setSelectedChat,
          setChats,
          () => {}
        )
      } else if (currentChat) {
        await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        })
      }
      
      if (currentChat) {
        await handleCreateMessages(
          chatMessages,
          currentChat,
          profile!,
          { modelId: chatSettings?.model || M1_MODEL_ID } as any,
          messageContent,
          result.text,
          [],
          isRegeneration,
          [],
          setChatMessages,
          () => {},
          setChatImages,
          selectedAssistant,
          result.citations.length > 0 ? result.citations : undefined
        )
      }
      
    } catch (error: any) {
      console.error("[ChatV2] 💥 Fatal error:", error)
      setStreamPhase("error")
      setStreamMessage(`Error: ${error.message}`)
    } finally {
      abortControllerRef.current = null
    }
  }, [
    selectedWorkspace,
    profile,
    chatSettings,
    selectedAssistant,
    selectedChat,
    setChatMessages,
    setStreamState,
    setStreamPhase,
    setStreamMessage,
    setUserInput,
    setSelectedChat,
    setChats,
    setChatImages
  ])

  const handleSendEdit = useCallback(async (
    editedContent: string,
    sequenceNumber: number
  ) => {
    if (!selectedChat) return
    
    await deleteMessagesIncludingAndAfter(
      selectedChat.user_id,
      selectedChat.id,
      sequenceNumber
    )
    
    const filteredMessages = chatMessages.filter(
      msg => msg.message.sequence_number < sequenceNumber
    )
    
    setChatMessages(filteredMessages)
    handleSendMessage(editedContent, filteredMessages, false)
  }, [selectedChat, chatMessages, setChatMessages, handleSendMessage])

  return {
    handleNewChat,
    handleSendMessage,
    handleStopMessage,
    handleSendEdit
  }
}
