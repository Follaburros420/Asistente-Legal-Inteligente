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
import { useParams } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ChatHelp } from "./chat-help"
import { ModelSelectorToggle } from "./model-selector-toggle"
import { useScroll } from "./chat-hooks/use-scroll"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatSecondaryButtons } from "./chat-secondary-buttons"
import { normalizeMModel } from "@/lib/models/m1-models"

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

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      const chatId = params.chatid as string | undefined
      if (!chatId) {
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
  }, [params.chatid])

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

    setChatMessages(fetchedChatMessages)
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
