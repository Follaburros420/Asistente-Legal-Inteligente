import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { FC, useContext, useState } from "react"
import { Message } from "../messages/message"
import { TypingIndicator } from "./modern/TypingIndicator"
import { AnimatePresence } from "framer-motion"

interface ChatMessagesProps {}

export const ChatMessages: FC<ChatMessagesProps> = ({}) => {
  const { chatMessages, chatFileItems, isGenerating, firstTokenReceived } = useContext(ChatbotUIContext)

  const { handleSendEdit } = useChatHandler()

  const [editingMessage, setEditingMessage] = useState<Tables<"messages">>()

  return (
    <>
      {chatMessages
        .sort((a, b) => a.message.sequence_number - b.message.sequence_number)
        .map((chatMessage, index, array) => {
          const messageFileItems = chatFileItems.filter(
            (chatFileItem, _, self) =>
              chatMessage.fileItems.includes(chatFileItem.id) &&
              self.findIndex(item => item.id === chatFileItem.id) === _
          )

          return (
            <Message
              key={chatMessage.message.sequence_number}
              message={chatMessage.message}
              fileItems={messageFileItems}
              bibliography={chatMessage.bibliography}
              isEditing={editingMessage?.id === chatMessage.message.id}
              isLast={index === array.length - 1}
              onStartEdit={setEditingMessage}
              onCancelEdit={() => setEditingMessage(undefined)}
              onSubmitEdit={handleSendEdit}
            />
          )
        })}
      
      {/* Typing Indicator cuando está generando - Solo si no hay mensaje del asistente */}
      <AnimatePresence>
        {isGenerating && !firstTokenReceived && chatMessages.length === 0 && <TypingIndicator />}
      </AnimatePresence>
    </>
  )
}
