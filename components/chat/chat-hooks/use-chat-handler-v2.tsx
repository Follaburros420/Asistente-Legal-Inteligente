/**
 * useChatHandler V2 - VERSIÓN CORREGIDA
 * 
 * CORRECCIONES CRÍTICAS:
 * 1. Preservar mensajes anteriores correctamente
 * 2. Manejo de errores robusto
 * 3. Logs exhaustivos
 * 4. No perder historial en errores
 */

import { useContext, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ALIContext } from "@/context/context"
import { streamChat, StreamCallbacks } from "@/components/chat/chat-helpers/stream-chat"
import { handleCreateChat, handleCreateMessages } from "@/components/chat/chat-helpers"
import { updateChat } from "@/db/chats"
import { deleteMessagesIncludingAndAfter } from "@/db/messages"
import { ChatMessage } from "@/types"
import { M1_MODEL_ID, normalizeMModel } from "@/lib/models/m1-models"
import { INITIAL_STREAM_STATE } from "@/lib/stream-protocol"
import { v4 as uuidv4 } from "uuid"
import { toast } from "sonner"

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
    setStreamState,
    setStreamPhase,
    setStreamMessage,
    setChatImages
  } = useContext(ALIContext)

  const handleNewChat = useCallback(() => {
    if (!selectedWorkspace) return
    
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
    currentChatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    console.log("[ChatV2] ================================================")
    console.log("[ChatV2] 🚀 START - Message:", messageContent.substring(0, 50))
    console.log("[ChatV2] 📊 Current chat messages count:", currentChatMessages.length)
    console.log("[ChatV2] 🔄 isRegeneration:", isRegeneration)
    
    if (!messageContent.trim()) {
      console.log("[ChatV2] ⚠️ Empty message, aborting")
      return
    }
    
    if (!selectedWorkspace) {
      console.log("[ChatV2] ❌ No workspace selected")
      toast.error("No hay workspace seleccionado")
      return
    }
    
    if (!profile) {
      console.log("[ChatV2] ❌ No profile")
      toast.error("Perfil no cargado")
      return
    }
    
    // Crear AbortController
    abortControllerRef.current = new AbortController()
    const abortController = abortControllerRef.current
    
    // Crear IDs para mensajes
    const userMessageId = uuidv4()
    const assistantMessageId = uuidv4()
    const sequenceNumber = currentChatMessages.length
    
    console.log("[ChatV2] 📝 Created message IDs:", { user: userMessageId, assistant: assistantMessageId })
    
    // Crear mensaje del usuario
    // NOTA: assistant_id removido temporalmente - no existe en schema de producción
    const userMessage: any = {
      message: {
        id: userMessageId,
        chat_id: selectedChat?.id || "",
        user_id: profile.user_id,
        content: messageContent,
        role: "user",
        sequence_number: sequenceNumber,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        image_paths: [],
        model: chatSettings?.model || M1_MODEL_ID
      },
      fileItems: []
    }
    
    // Crear mensaje del asistente (vacío inicialmente)
    // NOTA: assistant_id removido temporalmente - no existe en schema de producción
    const assistantMessage: any = {
      message: {
        id: assistantMessageId,
        chat_id: selectedChat?.id || "",
        user_id: profile.user_id,
        content: "",
        role: "assistant",
        sequence_number: sequenceNumber + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        image_paths: [],
        model: chatSettings?.model || M1_MODEL_ID
      },
      fileItems: []
    }
    
    // AGREGAR mensajes al estado INMEDIATAMENTE
    // Esto preserva los mensajes anteriores
    let messagesAfterAdd: ChatMessage[]
    
    if (isRegeneration) {
      // En regeneración, reemplazar el último mensaje del asistente
      console.log("[ChatV2] 🔄 Regeneration mode - replacing last assistant message")
      const withoutLast = currentChatMessages.slice(0, -1)
      messagesAfterAdd = [...withoutLast, { ...assistantMessage, message: { ...assistantMessage.message, content: "" } }]
    } else {
      // Agregar ambos mensajes nuevos
      console.log("[ChatV2] ➕ Adding new messages to chat")
      messagesAfterAdd = [...currentChatMessages, userMessage, assistantMessage]
    }
    
    console.log("[ChatV2] 📊 Messages after add:", messagesAfterAdd.length)
    setChatMessages(messagesAfterAdd)
    
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
    
    // Preparar historial para el backend
    // Usar messagesAfterAdd para tener el contexto actualizado
    const history = messagesAfterAdd
      .filter(msg => msg.message.role !== "system")
      .slice(-20) // Últimos 20 mensajes
      .map(msg => ({
        role: msg.message.role as "user" | "assistant",
        content: msg.message.content
      }))
    
    console.log("[ChatV2] 📚 History for backend:", history.length, "messages")
    
    // Callbacks del stream
    const callbacks: StreamCallbacks = {
      onMeta: (messageId, intent, renderMode) => {
        console.log("[ChatV2] 📋 Meta received:", { intent, renderMode })
        setStreamState(prev => ({
          ...prev,
          intent: intent as any,
          renderMode
        }))
      },
      
      onStatus: (phase, message) => {
        console.log("[ChatV2] 📊 Status:", phase, "-", message)
        setStreamPhase(phase as any)
        setStreamMessage(message)
        setStreamState(prev => ({
          ...prev,
          phase: phase as any,
          statusMessage: message
        }))
      },
      
      onDelta: (text) => {
        // Actualizar SOLO el mensaje del asistente
        setChatMessages(prev => {
          const updated = prev.map(msg => {
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
          })
          return updated
        })
        
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
        toast.error(`Error: ${message}`)
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
      console.log("[ChatV2] 🌊 Starting streamChat...")
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
        cancelled: result.cancelled,
        error: result.error
      })
      
      // Si hubo error, mostrar en el mensaje
      if (result.error) {
        setChatMessages(prev => prev.map(msg => {
          if (msg.message.id === assistantMessageId) {
            return {
              ...msg,
              message: {
                ...msg.message,
                content: `❌ Error: ${result.error}`
              }
            }
          }
          return msg
        }))
      }
      
      // Guardar en BD
      console.log("[ChatV2] 💾 Saving to database...")
      let currentChat = selectedChat
      
      if (!currentChat && !isRegeneration) {
        // Crear nuevo chat
        console.log("[ChatV2] 🆕 Creating new chat...")
        try {
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
            profile,
            selectedWorkspace,
            messageContent,
            selectedAssistant,
            [],
            setSelectedChat,
            setChats,
            () => {}
          )
          console.log("[ChatV2] ✅ Chat created:", currentChat.id)
        } catch (error: any) {
          console.error("[ChatV2] ❌ Error creating chat:", error)
          toast.error("Error creando chat: " + error.message)
          throw error
        }
      } else if (currentChat) {
        await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        })
      }
      
      if (currentChat) {
        // Actualizar IDs de chat en los mensajes
        setChatMessages(prev => prev.map(msg => ({
          ...msg,
          message: {
            ...msg.message,
            chat_id: currentChat!.id
          }
        })))
        
        // Guardar mensajes en BD
        await handleCreateMessages(
          messagesAfterAdd, // Usar los mensajes que tenemos
          currentChat,
          profile,
          { modelId: chatSettings?.model || M1_MODEL_ID } as any,
          messageContent,
          result.text || "Error: No response",
          [],
          isRegeneration,
          [],
          setChatMessages,
          () => {},
          setChatImages,
          selectedAssistant,
          result.citations.length > 0 ? result.citations : undefined
        )
        console.log("[ChatV2] ✅ Messages saved to DB")
      }
      
    } catch (error: any) {
      console.error("[ChatV2] 💥 Fatal error:", error)
      setStreamPhase("error")
      setStreamMessage(`Error: ${error.message}`)
      
      // Mostrar error en el mensaje del asistente
      setChatMessages(prev => prev.map(msg => {
        if (msg.message.id === assistantMessageId) {
          return {
            ...msg,
            message: {
              ...msg.message,
              content: `❌ Error: ${error.message || "Error desconocido"}`
            }
          }
        }
        return msg
      }))
      
      toast.error(error.message || "Error en el chat")
    } finally {
      abortControllerRef.current = null
      console.log("[ChatV2] 🧹 Cleanup done")
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
