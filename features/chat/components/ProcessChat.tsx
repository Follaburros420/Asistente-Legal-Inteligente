"use client"
import { FC, useEffect, useMemo, useState, useRef } from "react"
import { useChat } from "ai/react"
import { ProcessChatStatus } from "@/components/processes/chat/process-chat-status"
import { ProcessChatMessages } from "@/components/processes/chat/process-chat-messages"
import { ProcessChatEmptyState } from "./ProcessChatEmptyState"
import type { ProcessInsights } from "@/lib/types"
import { buildChatSuggestions } from "@/features/chat/utils/suggestions"
import { ProcessChatInput } from "@/components/processes/chat/process-chat-input"
import { es } from "@/lib/i18n/es"

interface ProcessChatProps {
  processId: string
  processName: string
  indexingStatus: "pending" | "processing" | "ready" | "error"
  chatId: string
  insights?: Partial<ProcessInsights>
}

export const ProcessChat: FC<ProcessChatProps> = ({
  processId,
  processName,
  indexingStatus,
  chatId,
  insights
}) => {
  const [suggestionChips, setSuggestionChips] = useState<string[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isReady = indexingStatus === "ready"

  const suggestionChipsMemo = useMemo(
    () => buildChatSuggestions(insights),
    [insights]
  )

  useEffect(() => {
    setSuggestionChips(suggestionChipsMemo)
  }, [suggestionChipsMemo])

  // Scroll to bottom helper
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setInput } = useChat({
    api: `/api/processes/${processId}/chat`,
    body: {
      chatId,
      processName,
    },
    initialMessages: [],
    onFinish: () => {
      scrollToBottom()
    }
  })

  // Handle custom event for graph suggestions
  useEffect(() => {
    const handleGraphSuggestion = (e: CustomEvent) => {
      const text = e.detail?.text
      if (text && typeof text === "string") {
        setInput(text)
      }
    }

    window.addEventListener("process-chat-suggestion", handleGraphSuggestion as EventListener)
    return () => {
      window.removeEventListener("process-chat-suggestion", handleGraphSuggestion as EventListener)
    }
  }, [setInput])

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  const handleChipClick = (chip: string) => {
    setInput(chip)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ProcessChatStatus indexingStatus={indexingStatus} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <ProcessChatEmptyState
            suggestionChips={suggestionChips}
            onChipClick={handleChipClick}
          />
        ) : (
          <ProcessChatMessages
            messages={messages}
            isLoading={isLoading}
            error={error}
            messagesEndRef={messagesEndRef}
          />
        )}
      </div>

      <ProcessChatInput
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        isReady={isReady}
      />
    </div>
  )
}
