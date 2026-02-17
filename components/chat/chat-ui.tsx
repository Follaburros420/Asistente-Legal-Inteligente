import Loading from "@/app/[locale]/loading"
import { useChatHandlerV2 } from "@/components/chat/chat-hooks/use-chat-handler-v2"
import { ALIContext } from "@/context/context"
import { getAssistantToolsByAssistantId } from "@/db/assistant-tools"
import { getChatFilesByChatId } from "@/db/chat-files"
import { getChatById } from "@/db/chats"
import { getMessageFileItemsByMessageId } from "@/db/message-file-items"
import { getMessagesByChatId } from "@/db/messages"
import { getMessageImageFromStorage } from "@/db/storage/message-images"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLMID, MessageImage } from "@/types"
import { useParams } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ShaderCanvas } from "@/components/shader-canvas"
import { ChatHelp } from "./chat-help"
import { ModelSelectorToggle } from "./model-selector-toggle"
import { useScroll } from "./chat-hooks/use-scroll"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatSecondaryButtons } from "./chat-secondary-buttons"
import { normalizeMModel } from "@/lib/models/m1-models"
import { LangGraphSidebar, LangGraphMiniIndicator } from "@/components/langgraph/LangGraphSidebar"
import { YesNoInterruptModal } from "@/components/langgraph/YesNoInterruptModal"
import { DeepResearchMiniIndicator, DeepResearchProgress } from "@/components/langgraph/DeepResearchProgress"

interface ChatUIProps { }

export const ChatUI: FC<ChatUIProps> = ({ }) => {
  useHotkey("o", () => handleNewChat())

  const params = useParams()

  const {
    chatMessages,
    setChatMessages,
    selectedChat,
    setSelectedChat,
    setChatSettings,
    setChatImages,
    assistants,
    setSelectedAssistant,
    setChatFileItems,
    setChatFiles,
    setShowFilesDisplay,
    setUseRetrieval,
    setSelectedTools,
    streamPhase,
    // LangGraph state
    langGraphInterrupt,
    setLangGraphInterrupt,
    langGraphThreadId
  } = useContext(ALIContext)

  const { handleNewChat, handleFocusChatInput } = useChatHandlerV2()

  const {
    messagesStartRef,
    messagesEndRef,
    handleScroll,
    scrollToBottom,
    setIsAtBottom
  } = useScroll()

  const [loading, setLoading] = useState(true)
  const [selectedShader, setSelectedShader] = useState(1)

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem("selectedShader")
    if (saved) setSelectedShader(parseInt(saved, 10))
    const onShaderChanged = (e: CustomEvent<number>) => setSelectedShader(e.detail)
    window.addEventListener("shaderChanged", onShaderChanged as EventListener)
    return () => window.removeEventListener("shaderChanged", onShaderChanged as EventListener)
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      const chatId = params.chatid as string | undefined
      if (!chatId) {
        if (!cancelled) setLoading(false)
        return
      }

      // NO recargar mensajes si estamos procesando un mensaje activo
      // Esto evita que los mensajes locales se sobrescriban con los de BD
      if (streamPhase !== "idle" && streamPhase !== "completed" && streamPhase !== "error") {
        console.log("[ChatUI] ⏸️ Skipping fetchMessages - active stream in progress:", streamPhase)
        if (!cancelled) setLoading(false)
        return
      }

      if (!cancelled) setLoading(true)

      try {
        await fetchMessages(chatId)
        await fetchChat(chatId)

        if (!cancelled) {
          scrollToBottom()
          setIsAtBottom(true)
          handleFocusChatInput()
        }
      } catch (error) {
        console.error("Error loading chat UI data:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [params.chatid]) // Solo depende de params.chatid, streamPhase se lee dentro

  const fetchMessages = async (chatId: string) => {
    const fetchedMessages = await getMessagesByChatId(chatId)

    const imagePromises: Promise<MessageImage | null>[] = fetchedMessages.flatMap(
      message =>
        message.image_paths
          ? message.image_paths.map(async imagePath => {
            try {
              const url = await getMessageImageFromStorage(imagePath)

              return {
                messageId: message.id,
                path: imagePath,
                base64: "", // Lazy load: we don't fetch base64 immediately anymore
                url,
                file: null
              }
            } catch (error) {
              console.warn(`Skipping image ${imagePath} due to load error`, error)
              return null
            }
          })
          : []
    )

    const images = (await Promise.all(imagePromises.flat())).filter(Boolean) as MessageImage[]
    setChatImages(images)

    const messageFileItemSettled = await Promise.allSettled(
      fetchedMessages.map(async message => await getMessageFileItemsByMessageId(message.id))
    )

    const messageFileItems = messageFileItemSettled
      .filter(
        (
          item
        ): item is PromiseFulfilledResult<Awaited<ReturnType<typeof getMessageFileItemsByMessageId>>> =>
          item.status === "fulfilled"
      )
      .map(item => item.value)

    const uniqueFileItems = messageFileItems.flatMap(item => item.file_items)
    setChatFileItems(uniqueFileItems)

    const chatFiles = await getChatFilesByChatId(chatId)

    setChatFiles(
      chatFiles.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        file: null
      }))
    )

    setUseRetrieval(true)
    setShowFilesDisplay(true)

    const fetchedChatMessages = fetchedMessages.map(message => {
      return {
        message,
        fileItems: messageFileItems
          .filter(messageFileItem => messageFileItem.id === message.id)
          .flatMap(messageFileItem =>
            messageFileItem.file_items.map(fileItem => fileItem.id)
          )
      }
    })

    // Merge con mensajes locales para no perder mensajes no guardados aún
    console.log("[ChatUI] 🔄 fetchMessages - mensajes de BD:", fetchedChatMessages.length)
    
    setChatMessages(prevMessages => {
      console.log("[ChatUI] 🔄 setChatMessages callback - prev:", prevMessages.length, "fetched:", fetchedChatMessages.length)
      
      // Si tenemos mensajes locales y la BD está vacía o tiene menos, mantener locales
      if (prevMessages.length > 0 && fetchedChatMessages.length === 0) {
        console.log("[ChatUI] ⚠️ BD vacía pero hay mensajes locales, manteniendo locales")
        return prevMessages
      }
      
      // Si tenemos más mensajes locales que en BD, hay algo nuevo que aún no se guardó
      if (prevMessages.length > fetchedChatMessages.length) {
        console.log("[ChatUI] ⚠️ Más mensajes locales que en BD, haciendo merge conservador")
        // Solo agregar mensajes locales que no estén en BD
        const fetchedIds = new Set(fetchedMessages.map(m => m.id))
        const localOnlyMessages = prevMessages.filter(pm => !fetchedIds.has(pm.message.id))
        
        if (localOnlyMessages.length > 0) {
          const merged = [...fetchedChatMessages, ...localOnlyMessages].sort(
            (a, b) => a.message.sequence_number - b.message.sequence_number
          )
          console.log("[ChatUI] ✅ Mergeado conservador:", merged.length, "mensajes")
          return merged
        }
      }
      
      if (prevMessages.length === 0) {
        console.log("[ChatUI] 🔄 No hay mensajes previos, usando BD")
        return fetchedChatMessages
      }
      
      // Caso normal: misma cantidad o más en BD
      console.log("[ChatUI] 🔄 Usando mensajes de BD:", fetchedChatMessages.length)
      return fetchedChatMessages
    })
  }

  const fetchChat = async (chatId: string) => {
    const chat = await getChatById(chatId)
    if (!chat) return

    if (chat.assistant_id) {
      const assistant = assistants.find(
        assistant => assistant.id === chat.assistant_id
      )

      if (assistant) {
        setSelectedAssistant(assistant)

        const assistantTools = (
          await getAssistantToolsByAssistantId(assistant.id)
        ).tools
        setSelectedTools(assistantTools)
      }
    }

    setSelectedChat(chat)

    const chatModel = normalizeMModel(chat.model)

    setChatSettings({
      model: chatModel as LLMID,
      prompt: chat.prompt,
      temperature: chat.temperature,
      contextLength: chat.context_length,
      includeProfileContext: chat.include_profile_context,
      includeWorkspaceInstructions: chat.include_workspace_instructions,
      embeddingsProvider: chat.embeddings_provider as "openai" | "local" | "openrouter"
    })
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-background via-background to-primary/20 overflow-hidden">
      {/* Header: surface semitransparente + blur, sin border */}
      <header
        className="flex-shrink-0 px-2 py-2.5 sm:px-3 md:px-6 md:py-4 pt-[max(0.5rem,env(safe-area-inset-top))] flex items-center justify-between relative bg-background/60 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.18)]"
        role="banner"
      >
        <div className="flex items-center gap-2">
          <LangGraphMiniIndicator />
          <DeepResearchMiniIndicator />
        </div>
        <div className="flex-shrink-0 z-20">
          <ModelSelectorToggle />
        </div>
      </header>

      {/* Main Content - Padding inferior para dejar espacio al input flotante */}
      <div
        className="flex-1 min-h-0 overflow-auto pb-32 md:pb-28"
        onScroll={handleScroll}
      >
        {chatMessages.length === 0 ? (
          <div className="flex flex-1 min-h-full items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-2xl text-center">
              <div className="flex justify-center mb-6 md:mb-8">
                <ShaderCanvas size={100} shaderId={selectedShader} />
              </div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl text-foreground font-light">
                ¿En qué puedo ayudarte hoy?
              </h1>
            </div>
          </div>
        ) : (
          <>
            <div ref={messagesStartRef} />
            <ChatMessages />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area: Sin fondo/banda, glassmorphism aplicado directo en el input */}
      <div
        className="fixed z-50 w-full px-4 sm:px-6 md:px-8 
                   /* Móvil: pegado abajo con safe-area | Desktop: flotante con margen */
                   bottom-0 md:bottom-6 
                   pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-0
                   /* Sin fondo ni sombra - la barra trae su propio glassmorphism */
                   bg-transparent"
        role="region"
        aria-label="Área de escritura del chat"
      >
        <div className="w-full max-w-3xl mx-auto">
          <ChatInput />
        </div>
      </div>

      {/* Help Button */}
      <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
        <ChatHelp />
      </div>

      {/* LangGraph Sidebar */}
      <LangGraphSidebar />

      {/* LangGraph Interrupt Modal */}
      {langGraphInterrupt && (
        <YesNoInterruptModal
          payload={langGraphInterrupt}
          onSubmit={async (answers) => {
            // Resume the LangGraph pipeline with the answers
            try {
              const response = await fetch("/api/langgraph/resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  threadId: langGraphThreadId,
                  answers
                })
              })
              
              if (!response.ok) {
                throw new Error(`API error: ${response.status}`)
              }
              
              setLangGraphInterrupt(null)
            } catch (error) {
              console.error("Error resuming LangGraph:", error)
            }
          }}
          onCancel={() => setLangGraphInterrupt(null)}
          isOpen={true}
        />
      )}
    </div>
  )
}
