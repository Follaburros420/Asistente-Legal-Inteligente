import Loading from "@/app/[locale]/loading"
import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
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
import { BibliographyItem } from "@/types/chat-message"
import { useParams } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ChatHelp } from "./chat-help"
import { ModelSelectorToggle } from "./model-selector-toggle"
import { useScroll } from "./chat-hooks/use-scroll"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatSecondaryButtons } from "./chat-secondary-buttons"

interface ChatUIProps { }

export const ChatUI: FC<ChatUIProps> = ({ }) => {
  useHotkey("o", () => handleNewChat())

  const params = useParams()

  const {
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
    setSelectedTools
  } = useContext(ALIContext)

  const { handleNewChat, handleFocusChatInput } = useChatHandler()

  const {
    messagesStartRef,
    messagesEndRef,
    handleScroll,
    scrollToBottom,
    setIsAtBottom
  } = useScroll()

  const [loading, setLoading] = useState(true)

  const parseBibliographyFromMetadata = (
    metadata: unknown
  ): BibliographyItem[] | undefined => {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return undefined
    }

    const maybeBibliography = (metadata as Record<string, unknown>).bibliography
    if (!Array.isArray(maybeBibliography)) {
      return undefined
    }

    const parsed = maybeBibliography
      .filter(
        item =>
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).title === "string" &&
          typeof (item as Record<string, unknown>).url === "string"
      )
      .map((item, index) => {
        const source = item as Record<string, unknown>
        return {
          id: typeof source.id === "string" ? source.id : `source-${index + 1}`,
          title: source.title as string,
          url: source.url as string,
          type: typeof source.type === "string" ? source.type : "source",
          description:
            typeof source.description === "string" ? source.description : undefined
        } satisfies BibliographyItem
      })

    return parsed.length > 0 ? parsed : undefined
  }

  useEffect(() => {
    const fetchData = async () => {
      await fetchMessages()
      await fetchChat()

      scrollToBottom()
      setIsAtBottom(true)
    }

    if (params.chatid) {
      fetchData().then(() => {
        handleFocusChatInput()
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  const fetchMessages = async () => {
    const fetchedMessages = await getMessagesByChatId(params.chatid as string)

    const imagePromises: Promise<MessageImage>[] = fetchedMessages.flatMap(
      message =>
        message.image_paths
          ? message.image_paths.map(async imagePath => {
            const url = await getMessageImageFromStorage(imagePath)

            return {
              messageId: message.id,
              path: imagePath,
              base64: "", // Lazy load: we don't fetch base64 immediately anymore
              url,
              file: null
            }
          })
          : []
    )

    const images: MessageImage[] = await Promise.all(imagePromises.flat())
    setChatImages(images)

    const messageFileItemPromises = fetchedMessages.map(
      async message => await getMessageFileItemsByMessageId(message.id)
    )

    const messageFileItems = await Promise.all(messageFileItemPromises)

    const uniqueFileItems = messageFileItems.flatMap(item => item.file_items)
    setChatFileItems(uniqueFileItems)

    const chatFiles = await getChatFilesByChatId(params.chatid as string)

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
      const bibliography = parseBibliographyFromMetadata(message.metadata)

      return {
        message,
        ...(bibliography ? { bibliography } : {}),
        fileItems: messageFileItems
          .filter(messageFileItem => messageFileItem.id === message.id)
          .flatMap(messageFileItem =>
            messageFileItem.file_items.map(fileItem => fileItem.id)
          )
      }
    })

    setChatMessages(fetchedChatMessages)
  }

  const fetchChat = async () => {
    const chat = await getChatById(params.chatid as string)
    if (!chat) return

    setSelectedAssistant(null)
    setSelectedTools([])

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

    // Modelos válidos - Solo Gemini
    const validModels = [
      'google/gemini-3-flash-preview',
      'google/gemini-3-pro-preview'
    ]

    // Usar el modelo del chat si es válido, sino usar Gemini 3 Pro por defecto
    // NOTA: Chats antiguos con modelos obsoletos se migran automáticamente a Gemini 3 Pro
    const chatModel = validModels.includes(chat.model)
      ? chat.model
      : 'google/gemini-3-pro-preview'

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
      {/* Header */}
      <div className="px-3 md:px-6 py-3 md:py-4 border-b border-border flex items-center justify-end relative">
        <div className="flex-shrink-0 z-20">
          <ModelSelectorToggle />
        </div>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div ref={messagesStartRef} />
        <ChatMessages />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-3 md:px-6 py-3 md:py-4 border-t border-border">
        <div className="w-full max-w-3xl mx-auto">
          <ChatInput />
        </div>
      </div>

      {/* Help Button */}
      <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
        <ChatHelp />
      </div>
    </div>
  )
}
