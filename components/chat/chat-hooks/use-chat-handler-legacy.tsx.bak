import { ALIContext } from "@/context/context"
import { getAssistantCollectionsByAssistantId } from "@/db/assistant-collections"
import { getAssistantFilesByAssistantId } from "@/db/assistant-files"
import { getAssistantToolsByAssistantId } from "@/db/assistant-tools"
import { updateChat } from "@/db/chats"
import { getCollectionFilesByCollectionId } from "@/db/collection-files"
// NOTE: assistant functions are stubs - assistants feature removed
import { deleteMessagesIncludingAndAfter } from "@/db/messages"
import { buildFinalMessages } from "@/lib/build-prompt"
import { Tables } from "@/supabase/types"
import { ChatMessage, ChatPayload, LLMID, ModelProvider } from "@/types"
import { BibliographyItem } from "@/types/chat-message"
import { isAllowedMModel, M1_MODEL_ID, normalizeMModel } from "@/lib/models/m1-models"
import { useRouter } from "next/navigation"
import { useContext, useEffect, useRef } from "react"
import { LLM_LIST } from "../../../lib/models/llm/llm-list"
import {
  createTempMessages,
  handleCreateChat,
  handleCreateMessages,
  handleHostedChat,
  handleLocalChat,
  handleRetrieval,
  processResponse,
  validateChatSettings
} from "../chat-helpers"

export const useChatHandler = () => {
  const router = useRouter()

  const {
    userInput,
    chatFiles,
    setUserInput,
    setNewMessageImages,
    profile,
    setIsGenerating,
    setChatMessages,
    setFirstTokenReceived,
    selectedChat,
    selectedWorkspace,
    setSelectedChat,
    setChats,
    setSelectedTools,
    availableLocalModels,
    availableOpenRouterModels,
    abortController,
    setAbortController,
    chatSettings,
    newMessageImages,
    selectedAssistant,
    chatMessages,
    chatImages,
    setChatImages,
    setChatFiles,
    setNewMessageFiles,
    setShowFilesDisplay,
    newMessageFiles,
    chatFileItems,
    setChatFileItems,
    setToolInUse,
    useRetrieval,
    sourceCount,
    setIsPromptPickerOpen,
    setIsFilePickerOpen,
    selectedTools,
    selectedPreset,
    setChatSettings,
    models,
    isPromptPickerOpen,
    isFilePickerOpen,
    isToolPickerOpen,
    setShowPlaceholderSuggestions,
    setSuggestedQuestions,
    setShowSuggestedQuestions,
    setStreamPhase,
    setStreamMessage,
    setStreamState
  } = useContext(ALIContext)

  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isPromptPickerOpen && !isFilePickerOpen && !isToolPickerOpen) {
      chatInputRef.current?.focus()
    }
  }, [isPromptPickerOpen, isFilePickerOpen, isToolPickerOpen])

  const handleNewChat = async (options?: { preserveChatMode?: boolean }) => {
    if (!selectedWorkspace) return
    const preserveChatMode = options?.preserveChatMode ?? false

    if (typeof window !== "undefined" && !preserveChatMode) {
      localStorage.removeItem("chatMode")
      window.dispatchEvent(new Event("chat-mode-changed"))
    }

    setUserInput("")
    setChatMessages([])
    setSelectedChat(null)
    setChatFileItems([])

    setIsGenerating(false)
    setFirstTokenReceived(false)

    setChatFiles([])
    setChatImages([])
    setNewMessageFiles([])
    setNewMessageImages([])
    setShowFilesDisplay(false)
    setIsPromptPickerOpen(false)
    setIsFilePickerOpen(false)

    setSelectedTools([])
    setToolInUse("none")
    
    // Reiniciar sugerencias para el nuevo chat
    setShowPlaceholderSuggestions(true)
    
    // Reiniciar preguntas sugeridas
    setSuggestedQuestions([])
    setShowSuggestedQuestions(false)

    if (selectedAssistant) {
      setChatSettings({
        model: normalizeMModel(selectedAssistant.model) as LLMID,
        prompt: selectedAssistant.prompt,
        temperature: selectedAssistant.temperature,
        contextLength: selectedAssistant.context_length,
        includeProfileContext: selectedAssistant.include_profile_context,
        includeWorkspaceInstructions:
          selectedAssistant.include_workspace_instructions,
        embeddingsProvider: selectedAssistant.embeddings_provider as
          | "openai"
          | "local"
      })

      let allFiles = []

      const assistantFiles = (
        await getAssistantFilesByAssistantId(selectedAssistant.id)
      ).files
      allFiles = [...assistantFiles]
      const assistantCollections = (
        await getAssistantCollectionsByAssistantId(selectedAssistant.id)
      ).collections
      for (const collection of assistantCollections) {
        const collectionFiles = (
          await getCollectionFilesByCollectionId(collection.id)
        ).files
        allFiles = [...allFiles, ...collectionFiles]
      }
      const assistantTools = (
        await getAssistantToolsByAssistantId(selectedAssistant.id)
      ).tools

      setSelectedTools(assistantTools)
      setChatFiles(
        allFiles.map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          file: null
        }))
      )

      if (allFiles.length > 0) setShowFilesDisplay(true)
    } else if (selectedPreset) {
      setChatSettings({
        model: normalizeMModel(selectedPreset.model) as LLMID,
        prompt: selectedPreset.prompt,
        temperature: selectedPreset.temperature,
        contextLength: selectedPreset.context_length,
        includeProfileContext: selectedPreset.include_profile_context,
        includeWorkspaceInstructions:
          selectedPreset.include_workspace_instructions,
        embeddingsProvider: selectedPreset.embeddings_provider as
          | "openai"
          | "local"
      })
    } else if (selectedWorkspace) {
      // setChatSettings({
      //   model: (selectedWorkspace.default_model ||
      //     "gpt-4-1106-preview") as LLMID,
      //   prompt:
      //     selectedWorkspace.default_prompt ||
      //     "You are a friendly, helpful AI assistant.",
      //   temperature: selectedWorkspace.default_temperature || 0.5,
      //   contextLength: selectedWorkspace.default_context_length || 4096,
      //   includeProfileContext:
      //     selectedWorkspace.include_profile_context || true,
      //   includeWorkspaceInstructions:
      //     selectedWorkspace.include_workspace_instructions || true,
      //   embeddingsProvider:
      //     (selectedWorkspace.embeddings_provider as "openai" | "local") ||
      //     "openai"
      // })
    }

    // Navegar a la ruta del chat
    return router.push(`/${selectedWorkspace.id}/chat`)
  }

  const handleFocusChatInput = () => {
    chatInputRef.current?.focus()
  }

  const handleStopMessage = () => {
    if (abortController) {
      abortController.abort()
    }
    // Resetear estado inmediatamente al presionar Stop
    setIsGenerating(false)
    setFirstTokenReceived(false)
    setToolInUse("none")
    // Actualizar estado del stream (nuevo protocolo)
    setStreamPhase("cancelled")
    setStreamMessage("Cancelado por usuario")
  }

  const handleSendMessage = async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    const startingInput = messageContent
    let hasError = false
    console.log("[Chat] 🚀 Iniciando handleSendMessage:", messageContent.substring(0, 50))

    try {
      // Validaciones básicas sin mostrar errores al usuario
      if (!messageContent || messageContent.trim() === "") {
        console.log("[Chat] ⚠️ Mensaje vacío, ignorando")
        return
      }

      if (!selectedWorkspace) {
        console.error("[Chat] ❌ No hay workspace seleccionado")
        return
      }

      setUserInput("")
      setIsGenerating(true)
      setIsPromptPickerOpen(false)
      setIsFilePickerOpen(false)
      setNewMessageImages([])
      
      console.log("[Chat] 📋 Preparando mensajes temporales…")
      
      // Inicializar estado del stream (nuevo protocolo v2.0)
      setStreamPhase("classifying")
      setStreamMessage("Analizando tu consulta legal…")

      const newAbortController = new AbortController()
      setAbortController(newAbortController)

      // Crear chatSettings por defecto si es null
      const baseSettings = chatSettings || {
        model: M1_MODEL_ID as LLMID,
        prompt: "Eres un asistente legal inteligente especializado en derecho colombiano.",
        temperature: 0.3,
        contextLength: 4096,
        includeProfileContext: true,
        includeWorkspaceInstructions: true,
        embeddingsProvider: "openai" as "openai" | "local"
      }

      const effectiveChatSettings = {
        ...baseSettings,
        model: normalizeMModel(baseSettings.model) as LLMID
      }

      // Asegurar que el estado use siempre un modelo permitido
      if (!chatSettings || chatSettings.model !== effectiveChatSettings.model) {
        setChatSettings(effectiveChatSettings)
      }

      // Buscar el modelo en la lista de modelos disponibles
      let modelData = [
        ...models.map(model => ({
          modelId: model.model_id as LLMID,
          modelName: model.name,
          provider: "custom" as ModelProvider,
          hostedId: model.id,
          platformLink: "",
          imageInput: false
        })),
        ...LLM_LIST,
        ...availableLocalModels,
        ...availableOpenRouterModels
      ].find(llm => llm.modelId === effectiveChatSettings.model)

      // Si no se encuentra el modelo, usar M1 por defecto
      if (!modelData) {
        modelData = {
          modelId: M1_MODEL_ID as LLMID,
          modelName: "M1",
          provider: "openrouter" as ModelProvider,
          hostedId: M1_MODEL_ID,
          platformLink: "https://openrouter.ai/",
          imageInput: false
        }
      }

      // Validar configuración (sin mostrar errores al usuario)
      try {
        validateChatSettings(
          effectiveChatSettings,
          modelData,
          profile,
          selectedWorkspace,
          messageContent
        )
      } catch (error) {
        console.error("Error en validación:", error)
        // Continuar a pesar del error de validación
      }

      let currentChat = selectedChat ? { ...selectedChat } : null

      const b64Images = newMessageImages.map(image => image.base64)

      let retrievedFileItems: Tables<"file_items">[] = []

      if (
        (newMessageFiles.length > 0 || chatFiles.length > 0) &&
        useRetrieval
      ) {
        setToolInUse("retrieval")

        retrievedFileItems = await handleRetrieval(
          messageContent,
          newMessageFiles,
          chatFiles,
          effectiveChatSettings.embeddingsProvider,
          sourceCount
        )
      }

      console.log("[Chat] 📝 Creando mensajes temporales…")
      const { tempUserChatMessage, tempAssistantChatMessage } =
        createTempMessages(
          messageContent,
          chatMessages,
          effectiveChatSettings,
          b64Images,
          isRegeneration,
          setChatMessages,
          selectedAssistant
        )
      console.log("[Chat] ✅ Mensajes temporales creados. ID Asistente:", tempAssistantChatMessage.message.id)
      
      // Ahora que tenemos el ID, actualizar el streamState
      setStreamState({
        phase: "classifying",
        messageId: tempAssistantChatMessage.message.id,
        textBuffer: "",
        citations: [],
        renderMode: "chat",
        intent: "unknown",
        statusMessage: "Analizando tu consulta legal…",
        progress: 10,
        error: null,
        startedAt: Date.now(),
        completedAt: null
      })
      console.log("[Chat] 🎯 StreamState inicializado")

      let payload: ChatPayload = {
        chatSettings: effectiveChatSettings,
        workspaceInstructions: selectedWorkspace!.instructions || "",
        chatMessages: isRegeneration
          ? [...chatMessages]
          : [...chatMessages, tempUserChatMessage],
        assistant: selectedChat?.assistant_id ? selectedAssistant : null,
        messageFileItems: retrievedFileItems,
        chatFileItems: chatFileItems
      }

      let generatedText = ""
      let bibliography: BibliographyItem[] | undefined

      // Detectar si es un modelo M gestionado por LangChain
      const isManagedMModel = isAllowedMModel(payload.chatSettings.model)
      
      // Handlers para actualizar estado del stream (nuevo protocolo)
      const streamHandlers = {
        onPhaseChange: (phase: string, message: string) => {
          console.log(`[Chat] 🔄 Phase change: ${phase} - ${message}`)
          setStreamPhase(phase as any)
          setStreamMessage(message)
        },
        onComplete: () => {
          console.log("[Chat] ✅ Stream completed")
          setStreamPhase("completed")
          setStreamMessage("Respuesta completa")
        },
        onError: (error: string) => {
          console.log("[Chat] ❌ Stream error:", error)
          setStreamPhase("error")
          setStreamMessage(`Error: ${error}`)
        }
      }
      
      // Usar LangChain Agent para modelos de investigación O si hay tools seleccionadas
      if (isManagedMModel || selectedTools.length > 0) {
        setToolInUse("thinking")
        
        // Usar handleHostedChat que procesa streaming y detecta el modelo automáticamente
        const hostedResult = await handleHostedChat(
          payload,
          profile!,
          modelData!,
          tempAssistantChatMessage,
          isRegeneration,
          newAbortController,
          newMessageImages,
          chatImages,
          setIsGenerating,
          setFirstTokenReceived,
          setChatMessages,
          setToolInUse,
          streamHandlers
        )
        generatedText = hostedResult.text
        bibliography = hostedResult.bibliography
        
        setToolInUse("none")
      } else {
        if (modelData!.provider === "ollama") {
          const localResult = await handleLocalChat(
            payload,
            profile!,
            effectiveChatSettings,
            tempAssistantChatMessage,
            isRegeneration,
            newAbortController,
            setIsGenerating,
            setFirstTokenReceived,
            setChatMessages,
            setToolInUse
          )
          generatedText = localResult.text
          bibliography = localResult.bibliography
        } else {
          const hostedResult = await handleHostedChat(
            payload,
            profile!,
            modelData!,
            tempAssistantChatMessage,
            isRegeneration,
            newAbortController,
            newMessageImages,
            chatImages,
            setIsGenerating,
            setFirstTokenReceived,
            setChatMessages,
            setToolInUse,
            streamHandlers
          )
          generatedText = hostedResult.text
          bibliography = hostedResult.bibliography
        }
      }

      if (!currentChat) {
        currentChat = await handleCreateChat(
          effectiveChatSettings,
          profile!,
          selectedWorkspace!,
          messageContent,
          selectedAssistant!,
          newMessageFiles,
          setSelectedChat,
          setChats,
          setChatFiles
        )
      } else {
        const updatedChat = await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        })

        setChats(prevChats => {
          const updatedChats = prevChats.map(prevChat =>
            prevChat.id === updatedChat.id ? updatedChat : prevChat
          )

          return updatedChats
        })
      }

      await handleCreateMessages(
        chatMessages,
        currentChat,
        profile!,
        modelData!,
        messageContent,
        generatedText,
        newMessageImages,
        isRegeneration,
        retrievedFileItems,
        setChatMessages,
        setChatFileItems,
        setChatImages,
        selectedAssistant,
        bibliography
      )
    } catch (error: any) {
      hasError = true
      console.error("[Chat] 💥 ERROR en handleSendMessage:", error)
      console.error("[Chat] 💥 Stack trace:", error?.stack)
      
      // Solo restaurar el input si el error ocurrió ANTES de crear los mensajes temporales
      // Si ya se crearon los mensajes, el input debe quedar vacío (el usuario ya envió)
      if (!error?.message?.includes("stream") && !error?.message?.includes("processing")) {
        console.log("[Chat] 🔄 Restaurando input por error temprano")
        setUserInput(startingInput)
      } else {
        console.log("[Chat] 📝 Input se mantiene vacío (mensaje ya enviado)")
      }

      // Actualizar estado del stream a error
      setStreamPhase("error")
      setStreamMessage(`Error: ${error?.message || "Error desconocido"}`)
      
      // Mostrar error en consola detallado
      console.error("Error al enviar mensaje:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        cause: error?.cause
      })
    } finally {
      // Siempre resetear el estado al final
      setIsGenerating(false)
      setFirstTokenReceived(false)
      setToolInUse("none")
      // Asegurar que el input quede vacío si todo salió bien
      if (!hasError) {
        console.log("[Chat] 🧹 Limpiando input (no hubo error)")
        setUserInput("")
      }
      console.log("[Chat] 🏁 handleSendMessage finalizado")
    }
  }

  const handleSendEdit = async (
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
      chatMessage => chatMessage.message.sequence_number < sequenceNumber
    )

    setChatMessages(filteredMessages)

    handleSendMessage(editedContent, filteredMessages, false)
  }

  return {
    chatInputRef,
    prompt,
    handleNewChat,
    handleSendMessage,
    handleFocusChatInput,
    handleStopMessage,
    handleSendEdit
  }
}
