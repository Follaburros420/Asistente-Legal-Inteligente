import { useChatHandlerV2 } from "@/components/chat/chat-hooks/use-chat-handler-v2";
import { ALIContext } from "@/context/context";
import { Tables } from "@/supabase/types";
import { FC, useContext, useMemo, useState } from "react";
import { MessageV2 } from "../messages/message-v2";

interface ChatMessagesProps {}

export const ChatMessages: FC<ChatMessagesProps> = ({}) => {
  const { chatMessages, chatFileItems } = useContext(ALIContext);

  const { handleSendEdit } = useChatHandlerV2();

  const [editingMessage, setEditingMessage] = useState<Tables<"messages">>();

  console.log(
    "[ChatMessages] 📊 Rendering with",
    chatMessages.length,
    "messages",
  );

  return (
    <>
      {useMemo(() => {
        return [...chatMessages]
          .sort((a, b) => a.message.sequence_number - b.message.sequence_number)
          .map((chatMessage, index, array) => {
            const messageFileItems = chatFileItems.filter(
              (chatFileItem, _, self) =>
                chatMessage.fileItems.includes(chatFileItem.id) &&
                self.findIndex((item) => item.id === chatFileItem.id) === _,
            );

            return (
              <MessageV2
                key={chatMessage.message.id}
                message={chatMessage.message}
                fileItems={messageFileItems}
                bibliography={chatMessage.bibliography}
                isEditing={editingMessage?.id === chatMessage.message.id}
                isLast={index === array.length - 1}
                onStartEdit={() => setEditingMessage(chatMessage.message)}
                onCancelEdit={() => setEditingMessage(undefined)}
                onSubmitEdit={handleSendEdit}
              />
            );
          });
      }, [chatMessages, chatFileItems, editingMessage, handleSendEdit])}

      {/* El estado de "pensando" se renderiza en el ultimo mensaje del asistente.
          Evita duplicar indicadores durante latencia. */}
    </>
  );
};
