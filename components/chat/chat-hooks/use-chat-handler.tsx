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
    setShowSuggestedQuestions
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
        model: selectedAssistant.model as LLMID,
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
        model: selectedPreset.model as LLMID,
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
  }

  const handleSendMessage = async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    const startingInput = messageContent

    try {
      // Validaciones básicas sin mostrar errores al usuario
      if (!messageContent || messageContent.trim() === "") {
        console.log("Mensaje vacío, ignorando")
        return
      }

      if (!selectedWorkspace) {
        console.error("No hay workspace seleccionado")
        return
      }

      setUserInput("")
      setIsGenerating(true)
      setIsPromptPickerOpen(false)
      setIsFilePickerOpen(false)
      setNewMessageImages([])

      const newAbortController = new AbortController()
      setAbortController(newAbortController)

      // Crear chatSettings por defecto si es null - Usar M1 (Gemini 3 Pro) por defecto
      const effectiveChatSettings = chatSettings || {
        model: "google/gemini-3-pro-preview" as LLMID,
        prompt: profile?.default_prompt || "Eres un asistente legal inteligente especializado en derecho colombiano.",
        temperature: profile?.default_temperature ?? 0.3,
        contextLength: profile?.default_context_length ?? 4096,
        includeProfileContext: true,
        includeWorkspaceInstructions: true,
        embeddingsProvider: "openai" as "openai" | "local"
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

      // Si no se encuentra el modelo, usar Gemini 3 Pro Preview por defecto (M1)
      if (!modelData) {
        console.log('[ChatHandler] Modelo no encontrado, usando Gemini 3 Pro por defecto')
        modelData = {
          modelId: "google/gemini-3-pro-preview" as LLMID,
          modelName: "Gemini 3 Pro Preview",
          provider: "google" as ModelProvider,
          hostedId: "google/gemini-3-pro-preview",
          platformLink: "https://ai.google.dev/",
          imageInput: true
        }
      }

      const resolvedChatSettings = {
        ...effectiveChatSettings,
        model: modelData.modelId as LLMID
      }

      if (chatSettings?.model !== resolvedChatSettings.model) {
        setChatSettings(resolvedChatSettings)
        console.log('[ChatHandler] chatSettings resuelto:', resolvedChatSettings.model)
      }

      // Validar configuración (sin mostrar errores al usuario)
      try {
        validateChatSettings(
          resolvedChatSettings,
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

        // Usar messageContent (el parámetro de entrada) en lugar de userInput que ya se limpió
        retrievedFileItems = await handleRetrieval(
          messageContent,
          newMessageFiles,
          chatFiles,
          resolvedChatSettings.embeddingsProvider,
          sourceCount
        )
      }

      const { tempUserChatMessage, tempAssistantChatMessage } =
        createTempMessages(
          messageContent,
          chatMessages,
          resolvedChatSettings,
          b64Images,
          isRegeneration,
          setChatMessages,
          selectedAssistant
        )

      // Construir payload con el historial de mensajes correcto
      const messageHistoryForPayload = isRegeneration
        ? [...chatMessages]
        : [...chatMessages, tempUserChatMessage]

      console.log('[ChatHandler] Payload construido:', {
        messageCount: messageHistoryForPayload.length,
        lastMessageRole: messageHistoryForPayload[messageHistoryForPayload.length - 1]?.message?.role,
        lastMessageContent: messageHistoryForPayload[messageHistoryForPayload.length - 1]?.message?.content?.substring(0, 50)
      })

      let payload: ChatPayload = {
        chatSettings: resolvedChatSettings,
        workspaceInstructions: selectedWorkspace!.instructions || "",
        chatMessages: messageHistoryForPayload,
        assistant: selectedAssistant || null,
        messageFileItems: retrievedFileItems,
        chatFileItems: chatFileItems
      }

      let generatedText = ""
      let bibliography: BibliographyItem[] | undefined

      // Detectar si es un modelo que debe usar LangChain
      const modelId = payload.chatSettings.model?.toLowerCase() || ''
      const isResearchModel = modelId.includes('gemini') // Todos los modelos Gemini usan LangChain
      
      console.log('[ChatHandler] Enviando mensaje:', {
        model: modelId,
        isResearchModel,
        toolsCount: selectedTools.length,
        messageLength: messageContent.length,
        chatHistoryLength: chatMessages.length
      })
      
      // Usar LangChain Agent para modelos de investigación O si hay tools seleccionadas
      if (isResearchModel || selectedTools.length > 0) {
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
          setToolInUse
        )
        generatedText = hostedResult.text
        bibliography = hostedResult.bibliography
        
        setToolInUse("none")
      } else {
        if (modelData!.provider === "ollama") {
          const localResult = await handleLocalChat(
            payload,
            profile!,
            resolvedChatSettings,
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
            setToolInUse
          )
          generatedText = hostedResult.text
          bibliography = hostedResult.bibliography
        }
      }

      if (!currentChat) {
        currentChat = await handleCreateChat(
          resolvedChatSettings,
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
      // Restaurar el input del usuario para que pueda reintentar
      setUserInput(startingInput)

      // Log del error para depuración
      console.error("[ChatHandler] Error al enviar mensaje:", error?.message || error)

      // Mostrar error al usuario solo si es un error crítico
      const errorMessage = error?.message || "Error desconocido"
      
      if (errorMessage.includes("API key") || errorMessage.includes("autenticación")) {
        toast.error("Error de autenticación con el servicio de IA")
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("límite")) {
        toast.error("Has alcanzado el límite de consultas. Intenta más tarde.")
      } else if (errorMessage.includes("network") || errorMessage.includes("conexión")) {
        toast.error("Error de conexión. Verifica tu internet e intenta de nuevo.")
      }
      // Otros errores se manejan silenciosamente para no interrumpir la UX
    } finally {
      // Siempre resetear el estado al final
      setIsGenerating(false)
      setFirstTokenReceived(false)
      setToolInUse("none")
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
